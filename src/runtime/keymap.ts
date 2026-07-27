import type { GameCommand } from "@/core/run-state";

const COMMAND_KEYS: Readonly<Record<string, GameCommand>> = {
  w: "forward",
  a: "turnLeft",
  d: "turnRight",
  s: "backward",
  e: "interact",
};

/** Single-character keys compare case-insensitively; named keys (arrows, modifiers) are never mapped. */
export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/** Maps a raw `KeyboardEvent.key` to the one command it drives, or `undefined` outside W/A/S/D/E. */
export function commandForKey(key: string): GameCommand | undefined {
  return COMMAND_KEYS[normalizeKey(key)];
}
