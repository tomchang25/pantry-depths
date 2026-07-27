/**
 * Application bootstrap.
 *
 * This entry stays minimal and accumulates no gameplay or presentation logic. It wires
 * the runtime, presentation, and HUD layers together once they are earned, and it is the
 * single sanctioned wiring point for `src/harness/`.
 */

import { resolveAppRoute } from "@/app/app-route";
import { mountGameSurface, type MountedGameSurface } from "@/app/game-surface";
import { PROVISIONAL_FLOOR_SET, PROVISIONAL_RUN_WORLD } from "@/content/floor/floor-catalog";
import { GameSession } from "@/runtime/game-session";

const mount = document.querySelector<HTMLDivElement>("#app");

if (!mount) {
  throw new Error("bootstrap: #app mount point is missing from index.html");
}

const appMount = mount;
let mountedGameSurface: MountedGameSurface | undefined;

function renderOrdinaryPlay(): void {
  const session = new GameSession(PROVISIONAL_RUN_WORLD);
  mountedGameSurface = mountGameSurface(appMount, PROVISIONAL_FLOOR_SET, session);
}

function renderDebugLoadFailure(error: unknown): void {
  console.error("debug hub failed to load", error);

  const failure = document.createElement("main");
  failure.textContent = "Development tools failed to load. Check the browser console.";
  appMount.replaceChildren(failure);
}

function loadDebugRoute(): void {
  void import("@/app/debug/debug-router")
    .then(({ renderDebugRoute }) => {
      return renderDebugRoute(appMount, window.location.pathname);
    })
    .catch((error: unknown) => {
      renderDebugLoadFailure(error);
    });
}

if (import.meta.env.DEV) {
  const route = resolveAppRoute(window.location.pathname, true);

  if (route === "debug") {
    loadDebugRoute();
  } else {
    renderOrdinaryPlay();
  }
} else {
  renderOrdinaryPlay();
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    mountedGameSurface?.dispose();
  });
}
