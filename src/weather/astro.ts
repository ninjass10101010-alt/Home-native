// Home-native/src/weather/astro.ts
/** Moon math — verbatim port of Home-ai src/lib/weather-astro.ts:11-44.
 *  No moonrise/moonset on the wall (Open-Meteo carries none; we never fake). */

/** Synodic month length in days. */
const SYNODIC_MONTH = 29.53058867;
/** Reference new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_EPOCH_UTC = Date.UTC(2000, 0, 6, 18, 14);

export function moonPhase(timestamp: number): { phase: number; illumination: number; waxing: boolean } {
  const days = (timestamp - NEW_MOON_EPOCH_UTC) / 86400000;
  const phase = (((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH) / SYNODIC_MONTH;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  return { phase, illumination, waxing: phase < 0.5 };
}

export function moonPhaseName(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return "New Moon";
  if (phase < 0.22) return "Waxing Crescent";
  if (phase < 0.28) return "First Quarter";
  if (phase < 0.47) return "Waxing Gibbous";
  if (phase < 0.53) return "Full Moon";
  if (phase < 0.72) return "Waning Gibbous";
  if (phase < 0.78) return "Last Quarter";
  return "Waning Crescent";
}

/**
 * SVG path (centered at 0,0 with radius r) of the lit part of the moon.
 * Northern-hemisphere orientation: waxing lights the right limb. The epsilon
 * keeps quarter phases from emitting zero-radius arcs.
 */
export function moonLitPath(phase: number, r: number): string {
  const p = ((phase % 1) + 1) % 1;
  const rx = Math.abs(Math.cos(p * Math.PI * 2)) * r;
  const waxing = p <= 0.5;
  if (waxing) {
    const gibbous = p > 0.25;
    return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${Math.max(rx, 0.01)} ${r} 0 0 ${gibbous ? 1 : 0} 0 ${-r} Z`;
  }
  const gibbous = p < 0.75;
  return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} A ${Math.max(rx, 0.01)} ${r} 0 0 ${gibbous ? 0 : 1} 0 ${-r} Z`;
}

function localISO(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Next full/new moon within 30 days. Hourly scan for the closest approach to
 * the target phase (0.5 full, 0/1 new; wrap handled by circular distance).
 * Returns local ISO dates (yyyy-mm-dd) or null when the window misses.
 */
export function nextMoonEvents(now: number): { nextFullISO: string | null; nextNewISO: string | null } {
  const circular = (a: number, b: number) => {
    const d = Math.abs(a - b);
    return Math.min(d, 1 - d);
  };
  const find = (target: number): string | null => {
    for (let h = 1; h <= 30 * 24; h++) {
      const t = now + h * 3600_000;
      const dist = circular(moonPhase(t).phase, target);
      const prevDist = circular(moonPhase(t - 3600_000).phase, target);
      if (dist < prevDist && dist < 0.5 / 30) return localISO(t);
    }
    return null;
  };
  return { nextFullISO: find(0.5), nextNewISO: find(0) };
}
