/**
 * THE CODEC CHIP — what the stream REALLY is (SP3-B task 3).
 *
 * The Now Playing screen labels the stream it is playing: the codec and the
 * stream's own average bitrate, read from the resolution the engine made
 * (the `mimeType` and the `bitrate` of the stream that is actually playing).
 *
 * THE RULE IS ONE: NEVER INVENT A VALUE.
 *
 *   - A codec the answer cannot name is "—", never a guess. The container
 *     alone is not always the whole truth (a webm stream may be Opus or
 *     Vorbis), so a mime type that carries its codecs is read exactly, and a
 *     container we cannot map is honestly silent.
 *   - A bitrate the answer does not carry is LEFT OUT, not rounded up from
 *     nothing: the chip then names the codec alone. A rate that is not a
 *     rate (zero, negative, NaN) is no rate at all.
 *
 * PURE by contract (like the rest of the music surface's domain modules):
 * no I/O, no clock, no randomness — so the same resolution always produces
 * the same label, which is what makes the claim checkable.
 */

/** What the chip knows about the stream. */
export interface CodecChipInput {
  /**
   * The stream's mime type, as the engine resolved it.
   *
   * Either the bare container ("audio/mp4") or the full mime type with its
   * codecs ("audio/webm; codecs=\"opus\"") — the latter names the codec
   * exactly, and it wins.
   */
  mimeType: string | null;
  /** The stream's average bitrate, in bits per second. */
  bitrate: number | null;
  /**
   * The stream's OWN codec, as the engine read it off the stream it picked
   * ("mp4a.40.2", "opus", "vorbis").
   *
   * This is the exact truth, so it beats the container (a webm stream may be
   * Opus or Vorbis). It may be null: a stream that reports no codec reports
   * none, and the chip then falls back to the container.
   */
  codec?: string | null;
}

/** The chip's "nothing is known" face. */
const UNKNOWN = "—";

/**
 * The codec a bare container means.
 *
 * The engine's stream preference keeps this mapping true in practice (it
 * picks the AAC and Opus streams first), and a mime type that names its
 * codecs — or a codec the engine read off the stream — is read exactly
 * instead of through this table.
 */
const CONTAINER_CODEC: Record<string, string> = {
  "audio/mp4": "AAC",
  "audio/webm": "OPUS",
};

/**
 * The codec a token names, or null when it names none we know.
 *
 * The tokens are the engine's own ("mp4a.40.2", "opus", "vorbis") and the
 * codec parameter of a mime type ("opus", "mp4a.40.2").
 */
function codecFromToken(token: string | null | undefined): string | null {
  if (typeof token !== "string") return null;
  const value = token.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("opus")) return "OPUS";
  if (value.includes("mp4a") || value.includes("aac")) return "AAC";
  if (value.includes("vorbis")) return "VORBIS";
  if (value.includes("mp3") || value.includes("mpeg")) return "MP3";
  // A codec we cannot name is a codec we do not claim.
  return null;
}

/**
 * The codec a mime type names, or null when it names none we know.
 *
 * The codecs parameter wins: "audio/webm" alone may be Opus or Vorbis, but
 * "audio/webm; codecs=\"vorbis\"" is not in doubt.
 */
export function codecName(mimeType: string | null): string | null {
  if (typeof mimeType !== "string") return null;
  const value = mimeType.trim().toLowerCase();
  if (!value) return null;

  const codecs = value.match(/codecs\s*=\s*"?([^";]+)"?/);
  if (codecs) return codecFromToken(codecs[1]);

  return CONTAINER_CODEC[value.split(";")[0].trim()] ?? null;
}

/**
 * The rate in whole kbps, or null when there is no rate.
 *
 * A rate that is not a rate — not a number, not finite, not positive — is no
 * rate at all, and the chip leaves it out rather than printing a zero it did
 * not measure.
 */
function rateInKbps(bitrate: number | null): number | null {
  if (typeof bitrate !== "number") return null;
  if (!Number.isFinite(bitrate)) return null;
  if (bitrate <= 0) return null;
  return Math.round(bitrate / 1000);
}

/**
 * The chip's label for one resolved stream.
 *
 * "AAC · 128 kbps" · "OPUS · 142 kbps" · "AAC" (a codec with no measured
 * rate) · "—" (nothing known).
 */
export function formatCodecChip(input: CodecChipInput): string {
  // The engine's own codec is the exact truth and beats the container. When
  // it is there but names nothing we know, the chip says NOTHING: the
  // container's guess would be a claim the engine's answer contradicts.
  const reported =
    typeof input.codec === "string" && input.codec.trim().length > 0;
  const codec = reported ? codecFromToken(input.codec) : codecName(input.mimeType);
  if (!codec) return UNKNOWN;
  const rate = rateInKbps(input.bitrate);
  return rate === null ? codec : `${codec} · ${rate} kbps`;
}
