package expo.modules.youtubeengine

import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.StreamInfoItem

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

  fun related(id: String): List<Map<String, Any?>> = emptyList()

  fun resolveAudio(id: String): Map<String, Any?> =
    throw IllegalStateException("resolveAudio not implemented")
}
