export type ActionTimings = Readonly<{
  forwardMoveDurationMs: number;
  turnDurationMs: number;
  attackDurationMs: number;
  attackReducedDurationMs: number;
  blockedMoveDurationMs: number;
  blockedMoveRecoilCells: number;
  blockedMoveTorchContraction: number;
  /** Peak radians the view leans toward the pointer; the facing itself never leaves its four values. */
  pointerLeanRadians: number;
  /** Constant angular speed the lean travels at, including the pull back to centre. */
  pointerLeanSpeedRadiansPerSecond: number;
}>;

/**
 * Authored presentation timings for the commands with a duration, plus the blocked-move cue. Every
 * step — forward, backward, and both sidesteps — shares `forwardMoveDurationMs`, because they are
 * the same distance travelled and a slower sidestep would read as the player wading. Held-forward
 * repeat has no cadence of its own: each step starts the moment the previous one settles.
 *
 * The recoil is measured in cells because it pulls the presentation camera straight back along its
 * own facing, which reads as a flinch. It is not a screen-space offset: sliding the rendered frame
 * instead makes the walls appear to bob rather than the view to recoil. The player stands at a cell
 * centre, so the value must stay well under 0.5 to keep the camera inside its own cell and out of
 * the wall behind.
 *
 * The pointer lean is presentation-only and deliberately small. It buys peripheral awareness at a
 * junction without becoming a second way to aim: the sword, every interaction, and every enemy
 * adjacency read the discrete facing, which the pointer cannot touch.
 */
export const ACTION_TIMINGS: ActionTimings = {
  forwardMoveDurationMs: 220,
  turnDurationMs: 180,
  attackDurationMs: 320,
  attackReducedDurationMs: 180,
  blockedMoveDurationMs: 200,
  blockedMoveRecoilCells: 0.07,
  blockedMoveTorchContraction: 0.45,
  pointerLeanRadians: Math.PI / 9,
  pointerLeanSpeedRadiansPerSecond: Math.PI / 3,
};

export const BLOCKED_MOVE_TEXT = "The way is blocked.";
