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
  fun `official songs rank before the top-result card`() {
    val root = fixture("search_explicit.json")
    val tracks = MusicSearch.parseTracks(root)
    // The captured response lists a user upload ("More from YouTube") before the
    // official song; the parsed order must still surface the official song first.
    assertEquals("zlJ0Aj9y67c", tracks.first()["id"])
    assertEquals(true, tracks.first()["explicit"])
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
    val artist = JsonParser.`object`().from(
      """{"flexColumns":[{"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Eminem"}]}}}]}"""
    )
    assertNull(MusicSearch.trackFrom(artist))
  }

  @Test
  fun `reads the duration when YouTube provides one`() {
    val root = fixture("search_clean.json")
    val video = items(root).first { item ->
      val columns = item["flexColumns"] as? JsonArray ?: return@first false
      columns.any { column ->
        val runs = (column as? JsonObject)
          ?.getObject("musicResponsiveListItemFlexColumnRenderer")
          ?.getObject("text")
          ?.getArray("runs")
        runs?.any { (it as? JsonObject)?.getString("text") == "5:08" } == true
      }
    }
    assertNotNull("expected a captured item carrying a duration", video)
    val track = MusicSearch.trackFrom(video!!)
    assertNotNull(track)
    assertEquals(308L, track!!["durationSeconds"])
  }
}
