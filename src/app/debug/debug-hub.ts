import { createDebugPage } from "@/app/debug/debug-shell";
import { DEBUG_TOOLS } from "@/app/debug/debug-tools";

/** Renders the development-only index for every registered debug tool. */
export function renderDebugHub(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "Development Tools",
    description:
      "Inspect canonical rules, authored floors, command traces, and content pipelines through focused development surfaces.",
    isHub: true,
    width: "wide",
  });

  if (DEBUG_TOOLS.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "debug-panel";
    emptyState.textContent = "No development tools are registered yet.";
    content.append(emptyState);
  } else {
    const toolList = document.createElement("ul");
    toolList.className = "debug-card-grid";

    for (const tool of DEBUG_TOOLS) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const title = document.createElement("span");
      const description = document.createElement("p");
      const action = document.createElement("span");

      item.className = "debug-card-grid__item";
      link.className = "debug-tool-card";
      link.href = tool.path;
      title.className = "debug-tool-card__title";
      title.textContent = tool.title;
      description.className = "debug-tool-card__description";
      description.textContent = tool.description;
      action.className = "debug-tool-card__action";
      action.textContent = "Open tool →";
      link.append(title, description, action);
      item.append(link);
      toolList.append(item);
    }

    content.append(toolList);
  }

  mount.replaceChildren(page);
}
