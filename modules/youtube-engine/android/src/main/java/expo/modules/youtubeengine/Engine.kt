package expo.modules.youtubeengine

import android.util.Log
import expo.modules.kotlin.Promise
import kotlinx.coroutines.CancellationException
import okhttp3.OkHttpClient
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.AudioStream
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import java.util.concurrent.Callable
import java.util.concurrent.ExecutionException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicInteger

private val AUDIO_ITAG_PREFERENCE = listOf(140, 251, 139, 249)

object Engine {
  private const val TAG = "YoutubeEngine"
  private const val ERROR_CODE = "ERR_YOUTUBE_ENGINE"

  /**
   * The badge (innertube) client's timeouts, in seconds.
   *
   * The badge path is the only source of explicit ratings, so when YouTube
   * stops answering it the search degrades to NewPipe — and NewPipe's ratings
   * are unknown. A slow dead client must not hold the app hostage while it
   * times out, so these are short.
   */
  internal const val BADGE_CONNECT_TIMEOUT_SECONDS = 5L
  internal const val BADGE_READ_TIMEOUT_SECONDS = 8L

  /**
   * The NewPipe transport's timeouts, in seconds.
   *
   * This transport also carries the playback resolution (`StreamInfo.getInfo`
   * makes two to three sequential requests), and a resolution that used to
   * succeed on a slow link must not start failing: so these stay generous.
   * The short timeouts above belong to the badge client alone.
   */
  internal const val DOWNLOADER_CONNECT_TIMEOUT_SECONDS = 10L
  internal const val DOWNLOADER_READ_TIMEOUT_SECONDS = 20L

  /**
   * The fallback search's own deadline, in seconds.
   *
   * The transport is generous (playback needs it), so the deadline lives on
   * the fallback path alone: the degraded search gives up instead of holding
   * the app hostage.
   */
  internal const val FALLBACK_SEARCH_TIMEOUT_SECONDS = 10L

  @Volatile private var initialized = false

  private val threadCounter = AtomicInteger(0)

  /**
   * The engine's own threads.
   *
   * Every `AsyncFunction` body runs on ONE HandlerThread that the whole app
   * shares ("expo.modules.AsyncFunctionQueue"), so a blocking network call
   * there stalls every other native call for as long as it takes. The engine
   * runs its network work on a pool of its own instead: a rotten client
   * version can then only ever delay the engine itself.
   *
   * Two threads, so a stalled search never blocks a playback resolution (and
   * the other way round).
   */
  private val engineExecutor: ExecutorService = Executors.newFixedThreadPool(2) { runnable ->
    Thread(runnable, "youtube-engine-${threadCounter.incrementAndGet()}").apply {
      isDaemon = true
    }
  }

  /**
   * The thread the fallback search runs on.
   *
   * The fallback is bounded by a deadline, so it may not sit on an engine
   * thread that a playback resolution is using — and it may not be able to
   * block one either.
   */
  private val fallbackExecutor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "youtube-engine-fallback").apply {
      isDaemon = true
    }
  }

  /**
   * The badge client, tuned for a search that must fail fast.
   *
   * The badge path is the only source of explicit ratings, so when YouTube
   * stops answering it the search degrades to NewPipe — and NewPipe's ratings
   * are unknown. A slow dead client must not hold the app hostage while it
   * times out, so the timeouts are short.
   */
  private val badgeClient: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(BADGE_CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    .readTimeout(BADGE_READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    .build()

  /**
   * The artwork client's timeouts, in seconds.
   *
   * The stage's tint is a nicety, not a contract: a slow thumbnail must not
   * hold an engine thread (and with it a playback resolution) for long, so
   * these are short and the tint simply falls back to the accent token.
   */
  internal const val ARTWORK_CONNECT_TIMEOUT_SECONDS = 5L
  internal const val ARTWORK_READ_TIMEOUT_SECONDS = 8L

  /**
   * The client that fetches the artwork.
   *
   * Its own client, not the badge one: the artwork is a different host and a
   * different job, and a stalled thumbnail must not spend the badge
   * client's budget.
   */
  private val artworkClient: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(ARTWORK_CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    .readTimeout(ARTWORK_READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    .build()

  private fun ensureInit() {
    if (initialized) return
    synchronized(this) {
      if (!initialized) {
        NewPipe.init(NewPipeDownloader())
        initialized = true
      }
    }
  }

  /**
   * The fail-closed fallback mapping.
   *
   * NewPipe exposes no explicit badge, so every track on this path has an
   * UNKNOWN rating (`explicit = null`) — the family-safe filter then hides
   * them instead of guessing. Pure, so the contract is unit-testable.
   */
  fun mapFallbackTracks(items: List<StreamInfoItem>): List<Map<String, Any?>> =
    items.map { it.toFallbackTrack() }

  /**
   * The whole fallback answer: the tracks plus the "ratings unknown" flag.
   */
  fun fallbackResult(items: List<StreamInfoItem>): Map<String, Any?> =
    mapOf("tracks" to mapFallbackTracks(items), "explicitKnown" to false)

  private fun StreamInfoItem.toFallbackTrack(): Map<String, Any?> = mapOf(
    "id" to youtubeId(),
    "title" to name,
    "artist" to (uploaderName ?: ""),
    "album" to "",
    "durationSeconds" to duration.coerceAtLeast(0L),
    "artworkUrl" to thumbnails.firstOrNull()?.url,
    // Ratings UNKNOWN on this path — kids fail closed.
    "explicit" to null,
    "source" to "youtube_music"
  )

  private fun StreamInfoItem.youtubeId(): String =
    url.substringAfter("v=", "").substringBefore("&")

  /**
   * Runs a blocking engine call on the engine's own thread and settles the
   * promise there.
   *
   * The promise is settled on the engine thread, so Expo's shared queue is
   * free again the moment this returns — the network call never sits on it.
   *
   * The promise ALWAYS settles. A failure is a rejected promise, a
   * cancellation is a rejected promise, and so is an `Error`: an `Error` is a
   * bug, not a search failure, so it is rethrown (the crash semantics stay)
   * — but only after the rejection, because a promise nobody settles hangs
   * the caller forever.
   */
  internal fun onEngineThread(promise: Promise, block: () -> Any?) {
    try {
      engineExecutor.execute {
        try {
          promise.resolve(block())
        } catch (cancellation: CancellationException) {
          promise.reject(ERROR_CODE, "youtube_engine_cancelled", cancellation)
        } catch (error: Exception) {
          promise.reject(ERROR_CODE, "youtube_engine_failed", error)
        } catch (error: Throwable) {
          promise.reject(ERROR_CODE, "youtube_engine_failed", error)
          throw error
        }
      }
    } catch (rejected: RejectedExecutionException) {
      promise.reject(ERROR_CODE, "youtube_engine_rejected", rejected)
    }
  }

  /**
   * Searches YouTube Music for tracks, off Expo's shared async queue.
   */
  fun searchAsync(query: String, limit: Int, promise: Promise) =
    onEngineThread(promise) { search(query, limit) }

  /**
   * Resolves an audio stream, off Expo's shared async queue.
   */
  fun resolveAudioAsync(id: String, promise: Promise) =
    onEngineThread(promise) { resolveAudio(id) }

  /**
   * Loads related tracks, off Expo's shared async queue.
   */
  fun relatedAsync(id: String, promise: Promise) =
    onEngineThread(promise) { related(id) }

  /**
   * Reads the artwork's own colours, off Expo's shared async queue.
   */
  fun artworkColorsAsync(url: String, promise: Promise) =
    onEngineThread(promise) { artworkColors(url) }

  /**
   * The dominant and vibrant colours of the artwork at [url].
   *
   * `{ dominant, vibrant }` — either may be null. The extraction never
   * throws and never invents a colour: a failure answers with two nulls and
   * the app falls back to its accent token.
   *
   * The artwork thumbnails are PUBLIC (they are the same URLs the cover
   * image is loaded from), so the signed-stream rule does not apply here —
   * but the no-logging discipline still does: the URL and the bytes never
   * reach logcat.
   */
  fun artworkColors(url: String): Map<String, Any?> {
    val colors = ArtworkColors.extract(url, artworkClient)
    return mapOf(
      "dominant" to colors["dominant"],
      "vibrant" to colors["vibrant"]
    )
  }

  /**
   * Searches YouTube Music for tracks.
   *
   * Returns `{ tracks, explicitKnown }`. The badge path (innertube) is
   * authoritative for ratings; when it fails, NewPipe still answers the search
   * but the ratings are unknown (`explicit` is null, `explicitKnown` false).
   */
  fun search(query: String, limit: Int): Map<String, Any?> {
    ensureInit()
    val badgeTracks = try {
      MusicSearch.search(query, limit, badgeClient)
    } catch (cancellation: CancellationException) {
      // A cancellation is not a search failure — it must not be swallowed.
      throw cancellation
    } catch (error: Exception) {
      // Reason/status only: no body, no URL, no query string, no token.
      Log.w(TAG, "innertube search failed: ${MusicSearch.reasonFor(error)}")
      null
    }
    if (!badgeTracks.isNullOrEmpty()) {
      return mapOf("tracks" to badgeTracks, "explicitKnown" to true)
    }
    val fallback = try {
      searchViaNewPipe(query, limit)
    } catch (cancellation: CancellationException) {
      throw cancellation
    } catch (error: Exception) {
      Log.w(TAG, "newpipe search failed: ${reasonFor(error)}")
      emptyList()
    }
    return fallbackResult(fallback)
  }

  /**
   * The degraded search: NewPipe, on a deadline.
   *
   * The transport is generous because the playback resolution needs it, so
   * the deadline lives HERE — on the fallback path alone. The caller waits
   * at most [FALLBACK_SEARCH_TIMEOUT_SECONDS] for the degraded answer and
   * gets an empty one after that, instead of waiting out the transport's
   * own (much longer) timeouts.
   */
  private fun searchViaNewPipe(query: String, limit: Int): List<StreamInfoItem> {
    val task = fallbackExecutor.submit(
      Callable<List<StreamInfoItem>> {
        // A previous timeout may have left an interrupt behind; drop it, so
        // it cannot fail this search.
        Thread.interrupted()
        val extractor = ServiceList.YouTube.getSearchExtractor(query)
        extractor.fetchPage()
        extractor.initialPage.items
          .filterIsInstance<StreamInfoItem>()
          .filter { it.youtubeId().length == 11 }
          .take(limit.coerceIn(1, 25))
      }
    )
    return try {
      task.get(FALLBACK_SEARCH_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    } catch (timeout: TimeoutException) {
      // The degraded search gives up rather than holding the app hostage.
      task.cancel(true)
      Log.w(TAG, "newpipe search timed out")
      emptyList()
    } catch (interrupted: InterruptedException) {
      task.cancel(true)
      Thread.currentThread().interrupt()
      throw interrupted
    } catch (failure: ExecutionException) {
      val cause = failure.cause
      if (cause is Exception) throw cause
      throw RuntimeException(cause ?: failure)
    }
  }

  /**
   * A log-safe reason for a failure.
   *
   * Only our own reasons (a status token such as `innertube_search_http_403`)
   * are echoed; anything else is reduced to the exception's type, so no body,
   * URL, query string or token can reach logcat.
   */
  private fun reasonFor(error: Exception): String {
    val message = error.message
    if (message != null && message.startsWith(MusicSearch.REASON_PREFIX)) return message
    return "search_failed_" + error.javaClass.simpleName.lowercase()
  }

  private fun pickAudio(streams: List<AudioStream>): AudioStream? {
    for (itag in AUDIO_ITAG_PREFERENCE) {
      streams.firstOrNull { it.itag == itag }?.let { return it }
    }
    return streams.maxByOrNull { it.averageBitrate }
  }

  fun related(id: String): List<Map<String, Any?>> {
    ensureInit()
    val info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=$id")
    return info.relatedStreams
      .filterIsInstance<StreamInfoItem>()
      .map { it.toFallbackTrack() }
      .filter { (it["id"] as? String).orEmpty().length == 11 }
      .take(25)
  }

  fun resolveAudio(id: String): Map<String, Any?> {
    ensureInit()
    val info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=$id")
    val chosen = pickAudio(info.audioStreams)
      ?: throw IllegalStateException("no_audio_stream")
    return mapOf(
      "url" to chosen.url,
      "mimeType" to (chosen.format?.mimeType ?: "audio/mp4").substringBefore(";").trim(),
      "contentLength" to null,
      "durationSeconds" to info.duration.takeIf { it >= 0L },
      "expiresAt" to (System.currentTimeMillis() + 6 * 60 * 60 * 1000L)
    )
  }
}
