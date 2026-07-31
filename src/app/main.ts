/**
 * Application bootstrap.
 *
 * This entry stays minimal and accumulates no gameplay or presentation logic. It wires
 * the runtime, presentation, and HUD layers together once they are earned, and it is the
 * single sanctioned wiring point for `src/harness/`.
 */

import { resolveAppRoute } from "@/app/app-route";
import type { MountedDemo } from "@/demo/demo-surface";

const mount = document.querySelector<HTMLDivElement>("#app");

if (!mount) {
  throw new Error("bootstrap: #app mount point is missing from index.html");
}

const appMount = mount;
let mountedDemo: MountedDemo | undefined;
let moduleDisposed = false;

function renderLoadFailure(logLabel: string, message: string, error: unknown): void {
  console.error(logLabel, error);

  const failure = document.createElement("main");
  failure.textContent = message;
  appMount.replaceChildren(failure);
}

/**
 * The play surface is imported lazily so that its full-viewport stylesheet — which locks
 * `html`, `body`, and `#app` to the viewport and hides their scrollbars — is only injected
 * on the play route and never leaks into a scrollable debug page.
 *
 * Mounting is asynchronous because the surface loads its artwork before it draws, so disposal
 * is checked on both sides of the await: the module can be torn down while the images are still
 * in flight, and a surface that arrives after that has to be disposed rather than kept.
 */
function renderOrdinaryPlay(): void {
  // Which map to play is a query parameter, read here rather than by the route resolver: that
  // function answers which surface a pathname wants, and a second question in it is a second reason
  // for it to change.
  const mapName = new URLSearchParams(window.location.search).get("map") ?? undefined;

  void import("@/demo/demo-surface")
    .then(async ({ mountDemo }) => {
      if (moduleDisposed) {
        return;
      }

      const mounted = await mountDemo(appMount, mapName);

      if (moduleDisposed) {
        mounted.dispose();
        return;
      }

      mountedDemo = mounted;
    })
    .catch((error: unknown) => {
      renderLoadFailure("play surface failed to load", "The game failed to load. Check the browser console.", error);
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
    mountedDemo?.dispose();
  });
}
