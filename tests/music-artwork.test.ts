import { toHighResArtworkUrl } from "../src/music/artwork";

describe("toHighResArtworkUrl", () => {
  it("returns null for null, undefined, or empty inputs", () => {
    expect(toHighResArtworkUrl(null)).toBeNull();
    expect(toHighResArtworkUrl(undefined)).toBeNull();
    expect(toHighResArtworkUrl("")).toBeNull();
    expect(toHighResArtworkUrl("   ")).toBeNull();
  });

  it("upgrades Google User Content thumbnails to 1200x1200 high definition", () => {
    const input = "https://lh3.googleusercontent.com/abc123xyz=w120-h120-l90-rj";
    const expected = "https://lh3.googleusercontent.com/abc123xyz=w1200-h1200-l90-rj";
    expect(toHighResArtworkUrl(input)).toBe(expected);

    const sThumb = "https://lh3.googleusercontent.com/sample=s120-c";
    expect(toHighResArtworkUrl(sThumb)).toBe("https://lh3.googleusercontent.com/sample=s1200-c");
  });

  it("upgrades YouTube video thumbnails to maxresdefault", () => {
    const input = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
    const expected = "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg";
    expect(toHighResArtworkUrl(input)).toBe(expected);
  });

  it("passes through unknown image sources unchanged", () => {
    const custom = "https://images.example.com/cover-art-large.png";
    expect(toHighResArtworkUrl(custom)).toBe(custom);
  });
});

