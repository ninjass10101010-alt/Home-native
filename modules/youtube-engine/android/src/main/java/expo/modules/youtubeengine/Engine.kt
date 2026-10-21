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
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

private val AUDIO_ITAG_PREFERENCE = listOf(140, 251, 139, 249)

object Engine {
  private const val TAG = "YoutubeEngine"
  private const val ERROR_CODE = "ERR_YOUTUBE_ENGINE"

  /** Connect timeout of the engine's HTTP clients, in seconds. */
  internal const val CONNECT_TIMEOUT_SECONDS = 5L

  /** Read timeout of the engine's HTTP clients, in seconds. */
  internal const val READ_TIMEOUT_SECONDS = 8L

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
   * The innertube client, tuned for a search that must fail fast.
   *
   * The badge path is the only source of explicit ratings, so when YouTube
   * stops answering it the search degrades to NewPipe — and NewPipe's ratings
   * are unknown. A slow dead client must not hold the app hostage while it
   * times out, so the timeouts are short.
   */
  private val httpClient: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    .readTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
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
   * Only `Exception` is caught: an `Error` is a bug, not a search failure,
   * and swallowing it would hide it. A cancellation is settled (rejected)
   * rather than dropped, so the caller is never left waiting forever.
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
   * Searches YouTube Music for tracks.
   *
   * Returns `{ tracks, explicitKnown }`. The badge path (innertube) is
   * authoritative for ratings; when it fails, NewPipe still answers the search
   * but the ratings are unknown (`explicit` is null, `explicitKnown` false).
   */
  fun search(query: String, limit: Int): Map<String, Any?> {
    ensureInit()
    val badgeTracks = try {
      MusicSearch.search(query, limit, httpClient)
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

  private fun searchViaNewPipe(query: String, limit: Int): List<StreamInfoItem> {
    val extractor = ServiceList.YouTube.getSearchExtractor(query)
    extractor.fetchPage()
    return extractor.initialPage.items
      .filterIsInstance<StreamInfoItem>()
      .filter { it.youtubeId().length == 11 }
      .take(limit.coerceIn(1, 25))
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
