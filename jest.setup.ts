// Reanimated runs through a Jest mock in unit tests (no native worklets runtime).
/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factory idiom */
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
