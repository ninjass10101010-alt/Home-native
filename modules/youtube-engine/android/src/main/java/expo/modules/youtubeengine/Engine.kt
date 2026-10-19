package expo.modules.youtubeengine

object Engine {
  fun search(query: String, limit: Int): List<Map<String, Any?>> = emptyList()
  fun resolveAudio(id: String): Map<String, Any?> =
    throw IllegalStateException("resolveAudio not implemented")
  fun related(id: String): List<Map<String, Any?>> = emptyList()
}