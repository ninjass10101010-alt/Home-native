/**
 * Jest resolver combining:
 *  - react-native-worklets' resolver (strips `.native` extensions for its own
 *    modules so the Jest mocks load instead of the native runtime), and
 *  - the React Native preset resolver (RN package "exports" compat) for
 *    everything else.
 */
const presetResolver = require("@react-native/jest-preset/jest/resolver.js");
const workletsResolver = require("react-native-worklets/jest/resolver.js");

module.exports = (request, options) => {
  const touchesWorklets =
    request.includes("react-native-worklets") ||
    (options.basedir && options.basedir.includes("react-native-worklets"));
  return touchesWorklets
    ? workletsResolver(request, options)
    : presetResolver(request, options);
};
