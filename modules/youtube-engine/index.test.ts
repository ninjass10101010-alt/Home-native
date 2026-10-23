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
import { artworkColors } from "./index";

// The module under test is mocked GLOBALLY (the test setup fakes the whole
// engine), so this file asks for the real one. Jest hoists the call above
// the imports.
jest.unmock("./index");

// The package's MOCKED object (jest-expo already mocks expo-modules-core);
// the module lookup is faked on top of it, so the rest of the package's
// native surface stays exactly as the environment set it up.
const ExpoModulesCore = jest.requireMock("expo-modules-core");

const native = { artworkColors: jest.fn() };

beforeEach(() => {
  native.artworkColors.mockReset();
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
