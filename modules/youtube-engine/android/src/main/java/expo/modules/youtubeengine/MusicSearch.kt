package expo.modules.youtubeengine

import com.grack.nanojson.JsonArray
import com.grack.nanojson.JsonObject
import com.grack.nanojson.JsonParser
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

/**
 * YouTube Music search over innertube.
 *
 * NewPipe's extractor exposes no explicit badge, so the ratings the family-safe
 * filter needs are read here, straight from YouTube's own `MUSIC_EXPLICIT_BADGE`
 * marker. NewPipe keeps doing stream resolution only.
 *
 * Every read below tolerates absence: YouTube reshapes these payloads often, and
 * a missing field must degrade the result, never crash the search.
 */
object MusicSearch {
  private const val ENDPOINT = "https://www.youtube.com/youtubei/v1/search?prettyPrint=false"

  /** YouTube Music's web client — the one that answers with music results. */
  private const val CLIENT_NAME = "WEB_REMIX"
  private const val CLIENT_VERSION = "1.20241010.01.00"
  private const val CLIENT_ID = "67"
  private const val USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

  /** Innertube filter for the music search surface. */
  private const val SEARCH_PARAMS = "EgWKAQ"

  /** YouTube's marker for an explicit track. */
  private const val EXPLICIT_MARKER = "EXPLICIT"

  private val JSON_MEDIA_TYPE = "application/json".toMediaType()

  /** The item kinds YouTube prints in the second column ("Song • Eminem"). */
  private val ITEM_KINDS = setOf(
    "song", "video", "album", "single", "episode", "playlist", "artist",
    "profile", "podcast", "audiobook", "station", "movie", "clip", "show"
  )

  /** True when the item's badge subtree carries YouTube's explicit marker. */
  fun hasExplicitBadge(item: JsonObject): Boolean {
    val badges = item["badges"] ?: return false
    return containsExplicitMarker(badges)
  }

  /** Every music song item in the response, found by shape, not by path. */
  fun collectMusicItems(root: JsonObject): List<JsonObject> {
    val out = mutableListOf<JsonObject>()
    fun walk(node: Any?) {
      when (node) {
        is JsonObject -> {
          val item = node["musicResponsiveListItemRenderer"]
          if (item is JsonObject) out += item
          node.values.forEach { walk(it) }
        }
        is JsonArray -> node.forEach { walk(it) }
      }
    }
    walk(root)
    return out
  }

  /** One track, or null when the item is not a playable song. */
  fun trackFrom(item: JsonObject): Map<String, Any?>? {
    val id = videoId(item) ?: return null
    val title = columnText(item, 0) ?: return null
    return mapOf(
      "id" to id,
      "title" to title,
      "artist" to artistOf(item),
      "album" to "",
      "durationSeconds" to durationSeconds(item),
      "artworkUrl" to thumbnailUrl(item),
      "explicit" to hasExplicitBadge(item),
      "source" to "youtube_music"
    )
  }

  /**
   * Every playable track in the response, official songs first.
   *
   * YouTube answers with a "top result" card (often a user upload) before the
   * song list; ranking keeps the official tracks — the ones that actually carry
   * badges — on top. The sort is stable, so YouTube's own order is kept within
   * a kind.
   */
  fun parseTracks(json: JsonObject): List<Map<String, Any?>> =
    collectMusicItems(json)
      .sortedBy { rank(it) }
      .mapNotNull { trackFrom(it) }

  /** Searches YouTube Music and returns the tracks it found. */
  fun search(query: String, limit: Int, client: OkHttpClient): List<Map<String, Any?>> {
    val trimmed = query.trim()
    if (trimmed.isEmpty()) return emptyList()

    val request = Request.Builder()
      .url(ENDPOINT)
      .post(requestBody(trimmed).toRequestBody(JSON_MEDIA_TYPE))
      .header("Content-Type", "application/json")
      .header("User-Agent", USER_AGENT)
      .header("X-Youtube-Client-Name", CLIENT_ID)
      .header("X-Youtube-Client-Version", CLIENT_VERSION)
      .header("Accept-Language", "en-US,en;q=0.9")
      .header("Origin", "https://music.youtube.com")
      .build()

    client.newCall(request).execute().use { response ->
      if (!response.isSuccessful) throw IOException("innertube_search_http_${response.code}")
      val payload = response.body?.string() ?: throw IOException("innertube_search_empty_body")
      val json = try {
        JsonParser.`object`().from(payload)
      } catch (error: Exception) {
        throw IOException("innertube_search_unreadable_body")
      }
      return parseTracks(json).take(limit.coerceIn(1, 50))
    }
  }

  private fun requestBody(query: String): String =
    "{\"context\":{\"client\":{\"clientName\":\"$CLIENT_NAME\"," +
      "\"clientVersion\":\"$CLIENT_VERSION\",\"hl\":\"en\",\"gl\":\"US\"}}," +
      "\"query\":\"${escape(query)}\",\"params\":\"$SEARCH_PARAMS\"}"

  private fun escape(value: String): String {
    val out = StringBuilder(value.length + 8)
    for (char in value) {
      when {
        char == '"' -> out.append("\\\"")
        char == '\\' -> out.append("\\\\")
        char == '\n' -> out.append("\\n")
        char == '\r' -> out.append("\\r")
        char == '\t' -> out.append("\\t")
        char < ' ' -> out.append(String.format("\\u%04x", char.code))
        else -> out.append(char)
      }
    }
    return out.toString()
  }

  /** Scans a badge subtree for YouTube's explicit marker. */
  private fun containsExplicitMarker(node: Any?): Boolean = when (node) {
    is JsonObject -> {
      val iconType = node["iconType"]
      if (iconType is String && iconType.contains(EXPLICIT_MARKER, ignoreCase = true)) {
        true
      } else {
        node.values.any { containsExplicitMarker(it) }
      }
    }
    is JsonArray -> node.any { containsExplicitMarker(it) }
    is String -> node.contains(EXPLICIT_MARKER, ignoreCase = true)
    else -> false
  }

  /** Official songs first, then official videos, then everything else. */
  private fun rank(item: JsonObject): Int = when (itemType(item)) {
    "song" -> 0
    "video" -> 1
    null -> 2
    else -> 3
  }

  private fun itemType(item: JsonObject): String? {
    val first = columnRuns(item, 1).firstOrNull()?.getString("text")?.trim()?.lowercase()
    return first?.takeIf { it in ITEM_KINDS }
  }

  private fun flexColumns(item: JsonObject): List<JsonObject> =
    (item["flexColumns"] as? JsonArray)?.filterIsInstance<JsonObject>() ?: emptyList()

  private fun columnRuns(item: JsonObject, index: Int): List<JsonObject> {
    val column = flexColumns(item).getOrNull(index) ?: return emptyList()
    val renderer = column["musicResponsiveListItemFlexColumnRenderer"] as? JsonObject
      ?: return emptyList()
    val text = renderer["text"] as? JsonObject ?: return emptyList()
    val runs = text["runs"] as? JsonArray ?: return emptyList()
    return runs.filterIsInstance<JsonObject>()
  }

  private fun columnText(item: JsonObject, index: Int): String? {
    val runs = columnRuns(item, index)
    if (runs.isEmpty()) return null
    val text = runs.joinToString("") { run -> run.getString("text") ?: "" }.trim()
    return text.ifEmpty { null }
  }

  /** The artist is the run that links to a browse endpoint ("Song • Adele"). */
  private fun artistOf(item: JsonObject): String {
    val linked = columnRuns(item, 1).firstOrNull { run ->
      val endpoint = run["navigationEndpoint"] as? JsonObject
      endpoint != null && endpoint["browseEndpoint"] != null
    }
    linked?.getString("text")?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }

    val parts = (columnText(item, 1) ?: "")
      .split("•")
      .map { it.trim() }
      .filter { it.isNotEmpty() }
    return parts.dropWhile { it.lowercase() in ITEM_KINDS }.firstOrNull() ?: ""
  }

  /** Duration, when YouTube prints one ("5:08"). Songs often carry none. */
  private fun durationSeconds(item: JsonObject): Long? {
    val fixed = (item["fixedColumns"] as? JsonArray)?.filterIsInstance<JsonObject>() ?: emptyList()
    for (column in fixed) {
      val renderer = column["musicResponsiveListItemFixedColumnRenderer"] as? JsonObject
        ?: continue
      val text = renderer["text"] as? JsonObject ?: continue
      val runs = (text["runs"] as? JsonArray)?.filterIsInstance<JsonObject>() ?: continue
      for (run in runs) {
        val parsed = parseDuration(run.getString("text"))
        if (parsed != null) return parsed
      }
    }
    for (run in columnRuns(item, 1)) {
      val parsed = parseDuration(run.getString("text"))
      if (parsed != null) return parsed
    }
    return null
  }

  private fun parseDuration(text: String?): Long? {
    if (text.isNullOrBlank()) return null
    val parts = text.trim().split(":")
    if (parts.size !in 2..3) return null
    var total = 0L
    for (part in parts) {
      val value = part.toIntOrNull() ?: return null
      total = total * 60 + value
    }
    return total
  }

  private fun videoId(item: JsonObject): String? {
    val listed = (item["playlistItemData"] as? JsonObject)?.getString("videoId")
    if (listed != null && listed.length == 11) return listed
    val endpoint = columnRuns(item, 0).firstOrNull()?.get("navigationEndpoint") as? JsonObject
      ?: return null
    val watch = endpoint["watchEndpoint"] as? JsonObject ?: return null
    return watch.getString("videoId")?.takeIf { it.length == 11 }
  }

  private fun thumbnailUrl(item: JsonObject): String? {
    val thumbnail = item["thumbnail"] as? JsonObject ?: return null
    val renderer = thumbnail["musicThumbnailRenderer"] as? JsonObject
    val inner = renderer?.get("thumbnail") as? JsonObject ?: thumbnail
    val thumbs = (inner["thumbnails"] as? JsonArray)?.filterIsInstance<JsonObject>() ?: return null
    val best = thumbs.maxByOrNull { thumb -> (thumb["width"] as? Number)?.toInt() ?: 0 }
    return best?.getString("url")
  }
}
