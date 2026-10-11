/**
 * The Home-side idle rule that settles the wall into /screensaver (WS-8).
 * Pure decision function so the wiring in app/index.tsx stays one obvious
 * expression, and the rule itself is unit-tested without mounting the wall.
 *
 * There was no Wave 1 idle hook to reuse (AuthProvider's idle timers only
 * govern SESSION expiry); this is the smallest honest rule: only the Home
 * route may idle into the board, only after a quiet spell, and never twice
 * without the family touching the wall again (Home stays mounted under the
 * pushed route, so without the `pushed` guard the board would stack).
 */

/** Quiet time before the Home wall hands over to the ambient board. */
export const SCREENSAVER_IDLE_MS = 90_000;
/** How often the Home route re-checks the quiet clock. */
export const IDLE_CHECK_MS = 5_000;

export interface IdleBoardArgs {
  /** Current route — the board only ever opens FROM Home. */
  pathname: string;
  /** Milliseconds since the family's last touch on the wall. */
  idleMs: number;
  /** True once the board has been pushed for this Home visit. */
  pushed: boolean;
  /** A modal flow is open (PIN pad, More… sheet): modal taps live in a
   *  separate window and the touch clock never sees them, so the wall MUST
   *  stand down instead of pushing the board mid-flow. */
  blocked: boolean;
}

export function idleBoardDue({ pathname, idleMs, pushed, blocked }: IdleBoardArgs): boolean {
  return pathname === "/" && !pushed && !blocked && idleMs >= SCREENSAVER_IDLE_MS;
}
