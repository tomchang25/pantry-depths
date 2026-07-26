import { renderDebugHub } from "@/app/debug/debug-hub";
import { DEBUG_TOOLS } from "@/app/debug/debug-tools";

/** Dispatches exact debug-tool paths and falls back to the debug hub. */
export function renderDebugRoute(mount: HTMLElement, pathname: string): void {
  const tool = DEBUG_TOOLS.find((entry) => entry.path === pathname);

  if (!tool) {
    renderDebugHub(mount);
    return;
  }

  void tool.load().then((renderer) => {
    renderer.render(mount);
  });
}
