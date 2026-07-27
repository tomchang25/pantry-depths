export type ActionTimings = Readonly<{
  forwardMoveDurationMs: number;
  turnDurationMs: number;
  attackDurationMs: number;
  attackReducedDurationMs: number;
  backwardRejectionDurationMs: number;
  backwardRejectionRecoilCells: number;
  backwardRejectionTorchContraction: number;
}>;

/**
 * Authored presentation timings for the three commands with a duration, plus the backward
 * rejection cue. Held-forward repeat has no cadence of its own: each step starts the moment the
 * previous one settles, at `forwardMoveDurationMs`.
 *
 * The rejection recoil is measured in cells because it pulls the presentation camera straight
 * back along its own facing, which reads as a flinch. It is not a screen-space offset: sliding
 * the rendered frame instead makes the walls appear to bob rather than the view to recoil. The
 * player stands at a cell centre, so the value must stay well under 0.5 to keep the camera
 * inside its own cell and out of the wall behind.
 */
export const ACTION_TIMINGS: ActionTimings = {
  forwardMoveDurationMs: 220,
  turnDurationMs: 180,
  attackDurationMs: 320,
  attackReducedDurationMs: 180,
  backwardRejectionDurationMs: 200,
  backwardRejectionRecoilCells: 0.07,
  backwardRejectionTorchContraction: 0.45,
};

export const BACKWARD_REJECTION_TEXT = "The dungeon does not allow you to retreat.";
