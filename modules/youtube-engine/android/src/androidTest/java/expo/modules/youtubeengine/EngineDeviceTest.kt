package expo.modules.youtubeengine

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.AsyncFunctionWithPromiseComponent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * The device gate: the real engine, on a real device, against real YouTube.
 *
 * The unit tests prove the parsers over captured fixtures; this proves the
 * wire — that YouTube still answers the badge search, that the explicit
 * badge lands on the row it belongs to, and that the search runs off Expo's
 * shared async queue.
 *
 * It prints ids, titles and booleans only: no URLs, no cookies, no raw
 * bodies.
 */
@RunWith(AndroidJUnit4::class)
class EngineDeviceTest {

  private class RecordingPromise : Promise {
    @Volatile var value: Any? = null
    @Volatile var failure: String? = null
    @Volatile var settledOn: String? = null
    val latch = CountDownLatch(1)

    override fun resolve(value: Any?) {
      this.value = value
      this.settledOn = Thread.currentThread().name
      latch.countDown()
    }

    override fun reject(code: String?, message: String?, cause: Throwable?) {
      this.failure = "$code:$message"
      this.settledOn = Thread.currentThread().name
      latch.countDown()
    }
  }

  private fun report(label: String, result: Map<String, Any?>) {
    val tracks = (result["tracks"] as List<*>).map { it as Map<*, *> }
    val first = tracks.firstOrNull()
    println(
      "PROBE $label count=${tracks.size} " +
        "id=${first?.get("id")} title=${first?.get("title")} " +
        "explicit=${first?.get("explicit")} explicitKnown=${result["explicitKnown"]}"
    )
  }

  @Test
  fun theSearchFunctionOwnsThePromise() {
    val data = YoutubeEngineModule().definition()
    val search = data.asyncFunctions["search"]
    assertNotNull("search must be an async function", search)
    assertTrue(
      "search must own the promise, so the JS call is not held by the shared queue",
      search is AsyncFunctionWithPromiseComponent
    )
  }

  @Test
  fun explicitQueryKeepsItsBadge() {
    val result = Engine.search("eminem lose yourself", 5)
    report("eminem", result)
    assertEquals(true, result["explicitKnown"])
    val tracks = (result["tracks"] as List<*>).map { it as Map<*, *> }
    assertTrue("the search must return tracks", tracks.isNotEmpty())
    assertEquals(true, tracks.first()["explicit"])
    assertTrue(
      "every badge-path track carries a known rating",
      tracks.all { it["explicit"] is Boolean }
    )
  }

  @Test
  fun cleanQueryStaysClean() {
    val result = Engine.search("adele hello", 5)
    report("adele", result)
    assertEquals(true, result["explicitKnown"])
    val tracks = (result["tracks"] as List<*>).map { it as Map<*, *> }
    assertTrue("the search must return tracks", tracks.isNotEmpty())
    assertEquals(false, tracks.first()["explicit"])
    assertTrue(
      "every badge-path track carries a known rating",
      tracks.all { it["explicit"] is Boolean }
    )
  }

  @Test
  fun theAsyncPathResolvesOnItsOwnThread() {
    val promise = RecordingPromise()
    val caller = Thread.currentThread().name
    Engine.searchAsync("eminem lose yourself", 5, promise)
    assertTrue("the promise must settle", promise.latch.await(60, TimeUnit.SECONDS))
    assertNotNull("the promise must not reject: ${promise.failure}", promise.value)
    @Suppress("UNCHECKED_CAST")
    val result = promise.value as Map<String, Any?>
    report("async", result)
    assertEquals(true, result["explicitKnown"])
    assertTrue(
      "the work must not run on the caller's thread ($caller)",
      promise.settledOn != caller
    )
    assertTrue(
      "the work must run on an engine thread, was ${promise.settledOn}",
      promise.settledOn!!.startsWith("youtube-engine")
    )
  }
}
