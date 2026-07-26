import { DEBUG_TOOLS } from "@/app/debug/debug-tools";

/** Renders the development-only index for every registered debug tool. */
export function renderDebugHub(mount: HTMLElement): void {
  const hub = document.createElement("main");
  const heading = document.createElement("h1");
  heading.textContent = "Pantry Depths Development Tools";
  hub.append(heading);

  if (DEBUG_TOOLS.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.textContent = "No development tools are registered yet.";
    hub.append(emptyState);
  } else {
    const toolList = document.createElement("ul");

    for (const tool of DEBUG_TOOLS) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const description = document.createElement("p");

      link.href = tool.path;
      link.textContent = tool.title;
      description.textContent = tool.description;
      item.append(link, description);
      toolList.append(item);
    }

    hub.append(toolList);
  }

  mount.replaceChildren(hub);
}
