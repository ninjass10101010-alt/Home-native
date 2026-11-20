package expo.modules.youtubeengine

import com.grack.nanojson.JsonArray
import com.grack.nanojson.JsonObject
import okhttp3.OkHttpClient

/**
 * YouTube Music innertube browse parser for Artist profiles, Albums/Singles,
 * and Playlists. Uses the same `WEB_REMIX` client & fail-closed rating rules as
 * [MusicSearch].
 */
object MusicBrowse {
  private const val ENDPOINT = "https://www.youtube.com/youtubei/v1/browse?prettyPrint=false"
  const val REASON_PREFIX = "innertube_browse_"

  private const val PAGE_TYPE_ARTIST = "MUSIC_PAGE_TYPE_ARTIST"
  private const val PAGE_TYPE_ALBUM = "MUSIC_PAGE_TYPE_ALBUM"
  private const val PAGE_TYPE_PLAYLIST = "MUSIC_PAGE_TYPE_PLAYLIST"

  fun browseArtist(browseId: String, client: OkHttpClient): Map<String, Any?> {
    val trimmed = browseId.trim()
    if (trimmed.isEmpty()) throw IllegalArgumentException("${REASON_PREFIX}empty_id")
    val json = fetchBrowse(trimmed, client)
    val profile = parseArtistProfile(trimmed, json).toMutableMap()
    val topSongs = (profile["topSongs"] as? List<*>)?.filterIsInstance<Map<String, Any?>>().orEmpty()
    val moreBrowseId = profile.remove("_topSongsBrowseId") as? String
    if (moreBrowseId != null && topSongs.size < 15) {
      val expanded = try {
        val moreJson = fetchBrowse(moreBrowseId, client)
        val detail = parseCollectionDetail(moreBrowseId, moreJson, overrideArtist = profile["name"] as? String ?: "")
        (detail["tracks"] as? List<*>)?.filterIsInstance<Map<String, Any?>>().orEmpty()
      } catch (_: Exception) {
        emptyList()
      }
      if (expanded.isNotEmpty()) {
        val merged = linkedMapOf<String, Map<String, Any?>>()
        topSongs.forEach { t -> (t["id"] as? String)?.let { id -> merged.putIfAbsent(id, t) } }
        expanded.forEach { t -> (t["id"] as? String)?.let { id -> merged.putIfAbsent(id, t) } }
        profile["topSongs"] = merged.values.take(25).toList()
      }
    }
    return profile
  }

  fun browseCollection(rawBrowseId: String, client: OkHttpClient): Map<String, Any?> {
    val trimmed = rawBrowseId.trim()
    if (trimmed.isEmpty()) throw IllegalArgumentException("${REASON_PREFIX}empty_id")
    val normalizedId = normalizeCollectionBrowseId(trimmed)
    val json = fetchBrowse(normalizedId, client)
    return parseCollectionDetail(normalizedId, json)
  }

  internal fun normalizeCollectionBrowseId(browseId: String): String {
    return when {
      browseId.startsWith("MPREb_") || browseId.startsWith("VL") -> browseId
      browseId.startsWith("PL") ||
        browseId.startsWith("RDCLAK5uy_") ||
        browseId.startsWith("OLAK5uy_") ||
        browseId.startsWith("LL") -> "VL$browseId"
      else -> browseId
    }
  }

  private fun fetchBrowse(browseId: String, client: OkHttpClient): JsonObject {
    val body =
      "{\"context\":{\"client\":{\"clientName\":\"${MusicSearch.CLIENT_NAME}\"," +
        "\"clientVersion\":\"${MusicSearch.CLIENT_VERSION}\",\"hl\":\"en\",\"gl\":\"US\"}}," +
        "\"browseId\":\"${MusicSearch.escape(browseId)}\"}"
    return MusicSearch.postInnertube(ENDPOINT, body, client, REASON_PREFIX)
  }

  fun parseArtistProfile(browseId: String, json: JsonObject): Map<String, Any?> {
    val headerObj = json["header"] as? JsonObject
    val header = (headerObj?.get("musicImmersiveHeaderRenderer") as? JsonObject)
      ?: (headerObj?.get("musicVisualHeaderRenderer") as? JsonObject)
      ?: headerObj
    val name = MusicSearch.runsText(header?.get("title")) ?: ""
    val audienceText = MusicSearch.runsText(header?.get("monthlyListenerCount"))
      ?: run {
        val subBtn = (header?.get("subscriptionButton") as? JsonObject)
          ?.get("subscribeButtonRenderer") as? JsonObject
        MusicSearch.runsText(subBtn?.get("subscriberCountText"))
          ?: MusicSearch.runsText(subBtn?.get("longSubscriberCountText"))
      }
      ?: "Artist"
    val description = MusicSearch.runsText(header?.get("description")) ?: ""
    val artworkUrl = header?.let { MusicSearch.thumbnailUrl(it) }

    val topSongs = mutableListOf<Map<String, Any?>>()
    var topSongsBrowseId: String? = null
    val albums = mutableListOf<Map<String, Any?>>()
    val singles = mutableListOf<Map<String, Any?>>()
    val playlists = mutableListOf<Map<String, Any?>>()
    val relatedArtists = mutableListOf<Map<String, Any?>>()

    val seenAlbumIds = HashSet<String>()
    val seenSingleIds = HashSet<String>()
    val seenPlaylistIds = HashSet<String>()
    val seenArtistIds = HashSet<String>()

    val sections = extractArtistSections(json)
    for (sec in sections) {
      val shelf = sec["musicShelfRenderer"] as? JsonObject
      if (shelf != null) {
        if (topSongsBrowseId == null) {
          topSongsBrowseId = MusicSearch.browseTargetOfEndpoint(
            shelf["bottomEndpoint"] as? JsonObject
          )?.first
        }
        val items = (shelf["contents"] as? JsonArray)?.filterIsInstance<JsonObject>() ?: emptyList()
        for (it in items) {
          val item = it["musicResponsiveListItemRenderer"] as? JsonObject ?: continue
          val track = MusicSearch.extractTrack(
            item = item,
            fallbackArtist = name,
            requireTrackKind = false,
          )
          if (track != null) topSongs += track
        }
        continue
      }

      val carousel = sec["musicCarouselShelfRenderer"] as? JsonObject
      if (carousel != null) {
        val hdr = carousel["header"] as? JsonObject
        val basic = hdr?.get("musicCarouselShelfBasicHeaderRenderer") as? JsonObject
        val sectionTitle = (MusicSearch.runsText(basic?.get("title")) ?: "").lowercase()
        val items = (carousel["contents"] as? JsonArray)?.filterIsInstance<JsonObject>() ?: emptyList()

        for (it in items) {
          val row = it["musicTwoRowItemRenderer"] as? JsonObject ?: continue
          val rowTitle = MusicSearch.runsText(row["title"]) ?: continue
          val rowSub = MusicSearch.runsText(row["subtitle"]) ?: ""
          val target = MusicSearch.browseTargetOfEndpoint(row["navigationEndpoint"] as? JsonObject) ?: continue
          val targetId = target.first
          val pageType = target.second
          val thumb = MusicSearch.thumbnailUrl(row)
          val explicit = MusicSearch.hasExplicitBadge(row)

          when {
            "single" in sectionTitle || "ep" in sectionTitle -> {
              if (seenSingleIds.add(targetId)) {
                singles += MusicSearch.albumMap(
                  browseId = targetId,
                  title = rowTitle,
                  subtitle = rowSub.ifEmpty { "Single" },
                  artworkUrl = thumb,
                  explicit = explicit,
                  fallbackArtist = name,
                )
              }
            }
            "album" in sectionTitle || pageType == PAGE_TYPE_ALBUM -> {
              if (seenAlbumIds.add(targetId)) {
                albums += MusicSearch.albumMap(
                  browseId = targetId,
                  title = rowTitle,
                  subtitle = rowSub.ifEmpty { "Album" },
                  artworkUrl = thumb,
                  explicit = explicit,
                  fallbackArtist = name,
                )
              }
            }
            "featured" in sectionTitle || "playlist" in sectionTitle || pageType == PAGE_TYPE_PLAYLIST -> {
              if (seenPlaylistIds.add(targetId)) {
                playlists += MusicSearch.playlistMap(
                  browseId = targetId,
                  title = rowTitle,
                  subtitle = rowSub.ifEmpty { "Playlist" },
                  artworkUrl = thumb,
                )
              }
            }
            "fans" in sectionTitle || "similar" in sectionTitle || pageType == PAGE_TYPE_ARTIST -> {
              if (targetId != browseId && seenArtistIds.add(targetId)) {
                relatedArtists += mapOf(
                  "browseId" to targetId,
                  "name" to rowTitle,
                  "subtitle" to rowSub.ifEmpty { "Artist" },
                  "artworkUrl" to thumb,
                )
              }
            }
          }
        }
      }
    }

    val out = linkedMapOf<String, Any?>(
      "browseId" to browseId,
      "name" to name,
      "subtitle" to audienceText,
      "description" to description,
      "artworkUrl" to artworkUrl,
      "topSongs" to topSongs,
      "albums" to albums,
      "singles" to singles,
      "playlists" to playlists,
      "relatedArtists" to relatedArtists,
      "explicitKnown" to true,
    )
    if (topSongsBrowseId != null) {
      out["_topSongsBrowseId"] = topSongsBrowseId
    }
    return out
  }

  fun parseCollectionDetail(
    browseId: String,
    json: JsonObject,
    overrideArtist: String = "",
  ): Map<String, Any?> {
    val kind = if (browseId.startsWith("MPREb_")) "album" else "playlist"
    val header = findCollectionHeader(json)
    val title = MusicSearch.runsText(header?.get("title")) ?: ""
    val subOne = MusicSearch.runsText(header?.get("subtitle")) ?: ""
    val subTwo = MusicSearch.runsText(header?.get("secondSubtitle")) ?: ""
    val subtitle = listOf(subOne, subTwo).filter { it.isNotEmpty() }.joinToString(" • ")
    val artist = MusicSearch.runsText(header?.get("straplineTextOne"))
      ?: overrideArtist
    val artworkUrl = header?.let { MusicSearch.thumbnailUrl(it) }

    val tracks = mutableListOf<Map<String, Any?>>()
    val seenIds = HashSet<String>()
    for (item in MusicSearch.collectMusicItems(json)) {
      if (tracks.size >= 100) break
      val explicitValue: Boolean? = if (kind == "album") {
        MusicSearch.hasExplicitBadge(item)
      } else {
        when {
          MusicSearch.hasExplicitBadge(item) -> true
          MusicSearch.musicVideoTypeOf(item) == "MUSIC_VIDEO_TYPE_ATV" -> false
          else -> null
        }
      }
      val track = MusicSearch.extractTrack(
        item = item,
        fallbackArtist = artist,
        fallbackAlbum = if (kind == "album") title else "",
        fallbackArtworkUrl = artworkUrl,
        requireTrackKind = false,
        useExplicitOverride = true,
        explicitOverride = explicitValue,
      ) ?: continue
      val id = track["id"] as? String ?: continue
      if (seenIds.add(id)) {
        tracks += track
      }
    }

    return mapOf(
      "browseId" to browseId,
      "kind" to kind,
      "title" to title,
      "subtitle" to subtitle,
      "artist" to artist,
      "artworkUrl" to artworkUrl,
      "tracks" to tracks,
      "explicitKnown" to true,
    )
  }

  private fun extractArtistSections(json: JsonObject): List<JsonObject> {
    val contents = json["contents"] as? JsonObject ?: return emptyList()
    val single = contents["singleColumnBrowseResultsRenderer"] as? JsonObject ?: return emptyList()
    val tabs = (single["tabs"] as? JsonArray)?.filterIsInstance<JsonObject>() ?: return emptyList()
    val tabRenderer = tabs.firstOrNull()?.get("tabRenderer") as? JsonObject ?: return emptyList()
    val content = tabRenderer["content"] as? JsonObject ?: return emptyList()
    val sectionList = content["sectionListRenderer"] as? JsonObject ?: return emptyList()
    return (sectionList["contents"] as? JsonArray)?.filterIsInstance<JsonObject>() ?: emptyList()
  }

  private fun findCollectionHeader(node: Any?): JsonObject? {
    when (node) {
      is JsonObject -> {
        (node["musicResponsiveHeaderRenderer"] as? JsonObject)?.let { return it }
        (node["musicDetailHeaderRenderer"] as? JsonObject)?.let { return it }
        for (v in node.values) {
          val hit = findCollectionHeader(v)
          if (hit != null) return hit
        }
      }
      is JsonArray -> {
        for (item in node) {
          val hit = findCollectionHeader(item)
          if (hit != null) return hit
        }
      }
    }
    return null
  }

  fun reasonFor(error: Exception): String {
    val message = error.message
    if (message != null && message.startsWith(REASON_PREFIX)) return message
    return REASON_PREFIX + "failed_" + error.javaClass.simpleName.lowercase()
  }
}
