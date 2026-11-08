/**
 * Focus & Routine Sprint Timer
 *
 * Configurable kid-friendly sprint timer presets and calculations for
 * daily family routines on the ApoloSign wall panel.
 */

export interface FocusPreset {
  id: string;
  title: string;
  emoji: string;
  seconds: number;
  tone: "amber" | "mint" | "cyan" | "lavender" | "coral";
  cheer: string;
}

export const FOCUS_PRESETS: FocusPreset[] = [
  {
    id: "brush",
    title: "Toothbrush Sprint",
    emoji: "🦷",
    seconds: 120,
    tone: "cyan",
    cheer: "Sparkling clean teeth! Keep brushing!",
  },
  {
    id: "cleanup",
    title: "5-Min Toy Cleanup",
    emoji: "🧸",
    seconds: 300,
    tone: "amber",
    cheer: "Beat the clock! Every toy back in its home!",
  },
  {
    id: "morning",
    title: "10-Min Morning Dash",
    emoji: "🎒",
    seconds: 600,
    tone: "mint",
    cheer: "Shoes, backpack, water bottle — ready to roll!",
  },
  {
    id: "homework",
    title: "15-Min Focus Block",
    emoji: "📚",
    seconds: 900,
    tone: "lavender",
    cheer: "Deep focus power! You're doing great!",
  },
  {
    id: "bedtime",
    title: "20-Min Bedtime Wind-Down",
    emoji: "🌙",
    seconds: 1200,
    tone: "coral",
    cheer: "PJs on, books out, calm and cozy!",
  },
];

export function formatTimerMMSS(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "00:00";
  }
  const s = Math.floor(totalSeconds);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function computeTimerProgress(
  remainingSeconds: number,
  totalSeconds: number,
): { pct: number; phaseLabel: string } {
  if (totalSeconds <= 0 || remainingSeconds <= 0) {
    return { pct: 100, phaseLabel: "Sprint Complete! 🎉" };
  }
  const elapsed = Math.max(0, totalSeconds - remainingSeconds);
  const rawPct = (elapsed / totalSeconds) * 100;
  const pct = Math.min(100, Math.max(0, Math.round(rawPct)));

  if (pct >= 50) {
    return { pct, phaseLabel: "Halfway there — keep going! 🌟" };
  }
  return { pct, phaseLabel: "Focused & rolling! 💪" };
}
