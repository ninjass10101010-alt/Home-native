package expo.modules.youtubeengine

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import androidx.palette.graphics.Palette
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.Locale

/**
 * The artwork's own colour, read on-device.
 *
 * The Now Playing stage washes itself with the cover's colour, and that
 * colour is read HERE — on the device, with AndroidX Palette (Apache-2.0),
 * because the artwork is already on the device and a colour cannot be
 * extracted from a URL in JS.
 *
 * The contract is deliberately dull, because a stage must never be a crash:
 *
 *  - It NEVER throws. A dead network, a 404, a body that is not an image, a
 *    malformed URL — every one of them answers with two nulls, and the app
 *    falls back to its accent token.
 *  - It NEVER invents a colour. A palette with no swatch reports no colour.
 *  - It NEVER logs the URL or the response bytes. Only a reason token.
 *
 * The stage's readability is NOT decided here: the raw colour is banded by
 * the app's pure `bandStageTint` (dark [0.06, 0.17], light [0.75, 0.92] of
 * WCAG luminance), so body text on the tint stays AA.
 */
object ArtworkColors {
  private const val TAG = "YoutubeEngine"

  /** Every failure of this module carries this prefix — and only this prefix. */
  const val REASON_PREFIX = "artwork_"

  /**
   * The largest artwork we pull into memory.
   *
   * A thumbnail is tens of kilobytes; a megabyte ceiling is generous and
   * stops a wrong URL from turning the stage into a memory hog.
   */
  private const val MAX_ARTWORK_BYTES = 4 * 1024 * 1024

  /**
   * The decode's sample size — the palette only needs the big shapes.
   *
   * The bitmap is decoded at one sixty-fourth of the pixels, which is what
   * the palette quantises anyway.
   */
  private const val SAMPLE_SIZE = 8

  /** The answer when there is no colour to report. */
  fun empty(): Map<String, String?> = mapOf("dominant" to null, "vibrant" to null)

  /**
   * The dominant and vibrant colours of the artwork at [url].
   *
   * Never throws: every failure answers with two nulls.
   */
  fun extract(url: String, client: OkHttpClient): Map<String, String?> {
    if (url.isBlank()) return empty()
    return try {
      val bytes = fetch(url, client)
      val bitmap = decode(bytes) ?: return empty()
      try {
        palette(bitmap)
      } finally {
        bitmap.recycle()
      }
    } catch (error: Exception) {
      // Reason only: no URL, no body, no bytes.
      Log.w(TAG, "artwork colors failed: ${reasonFor(error)}")
      empty()
    }
  }

  /**
   * The artwork's bytes.
   *
   * Every failure is an [IOException] carrying a reason (the status token
   * and friends), the way the search path reports its own.
   */
  internal fun fetch(url: String, client: OkHttpClient): ByteArray {
    val request = Request.Builder().url(url).build()
    client.newCall(request).execute().use { response ->
      if (!response.isSuccessful) throw IOException("${REASON_PREFIX}http_${response.code}")
      val body = response.body ?: throw IOException("${REASON_PREFIX}empty_body")
      if (body.contentLength() > MAX_ARTWORK_BYTES) {
        throw IOException("${REASON_PREFIX}too_large")
      }
      val bytes = body.bytes()
      if (bytes.isEmpty()) throw IOException("${REASON_PREFIX}empty_body")
      if (bytes.size > MAX_ARTWORK_BYTES) throw IOException("${REASON_PREFIX}too_large")
      return bytes
    }
  }

  /** The bitmap, downsampled — the palette only needs the big shapes. */
  internal fun decode(bytes: ByteArray): Bitmap? {
    val options = BitmapFactory.Options().apply { inSampleSize = SAMPLE_SIZE }
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
  }

  /**
   * The palette's colours for a bitmap.
   *
   * A palette with no swatch reports no colour — a stage that painted a made
   * up colour would be lying about the artwork.
   */
  internal fun palette(bitmap: Bitmap): Map<String, String?> {
    return try {
      val palette = Palette.from(bitmap).generate()
      mapOf(
        "dominant" to formatColor(palette.dominantSwatch?.rgb),
        "vibrant" to formatColor(palette.vibrantSwatch?.rgb)
      )
    } catch (error: Exception) {
      Log.w(TAG, "artwork palette failed: ${reasonFor(error)}")
      empty()
    }
  }

  /**
   * The JS-facing hex for a palette colour, or null when there is none.
   *
   * The alpha is dropped: the stage tints itself with an OPAQUE colour — a
   * translucent one would need a ground behind it, and the app's own band
   * works on the real pixel.
   */
  internal fun formatColor(color: Int?): String? =
    color?.let { String.format(Locale.US, "#%06X", 0xFFFFFF and it) }

  /**
   * A log-safe reason for a failed extraction.
   *
   * Only our own reasons (a status token such as `artwork_http_404`) are
   * echoed; anything else is reduced to the exception's type, so no URL, no
   * body and no token can reach logcat.
   */
  fun reasonFor(error: Exception): String {
    val message = error.message
    if (message != null && message.startsWith(REASON_PREFIX)) return message
    return REASON_PREFIX + "failed_" + error.javaClass.simpleName.lowercase()
  }
}
