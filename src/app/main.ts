/**
 * Application bootstrap.
 *
 * This entry stays minimal and accumulates no gameplay or presentation logic: it resolves the
 * route and defers to the runtime surface or the debug router.
 */

import { resolveAppRoute } from "@/app/app-route";
import type { MountedGame, MountGameOptions } from "@/runtime/surface";

const mount = document.querySelector<HTMLDivElement>("#app");

if (!mount) {
  throw new Error("bootstrap: #app mount point is missing from index.html");
}

const appMount = mount;
let mountedDemo: MountedGame | undefined;
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
 * on a play route and never leaks into a scrollable debug page.
 *
 * Mounting is asynchronous because the surface loads its artwork before it draws, so disposal
 * is checked on both sides of the await: the module can be torn down while the images are still
 * in flight, and a surface that arrives after that has to be disposed rather than kept.
 *
 * One mount path for the ordinary game and for every scene, because a scene is the game: what
 * separates them is the options handed in, not how the surface is put on the page.
 */
function renderPlay(options: MountGameOptions): void {
  void import("@/runtime/surface")
    .then(async ({ mountGame }) => {
      if (moduleDisposed) {
        return;
      }

      const mounted = await mountGame(appMount, options);

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

/**
 * Development scenes, behind the same deferred crossing the debug tools use.
 *
 * The catalog and every scene's rules stay out of the production module graph because nothing
 * production-reachable imports them: this call sits inside the development guard below.
 */
function loadSceneRoute(pathname: string): void {
  void import("@/app/scene/scene-router")
    .then(({ resolveScene }) => resolveScene(pathname))
    .then((options) => {
      renderPlay(options);
    })
    .catch((error: unknown) => {
      renderLoadFailure("scene failed to load", "The scene failed to load. Check the browser console.", error);
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
  } else if (route === "scene") {
    loadSceneRoute(window.location.pathname);
  } else {
    renderPlay({});
  }
} else {
  renderPlay({});
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    moduleDisposed = true;
    mountedDemo?.dispose();
  });
}
