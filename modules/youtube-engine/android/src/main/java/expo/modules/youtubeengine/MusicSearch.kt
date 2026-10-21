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

  /**
   * The innertube client version this module speaks.
   *
   * YouTube only serves the client versions it still honours, and it can stop
   * honouring this one at any time — that is what "the client rotted" means.
   * The failure mode is fail-closed: the search then falls back to NewPipe,
   * where the ratings are UNKNOWN (`explicit = null`, `explicitKnown = false`),
   * so the family-safe filter hides the tracks instead of showing them
   * unrated. Re-probe and bump this constant when the search starts failing.
   */
  private const val CLIENT_VERSION = "1.20241010.01.00"
  private const val CLIENT_ID = "67"
  private const val USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

  /** Innertube filter for the music search surface. */
  private const val SEARCH_PARAMS = "EgWKAQ"

  /** YouTube's marker for an explicit track. */
  private const val EXPLICIT_ICON_TYPE = "MUSIC_EXPLICIT_BADGE"
  private const val EXPLICIT_LABEL = "Explicit"

  /** Every failure of this module carries this prefix — and only this prefix. */
  const val REASON_PREFIX = "innertube_search_"

  private val JSON_MEDIA_TYPE = "application/json".toMediaType()

  /** The item kinds YouTube prints in the second column ("Song • Eminem"). */
  private val ITEM_KINDS = setOf(
    "song", "video", "album", "single", "episode", "playlist", "artist",
    "profile", "podcast", "audiobook", "station", "movie", "clip", "show"
  )

  /**
   * The kinds we are willing to show.
   *
   * A music search must return music. A "Video" row is a user upload, and an
   * upload carries no badge — treating it as "clean" would be a lie the
   * family-safe filter cannot see through. A row whose kind we cannot read
   * says nothing about its rating either, so it is dropped too, never
   * downgraded to "clean".
   */
  private val TRACK_KINDS = setOf("song", "album")

  /**
   * True when the item's badge subtree carries YouTube's explicit marker.
   *
   * The check is deliberately narrow: the badge's `iconType` and the label
   * inside its `accessibilityData`, both matched exactly. A loose "contains
   * EXPLICIT" over the whole subtree would fire on a future label like
   * "Not explicit".
   */
  fun hasExplicitBadge(item: JsonObject): Boolean {
    val badges = item["badges"] ?: return false
    return hasExplicitMarker(badges)
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

  /**
   * The row's kind, as YouTube prints it ("Song", "Video", "Album", …).
   *
   * Null when the row carries no readable kind — the top-result card (a user
   * upload) prints its channel name where the kind would be.
   */
  fun kindOf(item: JsonObject): String? {
    val first = columnRuns(item, 1).firstOrNull()?.getString("text")?.trim()?.lowercase()
    return first?.takeIf { it in ITEM_KINDS }
  }

  /**
   * One track, or null when the row is not a music track we may show.
   *
   * Only songs (and albums) become tracks. Videos, user uploads, artist rows
   * and rows whose kind cannot be read are dropped: none of them carry a
   * rating, and a row without a rating must never be reported as "clean".
   */
  fun trackFrom(item: JsonObject): Map<String, Any?>? {
    val kind = kindOf(item)
    if (kind == null || kind !in TRACK_KINDS) return null
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
   * Every playable track in the response, in YouTube's own order.
   *
   * Non-song rows are dropped rather than ranked lower — a "top result" card
   * (often a user upload) is not a track, and it never reaches the app.
   */
  fun parseTracks(json: JsonObject): List<Map<String, Any?>> =
    collectMusicItems(json).mapNotNull { trackFrom(it) }

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
      if (!response.isSuccessful) throw IOException("${REASON_PREFIX}http_${response.code}")
      val payload = response.body?.string() ?: throw IOException("${REASON_PREFIX}empty_body")
      val json = try {
        JsonParser.`object`().from(payload)
      } catch (error: Exception) {
        throw IOException("${REASON_PREFIX}unreadable_body")
      }
      return parseTracks(json).take(limit.coerceIn(1, 50))
    }
  }

  /**
   * A log-safe reason for a failed search.
   *
   * Only our own reasons are echoed (a status token such as
   * `innertube_search_http_403`); anything else is reduced to the exception's
   * type, so no body, URL, query string or token can reach logcat.
   */
  fun reasonFor(error: Exception): String {
    val message = error.message
    if (message != null && message.startsWith(REASON_PREFIX)) return message
    return REASON_PREFIX + "failed_" + error.javaClass.simpleName.lowercase()
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

  /**
   * Scans a badge subtree for YouTube's explicit marker.
   *
   * `insideAccessibilityData` keeps the label check where it belongs: only the
   * label of an accessibility container counts, and it has to match exactly.
   */
  private fun hasExplicitMarker(node: Any?, insideAccessibilityData: Boolean = false): Boolean =
    when (node) {
      is JsonObject -> {
        val iconType = node["iconType"]
        val icon = iconType is String && iconType.equals(EXPLICIT_ICON_TYPE, ignoreCase = true)
        val label = node["label"]
        val labelled = insideAccessibilityData &&
          label is String &&
          label.equals(EXPLICIT_LABEL, ignoreCase = true)
        icon || labelled || node.entries.any { (key, value) ->
          hasExplicitMarker(value, insideAccessibilityData || key == "accessibilityData")
        }
      }
      is JsonArray -> node.any { hasExplicitMarker(it, insideAccessibilityData) }
      else -> false
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
