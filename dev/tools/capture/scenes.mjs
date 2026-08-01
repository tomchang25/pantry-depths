/**
 * The fixed scene set the capture harness shoots, one entry per picture.
 *
 * A scene is a recipe, not an assertion: it drives the demo into a state through the same debug keys
 * a person uses (see the key rows in `src/demo/demo-surface.ts`), and what the resulting frame looks
 * like is judged by whoever reads the output — never by code. Every scene starts from a fresh page
 * with the same seeded random, so the floor is the same floor on every run and the only thing that
 * changes between two captures of a scene is the change being looked at.
 *
 * `sampleFps` marks the scenes busy enough to be worth timing; the harness samples them before the
 * screenshot so the number describes the moving picture, not a frozen one.
 *
 * A scene may say where it points and what ready means there. `address` is a path with an optional
 * query — `/?map=circle-water` for a named map, `/debug/map-workbench` for a workbench — and
 * defaults to the play surface. `readySelector` is a CSS selector to wait for, and defaults to the
 * development handle only the play surface publishes, so a page that is not the game must give one
 * or the harness waits for something that will never arrive. The capture flag is added by the
 * harness; no scene writes it.
 *
 * **A scene must never drive a page into saving.** Both capture commands start a dev server rooted
 * in this working tree, which means the authoring endpoint is live and its save operation overwrites
 * authored content on disk. A scene presses real keys and clicks real controls, so it can reach a
 * save button; `dev/agent_rules/test_operations.md` states the same prohibition for browser specs
 * and it applies here for the same reason.
 */

export const SCENES = [
  {
    name: "clean-hud",
    note: "Spawn view, untouched: run panel, tasks, minimap, bottom bar, corridor from the entrance.",
    async setup({ settle }) {
      await settle(30);
    },
  },
  {
    name: "arena-crowd",
    note: "Flattened arena with the crowd topped up, facing the swarm mid-approach: motion, wind-ups, damage traffic.",
    sampleFps: true,
    async setup({ faceNearestEnemy, press, settle, wait }) {
      await press("t");
      await settle(5);
      await press("n");
      await wait(1200);
      await faceNearestEnemy();
      await settle(30);
    },
  },
  {
    name: "crowd-frozen",
    note: "Same swarm with enemies paused: a stable frame for comparing bodies, markers, and lighting.",
    async setup({ faceNearestEnemy, press, settle, wait }) {
      await press("t");
      await settle(5);
      await press("n");
      await wait(1200);
      await faceNearestEnemy();
      await settle(30);
      await press("p");
      await settle(5);
    },
  },
  {
    name: "held-weapon",
    note: "The debug kit dropped in a ring and the nearest piece grabbed: viewmodel plus the held readout.",
    async setup({ press, rightClickCentre, settle }) {
      await press("b");
      await settle(10);
      await rightClickCentre();
      await settle(10);
    },
  },
  {
    name: "after-the-kill",
    note: "The crowd felled at once: announcement line, award card, completed task row, emptied minimap.",
    async setup({ press, settle, wait }) {
      await press("t");
      await settle(5);
      await press("n");
      await wait(800);
      await press("k");
      await settle(12);
    },
  },
];
