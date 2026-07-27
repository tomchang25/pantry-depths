import "@/app/debug/debug.css";

import { renderDebugHub } from "@/app/debug/debug-hub";
import { DEBUG_TOOLS, type DebugTool } from "@/app/debug/debug-tools";

export type DebugRoute = Readonly<{ kind: "hub" }> | Readonly<{ kind: "tool"; tool: DebugTool }>;

/** Resolves an exact catalog path and sends every other debug pathname to the hub. */
export function resolveDebugRoute(pathname: string): DebugRoute {
  const tool = DEBUG_TOOLS.find((entry) => entry.path === pathname);

  if (!tool) {
    return { kind: "hub" };
  }

  return { kind: "tool", tool };
}

/** Dispatches exact debug-tool paths and falls back to the debug hub. */
export async function renderDebugRoute(mount: HTMLElement, pathname: string): Promise<void> {
  const route = resolveDebugRoute(pathname);

  if (route.kind === "hub") {
    renderDebugHub(mount);
    return;
  }

  const renderer = await route.tool.load();
  renderer.render(mount);
}
