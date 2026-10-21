package expo.modules.youtubeengine

import expo.modules.kotlin.Promise
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * The engine must never sit on Expo's shared async queue.
 *
 * Every `AsyncFunction` body runs on ONE HandlerThread that the whole app
 * shares ("expo.modules.AsyncFunctionQueue"). A blocking network call there
 * stalls every other native call for as long as it takes, so the engine hands
 * its work to threads of its own and settles the promise there.
 *
 * This is the tripwire for that: if the engine ever goes back to running its
 * work on the caller's thread, the promise would be settled by the caller's
 * thread and this test fails.
 */
class EngineThreadingTest {

  private class RecordingPromise : Promise {
    @Volatile var value: Any? = null
    @Volatile var settledOn: String? = null
    @Volatile var failure: String? = null
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

  @Test
  fun `the engine works on its own thread, not on the caller's`() {
    val promise = RecordingPromise()
    val caller = Thread.currentThread().name
    Engine.onEngineThread(promise) { "done" }

    assertTrue("the promise must settle", promise.latch.await(10, TimeUnit.SECONDS))
    assertEquals("done", promise.value)
    assertTrue(
      "the work must not run on the caller's thread ($caller)",
      promise.settledOn != caller
    )
    assertTrue(
      "the work must run on an engine thread, was ${promise.settledOn}",
      promise.settledOn!!.startsWith("youtube-engine")
    )
  }

  @Test
  fun `a failing engine call rejects the promise instead of hanging`() {
    val promise = RecordingPromise()
    Engine.onEngineThread(promise) { throw IllegalStateException("no_audio_stream") }

    assertTrue("the promise must settle", promise.latch.await(10, TimeUnit.SECONDS))
    assertTrue("the promise must be rejected: ${promise.value}", promise.failure != null)
  }

  @Test
  fun `an error inside the task rejects the promise instead of hanging`() {
    val promise = RecordingPromise()
    // The error is rethrown (an `Error` is a bug, not a search failure), so
    // the worker thread dies with it. That is the crash semantics; what this
    // test pins is that the promise still settles on the way out.
    Engine.onEngineThread(promise) { throw AssertionError("boom") }

    assertTrue("the promise must settle", promise.latch.await(10, TimeUnit.SECONDS))
    assertTrue("the promise must be rejected: ${promise.value}", promise.failure != null)
  }
}
