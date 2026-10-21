package expo.modules.youtubeengine

import okhttp3.OkHttpClient
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.AudioStream
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import java.util.concurrent.TimeUnit

private val AUDIO_ITAG_PREFERENCE = listOf(140, 251, 139, 249)

object Engine {
  @Volatile private var initialized = false

  /**
   * True when the last search read YouTube's explicit badge.
   *
   * NewPipe exposes no badge, so a NewPipe-backed search leaves the ratings
   * UNKNOWN — the JS side then fails closed and hides the tracks.
   */
  @Volatile var explicitRatingsKnown: Boolean = false
    private set

  private val httpClient: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(20, TimeUnit.SECONDS)
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

  private fun StreamInfoItem.toTrack(): Map<String, Any?> = mapOf(
    "id" to youtubeId(),
    "title" to name,
    "artist" to uploaderName,
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
   * Searches YouTube Music for tracks.
   *
   * Returns `{ tracks, explicitKnown }`. The badge path (innertube) is
   * authoritative for ratings; when it fails, NewPipe still answers the search
   * but the ratings are unknown (`explicit` is null, `explicitKnown` false).
   */
  fun search(query: String, limit: Int): Map<String, Any?> {
    ensureInit()
    val badgeTracks = runCatching { MusicSearch.search(query, limit, httpClient) }.getOrNull()
    if (!badgeTracks.isNullOrEmpty()) {
      explicitRatingsKnown = true
      return mapOf("tracks" to badgeTracks, "explicitKnown" to true)
    }
    explicitRatingsKnown = false
    return mapOf("tracks" to searchViaNewPipe(query, limit), "explicitKnown" to false)
  }

  private fun searchViaNewPipe(query: String, limit: Int): List<Map<String, Any?>> {
    val extractor = ServiceList.YouTube.getSearchExtractor(query)
    extractor.fetchPage()
    val page = extractor.initialPage
    return page.items
      .filterIsInstance<StreamInfoItem>()
      .map { it.toTrack() }
      .filter { (it["id"] as? String).orEmpty().length == 11 }
      .take(limit.coerceIn(1, 25))
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
      .map { it.toTrack() }
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
