/**
 * The run's feedback channels: what a tick sounded like, what it said, and what it left on the floor.
 *
 * The bottom of the owner stack, and a leaf: it declares the shapes of its own channels and takes the
 * narrow slice of the run it writes, so it depends on no module that depends on it. Every one of these
 * records a decision somewhere presentation can find it; none of them makes one.
 */

import { holdsStains, isInsideGrid, tileIndex, type Maze } from "@/core/floor/maze";
import { nextId, type IdCounter } from "@/core/world/ids";
import type { SfxCueId } from "@/core/sfx-cues";

/** One sound a tick decided to make. An event, not a call: the rules layer may not reach the audio stack. */
export type SfxEvent = Readonly<{ id: SfxCueId; at?: Readonly<{ x: number; y: number }> }>;

/** A transient effect without an identity: `Omit` over a union distributes into an unsatisfiable type. */
export type VfxSpec =
  | { kind: "blast"; x: number; y: number; radius: number; age: number; life: number }
  | { kind: "arc"; fromX: number; fromY: number; toX: number; toY: number; age: number; life: number };

export type Vfx = VfxSpec & { id: string };

/**
 * A hit the player took, remembered long enough to point at where it came from. A world position, not
 * a screen angle, which would drag as the player turns. Severity scales loudness, never duration.
 */
export type DamageMark = {
  x: number;
  y: number;
  age: number;
  life: number;
  severity: number;
};

/**
 * The slice of the run these channels write.
 *
 * Structural, so the run state satisfies it without naming it. Stated as its own type rather than
 * taking the whole record because this module sits under everything: depending on the state module
 * would make the two a cycle, and none of the other forty-odd fields is any of feedback's business.
 */
export type FeedbackTarget = IdCounter & {
  sfxCues: SfxEvent[];
  message: string;
  messageSeconds: number;
  maze: Maze;
  stains: Float32Array;
  stainsVersion: number;
  vfx: Vfx[];
  damageMarks: DamageMark[];
};

/** How long a direction mark stays up, and how many can be on screen before the oldest is dropped. */
export const DAMAGE_MARK_SECONDS = 1.3;
export const MAX_DAMAGE_MARKS = 8;
/** The hit size that fills a mark out completely; anything heavier is already at full strength. */
const DAMAGE_MARK_FULL = 20;

/** Ceiling on how dark one cell can get, so a long fight does not end in a solid red floor. */
const MAX_STAIN = 0.72;

/** Reports one sound. The event carries a position only when it has one; a flat sound has none. */
export function raiseSfx(run: FeedbackTarget, id: SfxCueId, at?: Readonly<{ x: number; y: number }>): void {
  run.sfxCues.push(at ? { id, at } : { id });
}

/** Puts a line on the message channel. Deliberately silent: the line changes constantly. */
export function announce(run: FeedbackTarget, message: string, seconds = 2.2): void {
  run.message = message;
  run.messageSeconds = seconds;
}

/** Darkens one cell of the floor, up to the ceiling that keeps a long fight from ending in solid red. */
export function stainFloor(run: FeedbackTarget, x: number, y: number, amount: number): void {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);

  if (!isInsideGrid(run.maze, cellX, cellY)) {
    return;
  }

  // Refused here as well as at draw time, so a cell opened later does not reveal blood never visible on it.
  if (!holdsStains(run.maze, cellX, cellY)) {
    return;
  }

  const index = tileIndex(run.maze, cellX, cellY);
  run.stains[index] = Math.min(MAX_STAIN, (run.stains[index] ?? 0) + amount);
  run.stainsVersion += 1;
}

/** Adds a transient effect. Silent on purpose: a blast makes its own sound, and one per arc hop is a drum roll. */
export function addVfx(run: FeedbackTarget, effect: VfxSpec): void {
  run.vfx.push({ ...effect, id: nextId(run, "vfx") });
}

/** Records where a hit came from, so the frame can point at it until it fades. */
export function markDamageFrom(run: FeedbackTarget, amount: number, fromX: number, fromY: number): void {
  run.damageMarks.push({
    x: fromX,
    y: fromY,
    age: 0,
    life: DAMAGE_MARK_SECONDS,
    severity: Math.max(0.25, Math.min(1, amount / DAMAGE_MARK_FULL)),
  });

  if (run.damageMarks.length > MAX_DAMAGE_MARKS) {
    run.damageMarks.shift();
  }
}
