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

// Expo SDK 57 hardware modules — STAGED, deliberately not yet imported by app
// code (hardware wave: implement later — brightness/screensaver backlight,
// haptics, upload, voice, offline detection). The mocks below keep unit tests
// loading-free from day one of the install, so wiring them costs no gate churn.
// If a future wave REMOVES a dep, remove its mock with it.
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "Light", Heavy: "Heavy" },
  NotificationFeedbackType: { Success: "Success", Error: "Error" },
}));
jest.mock("expo-brightness", () => ({
  setBrightnessAsync: jest.fn(async () => {}),
  getBrightnessAsync: jest.fn(async () => 0.7),
}));
jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  MediaTypeOptions: { All: "All", Images: "Images", Videos: "Videos" },
}));
jest.mock("expo-audio", () => ({
  useAudioRecorder: () => ({ record: jest.fn(), stop: jest.fn() }),
  useAudioPlayer: () => ({
    playing: false,
    isLoaded: false,
    currentTime: 0,
    duration: 0,
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    remove: jest.fn(),
  }),
  useAudioPlayerStatus: () => ({ isLoaded: false, playing: false, currentTime: 0, duration: 0 }),
  createAudioPlayer: jest.fn(() => ({
    playing: false,
    isLoaded: false,
    currentTime: 0,
    duration: 0,
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    remove: jest.fn(),
  })),
  AudioModule: { requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })) },
}));
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(async () => ({ isConnected: true })),
}));
jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const make = (name: string) => {
    const C = ({ children, ...props }: { children?: unknown } & Record<string, unknown>) =>
      React.createElement(name, props, children as never);
    C.displayName = name;
    return C;
  };
  // Host-string stand-in named after the real native component (both platforms
  // render ExpoLinearGradient), props forwarded so testIDs/styles stay queryable.
  return { LinearGradient: make("ExpoLinearGradient") };
});

// expo-file-system: new Paths/File API mock.
jest.mock("expo-file-system", () => {
  const File = jest.fn().mockImplementation((dir: any, name: string) => ({
    uri: `file:///mock/${name}`,
    exists: false,
  }));
  (File as any).downloadFileAsync = jest.fn(async () => ({ exists: true }));
  const Paths = { document: { uri: "file:///mock/" } };
  return { __esModule: true, default: { Paths, File }, Paths, File };
});

// expo-notifications: no-op mock.
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
}));
