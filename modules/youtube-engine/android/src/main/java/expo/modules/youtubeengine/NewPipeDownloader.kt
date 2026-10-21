package expo.modules.youtubeengine

import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * NewPipe's transport.
 *
 * The timeouts are generous on purpose: this transport also carries the
 * playback resolution (`StreamInfo.getInfo` makes two to three sequential
 * requests), and a resolution that used to succeed on a slow link must not
 * start failing. The short timeouts of the badge client are the badge
 * client's alone.
 *
 * The fallback *search* does not need to be generous: it carries its own
 * deadline in the engine, so a rotten badge client still degrades fast.
 */
class NewPipeDownloader(
  private val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(Engine.DOWNLOADER_CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    .readTimeout(Engine.DOWNLOADER_READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    .build()
) : Downloader() {
  override fun execute(request: Request): Response {
    val method = request.httpMethod().uppercase(Locale.ROOT)
    val bodyBytes = request.dataToSend()
    val builder = okhttp3.Request.Builder()
      .url(request.url())
    when (method) {
      "POST", "PUT", "PATCH" ->
        builder.method(method, (bodyBytes ?: ByteArray(0)).toRequestBody())
      "GET", "HEAD" ->
        builder.method(method, null)
      else ->
        builder.method(method, bodyBytes?.toRequestBody())
    }

    request.headers().forEach { (name, values) ->
      values.forEach { value -> builder.addHeader(name, value) }
    }

    client.newCall(builder.build()).execute().use { res ->
      return Response(
        res.code,
        res.message,
        res.headers.toMultimap(),
        res.body?.string(),
        res.request.url.toString()
      )
    }
  }
}
