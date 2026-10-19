package expo.modules.youtubeengine

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class YoutubeEngineModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("YoutubeEngine")

    AsyncFunction("search") { query: String, limit: Int ->
      Engine.search(query, limit)
    }
    AsyncFunction("resolveAudio") { id: String ->
      Engine.resolveAudio(id)
    }
    AsyncFunction("related") { id: String ->
      Engine.related(id)
    }
  }
}