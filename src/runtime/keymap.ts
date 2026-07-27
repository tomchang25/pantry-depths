import type { GameCommand } from "@/core/run-state";

/**
 * W and S follow the eyes, A and D sidestep without changing them, and Q and E are the only inputs
 * that rotate. Splitting the sidestep away from the turn is what makes a one-cell lateral offset
 * cost one input instead of a turn, a step, and a turn back.
 */
const COMMAND_KEYS: Readonly<Record<string, GameCommand>> = {
  w: "forward",
  s: "backward",
  a: "strafeLeft",
  d: "strafeRight",
  q: "turnLeft",
  e: "turnRight",
  f: "interact",
};

/** Single-character keys compare case-insensitively; named keys (arrows, modifiers) are never mapped. */
export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/** Maps a raw `KeyboardEvent.key` to the one command it drives, or `undefined` outside W/A/S/D/Q/E/F. */
export function commandForKey(key: string): GameCommand | undefined {
  return COMMAND_KEYS[normalizeKey(key)];
}
