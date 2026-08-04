/**
 * The instrument panel: what the machine is doing, which cheats are on, and the buttons that put
 * the floor into a state worth looking at.
 *
 * Deliberately not part of the HUD. `HudModel` is what the player is told about themselves, and a
 * frame counter is not that — it was living in the health readout, which meant reading health was
 * parsing a compound line whose two halves change for unrelated reasons.
 *
 * It is loud on purpose. A cheat you cannot see is how an hour goes into wondering why nothing can
 * kill you, so the red frame is the point rather than a style choice.
 *
 * Every row names its key. The buttons only answer a click while the pointer is free, which is not
 * most of the time — so the key is the real control and the chip is where you find out what it is.
 */

import "@/runtime/dev-overlay.css";

export type DevOverlayModel = Readonly<{
  mindsFrozen: boolean;
  worldFrozen: boolean;
  fps: number;
  godMode: boolean;
  /**
   * The three knobs on the renderer, and which map is playing.
   *
   * They arrived here when the Three.js debug tool that held them was deleted: it existed to host the
   * renderer before the game drew through it, and once the game did, everything left on it was a
   * switch that belonged where the other switches are. A knob reachable only from a route nobody
   * opens any more is a knob nobody has.
   */
  arm: boolean;
  grain: boolean;
  torch: boolean;
  map: string;
  /**
   * State rows belonging to the development scene the run was opened at, if any.
   *
   * Absent or empty means the run is ordinary play and no extra row is drawn — a row naming a control
   * nothing has is a control the panel is claiming to have. The panel neither knows nor asks what a
   * given row means; a scene owns its own wording, including which keys it names.
   */
  sceneChips?: readonly string[] | undefined;
}>;

/**
 * What the panel can ask the demo to do.
 *
 * Handed in at mount rather than exposed as buttons for the caller to wire up. Four actions wired
 * from outside is eight lines of listener bookkeeping split across two places, and the half that
 * removes them is the half that gets forgotten.
 */
export type DevOverlayActions = Readonly<{
  toggleGodMode(): void;
  testArena(): void;
  killAll(): void;
  fillCrowd(): void;
  dropKit(): void;
  grantBless(): void;
}>;

/**
 * A command a development scene contributes, already bound to the run it acts on.
 *
 * Deliberately not the runtime's scene command type: the panel is handed a label and something to
 * run, and stays ignorant of worlds. Binding the world is the surface's job because the surface is
 * what knows which run is current.
 */
export type DevOverlayCommand = Readonly<{
  label: string;
  run(): void;
}>;

export type MountedDemoDevOverlay = Readonly<{
  element: HTMLDivElement;
  update(model: DevOverlayModel): void;
  dispose(): void;
}>;

/**
 * Mounts the overlay. Append it *after* the HUD.
 *
 * The HUD's pause overlay is a button covering the whole surface, so anything drawn before it has its
 * clicks taken by the thing that re-locks the pointer. Later sibling, later paint, and the buttons are
 * reachable whenever the pointer is free.
 */
export function mountDevOverlay(
  actions: DevOverlayActions,
  sceneCommands: readonly DevOverlayCommand[] = [],
): MountedDemoDevOverlay {
  const element = document.createElement("div");
  const fps = document.createElement("span");
  const godModeButton = document.createElement("button");
  const minds = document.createElement("span");
  const world = document.createElement("span");
  const torch = document.createElement("span");
  const grain = document.createElement("span");
  const arm = document.createElement("span");
  const map = document.createElement("span");
  element.className = "demo-dev";
  fps.className = "demo-dev__fps";
  // One chip shape for every row, so the panel reads as a column of states and commands rather than
  // as a mixture of buttons and captions. Only the ones that take a click say so.
  godModeButton.className = "demo-dev__chip demo-dev__toggle";
  godModeButton.type = "button";
  minds.className = "demo-dev__chip";
  world.className = "demo-dev__chip";
  torch.className = "demo-dev__chip";
  grain.className = "demo-dev__chip";
  arm.className = "demo-dev__chip";
  map.className = "demo-dev__chip";

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

  /**
   * The scene's state rows, created on the first update that carries them and never again.
   *
   * A scene's row count is fixed for its life, so this grows once and then only sets text. They sit
   * where the run's own switches end and the renderer's begin, which is where the one scene that
   * exists used to hardcode its row.
   */
  const sceneChips: HTMLSpanElement[] = [];

  const syncSceneChips = (labels: readonly string[]): void => {
    while (sceneChips.length < labels.length) {
      const chip = document.createElement("span");
      chip.className = "demo-dev__chip";
      sceneChips.push(chip);
      element.insertBefore(chip, torch);
    }

    sceneChips.forEach((chip, index) => {
      const label = labels[index];
      chip.hidden = label === undefined;
      chip.textContent = label ?? "";
    });
  };

  godModeButton.addEventListener("click", handleGodModeClick);
  element.append(
    fps,
    godModeButton,
    minds,
    world,
    torch,
    grain,
    arm,
    map,
    // A scene's commands lead the column, because a scene is why this run is open at all and its
    // buttons are the ones being reached for.
    ...sceneCommands.map((entry) => command(entry.label, entry.run)),
    command("Test arena · T", actions.testArena),
    command("Kill all · K", actions.killAll),
    command("Fill crowd · N", actions.fillCrowd),
    command("Drop kit · B", actions.dropKit),
    // The same draw an altar makes, on demand. A blessing is the one thing a run cannot be put into a
    // state of by moving the floor around: reaching the second tier means taking five of them first,
    // which is minutes of play before the screen that shows them can be looked at holding anything.
    command("Bless · L", actions.grantBless),
  );

  const update = (model: DevOverlayModel): void => {
    fps.textContent = `${Math.round(model.fps)} FPS`;
    godModeButton.textContent = `God mode · ${model.godMode ? "on" : "off"} · G`;
    godModeButton.dataset.active = String(model.godMode);
    godModeButton.setAttribute("aria-pressed", String(model.godMode));
    // Named after the switch, not after the world it produces. `frozen` against `moving` described
    // the enemies and left the reader to work out which way the switch was thrown; on and off against
    // the switch's own name cannot be read the wrong way round.
    //
    // Two rows rather than one, and named as a pair, because the difference between them is the
    // whole reason there are two: one holds the bodies and one holds the clock.
    minds.textContent = `Mind freeze · ${model.mindsFrozen ? "on" : "off"} · P`;
    minds.dataset.active = String(model.mindsFrozen);
    world.textContent = `World freeze · ${model.worldFrozen ? "on" : "off"} · O`;
    world.dataset.active = String(model.worldFrozen);
    // Whatever the scene wants said, in the scene's own words. The panel sizes its box to its longest
    // possible line, so a scene keeps its rows short for the same reason every row here is short.
    syncSceneChips(model.sceneChips ?? []);
    // The three renderer switches are named after the switch like the freezes above, but they light
    // up **inverted**, and that is the point of the panel rather than an inconsistency: the loud state
    // is the surprising one. A cheat that is on is surprising; a torch that is on is how the game
    // looks. What wants finding at a glance here is the switch somebody left off — which is exactly
    // the half hour that goes into wondering why the floor turned flat and grey.
    torch.textContent = `Torch · ${model.torch ? "on" : "off"} · F`;
    torch.dataset.active = String(!model.torch);
    grain.textContent = `Grain · ${model.grain ? "on" : "off"} · V`;
    grain.dataset.active = String(!model.grain);
    arm.textContent = `Arm · ${model.arm ? "on" : "off"} · J`;
    arm.dataset.active = String(!model.arm);
    // A choice among the maps found on disk, stepped by the pair of keys on the row. Changing it
    // starts that map, because a map is what a run is built from rather than something it can be
    // moved onto — the same reason R exists at all.
    map.textContent = `Map · ${model.map} · , .`;
  };

  // The command buttons' listeners go with the nodes they are on, which are removed with the panel.
  const dispose = (): void => {
    godModeButton.removeEventListener("click", handleGodModeClick);
    element.remove();
  };

  return { element, update, dispose };
}
