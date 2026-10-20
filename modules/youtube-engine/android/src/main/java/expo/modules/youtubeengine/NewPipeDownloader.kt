package expo.modules.youtubeengine

import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import java.util.concurrent.TimeUnit

class NewPipeDownloader(
  private val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(20, TimeUnit.SECONDS)
    .build()
) : Downloader() {
  override fun execute(request: Request): Response {
    val builder = okhttp3.Request.Builder()
      .url(request.url())
      .method(request.httpMethod(), request.dataToSend()?.toRequestBody())

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
