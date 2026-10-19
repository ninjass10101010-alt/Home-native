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
jest.mock("expo-audio", () => {
  const makePlayer = () => ({
    playing: false,
    isLoaded: true,
    currentTime: 0,
    duration: 0,
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    seekTo: jest.fn(async () => {}),
    remove: jest.fn(),
    setActiveForLockScreen: jest.fn(),
    updateLockScreenMetadata: jest.fn(),
    setPlaybackRate: jest.fn(),
  });
  return {
    useAudioRecorder: () => ({ record: jest.fn(), stop: jest.fn() }),
    useAudioPlayer: () => makePlayer(),
    useAudioPlayerStatus: () => ({
      isLoaded: true,
      playing: false,
      currentTime: 0,
      duration: 0,
      isBuffering: false,
      didJustFinish: false,
    }),
    createAudioPlayer: jest.fn(() => makePlayer()),
    setAudioModeAsync: jest.fn(async () => {}),
    AudioModule: {
      requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
      setAudioModeAsync: jest.fn(async () => {}),
    },
  };
});
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

// expo-file-system: new Paths/File/Directory API mock.
jest.mock("expo-file-system", () => {
  const join = (parts: any[]): string =>
    parts
      .map((part) => (typeof part === "string" ? part : part?.uri ?? ""))
      .join("/")
      .replace(/([^:])\/{2,}/g, "$1/");
  const File = jest.fn().mockImplementation((...parts: any[]) => ({
    uri: join(parts),
    exists: false,
    size: 0,
    delete: jest.fn(),
    create: jest.fn(),
  }));
  (File as any).downloadFileAsync = jest.fn(async (_url: string, destination: any) => destination);
  const Directory = jest.fn().mockImplementation((...parts: any[]) => ({
    uri: join(parts),
    exists: false,
    create: jest.fn(),
    delete: jest.fn(),
  }));
  const Paths = {
    document: { uri: "file:///mock/" },
    cache: { uri: "file:///mock-cache/" },
  };
  return {
    __esModule: true,
    default: { Paths, File, Directory },
    Paths,
    File,
    Directory,
  };
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

// expo-youtube-engine: native module is unavailable in jsdom. Individual tests
// override these with jest.mock when they assert behaviour.
jest.mock("./modules/youtube-engine", () => ({
  search: jest.fn(async () => []),
  related: jest.fn(async () => []),
  resolveAudio: jest.fn(async () => ({
    url: "https://example.invalid/audio.m4a",
    mimeType: "audio/mp4",
    contentLength: 1024,
    durationSeconds: 120,
    expiresAt: 0,
  })),
}));
