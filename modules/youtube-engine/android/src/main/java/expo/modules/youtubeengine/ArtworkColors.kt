package expo.modules.youtubeengine

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import androidx.palette.graphics.Palette
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.util.Locale
import kotlin.math.max
import kotlin.math.min

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
 *
 * THE SAME FILE OWNS THE BLURRED ARTWORK: the music surface's living backdrop
 * paints the cover, blurred, behind the stage. The blur is a native job (a
 * cover cannot be blurred in JS), and it answers with a `file://` URI in the
 * app's cache — or with null, when it fails.
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

  /* ── The blurred artwork (the living backdrop's image) ────────────────── */

  /** The cache's folder inside the app's cache directory. */
  private const val BLUR_CACHE_DIR = "artwork-blur"

  /** The written JPEG's width (the wall is 1080 wide). */
  private const val BLUR_TARGET_WIDTH = 1080

  /**
   * The box blur's own radius, in the SMALL copy's pixels.
   *
   * The blur's strength is carried by the copy's size, not by the kernel: a
   * wider requested radius means a smaller copy (and a softer field).
   */
  private const val BLUR_BOX_RADIUS = 4

  /** The box blur's passes (three passes of a small window read as a Gaussian). */
  private const val BLUR_PASSES = 3

  /** The small copy's bounds — never so small that the art's shape vanishes. */
  private const val BLUR_MIN_WORK = 64
  private const val BLUR_MAX_WORK = 320

  /** The radius the app may ask for. */
  private const val BLUR_MIN_RADIUS = 8
  private const val BLUR_MAX_RADIUS = 64

  /** The JPEG's quality — a colour field does not need much. */
  private const val BLUR_JPEG_QUALITY = 88

  /**
   * The blurred artwork at [url], as a `file://` URI in the app's cache.
   *
   * The backdrop's job is to be a COLOUR FIELD, not a picture: the artwork's
   * detail must be unreadable under the title, or the title is not readable.
   * So the pipeline is
   *
   *   fetch → decode → shrink → blur → grow → JPEG in the cache
   *
   * and the blur itself is a box blur over a SMALL copy. That is not a
   * shortcut, it is the same field a GPU blur gives: scaling the artwork
   * down to a couple of hundred pixels, blurring THAT, and scaling it back
   * up leaves no readable detail — for a fraction of the work, on every
   * Android version (no RenderEffect, no RenderScript, no API gate), and
   * inside the 400 ms the wall can afford.
   *
   * NEVER throws and NEVER rejects: every failure answers with null, and the
   * app falls back to the unblurred artwork under the tint scrim — a
   * wallpaper is an enhancement, never a blocker.
   *
   * The URL never becomes a path: the cache file is named after the URL's
   * SHA-256, so nothing readable (and nothing loggable) is written to disk.
   */
  fun blurred(
    url: String,
    radius: Int,
    client: OkHttpClient,
    cacheDir: File
  ): String? {
    if (url.isBlank()) return null
    return try {
      val file = File(File(cacheDir, BLUR_CACHE_DIR), "${cacheKey(url)}.jpg")
      // Already blurred once: the answer is on disk.
      if (file.exists() && file.length() > 0L) {
        Log.i(TAG, "artwork blur: cache hit")
        return Uri.fromFile(file).toString()
      }

      val started = System.nanoTime()
      val bytes = fetch(url, client)
      val fetched = System.nanoTime()
      val bitmap = decodeForBlur(bytes) ?: return null
      try {
        val field = blurField(bitmap, radius) ?: return null
        try {
          file.parentFile?.mkdirs()
          file.outputStream().use { out ->
            if (!field.compress(Bitmap.CompressFormat.JPEG, BLUR_JPEG_QUALITY, out)) {
              return null
            }
          }
          val done = System.nanoTime()
          // The numbers, never the URL: how long the cover's download took
          // and how long the blur itself took. The wall's budget is 400 ms
          // for the BLUR (the download is the network's business).
          Log.i(
            TAG,
            "artwork blur: fetch ${(fetched - started) / 1_000_000}ms, " +
              "blur ${(done - fetched) / 1_000_000}ms"
          )
          Uri.fromFile(file).toString()
        } finally {
          field.recycle()
        }
      } finally {
        bitmap.recycle()
      }
    } catch (error: Exception) {
      // Reason only: no URL, no bytes, no path.
      Log.w(TAG, "artwork blur failed: ${reasonFor(error)}")
      null
    }
  }

  /**
   * The cache file's name for one artwork: the URL's SHA-256.
   *
   * The URL itself never reaches the file system (and never a log): the hash
   * is stable, so the same cover is blurred once and the file is found again.
   */
  internal fun cacheKey(url: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(url.toByteArray(Charsets.UTF_8))
    return digest.joinToString("") { byte ->
      String.format(Locale.US, "%02x", byte.toInt() and 0xFF)
    }
  }

  /**
   * The artwork for the blur: decoded, and never larger than the target.
   */
  internal fun decodeForBlur(bytes: ByteArray): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= BLUR_TARGET_WIDTH) sample *= 2
    val options = BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
  }

  /**
   * The artwork as a soft colour field: shrunk, blurred, grown back.
   *
   * The small copy's width carries the requested radius: the box blur's own
   * radius is fixed, so a wider requested radius means a smaller copy — and
   * a softer field — at the same cost.
   */
  internal fun blurField(bitmap: Bitmap, radius: Int): Bitmap? {
    val wanted = radius.coerceIn(BLUR_MIN_RADIUS, BLUR_MAX_RADIUS)
    val workWidth = (BLUR_TARGET_WIDTH * BLUR_BOX_RADIUS / wanted)
      .coerceIn(BLUR_MIN_WORK, BLUR_MAX_WORK)
    val workHeight = max(1, bitmap.height * workWidth / max(1, bitmap.width))
    val small = Bitmap.createScaledBitmap(bitmap, workWidth, workHeight, true)
    try {
      boxBlur(small, BLUR_BOX_RADIUS, BLUR_PASSES)
      val outHeight = max(1, BLUR_TARGET_WIDTH * workHeight / workWidth)
      return Bitmap.createScaledBitmap(small, BLUR_TARGET_WIDTH, outHeight, true)
    } finally {
      if (small !== bitmap) small.recycle()
    }
  }

  /**
   * A box blur over the bitmap's own pixels.
   *
   * Three passes of a sliding window over a couple of hundred pixels: the
   * work is a few million operations, which is a few tens of milliseconds on
   * the panel — and it is the same answer on every device.
   */
  internal fun boxBlur(bitmap: Bitmap, radius: Int, passes: Int) {
    val width = bitmap.width
    val height = bitmap.height
    if (width <= 0 || height <= 0 || radius <= 0 || passes <= 0) return
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    val scratch = IntArray(pixels.size)
    for (pass in 0 until passes) {
      blurRows(pixels, scratch, width, height, radius)
      blurColumns(scratch, pixels, width, height, radius)
    }
    bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
  }

  /** The horizontal pass: each pixel takes the mean of its window's row. */
  private fun blurRows(src: IntArray, dst: IntArray, width: Int, height: Int, radius: Int) {
    for (y in 0 until height) {
      val offset = y * width
      for (x in 0 until width) {
        var a = 0
        var r = 0
        var g = 0
        var b = 0
        var n = 0
        val from = max(0, x - radius)
        val to = min(width - 1, x + radius)
        for (i in from..to) {
          val pixel = src[offset + i]
          a += (pixel ushr 24) and 0xFF
          r += (pixel shr 16) and 0xFF
          g += (pixel shr 8) and 0xFF
          b += pixel and 0xFF
          n++
        }
        dst[offset + x] = (a / n shl 24) or (r / n shl 16) or (g / n shl 8) or (b / n)
      }
    }
  }

  /** The vertical pass: each pixel takes the mean of its window's column. */
  private fun blurColumns(src: IntArray, dst: IntArray, width: Int, height: Int, radius: Int) {
    for (x in 0 until width) {
      for (y in 0 until height) {
        var a = 0
        var r = 0
        var g = 0
        var b = 0
        var n = 0
        val from = max(0, y - radius)
        val to = min(height - 1, y + radius)
        for (j in from..to) {
          val pixel = src[j * width + x]
          a += (pixel ushr 24) and 0xFF
          r += (pixel shr 16) and 0xFF
          g += (pixel shr 8) and 0xFF
          b += pixel and 0xFF
          n++
        }
        dst[y * width + x] = (a / n shl 24) or (r / n shl 16) or (g / n shl 8) or (b / n)
      }
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
