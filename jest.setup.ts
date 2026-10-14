// Reanimated runs through a Jest mock in unit tests (no native worklets runtime).
/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factory idiom */
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

// react-native-svg: host-string stand-ins so tests can query props (no native SVG).
jest.mock("react-native-svg", () => {
  const React = require("react");
  const make = (name: string) => {
    const C = ({ children, ...props }: { children?: unknown } & Record<string, unknown>) =>
      React.createElement(name, props, children as never);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: make("Svg"),
    Svg: make("Svg"),
    G: make("G"),
    Circle: make("Circle"),
    Rect: make("Rect"),
    Line: make("Line"),
    Path: make("Path"),
    Ellipse: make("Ellipse"),
    Polygon: make("Polygon"),
    Defs: make("Defs"),
    ClipPath: make("ClipPath"),
  };
});

// expo-font: fonts are "loaded" in tests; system fallback is never exercised.
jest.mock("expo-font", () => ({
  useFonts: () => [true, null],
}));
