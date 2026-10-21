package expo.modules.youtubeengine

import com.grack.nanojson.JsonArray
import com.grack.nanojson.JsonObject
import com.grack.nanojson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

/**
 * Pure-parser tests for [MusicSearch].
 *
 * The fixtures are REAL captured YouTube Music innertube search responses
 * (WEB_REMIX client, `POST https://www.youtube.com/youtubei/v1/search?prettyPrint=false`),
 * trimmed to the result sections that carry songs:
 *
 *  - `fixtures/search_explicit.json` — captured for the query `eminem lose yourself`.
 *    Holds the official "Lose Yourself" / "Space Bound" / "Sing For The Moment"
 *    songs, each carrying YouTube's `MUSIC_EXPLICIT_BADGE`, plus the
 *    "top result" card (a user upload with no badge) that YouTube returns first.
 *  - `fixtures/search_clean.json` — captured for the query `adele hello`.
 *    Holds Adele's "Hello" (no badge) and the explicit "Hello Parody" cover.
 */
class MusicSearchTest {

  private fun fixture(name: String): JsonObject {
    val stream = MusicSearchTest::class.java.getResourceAsStream("/fixtures/$name")
    assertNotNull("missing fixture: $name", stream)
    val text = stream!!.readBytes().decodeToString()
    return JsonParser.`object`().from(text)
  }

  private fun items(root: JsonObject): List<JsonObject> = MusicSearch.collectMusicItems(root)

  private fun itemWithId(root: JsonObject, id: String): JsonObject =
    items(root).first { (it["playlistItemData"] as? JsonObject)?.getString("videoId") == id }

  @Test
  fun `captured explicit song carries YouTube's explicit badge`() {
    val root = fixture("search_explicit.json")
    val loseYourself = itemWithId(root, "zlJ0Aj9y67c")
    assertTrue(MusicSearch.hasExplicitBadge(loseYourself))
  }

  @Test
  fun `captured clean song has no explicit badge`() {
    val root = fixture("search_clean.json")
    val hello = itemWithId(root, "yjo_aXygRDI")
    assertFalse(MusicSearch.hasExplicitBadge(hello))
  }

  @Test
  fun `an item without badges is not explicit`() {
    val bare = JsonParser.`object`().from("""{"playlistItemData":{"videoId":"yjo_aXygRDI"}}""")
    assertFalse(MusicSearch.hasExplicitBadge(bare))
  }

  @Test
  fun `collects music items by shape`() {
    val root = fixture("search_explicit.json")
    val collected = items(root)
    assertTrue("expected several music items, got ${collected.size}", collected.size >= 4)
    assertTrue(collected.any { (it["playlistItemData"] as? JsonObject)?.getString("videoId") == "zlJ0Aj9y67c" })
  }

  @Test
  fun `parses an explicit track`() {
    val root = fixture("search_explicit.json")
    val tracks = MusicSearch.parseTracks(root)
    val first = tracks.first()
    assertEquals("zlJ0Aj9y67c", first["id"])
    assertEquals("Lose Yourself", first["title"])
    assertEquals("Eminem", first["artist"])
    assertEquals(true, first["explicit"])
    assertEquals("youtube_music", first["source"])
  }

  @Test
  fun `parses a clean track`() {
    val root = fixture("search_clean.json")
    val tracks = MusicSearch.parseTracks(root)
    val first = tracks.first()
    assertEquals("yjo_aXygRDI", first["id"])
    assertEquals("Hello", first["title"])
    assertEquals("Adele", first["artist"])
    assertEquals(false, first["explicit"])
  }

  @Test
  fun `a top-result card is never parsed as a track`() {
    val explicitIds = MusicSearch.parseTracks(fixture("search_explicit.json")).map { it["id"] }
    // The captured response opens with a "More from YouTube" card (a user
    // upload, no badge). It is not a music track, so it must not be shown —
    // and above all not shown as "clean".
    assertFalse("the top-result card is not a track", explicitIds.contains("Cbtgk20s6wA"))
    assertEquals(
      listOf("zlJ0Aj9y67c", "BDrG1q-9rTY", "MJNGXnvHYPg", "8ibh8HAq0Mk"),
      explicitIds
    )

    val cleanIds = MusicSearch.parseTracks(fixture("search_clean.json")).map { it["id"] }
    assertFalse("the top-result card is not a track", cleanIds.contains("DfG6VKnjrVw"))
    assertEquals(listOf("yjo_aXygRDI", "H_LE4Ar83xM"), cleanIds)
  }

  @Test
  fun `only song rows become tracks`() {
    val video = JsonParser.`object`().from(
      """{"playlistItemData":{"videoId":"Cbtgk20s6wA"},
          "flexColumns":[
            {"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Lose Yourself"}]}}},
            {"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Video"},{"text":" • "},{"text":"Eminem"}]}}}
          ]}"""
    )
    assertEquals("video", MusicSearch.kindOf(video))
    assertNull("a video row is not a music track", MusicSearch.trackFrom(video))

    val artist = JsonParser.`object`().from(
      """{"playlistItemData":{"videoId":"Cbtgk20s6wA"},
          "flexColumns":[
            {"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Eminem"}]}}},
            {"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Artist"},{"text":" • "},{"text":"264M monthly audience"}]}}}
          ]}"""
    )
    assertEquals("artist", MusicSearch.kindOf(artist))
    assertNull("an artist row is not a music track", MusicSearch.trackFrom(artist))
  }

  @Test
  fun `a row without a readable kind is not a track`() {
    // The top-result card prints a channel name where the kind would be.
    val card = JsonParser.`object`().from(
      """{"playlistItemData":{"videoId":"Cbtgk20s6wA"},
          "flexColumns":[
            {"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Lose Yourself"}]}}},
            {"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Просто канал"},{"text":" • "},{"text":"72M views"}]}}}
          ]}"""
    )
    assertNull(MusicSearch.kindOf(card))
    assertNull("a row with no kind says nothing about its rating", MusicSearch.trackFrom(card))
  }

  @Test
  fun `a clean query still reports known ratings`() {
    val root = fixture("search_clean.json")
    val tracks = MusicSearch.parseTracks(root)
    assertTrue(tracks.isNotEmpty())
    assertTrue(tracks.all { it["explicit"] is Boolean })
  }

  @Test
  fun `survives an unfamiliar response shape`() {
    val empty = JsonParser.`object`().from("{}")
    assertTrue(MusicSearch.parseTracks(empty).isEmpty())
    val garbage = JsonParser.`object`().from(
      """{"contents":{"tabbedSearchResultsRenderer":{"tabs":[{"tabRenderer":{"content":{"sectionListRenderer":{"contents":[{"itemSectionRenderer":{"contents":[{"musicResponsiveListItemRenderer":{"flexColumns":[]}}]}}]}}}}]}}}"""
    )
    // No video id -> no track, but no crash.
    assertTrue(MusicSearch.parseTracks(garbage).isEmpty())
  }

  @Test
  fun `trackFrom rejects items without a playable id`() {
    // A song row, but YouTube printed no id for it.
    val song = JsonParser.`object`().from(
      """{"flexColumns":[
           {"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Eminem"}]}}},
           {"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Song"},{"text":" • "},{"text":"Eminem"}]}}}
         ]}"""
    )
    assertEquals("song", MusicSearch.kindOf(song))
    assertNull(MusicSearch.trackFrom(song))
  }

  @Test
  fun `reads the duration when YouTube provides one`() {
    // The captured song rows carry no duration; YouTube prints one on the
    // top-result card, which is not a track any more. A song row that does
    // print one is read from its fixed column.
    val song = JsonParser.`object`().from(
      """{"playlistItemData":{"videoId":"yjo_aXygRDI"},
          "flexColumns":[
            {"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Hello"}]}}},
            {"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Song"},{"text":" • "},{"text":"Adele"}]}}}
          ],
          "fixedColumns":[
            {"musicResponsiveListItemFixedColumnRenderer":{"text":{"runs":[{"text":"5:08"}]}}}
          ]}"""
    )
    val track = MusicSearch.trackFrom(song)
    assertNotNull(track)
    assertEquals(308L, track!!["durationSeconds"])
  }

  @Test
  fun `the explicit icon type alone marks a track explicit`() {
    // The icon type ALONE: no accessibility label in the fixture, so this
    // cannot be passing because of the label.
    val badge = JsonParser.`object`().from(
      """{"badges":[{"musicInlineBadgeRenderer":{"icon":{"iconType":"MUSIC_EXPLICIT_BADGE"}}}]}"""
    )
    assertTrue(MusicSearch.hasExplicitBadge(badge))
  }

  @Test
  fun `the explicit label alone marks a track explicit`() {
    // The label alone, on a badge whose icon type says nothing: the other
    // half of the explicit check.
    val badge = JsonParser.`object`().from(
      """{"badges":[{"musicInlineBadgeRenderer":{"icon":{"iconType":"MUSIC_VERIFIED_BADGE"},
          "accessibilityData":{"accessibilityData":{"label":"Explicit"}}}}]}"""
    )
    assertTrue(MusicSearch.hasExplicitBadge(badge))
  }

  @Test
  fun `a label that only mentions explicit does not mark a track explicit`() {
    val badge = JsonParser.`object`().from(
      """{"badges":[{"musicInlineBadgeRenderer":{"icon":{"iconType":"MUSIC_VERIFIED_BADGE"},
          "accessibilityData":{"accessibilityData":{"label":"Not explicit"}}}}]}"""
    )
    assertFalse(MusicSearch.hasExplicitBadge(badge))
  }

  @Test
  fun `the failure reason never echoes a body, a url or a query`() {
    val error = IOException(
      "GET https://www.youtube.com/youtubei/v1/search?query=eminem -> 403 {\"token\":\"s3cret\"}"
    )
    val reason = MusicSearch.reasonFor(error)
    assertEquals("innertube_search_failed_ioexception", reason)
    assertFalse("no url in the log line", reason.contains("http"))
    assertFalse("no body in the log line", reason.contains("s3cret"))
    assertFalse("no query in the log line", reason.contains("eminem"))
  }

  @Test
  fun `our own status token survives the reason`() {
    assertEquals(
      "innertube_search_http_403",
      MusicSearch.reasonFor(IOException("innertube_search_http_403"))
    )
  }
}
