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
 * The timeouts are short on purpose: the search degrades to this path when
 * the badge path fails, and a slow dead network must not hold the app
 * hostage while it times out. They are the same ones the innertube client
 * uses.
 */
class NewPipeDownloader(
  private val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(Engine.CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    .readTimeout(Engine.READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
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
