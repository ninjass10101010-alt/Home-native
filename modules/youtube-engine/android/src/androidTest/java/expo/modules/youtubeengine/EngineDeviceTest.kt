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
 * MANUAL AND NETWORK-FLAKY — this is NOT a build gate:
 *
 *  - It hits the live YouTube, so it goes red whenever the network is down,
 *    YouTube reshapes its response, or the pinned client version rots.
 *  - It is deliberately NOT wired into `check`/`build` (AGP does not run
 *    `connectedDebugAndroidTest` there), so it can never break the app
 *    build. Run it on purpose:
 *    `./gradlew :youtube-engine:connectedDebugAndroidTest`
 *  - Its assertions are order-tolerant: YouTube may surface any row first,
 *    so they assert that a KNOWN track is present with the expected rating,
 *    never that it sits at a given index.
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

  private fun report(label: String, result: Map<String, Any?>, track: Map<*, *>?) {
    val count = (result["tracks"] as List<*>).size
    println(
      "PROBE $label count=$count " +
        "id=${track?.get("id")} title=${track?.get("title")} " +
        "explicit=${track?.get("explicit")} explicitKnown=${result["explicitKnown"]}"
    )
  }

  /**
   * The known track, wherever YouTube put it.
   *
   * The id is the stable thing about a track (the title is not: it is
   * spelled differently by different rows). The title is only a fallback, so
   * a re-spelling does not fail the gate — the order does not matter.
   */
  private fun knownTrack(tracks: List<Map<*, *>>, id: String, title: String): Map<*, *>? =
    tracks.firstOrNull { it["id"] == id }
      ?: tracks.firstOrNull { (it["title"] as? String)?.equals(title, ignoreCase = true) == true }

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
    val tracks = (result["tracks"] as List<*>).map { it as Map<*, *> }
    val loseYourself = knownTrack(tracks, "zlJ0Aj9y67c", "Lose Yourself")
    report("eminem", result, loseYourself)
    assertEquals(true, result["explicitKnown"])
    assertTrue("the search must return tracks", tracks.isNotEmpty())
    assertNotNull("the search must return the known explicit track", loseYourself)
    assertEquals(true, loseYourself!!["explicit"])
    assertTrue(
      "every badge-path track carries a known rating",
      tracks.all { it["explicit"] is Boolean }
    )
  }

  @Test
  fun cleanQueryStaysClean() {
    val result = Engine.search("adele hello", 5)
    val tracks = (result["tracks"] as List<*>).map { it as Map<*, *> }
    val hello = knownTrack(tracks, "yjo_aXygRDI", "Hello")
    report("adele", result, hello)
    assertEquals(true, result["explicitKnown"])
    assertTrue("the search must return tracks", tracks.isNotEmpty())
    assertNotNull("the search must return the known clean track", hello)
    assertEquals(false, hello!!["explicit"])
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
    val tracks = (result["tracks"] as List<*>).map { it as Map<*, *> }
    report("async", result, knownTrack(tracks, "zlJ0Aj9y67c", "Lose Yourself"))
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
