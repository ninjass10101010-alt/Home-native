/**
 * Artwork resolution and enhancement utilities for Apple Music-grade visual fidelity.
 *
 * YouTube Music / Google User Content thumbnails arrive downscaled by default
 * (e.g. `=w120-h120` or `=w544-h544` or `=s60`), which can look soft on high-DPI
 * displays. This helper upgrades those URLs to crystal-clear high-definition
 * resolution (1200x1200 or maxresdefault) while safely preserving any fallback.
 */

export function toHighResArtworkUrl(url: string | null | undefined, size = 1200): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Google User Content / YouTube Music CDN:
  // Patterns like =w120-h120-l90-rj, =w544-h544, =s120-c, etc.
  if (trimmed.includes("googleusercontent.com") || trimmed.includes("ggpht.com")) {
    if (/=w\d+-h\d+/.test(trimmed)) {
      return trimmed.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
    }
    if (/=s\d+/.test(trimmed)) {
      return trimmed.replace(/=s\d+/, `=s${size}`);
    }
  }

  // Standard YouTube video thumbnails:
  // e.g. https://i.ytimg.com/vi/<id>/hqdefault.jpg -> maxresdefault.jpg
  if (trimmed.includes("ytimg.com/vi/") && trimmed.includes("hqdefault.jpg")) {
    return trimmed.replace("hqdefault.jpg", "maxresdefault.jpg");
  }

  return trimmed;
}

