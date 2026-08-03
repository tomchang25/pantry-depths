/**
 * The last three things the shipped renderer does to a frame, and the difference between a rendering
 * and a scene.
 *
 * None of it is information. The dust in the air says the player is moving through somewhere rather
 * than looking at something; the vignette pulls the eye to the middle of the frame and keeps the
 * torch reading as a light the player is carrying; the slow breath stops a still frame from looking
 * like a screenshot. The porting survey found all three missing and the checklist had never named
 * them, which is why the first judging session could call the atmosphere down without being able to
 * say what of.
 *
 * A 2D layer over the WebGL frame rather than a post-process on it, for the same reason the arm is:
 * these are lens effects, they need no depth, and the shipped renderer draws them with exactly these
 * canvas calls. Reimplementing a radial gradient as a shader would be a second opinion about numbers
 * that are quoted here.
 *
 * It sits under the arm, which reproduces the shipped stacking: the game paints the red answer to a
 * hit inside the renderer and then draws the viewmodel over it, so the arm is never tinted by the
 * blow that landed on the body holding it.
 *
 * Drawn at the full size of the element, not at the frame's own coarse resolution. The shipped
 * renderer halves only its plane pass; the grade, the motes and the red are all full-resolution
 * there, and matching the grain here would be a coarseness the game has not got.
 */

/** The two knobs on the turn vignette. Roughly a third of the first attempt, which was too obvious. */
const TURN_VIGNETTE_REACH = 0.06;
const TURN_VIGNETTE_DEPTH = 0.08;

/** What the pass needs of the frame it is finishing. */
export type FinishingView = Readonly<{
  elapsedSeconds: number;
  /** Where the eye is and which way it points, so the dust belongs to the room rather than to the screen. */
  cameraAngle: number;
  cameraX: number;
  cameraY: number;
  /** How hard the view is turning, from nothing to a full-speed turn. */
  turnRate: number;
  /** How much of the red a hit leaves is still on screen. */
  hitFlash: number;
}>;

export type FinishingPass = Readonly<{
  overlay: HTMLCanvasElement;
  resize(width: number, height: number): void;
  draw(view: FinishingView): void;
  dispose(): void;
}>;

export function createFinishingPass(): FinishingPass {
  const overlay = document.createElement("canvas");
  overlay.className = "three-scene__overlay";
  const context = overlay.getContext("2d");
  let width = 1;
  let height = 1;

  return {
    overlay,

    resize(nextWidth, nextHeight) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      overlay.width = width;
      overlay.height = height;
    },

    draw(view) {
      if (!context) {
        return;
      }

      context.clearRect(0, 0, width, height);
      drawMotes(context, view);
      drawGrade(context, view);

      if (view.hitFlash > 0) {
        drawPlayerHit(context, view.hitFlash);
      }
    },

    dispose() {
      overlay.remove();
    },
  };

  /**
   * Dust in the air, in three layers that drift at different rates.
   *
   * Parallax is what turns a scatter of specks into air the player is moving through: the near layer
   * is larger, brighter and faster, and slides against the turn of the head. A single layer at one
   * speed reads as static laid over the image.
   */
  function drawMotes(target: CanvasRenderingContext2D, view: FinishingView): void {
    const time = view.elapsedSeconds;
    const sway = view.cameraAngle * width * 0.24 + view.cameraX * 26 + view.cameraY * 18;

    for (let layer = 0; layer < 3; layer += 1) {
      const depth = (layer + 1) / 3;
      const count = 30 - layer * 8;
      const size = 1 + layer;
      const alpha = 0.05 + layer * 0.035;
      target.fillStyle = `rgba(238, 206, 168, ${alpha})`;

      for (let index = 0; index < count; index += 1) {
        const seed = index * 97 + layer * 311;
        const drift = time * (5 + layer * 11);
        const x = (((seed * 37) % width) + width + drift - sway * depth * 0.35) % width;
        const bob = Math.sin(time * (0.4 + layer * 0.25) + seed) * height * 0.03 * depth;
        const y = (((seed * 53) % height) + height + bob) % height;
        target.fillRect(x, y, size, size);
      }
    }
  }

  /** A vignette, a warm centre, and a breathing darkness at the edges that closes on a fast turn. */
  function drawGrade(target: CanvasRenderingContext2D, view: FinishingView): void {
    const centreX = width * 0.5;
    const centreY = height * 0.54;
    const breath = 1 + Math.sin(view.elapsedSeconds * 0.9) * 0.03;
    const closing = Math.max(0, Math.min(1, view.turnRate));
    const outer = Math.hypot(width, height) * (0.62 - closing * TURN_VIGNETTE_REACH) * breath;
    const vignette = target.createRadialGradient(centreX, centreY, outer * 0.34, centreX, centreY, outer);
    vignette.addColorStop(0, "rgba(6, 2, 12, 0)");
    vignette.addColorStop(0.62, `rgba(6, 2, 12, ${0.3 + closing * TURN_VIGNETTE_DEPTH})`);
    vignette.addColorStop(1, "rgba(4, 1, 9, 0.82)");
    target.fillStyle = vignette;
    target.fillRect(0, 0, width, height);

    const warm = target.createRadialGradient(centreX, centreY, 0, centreX, centreY, outer * 0.55);
    warm.addColorStop(0, "rgba(255, 156, 74, 0.07)");
    warm.addColorStop(1, "rgba(255, 156, 74, 0)");
    target.save();
    target.globalCompositeOperation = "lighter";
    target.fillStyle = warm;
    target.fillRect(0, 0, width, height);
    target.restore();
  }

  /** Damage reads from the edges inward, so it never hides what is in front of the player. */
  function drawPlayerHit(target: CanvasRenderingContext2D, strength: number): void {
    const centreX = width * 0.5;
    const centreY = height * 0.54;
    const outer = Math.hypot(width, height) * 0.62;
    const blood = target.createRadialGradient(centreX, centreY, outer * 0.2, centreX, centreY, outer);
    blood.addColorStop(0, "rgba(180, 24, 54, 0)");
    blood.addColorStop(0.55, `rgba(168, 20, 48, ${0.24 * strength})`);
    blood.addColorStop(1, `rgba(122, 8, 30, ${0.6 * strength})`);
    target.fillStyle = blood;
    target.fillRect(0, 0, width, height);
  }
}
