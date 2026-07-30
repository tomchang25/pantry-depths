/**
 * The instrument panel: what the machine is doing, which cheats are on, and the buttons that put
 * the floor into a state worth looking at.
 *
 * Deliberately not part of the HUD. `DemoHudModel` is what the player is told about themselves, and a
 * frame counter is not that — it was living in the health readout, which meant reading health was
 * parsing a compound line whose two halves change for unrelated reasons.
 *
 * It is loud on purpose. A cheat you cannot see is how an hour goes into wondering why nothing can
 * kill you, so the red frame is the point rather than a style choice.
 *
 * Every row names its key. The buttons only answer a click while the pointer is free, which is not
 * most of the time — so the key is the real control and the chip is where you find out what it is.
 */

import "@/demo/demo-dev-overlay.css";

export type DemoDevOverlayModel = Readonly<{
  enemiesPaused: boolean;
  fps: number;
  godMode: boolean;
}>;

/**
 * What the panel can ask the demo to do.
 *
 * Handed in at mount rather than exposed as buttons for the caller to wire up. Four actions wired
 * from outside is eight lines of listener bookkeeping split across two places, and the half that
 * removes them is the half that gets forgotten.
 */
export type DemoDevOverlayActions = Readonly<{
  toggleGodMode(): void;
  testArena(): void;
  killAll(): void;
  fillCrowd(): void;
  dropKit(): void;
}>;

export type MountedDemoDevOverlay = Readonly<{
  element: HTMLDivElement;
  update(model: DemoDevOverlayModel): void;
  dispose(): void;
}>;

/**
 * Mounts the overlay. Append it *after* the HUD.
 *
 * The HUD's pause overlay is a button covering the whole surface, so anything drawn before it has its
 * clicks taken by the thing that re-locks the pointer. Later sibling, later paint, and the buttons are
 * reachable whenever the pointer is free.
 */
export function mountDemoDevOverlay(actions: DemoDevOverlayActions): MountedDemoDevOverlay {
  const element = document.createElement("div");
  const fps = document.createElement("span");
  const godModeButton = document.createElement("button");
  const frozen = document.createElement("span");
  element.className = "demo-dev";
  fps.className = "demo-dev__fps";
  // One chip shape for every row, so the panel reads as a column of states and commands rather than
  // as a mixture of buttons and captions. Only the ones that take a click say so.
  godModeButton.className = "demo-dev__chip demo-dev__toggle";
  godModeButton.type = "button";
  frozen.className = "demo-dev__chip";

  /**
   * A momentary command, as distinct from a switch.
   *
   * No `data-active`: there is no state to be in. A button that lit up would be claiming the floor
   * is now in some mode, and none of these leave one — they do a thing once and the world carries on.
   */
  const command = (label: string, run: () => void): HTMLButtonElement => {
    const button = document.createElement("button");
    button.className = "demo-dev__chip demo-dev__action";
    button.type = "button";
    button.textContent = label;
    // The click is kept off the surface underneath so it cannot double as a request to go back in,
    // which is what a click anywhere else means while the overlay is up.
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      run();
    });
    return button;
  };

  const handleGodModeClick = (event: MouseEvent): void => {
    event.stopPropagation();
    actions.toggleGodMode();
  };

  godModeButton.addEventListener("click", handleGodModeClick);
  element.append(
    fps,
    godModeButton,
    frozen,
    command("Test arena · T", actions.testArena),
    command("Kill all · K", actions.killAll),
    command("Fill crowd · N", actions.fillCrowd),
    command("Drop kit · B", actions.dropKit),
  );

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

  // The command buttons' listeners go with the nodes they are on, which are removed with the panel.
  const dispose = (): void => {
    godModeButton.removeEventListener("click", handleGodModeClick);
    element.remove();
  };

  return { element, update, dispose };
}
