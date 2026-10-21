package expo.modules.youtubeengine

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class YoutubeEngineModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("YoutubeEngine")

    // Every function below hands its work to the engine's own threads: the
    // JS call returns a promise that the engine settles later, so Expo's
    // shared async queue never sits behind a network call.
    AsyncFunction("search") { query: String, limit: Int, promise: Promise ->
      Engine.searchAsync(query, limit, promise)
    }
    AsyncFunction("resolveAudio") { id: String, promise: Promise ->
      Engine.resolveAudioAsync(id, promise)
    }
    AsyncFunction("related") { id: String, promise: Promise ->
      Engine.relatedAsync(id, promise)
    }
  }
}
