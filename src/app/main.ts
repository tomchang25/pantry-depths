/**
 * Application bootstrap.
 *
 * This entry stays minimal and accumulates no gameplay or presentation logic. It wires
 * the runtime, presentation, and HUD layers together once they are earned, and it is the
 * single sanctioned wiring point for `src/harness/`.
 */

const mount = document.querySelector<HTMLDivElement>("#app");

if (!mount) {
  throw new Error("bootstrap: #app mount point is missing from index.html");
}

mount.textContent = "Pantry Depths — layers not implemented yet.";
