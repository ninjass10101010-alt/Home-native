package expo.modules.youtubeengine

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.TimeUnit

/**
 * The artwork extraction's FAILURE path.
 *
 * The stage tints itself from the cover's own colour, and that colour is
 * read on-device (AndroidX Palette). The extraction must never be a source
 * of crashes: a missing thumbnail, a 404, a body that is not an image, a
 * malformed URL — every one of them answers with "no colour", and the app
 * falls back to the accent token.
 *
 * The JVM cannot decode a bitmap (the framework is stubbed), so the SUCCESS
 * path is a device probe; the failure path is what can be pinned here, and it
 * is the path that matters: it must never throw, and it must never invent a
 * colour.
 */
class ArtworkColorsTest {

  /** A client that answers every request with the given status and body. */
  private fun stubClient(code: Int, body: ByteArray): OkHttpClient =
    OkHttpClient.Builder()
      .addInterceptor { chain ->
        Response.Builder()
          .request(chain.request())
          .protocol(Protocol.HTTP_1_1)
          .code(code)
          .message("stub")
          .body(body.toResponseBody("image/jpeg".toMediaType()))
          .build()
      }
      .build()

  private fun assertNoColours(answer: Map<String, String?>) {
    assertEquals("the answer carries exactly the two colour slots", setOf("dominant", "vibrant"), answer.keys)
    assertNull("no dominant colour", answer["dominant"])
    assertNull("no vibrant colour", answer["vibrant"])
  }

  @Test
  fun `a blank url answers with no colours`() {
    assertNoColours(ArtworkColors.extract("", stubClient(200, byteArrayOf(1, 2, 3))))
  }

  @Test
  fun `a malformed url answers with no colours`() {
    // The URL never reaches the network: OkHttp rejects it, and the
    // rejection must not escape as a crash.
    assertNoColours(ArtworkColors.extract("not a url", stubClient(200, byteArrayOf(1, 2, 3))))
  }

  @Test
  fun `a failed fetch answers with no colours`() {
    // A real client against a dead local port: the transport fails, and the
    // failure must not escape as a crash.
    val dead = OkHttpClient.Builder()
      .connectTimeout(1, TimeUnit.SECONDS)
      .readTimeout(1, TimeUnit.SECONDS)
      .build()
    assertNoColours(ArtworkColors.extract("http://127.0.0.1:1/art.jpg", dead))
  }

  @Test
  fun `a non-success status answers with no colours`() {
    assertNoColours(ArtworkColors.extract("https://example.invalid/art.jpg", stubClient(404, byteArrayOf())))
  }

  @Test
  fun `an empty body answers with no colours`() {
    assertNoColours(ArtworkColors.extract("https://example.invalid/art.jpg", stubClient(200, byteArrayOf())))
  }

  @Test
  fun `a body that is not an image answers with no colours`() {
    assertNoColours(
      ArtworkColors.extract(
        "https://example.invalid/art.jpg",
        stubClient(200, "this is not an image".toByteArray())
      )
    )
  }

  @Test
  fun `the extraction never throws`() {
    // Whatever the transport does, the answer is an answer.
    val answers = listOf(
      ArtworkColors.extract("", stubClient(200, byteArrayOf())),
      ArtworkColors.extract("://broken", stubClient(200, byteArrayOf())),
      ArtworkColors.extract("https://example.invalid/art.jpg", stubClient(500, byteArrayOf(9))),
    )
    assertTrue("every attempt answers", answers.size == 3)
    for (answer in answers) assertNoColours(answer)
  }

  @Test
  fun `a colour is formatted as a six-digit hex`() {
    // The palette hands back a packed ARGB int; the alpha is dropped.
    assertEquals("#3B82F6", ArtworkColors.formatColor(0xFF3B82F6.toInt()))
    assertEquals("#000000", ArtworkColors.formatColor(0xFF000000.toInt()))
    assertEquals("#FFFFFF", ArtworkColors.formatColor(0xFFFFFFFF.toInt()))
  }

  @Test
  fun `no colour is null, never a fake one`() {
    assertNull(ArtworkColors.formatColor(null))
  }
}
