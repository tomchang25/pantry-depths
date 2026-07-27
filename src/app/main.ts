/**
 * Application bootstrap.
 *
 * This entry stays minimal and accumulates no gameplay or presentation logic. It wires
 * the runtime, presentation, and HUD layers together once they are earned, and it is the
 * single sanctioned wiring point for `src/harness/`.
 */

import { resolveAppRoute } from "@/app/app-route";
import type { MountedGameSurface } from "@/app/game-surface";
import { PROVISIONAL_FLOOR_SET, PROVISIONAL_RUN_WORLD } from "@/content/floor/floor-catalog";
import { GameSession } from "@/runtime/game-session";

const mount = document.querySelector<HTMLDivElement>("#app");

if (!mount) {
  throw new Error("bootstrap: #app mount point is missing from index.html");
}

const appMount = mount;
let mountedGameSurface: MountedGameSurface | undefined;
let moduleDisposed = false;

function renderLoadFailure(logLabel: string, message: string, error: unknown): void {
  console.error(logLabel, error);

  const failure = document.createElement("main");
  failure.textContent = message;
  appMount.replaceChildren(failure);
}

/**
 * The game surface is imported lazily so that its full-viewport stylesheet — which locks
 * `html`, `body`, and `#app` to the viewport and hides their scrollbars — is only injected
 * on the play route and never leaks into a scrollable debug page.
 */
function renderOrdinaryPlay(): void {
  void import("@/app/game-surface")
    .then(({ mountGameSurface }) => {
      if (moduleDisposed) {
        return;
      }

      mountedGameSurface = mountGameSurface(
        appMount,
        PROVISIONAL_FLOOR_SET,
        () => new GameSession(PROVISIONAL_RUN_WORLD),
      );
    })
    .catch((error: unknown) => {
      renderLoadFailure("game surface failed to load", "The game failed to load. Check the browser console.", error);
    });
}

function loadDebugRoute(): void {
  void import("@/app/debug/debug-router")
    .then(({ renderDebugRoute }) => {
      return renderDebugRoute(appMount, window.location.pathname);
    })
    .catch((error: unknown) => {
      renderLoadFailure(
        "debug hub failed to load",
        "Development tools failed to load. Check the browser console.",
        error,
      );
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
    moduleDisposed = true;
    mountedGameSurface?.dispose();
  });
}
