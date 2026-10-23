import { castErrorCopy, castMediaInfo, castStatusAction, normalizeCastState, toTargets } from "../src/music/cast";
import type { MediaTrack } from "../src/music/types";

const track: MediaTrack = {
  id: "yjo_aXygRDI", title: "Hello", artist: "Adele", album: "25",
  durationSeconds: 295, artworkUrl: "https://example.test/art.jpg",
  explicit: false, source: "youtube_music",
};

test("normalizeCastState maps the SDK enum and unknown input", () => {
  expect(normalizeCastState("connected")).toBe("connected");
  expect(normalizeCastState("noDevicesAvailable")).toBe("noDevicesAvailable");
  expect(normalizeCastState(null)).toBe("unavailable");
  expect(normalizeCastState("something-new")).toBe("unavailable");
});

test("toTargets drops blanks, dedupes by id and sorts by name", () => {
  expect(toTargets([
    { deviceId: "b", friendlyName: "Living Room" },
    { deviceId: "a", friendlyName: "Kitchen" },
    { deviceId: "a", friendlyName: "Kitchen" },
    { deviceId: "c", friendlyName: "  " },
  ])).toEqual([
    { id: "a", name: "Kitchen" },
    { id: "b", name: "Living Room" },
  ]);
});

test("castMediaInfo carries the resolved URL, mime and honest metadata", () => {
  expect(castMediaInfo(track, { url: "https://rr.example/audio", mimeType: "audio/mp4", durationSeconds: 295 })).toEqual({
    contentUrl: "https://rr.example/audio",
    contentType: "audio/mp4",
    contentId: "yjo_aXygRDI",
    streamType: "buffered",
    streamDuration: 295,
    metadata: {
      type: "musicTrack",
      title: "Hello",
      artist: "Adele",
      albumTitle: "25",
      images: [{ url: "https://example.test/art.jpg" }],
    },
  });
});

test("a missing duration omits streamDuration instead of sending 0", () => {
  const info = castMediaInfo(track, { url: "https://rr.example/a", mimeType: "audio/mp4", durationSeconds: null });
  expect("streamDuration" in info).toBe(false);
});

test("castStatusAction turns only real endings into advances", () => {
  expect(castStatusAction({ playerState: "idle", idleReason: "finished" })).toBe("advance");
  expect(castStatusAction({ playerState: "idle", idleReason: "error" })).toBe("error");
  expect(castStatusAction({ playerState: "playing", idleReason: null })).toBe("none");
  expect(castStatusAction(null)).toBe("none");
});

test("castErrorCopy names the target and never leaks a URL", () => {
  expect(castErrorCopy("Living Room")).toBe("Couldn't cast to Living Room.");
});
