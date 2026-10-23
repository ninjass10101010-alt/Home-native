const { withAppBuildGradle } = require("@expo/config-plugins");

const CONSTRAINT =
  'constraints {\n        implementation("androidx.mediarouter:mediarouter:1.8.1") { because "cast-framework 22.3.1 declares 1.8.0-beta01; 1.9+ requires compileSdk 37" }\n    }';

module.exports = function withCastPins(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error("with-cast-pins expects a Groovy app/build.gradle");
    }
    if (cfg.modResults.contents.includes("androidx.mediarouter:mediarouter:1.8.1")) {
      return cfg;
    }
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /dependencies\s*\{/,
      (match) => `${match}\n    ${CONSTRAINT}`,
    );
    return cfg;
  });
};
