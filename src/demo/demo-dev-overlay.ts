/**
 * The instrument panel: what the machine is doing, and which cheats are on.
 *
 * Deliberately not part of the HUD. `DemoHudModel` is what the player is told about themselves, and a
 * frame counter is not that — it was living in the health readout, which meant reading health was
 * parsing a compound line whose two halves change for unrelated reasons.
 *
 * It is loud on purpose. A cheat you cannot see is how an hour goes into wondering why nothing can
 * kill you, so the red frame is the point rather than a style choice.
 */

import "@/demo/demo-dev-overlay.css";

export type DemoDevOverlayModel = Readonly<{
  enemiesPaused: boolean;
  fps: number;
  godMode: boolean;
}>;

export type MountedDemoDevOverlay = Readonly<{
  element: HTMLDivElement;
  godModeButton: HTMLButtonElement;
  update(model: DemoDevOverlayModel): void;
}>;

/**
 * Mounts the overlay. Append it *after* the HUD.
 *
 * The HUD's pause overlay is a button covering the whole surface, so anything drawn before it has its
 * clicks taken by the thing that re-locks the pointer. Later sibling, later paint, and the toggle is
 * reachable whenever the pointer is free.
 */
export function mountDemoDevOverlay(): MountedDemoDevOverlay {
  const element = document.createElement("div");
  const fps = document.createElement("span");
  const godModeButton = document.createElement("button");
  const frozen = document.createElement("span");
  element.className = "demo-dev";
  fps.className = "demo-dev__fps";
  // One chip shape for both switches, so the panel reads as a row of states rather than as a button
  // and a caption. Only god mode adds the toggle class, which is the only thing that takes a click.
  godModeButton.className = "demo-dev__chip demo-dev__toggle";
  godModeButton.type = "button";
  frozen.className = "demo-dev__chip";
  element.append(fps, godModeButton, frozen);

  const update = (model: DemoDevOverlayModel): void => {
    fps.textContent = `${Math.round(model.fps)} FPS`;
    godModeButton.textContent = `God mode · ${model.godMode ? "on" : "off"} · G`;
    godModeButton.dataset.active = String(model.godMode);
    godModeButton.setAttribute("aria-pressed", String(model.godMode));
    // Named after the switch, not after the world it produces. `frozen` against `moving` described
    // the enemies and left the reader to work out which way the switch was thrown; on and off against
    // the switch's own name cannot be read the wrong way round.
    frozen.textContent = `Enemy pause · ${model.enemiesPaused ? "on" : "off"} · P`;
    frozen.dataset.active = String(model.enemiesPaused);
  };

  return { element, godModeButton, update };
}
