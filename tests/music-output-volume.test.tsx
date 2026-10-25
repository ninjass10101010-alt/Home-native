import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useOutputVolume } from "../src/music/output-volume";
import { useCast } from "../src/music/CastProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("../src/music/CastProvider");
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockPlayer = { volume: 0.5 };

describe("useOutputVolume", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer.volume = 0.5;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("routes to cast volume when casting", async () => {
    const mockSetVolume = jest.fn();
    const mockAdjustVolume = jest.fn();
    const mockToggleMute = jest.fn();

    (useCast as jest.Mock).mockReturnValue({
      casting: true,
      volume: 0.8,
      muted: false,
      setVolume: mockSetVolume,
      adjustVolume: mockAdjustVolume,
      toggleMute: mockToggleMute,
    });

    const { result } = renderHook(() => useOutputVolume(mockPlayer));

    expect(result.current.target).toBe("cast");
    expect(result.current.value).toBe(0.8);
    expect(result.current.muted).toBe(false);

    act(() => {
      result.current.setValue(0.6);
    });

    expect(mockSetVolume).toHaveBeenCalledWith(0.6);

    act(() => {
      result.current.nudge(0.02);
    });

    expect(mockAdjustVolume).toHaveBeenCalledWith(0.02);

    act(() => {
      result.current.toggleMute();
    });

    expect(mockToggleMute).toHaveBeenCalled();
  });

  it("routes to local volume when not casting", async () => {
    (useCast as jest.Mock).mockReturnValue({
      casting: false,
      volume: 0.5,
      muted: false,
      setVolume: jest.fn(),
      adjustVolume: jest.fn(),
      toggleMute: jest.fn(),
    });

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("0.7");

    const { result } = renderHook(() => useOutputVolume(mockPlayer));

    await waitFor(() => {
      expect(result.current.value).toBe(0.7);
    });

    expect(result.current.target).toBe("local");

    await act(async () => {
      result.current.setValue(0.5);
    });

    expect(mockPlayer.volume).toBe(0.5);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("music.localVolume", "0.5");
  });

  it("defaults to 0.5 if no persisted local volume", async () => {
    (useCast as jest.Mock).mockReturnValue({ casting: false });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useOutputVolume(mockPlayer));

    expect(result.current.value).toBe(0.5);
  });

  it("clamps local volume to 0..1", async () => {
    (useCast as jest.Mock).mockReturnValue({ casting: false });

    const { result } = renderHook(() => useOutputVolume(mockPlayer));

    await act(async () => {
      result.current.setValue(1.5);
    });

    expect(mockPlayer.volume).toBe(1.0);
  });
});
