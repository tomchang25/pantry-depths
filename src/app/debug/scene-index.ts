/**
 * Every development play address, on one page.
 *
 * The debug hub lists tools, and a scene is not one — it is the game at an address of its own, behind
 * a stylesheet that locks the document to the viewport. That rule is why the scenes were reachable
 * only by typing them, and this page is the answer to it: the hub lists one more tool, the tool is a
 * directory, and each of its links is an ordinary anchor that leaves the debug document entirely.
 *
 * It states nothing of its own about a scene. The named scenes come from the catalog that already
 * owns their addresses and their words, and the testbeds are derived from the map library, so a map
 * dropped into the content tree and a scene added to the catalog both show up here without an edit.
 */

import { createDebugPage, createDebugPanel } from "@/app/debug/debug-shell";
import { SCENES, testbedPath } from "@/app/scene/scene-router";
import { MAPS } from "@/content/maps/map-library";

type SceneLink = Readonly<{
  address: string;
  title: string;
  description: string;
}>;

/**
 * One group of addresses, drawn as the cards the hub already uses.
 *
 * Deliberately the same two classes rather than a card style of this page's own: a scene card and a
 * tool card are the same object pointing somewhere else, and a second style would drift from the
 * first the next time either is touched.
 */
function linkGrid(links: readonly SceneLink[], action: string): HTMLUListElement {
  const grid = document.createElement("ul");
  // The fill variant, because these groups are short: the named scenes are one entry until the boss
  // lab arrives, and ordinary play is one by definition.
  grid.className = "debug-card-grid debug-card-grid--fill";

  for (const entry of links) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const title = document.createElement("span");
    const description = document.createElement("p");
    const address = document.createElement("span");

    item.className = "debug-card-grid__item";
    link.className = "debug-tool-card";
    link.href = entry.address;
    title.className = "debug-tool-card__title";
    title.textContent = entry.title;
    description.className = "debug-tool-card__description";
    description.textContent = entry.description;
    address.className = "debug-tool-card__action";
    address.textContent = `${action} ${entry.address} →`;
    link.append(title, description, address);
    item.append(link);
    grid.append(item);
  }

  return grid;
}

/** What one authored map offers a run, in the terms the map file itself is written in. */
function mapSummary(map: (typeof MAPS)[number]): string {
  const rooms =
    map.pool.length === 0 ? "no pool" : `${String(map.draw)} drawn from a pool of ${String(map.pool.length)}`;
  return `${String(map.width)}×${String(map.height)} · ${String(map.fixed.length)} fixed rooms · ${rooms}`;
}

/** Renders the directory of every address a development build opens the game at. */
export function renderSceneIndex(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "Scene Index",
    description:
      "Every address a development build opens the game at: the dressed scenes, the plain map testbeds they are read against, and ordinary play.",
    width: "wide",
  });

  const ordinary = createDebugPanel(
    "Ordinary play",
    "The shipped route. It takes no address of its own and plays the default floor — the one thing on this page a production build also has.",
  );
  const scenes = createDebugPanel(
    "Named scenes",
    "The game with a session's worth of rules over it. A scene owns its address, its floor, how the world is dressed, which keys it adds, and what the screen shows on open.",
  );
  const testbeds = createDebugPanel(
    "Testbeds",
    "The same game on one authored map with no rules over it at all. This is the control group a dressed scene is read against, which is why it stays plain.",
  );

  ordinary.body.append(
    linkGrid([{ address: "/", title: "The game", description: "The default floor, undressed." }], "Play"),
  );
  scenes.body.append(
    linkGrid(
      SCENES.map((scene) => ({ address: scene.path, title: scene.title, description: scene.description })),
      "Open",
    ),
  );
  testbeds.body.append(
    linkGrid(
      MAPS.map((map) => ({ address: testbedPath(map.name), title: map.name, description: mapSummary(map) })),
      "Open",
    ),
  );

  content.append(ordinary.panel, scenes.panel, testbeds.panel);
  mount.replaceChildren(page);
}
