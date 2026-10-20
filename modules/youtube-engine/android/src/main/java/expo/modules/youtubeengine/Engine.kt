package expo.modules.youtubeengine

import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.AudioStream
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.StreamInfoItem

private val AUDIO_ITAG_PREFERENCE = listOf(140, 251, 139, 249)

object Engine {
  @Volatile private var initialized = false

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
    "explicit" to false,
    "source" to "youtube_music"
  )

  private fun StreamInfoItem.youtubeId(): String =
    url.substringAfter("v=", "").substringBefore("&")

  fun search(query: String, limit: Int): List<Map<String, Any?>> {
    ensureInit()
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
