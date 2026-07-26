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

const appMount = mount;

function isDebugPath(pathname: string): boolean {
  return pathname === "/debug" || pathname.startsWith("/debug/");
}

function renderOrdinaryPlay(): void {
  appMount.textContent = "Pantry Depths — layers not implemented yet.";
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
      renderDebugRoute(appMount, window.location.pathname);
    })
    .catch((error: unknown) => {
      renderDebugLoadFailure(error);
    });
}

if (import.meta.env.DEV && isDebugPath(window.location.pathname)) {
  loadDebugRoute();
} else {
  renderOrdinaryPlay();
}
