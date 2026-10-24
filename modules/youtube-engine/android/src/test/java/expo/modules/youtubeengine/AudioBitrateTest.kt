package expo.modules.youtubeengine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The stream bitrate's UNITS.
 *
 * The Now Playing screen's codec chip states the stream's real rate ("AAC ·
 * 128 kbps"), and the rate comes from the audio stream the engine picked.
 * NewPipe reports that stream's average bitrate in KILOBITS per second — its
 * itag table says "128" for the 128 kbps AAC stream — while the chip states
 * BITS per second.
 *
 * So the conversion happens ONCE, at the boundary that owns the units (the
 * engine), and this test pins it: a rate that was not scaled came out as
 * "0 kbps" on the panel, which is exactly the kind of wrong-but-plausible
 * number this repo refuses to show.
 *
 * A stream that reports NO rate (0, or NewPipe's unknown -1) reports none:
 * the chip then names the codec alone and never invents a number.
 */
class AudioBitrateTest {

  @Test
  fun `the itag table's kbps become bits per second`() {
    // the 128 kbps AAC stream (itag 140) and the 160 kbps Opus one (itag 251)
    assertEquals(128000L, audioBitrateBitsPerSecond(128))
    assertEquals(160000L, audioBitrateBitsPerSecond(160))
    assertEquals(50000L, audioBitrateBitsPerSecond(50))
  }

  @Test
  fun `a stream with no rate reports none`() {
    assertNull(audioBitrateBitsPerSecond(0))
    assertNull(audioBitrateBitsPerSecond(-1))
  }

  @Test
  fun `the whole kbps range stays inside a Long`() {
    assertEquals(256000L, audioBitrateBitsPerSecond(256))
  }
}
