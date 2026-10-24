/**
 * The JS wrapper around the native colour extraction (SP2 Task 2).
 *
 * The native side reads the artwork's dominant colour on-device (AndroidX
 * Palette) and NEVER throws there. This wrapper adds the two things JS is
 * good at, and they are the contract:
 *
 *  - a SHAPE that cannot lie — a missing or wrongly typed field becomes
 *    null, never a made-up colour;
 *  - a CACHE, so a cover is read once and the cache is bounded.
 *
 * Every failure path answers with two nulls, and the stage falls back to the
 * app's accent token.
 */
import {
  artworkBlurred,
  artworkColors,
  lastStreamFormat,
  resolveAudio,
  subscribeStreamFormat,
} from "./index";

// The module under test is mocked GLOBALLY (the test setup fakes the whole
// engine), so this file asks for the real one. Jest hoists the call above
// the imports.
jest.unmock("./index");

// The package's MOCKED object (jest-expo already mocks expo-modules-core);
// the module lookup is faked on top of it, so the rest of the package's
// native surface stays exactly as the environment set it up.
const ExpoModulesCore = jest.requireMock("expo-modules-core");

const native = {
  artworkColors: jest.fn(),
  artworkBlurred: jest.fn(),
  resolveAudio: jest.fn(),
};

beforeEach(() => {
  native.artworkColors.mockReset();
  native.artworkBlurred.mockReset();
  native.resolveAudio.mockReset();
  jest
    .spyOn(ExpoModulesCore, "requireNativeModule")
    .mockReturnValue(native as never);
});

describe("artworkColors", () => {
  it("answers with the colours the native side read", async () => {
    native.artworkColors.mockResolvedValue({
      dominant: "#FF2D55",
      vibrant: "#30D158",
    });
    await expect(artworkColors("https://img.invalid/a.jpg")).resolves.toEqual({
      dominant: "#FF2D55",
      vibrant: "#30D158",
    });
  });

  it("never invents a colour: a missing or wrongly typed field becomes null", async () => {
    native.artworkColors.mockResolvedValue({ dominant: 42 });
    await expect(artworkColors("https://img.invalid/b.jpg")).resolves.toEqual({
      dominant: null,
      vibrant: null,
    });

    native.artworkColors.mockResolvedValue(null);
    await expect(artworkColors("https://img.invalid/c.jpg")).resolves.toEqual({
      dominant: null,
      vibrant: null,
    });
  });

  it("a native failure answers with nulls, never a rejection", async () => {
    native.artworkColors.mockRejectedValue(new Error("no module"));
    await expect(artworkColors("https://img.invalid/d.jpg")).resolves.toEqual({
      dominant: null,
      vibrant: null,
    });
  });

  it("a blank url answers with nulls and never reaches the native side", async () => {
    await expect(artworkColors("   ")).resolves.toEqual({
      dominant: null,
      vibrant: null,
    });
    expect(native.artworkColors).not.toHaveBeenCalled();
  });

  it("reads a cover once", async () => {
    native.artworkColors.mockResolvedValue({ dominant: "#3B82F6", vibrant: null });
    await artworkColors("https://img.invalid/e.jpg");
    await artworkColors("https://img.invalid/e.jpg");
    expect(native.artworkColors).toHaveBeenCalledTimes(1);
  });

  it("keeps the cache bounded: an evicted cover is read again", async () => {
    native.artworkColors.mockResolvedValue({ dominant: "#3B82F6", vibrant: null });
    const first = "https://img.invalid/first.jpg";
    await artworkColors(first);
    expect(native.artworkColors).toHaveBeenCalledTimes(1);

    // 100 more covers push the first one out of the bounded cache.
    for (let i = 0; i < 100; i++) {
      await artworkColors(`https://img.invalid/fill-${i}.jpg`);
    }
    expect(native.artworkColors).toHaveBeenCalledTimes(101);

    // The first cover was evicted, so it is read again — the cache is bounded
    // (it never grows past its ceiling) instead of growing forever.
    await artworkColors(first);
    expect(native.artworkColors).toHaveBeenCalledTimes(102);
  });
});

/**
 * The blurred artwork (the living backdrop's image).
 *
 * The native side writes the blurred cover into the app's cache and answers
 * with a `file://` URI. The wrapper's contract is the colour extraction's:
 * a failure answers with null and NEVER with a rejection — a wallpaper is an
 * enhancement, and the app falls back to the raw cover under the tint scrim.
 */
describe("artworkBlurred", () => {
  it("answers with the URI the native side wrote", async () => {
    native.artworkBlurred.mockResolvedValue("file:///cache/artwork-blur/abc.jpg");
    await expect(artworkBlurred("https://img.invalid/a.jpg")).resolves.toBe(
      "file:///cache/artwork-blur/abc.jpg"
    );
    expect(native.artworkBlurred).toHaveBeenCalledWith(
      "https://img.invalid/a.jpg",
      24
    );
  });

  it("never invents a URI: a missing or wrongly typed answer becomes null", async () => {
    native.artworkBlurred.mockResolvedValue(42);
    await expect(artworkBlurred("https://img.invalid/b.jpg")).resolves.toBeNull();

    native.artworkBlurred.mockResolvedValue("");
    await expect(artworkBlurred("https://img.invalid/c.jpg")).resolves.toBeNull();

    native.artworkBlurred.mockResolvedValue(null);
    await expect(artworkBlurred("https://img.invalid/d.jpg")).resolves.toBeNull();
  });

  it("a native failure answers with null, never a rejection", async () => {
    native.artworkBlurred.mockRejectedValue(new Error("no module"));
    await expect(artworkBlurred("https://img.invalid/e.jpg")).resolves.toBeNull();
  });

  it("a blank url answers with null and never reaches the native side", async () => {
    await expect(artworkBlurred("   ")).resolves.toBeNull();
    expect(native.artworkBlurred).not.toHaveBeenCalled();
  });

  it("blurs a cover once — and remembers a FAILURE too", async () => {
    native.artworkBlurred.mockResolvedValue("file:///cache/artwork-blur/one.jpg");
    await artworkBlurred("https://img.invalid/f.jpg");
    await artworkBlurred("https://img.invalid/f.jpg");
    expect(native.artworkBlurred).toHaveBeenCalledTimes(1);

    // A cover that could not be blurred must not be asked again on every
    // render of the stage.
    native.artworkBlurred.mockResolvedValue(null);
    await artworkBlurred("https://img.invalid/g.jpg");
    await artworkBlurred("https://img.invalid/g.jpg");
    expect(native.artworkBlurred).toHaveBeenCalledTimes(2);
  });

  it("a different radius is a different artwork", async () => {
    native.artworkBlurred.mockResolvedValue("file:///cache/artwork-blur/h.jpg");
    await artworkBlurred("https://img.invalid/h.jpg", 24);
    await artworkBlurred("https://img.invalid/h.jpg", 48);
    expect(native.artworkBlurred).toHaveBeenCalledTimes(2);
    expect(native.artworkBlurred).toHaveBeenLastCalledWith(
      "https://img.invalid/h.jpg",
      48
    );
  });
});

/**
 * THE STREAM RESOLUTION — the codec chip's truth (SP3-B task 3).
 *
 * The engine resolves a playable stream for a track; that answer carries the
 * stream's CONTAINER and its AVERAGE BITRATE. The wrapper's job here is the
 * same as everywhere else: a shape that cannot lie. A bitrate the native side
 * did not report (or reported as something other than a number) becomes null
 * — never a made-up rate — and the chip then says nothing about the rate.
 *
 * The wrapper also REMEMBERS the last resolution, so the Now Playing screen
 * can label the stream it is actually playing (the resolution happens in the
 * playback provider and in the cast provider — the same stream either way).
 */
describe("resolveAudio", () => {
  const RESOLVED = {
    url: "https://stream.invalid/audio.m4a",
    mimeType: "audio/mp4",
    contentLength: null,
    durationSeconds: 120,
    expiresAt: 0,
  };

  it("answers with the bitrate the native side read", async () => {
    native.resolveAudio.mockResolvedValue({ ...RESOLVED, bitrate: 128000 });
    await expect(resolveAudio("abc12345678")).resolves.toEqual(
      expect.objectContaining({ mimeType: "audio/mp4", bitrate: 128000 })
    );
  });

  it("answers with the codec the native side read", async () => {
    native.resolveAudio.mockResolvedValue({ ...RESOLVED, bitrate: 128000, codec: "mp4a.40.2" });
    await expect(resolveAudio("abc12345678")).resolves.toEqual(
      expect.objectContaining({ codec: "mp4a.40.2" })
    );
  });

  it("never invents a codec: a missing or wrongly typed one is null", async () => {
    native.resolveAudio.mockResolvedValue({ ...RESOLVED, codec: 42 });
    await expect(resolveAudio("abc12345678")).resolves.toEqual(
      expect.objectContaining({ codec: null })
    );

    native.resolveAudio.mockResolvedValue({ ...RESOLVED });
    await expect(resolveAudio("abc12345678")).resolves.toEqual(
      expect.objectContaining({ codec: null })
    );
  });

  it("a native answer that is not an answer stays a failure, never a half-built one", async () => {
    // The caller must see the SAME failure it always saw (no stream at all),
    // not an object with a URL that is missing.
    native.resolveAudio.mockResolvedValue(null);
    await expect(resolveAudio("abc12345678")).resolves.toBeNull();
  });

  it("never invents a bitrate: a missing or wrongly typed one is null", async () => {
    native.resolveAudio.mockResolvedValue({ ...RESOLVED, bitrate: "128000" });
    await expect(resolveAudio("abc12345678")).resolves.toEqual(
      expect.objectContaining({ bitrate: null })
    );

    native.resolveAudio.mockResolvedValue({ ...RESOLVED });
    await expect(resolveAudio("abc12345678")).resolves.toEqual(
      expect.objectContaining({ bitrate: null })
    );
  });

  it("remembers the last resolution and tells the listeners", async () => {
    const seen: unknown[] = [];
    const stop = subscribeStreamFormat((format) => seen.push(format));
    native.resolveAudio.mockResolvedValue({
      ...RESOLVED,
      mimeType: "audio/webm",
      bitrate: 142000,
    });
    await resolveAudio("track000001");

    expect(lastStreamFormat()).toEqual({
      id: "track000001",
      mimeType: "audio/webm",
      bitrate: 142000,
      codec: null,
    });
    expect(seen).toEqual([
      { id: "track000001", mimeType: "audio/webm", bitrate: 142000, codec: null },
    ]);

    // a listener that unsubscribes hears nothing more
    stop();
    native.resolveAudio.mockResolvedValue({ ...RESOLVED, bitrate: 99000 });
    await resolveAudio("track000002");
    expect(seen).toHaveLength(1);
  });
});
