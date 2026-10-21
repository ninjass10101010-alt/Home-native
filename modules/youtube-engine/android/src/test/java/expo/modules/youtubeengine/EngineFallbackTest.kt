package expo.modules.youtubeengine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import org.schabi.newpipe.extractor.stream.StreamType

/**
 * The fail-closed fallback contract.
 *
 * NewPipe exposes no explicit badge, so every track that reaches the app
 * through the fallback carries an UNKNOWN rating. The family-safe filter
 * treats UNKNOWN as "hide it" — a fallback track must therefore never claim
 * to be clean. These tests are the tripwire for that: if a refactor ever
 * turned the `null` into `false`, an explicit song would look clean to the
 * kids' view.
 */
class EngineFallbackTest {

  private fun item(id: String, title: String, artist: String): StreamInfoItem {
    val item = StreamInfoItem(
      0,
      "https://www.youtube.com/watch?v=$id",
      title,
      StreamType.VIDEO_STREAM
    )
    item.setUploaderName(artist)
    item.setDuration(300L)
    return item
  }

  @Test
  fun `fallback tracks carry unknown ratings`() {
    val tracks = Engine.mapFallbackTracks(
      listOf(
        item("zlJ0Aj9y67c", "Lose Yourself", "Eminem"),
        item("yjo_aXygRDI", "Hello", "Adele")
      )
    )
    assertEquals(2, tracks.size)
    for (track in tracks) {
      assertTrue("the rating key must be present", track.containsKey("explicit"))
      assertNull("ratings stay UNKNOWN on the fallback path", track["explicit"])
    }
  }

  @Test
  fun `the fallback path reports unknown ratings`() {
    val result = Engine.fallbackResult(listOf(item("zlJ0Aj9y67c", "Lose Yourself", "Eminem")))
    assertEquals(false, result["explicitKnown"])
    val tracks = result["tracks"] as List<*>
    assertEquals(1, tracks.size)
    val track = tracks.first() as Map<*, *>
    assertNull("ratings stay UNKNOWN on the fallback path", track["explicit"])
  }

  @Test
  fun `an empty fallback still reports unknown ratings`() {
    val result = Engine.fallbackResult(emptyList())
    assertEquals(false, result["explicitKnown"])
    assertEquals(emptyList<Any>(), result["tracks"])
  }

  @Test
  fun `the fallback keeps the id, the title and the artist`() {
    val track = Engine.mapFallbackTracks(
      listOf(item("zlJ0Aj9y67c", "Lose Yourself", "Eminem"))
    ).first()
    assertEquals("zlJ0Aj9y67c", track["id"])
    assertEquals("Lose Yourself", track["title"])
    assertEquals("Eminem", track["artist"])
    assertEquals("youtube_music", track["source"])
  }
}
