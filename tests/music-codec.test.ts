/**
 * THE CODEC CHIP — the Now Playing screen's honest stream label (SP3-B task 3).
 *
 * The chip states what the ENGINE actually resolved for the stream that is
 * playing: the container's codec and the stream's own average bitrate. It is
 * a claim about a real measurement, so the rule is simple:
 *
 *   NEVER INVENT A VALUE. A codec we cannot name is "—", not a guess; a
 *   bitrate we do not have is left out, not rounded up from nothing.
 *
 * The chip is PURE (no I/O, no clock, no randomness), so the same input always
 * gives the same label — which is what makes it testable at all.
 */
import { formatCodecChip } from "../src/music/codec";

describe("the codec chip", () => {
  it("names the codec and the bitrate of a resolved stream", () => {
    expect(formatCodecChip({ mimeType: "audio/mp4", bitrate: 128000 })).toBe("AAC · 128 kbps");
    expect(formatCodecChip({ mimeType: "audio/webm", bitrate: 142000 })).toBe("OPUS · 142 kbps");
  });

  it("says nothing at all when nothing is known", () => {
    expect(formatCodecChip({ mimeType: null, bitrate: null })).toBe("—");
  });

  it("never invents a codec: a container it cannot name is an honest dash", () => {
    expect(formatCodecChip({ mimeType: "audio/ogg", bitrate: 128000 })).toBe("—");
    expect(formatCodecChip({ mimeType: "", bitrate: 128000 })).toBe("—");
  });

  it("never invents a bitrate: a known codec with no rate names the codec alone", () => {
    expect(formatCodecChip({ mimeType: "audio/mp4", bitrate: null })).toBe("AAC");
    // a rate that is not a rate (zero, negative, NaN) is NO rate
    expect(formatCodecChip({ mimeType: "audio/mp4", bitrate: 0 })).toBe("AAC");
    expect(formatCodecChip({ mimeType: "audio/mp4", bitrate: -1 })).toBe("AAC");
    expect(formatCodecChip({ mimeType: "audio/mp4", bitrate: Number.NaN })).toBe("AAC");
  });

  it("reads the codec out of a mime type that carries one", () => {
    // The engine's raw mime type names the codec; the container alone does
    // not always tell the whole truth (a webm stream may be Opus or Vorbis).
    expect(formatCodecChip({ mimeType: 'audio/webm; codecs="opus"', bitrate: 142000 })).toBe(
      "OPUS · 142 kbps"
    );
    expect(formatCodecChip({ mimeType: 'audio/mp4; codecs="mp4a.40.2"', bitrate: 128000 })).toBe(
      "AAC · 128 kbps"
    );
    expect(formatCodecChip({ mimeType: 'audio/webm; codecs="vorbis"', bitrate: 128000 })).toBe(
      "VORBIS · 128 kbps"
    );
  });

  it("believes the engine's own codec over the container", () => {
    // The engine reads the codec off the stream it picked ("mp4a.40.2",
    // "opus", "vorbis"). That is the exact truth; the container is only a
    // guess, so the exact answer wins.
    expect(formatCodecChip({ mimeType: "audio/webm", bitrate: 128000, codec: "vorbis" })).toBe(
      "VORBIS · 128 kbps"
    );
    expect(formatCodecChip({ mimeType: "audio/mp4", bitrate: 128000, codec: "mp4a.40.2" })).toBe(
      "AAC · 128 kbps"
    );
    expect(formatCodecChip({ mimeType: "audio/mp4", bitrate: 128000, codec: "opus" })).toBe(
      "OPUS · 128 kbps"
    );
    // a codec nobody can name is still nobody's claim
    expect(formatCodecChip({ mimeType: "audio/mp4", bitrate: 128000, codec: "wibble" })).toBe("—");
  });

  it("rounds the rate to whole kbps — never to a made-up precision", () => {
    expect(formatCodecChip({ mimeType: "audio/mp4", bitrate: 128500 })).toBe("AAC · 129 kbps");
    expect(formatCodecChip({ mimeType: "audio/mp4", bitrate: 129400 })).toBe("AAC · 129 kbps");
    // a rate below 1 kbps is still a rate, and it is not rounded away
    expect(formatCodecChip({ mimeType: "audio/mp4", bitrate: 400 })).toBe("AAC · 0 kbps");
  });
});
