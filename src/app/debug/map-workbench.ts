/**
 * A map, edited as the floor it assembles — and the page the room surface shares with it.
 *
 * A map file is a name, an extent, which rooms are always present and where, a pool the rest are drawn
 * from, and how many are drawn. None of that is judgeable as text: whether a pool of four into three
 * free slots reads as a floor worth walking is a question about the floor, and until now the only way to
 * ask it was to edit the file and start a run.
 *
 * **One draw, shown twice.** The world builder is called once per draw and both views come from that one
 * call. Building each from its own call would put two different draws side by side as though they were
 * one — the pool is re-drawn on every call.
 *
 * **Nothing here validates.** Reading the draft, resolving its names against the library, and assembling
 * the floor are the same three operations the game performs, and every refusal lives inside them. What
 * this file does with a bad map is report what that chain threw and refuse to save; a tool that re-ran
 * the checks itself would be a second opinion able to disagree with the one the game gets.
 *
 * The two surfaces are two tabs because there are two files, and a room is not edited through whichever
 * map happens to name it. Neither reads the other's draft.
 */

import { listCanonical, loadCanonical, saveCanonical } from "@/app/debug/authoring-client";
import { actionButton, field, numberInput } from "@/app/debug/debug-form";
import { createDebugPage, createDebugPanel } from "@/app/debug/debug-shell";
import { createFloorPreview } from "@/app/debug/floor-preview";
import { createRoomSurface } from "@/app/debug/room-workbench";
import { resolveMap } from "@/content/maps/map-resolver";
import { parseMapSource, type MapSource } from "@/content/maps/map-schema";
import { MAP_SLOTS, type MapSlot } from "@/core/map-contract";
import { ROOM_LIBRARY } from "@/content/maps/room-library";
import { GAME_CATALOG } from "@/content/catalog";
import { createWorld, type World } from "@/core/world";

/** What a slot with nothing in it is worth in a select, which cannot hold an absence. */
const NO_ROOM = "";

type MapDraft = {
  name: string;
  width: number;
  height: number;
  fixed: { slot: MapSlot; room: string }[];
  pool: string[];
  draw: number;
};

function draftFrom(source: MapSource): MapDraft {
  return {
    name: source.name,
    width: source.width,
    height: source.height,
    fixed: source.fixed.map((placement) => ({ slot: placement.slot, room: placement.room })),
    pool: [...source.pool],
    draw: source.draw,
  };
}

/**
 * The draft in the shape its file holds.
 *
 * The endpoint writes a validator's return value verbatim, so what is sent has to be what belongs in the
 * file — a draft carrying a slot with no room in it would write a placement naming nothing.
 */
function sourceFrom(draft: MapDraft): unknown {
  return {
    name: draft.name,
    width: draft.width,
    height: draft.height,
    fixed: draft.fixed.filter((placement) => placement.room !== NO_ROOM),
    pool: [...draft.pool],
    draw: draft.draw,
  };
}

/** What a draft comes to once read, or nothing when it cannot be read at all. */
function settled(value: unknown): string | undefined {
  try {
    return JSON.stringify(parseMapSource(value));
  } catch {
    return undefined;
  }
}

/**
 * A map that is not a map yet.
 *
 * The extent the shipped map uses, and nothing else — so the first thing it reports is that it has no
 * main region, which is true and is the next thing an author has to decide. A template that arrived
 * already valid would be a map somebody else designed.
 */
function blankDraft(): MapDraft {
  return { name: "", width: 35, height: 35, fixed: [], pool: [], draw: 0 };
}

/**
 * The identity a copy takes: the original with a suffix, and a counter while the name is still taken.
 *
 * Derived from the listing rather than from the library the page was built with, because a file created
 * a minute ago is in one and not the other — and offering a name that is already on disk is the one
 * thing a copy must not do.
 */
function freeName(name: string, taken: readonly string[]): string {
  const base = `${name}-copy`;

  if (!taken.includes(base)) {
    return base;
  }

  let counter = 2;

  while (taken.includes(`${base}-${counter}`)) {
    counter += 1;
  }

  return `${base}-${counter}`;
}

function roomOptions(select: HTMLSelectElement, names: readonly string[], selected: string, allowEmpty: boolean): void {
  select.replaceChildren();

  if (allowEmpty) {
    const empty = document.createElement("option");
    empty.value = NO_ROOM;
    empty.textContent = "— nothing —";
    select.append(empty);
  }

  // A name the draft holds but the listing does not is still offered, because dropping it silently would
  // turn "this room is missing" into "this slot was always empty" while the author watched.
  for (const name of names.includes(selected) || selected === NO_ROOM ? names : [selected, ...names]) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = ROOM_LIBRARY.has(name) ? name : `${name} (not in the library)`;
    select.append(option);
  }

  select.value = selected;
}

/** Builds the map tab, which owns its own draft, preview and saving and nothing else's. */
function createMapSurface(): HTMLElement {
  const root = document.createElement("div");
  const form = createDebugPanel(
    "The map",
    "Which rooms are always present and where, which the pool holds, and how many are drawn.",
  );
  const previewPanel = createDebugPanel(
    "The floor it assembles",
    "One draw, from above and from where the run arrives.",
  );
  const preview = createFloorPreview();
  const mapSelect = document.createElement("select");
  const nameInput = document.createElement("input");
  const widthInput = numberInput(35);
  const heightInput = numberInput(35);
  const drawInput = numberInput(0);
  const slotGrid = document.createElement("div");
  const poolList = document.createElement("div");
  const addToPool = actionButton("Add a room to the pool");
  const grid = document.createElement("div");
  const actions = document.createElement("div");
  const drawAgain = actionButton("Draw again");
  const saveButton = actionButton("Save map", true);
  const reloadButton = actionButton("Reload from disk");
  const refreshButton = actionButton("Refresh room list");
  const newButton = actionButton("New map");
  const cloneButton = actionButton("Clone");
  const playButton = actionButton("Play this map");
  const status = document.createElement("p");

  let draft: MapDraft = { name: "", width: 0, height: 0, fixed: [], pool: [], draw: 0 };
  let savedSource: string | undefined;
  let mapNames: readonly string[] = [];
  let roomNames: readonly string[] = [...ROOM_LIBRARY.keys()].sort();
  let world: World | undefined;
  let failure: string | undefined;

  root.className = "map-workbench";
  nameInput.type = "text";
  slotGrid.className = "debug-form-grid map-workbench-slots";
  poolList.className = "map-workbench-pool";
  grid.className = "debug-form-grid";
  actions.className = "debug-button-row workbench-actions";
  status.className = "debug-status";
  status.setAttribute("role", "status");

  const dirty = (): boolean => savedSource === undefined || settled(sourceFrom(draft)) !== savedSource;

  const refresh = (): void => {
    nameInput.value = draft.name;
    // The listing and the open map are refreshed by different actions, so whichever ran last has to
    // leave the selector showing what is actually open rather than what it last listed.
    mapSelect.value = draft.name;
    widthInput.value = String(draft.width);
    heightInput.value = String(draft.height);
    drawInput.value = String(draft.draw);
    playButton.disabled = dirty() || draft.name.length === 0;
    playButton.title = playButton.disabled
      ? "What plays is the game reading a file, so a map has to be saved before it can be opened."
      : `Opens the game at "${draft.name}" in a new tab.`;
    saveButton.disabled = failure !== undefined;
    cloneButton.disabled = draft.name.length === 0;
    // Creating a file and destroying one look identical up to the moment they happen, and starting from
    // nothing makes typing an occupied name far more likely. The listing is already here, so saying which
    // of the two this is costs nothing.
    saveButton.textContent =
      mapNames.length === 0
        ? "Save map"
        : mapNames.includes(draft.name)
          ? `Save map (overwrites ${draft.name})`
          : "Save map (new file)";

    slotGrid.replaceChildren();

    for (const slot of MAP_SLOTS) {
      const select = document.createElement("select");
      const placement = draft.fixed.find((entry) => entry.slot === slot);
      roomOptions(select, roomNames, placement?.room ?? NO_ROOM, slot !== "main");
      select.addEventListener("change", () => {
        // Slot order is the file's order, and the assembly paints in it, so a slot re-chosen keeps its
        // place in the list rather than moving to the end.
        draft.fixed = MAP_SLOTS.flatMap((candidate) =>
          candidate === slot
            ? select.value === NO_ROOM
              ? []
              : [{ slot, room: select.value }]
            : draft.fixed.filter((entry) => entry.slot === candidate),
        );
        rebuild();
      });
      slotGrid.append(field(slot, select));
    }

    poolList.replaceChildren();

    for (const [index, name] of draft.pool.entries()) {
      const row = document.createElement("div");
      const select = document.createElement("select");
      const remove = actionButton("Remove");
      row.className = "map-workbench-pool__row";
      roomOptions(select, roomNames, name, false);
      select.addEventListener("change", () => {
        draft.pool = draft.pool.map((entry, position) => (position === index ? select.value : entry));
        rebuild();
      });
      remove.addEventListener("click", () => {
        draft.pool = draft.pool.filter((_entry, position) => position !== index);
        rebuild();
      });
      row.append(select, remove);
      poolList.append(row);
    }

    if (world) {
      preview.show(world, `Assembled floor for ${draft.name}`);
    }

    status.dataset.tone = failure === undefined ? "success" : "error";
    status.textContent =
      failure ??
      (world
        ? `${draft.name}: ${world.maze.rooms.length} rooms assembled, ${world.enemies.length} bodies standing.${dirty() ? " Unsaved." : ""}`
        : "Nothing assembled yet.");
  };

  /**
   * Reads the draft, resolves its names, and assembles a floor — the three operations the game performs.
   *
   * A failed draft keeps the last floor on screen rather than clearing it. What an author is doing when a
   * map goes briefly invalid is editing it, and taking the picture away mid-edit costs the one thing they
   * were looking at; the status line and the disabled save are what say the draft is refused.
   */
  /**
   * Rooms this draft names that are on disk but not in the library this page was built with.
   *
   * The listing is asked for over and over; the library is a glob expanded once, when the document
   * loaded. A room created after that is therefore in the first and not the second, and the refusal an
   * author sees says the room does not exist — which is true of this page and false of the disk.
   *
   * Answered by comparing the two rather than guessing, so the advice below is only ever offered when
   * it will actually work. A room that is in neither is simply missing, and reloading would not help.
   */
  const createdSinceLoad = (): readonly string[] => [
    ...new Set(
      [...draft.fixed.map((placement) => placement.room), ...draft.pool].filter(
        (name) => name !== NO_ROOM && roomNames.includes(name) && !ROOM_LIBRARY.has(name),
      ),
    ),
  ];

  const rebuild = (): void => {
    try {
      world = createWorld(resolveMap(parseMapSource(sourceFrom(draft)), ROOM_LIBRARY), GAME_CATALOG);
      failure = undefined;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stale = createdSinceLoad();
      // Said here rather than where the refusal is written, because that message is also what the game
      // shows when a map names a room nothing anywhere answers, and reloading cures nothing there.
      failure =
        stale.length === 0
          ? message
          : `${message} ${stale.join(" and ")} ${stale.length === 1 ? "was" : "were"} created after this page loaded, so this tool cannot see ${stale.length === 1 ? "it" : "them"} yet — refresh the page (F5) and it will be there.`;
    }

    refresh();
  };

  const openMap = (name: string): Promise<void> =>
    loadCanonical("map", name).then((source) => {
      draft = draftFrom(parseMapSource(source));
      savedSource = settled(source);
      rebuild();
    });

  const refreshLists = (): Promise<void> =>
    Promise.all([listCanonical("map"), listCanonical("room")]).then(([maps, rooms]) => {
      mapNames = maps;
      roomNames = rooms;
      mapSelect.replaceChildren();

      for (const name of maps) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        mapSelect.append(option);
      }

      refresh();
    });

  const run = (button: HTMLButtonElement, working: string, task: () => Promise<unknown>): void => {
    button.disabled = true;
    status.dataset.tone = "info";
    status.textContent = working;
    void task()
      .catch((error: unknown) => {
        failure = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        button.disabled = false;
        refresh();
      });
  };

  // Rebuilt as it is typed, not on commit: the name is one of the things the reader refuses a map for,
  // so a surface that only redrew the form would leave a map reporting a bad name after it had been
  // given a good one. The extent stays on commit for the opposite reason — a half-typed number is a
  // different map.
  nameInput.addEventListener("input", () => {
    draft.name = nameInput.value;
    rebuild();
  });

  for (const [input, key] of [
    [widthInput, "width"],
    [heightInput, "height"],
    [drawInput, "draw"],
  ] as const) {
    input.addEventListener("change", () => {
      draft[key] = Number(input.value);
      rebuild();
    });
  }

  addToPool.addEventListener("click", () => {
    const first = roomNames.find((name) => !draft.pool.includes(name)) ?? roomNames[0];

    if (first !== undefined) {
      draft.pool = [...draft.pool, first];
      rebuild();
    }
  });

  mapSelect.addEventListener("change", () => {
    run(reloadButton, `Reading "${mapSelect.value}" from disk…`, () => openMap(mapSelect.value));
  });
  newButton.addEventListener("click", () => {
    draft = blankDraft();
    // Nothing has been saved under this draft, so it is unsaved from its first frame — which is what
    // keeps the play action shut until a file exists for the game to read.
    savedSource = undefined;
    rebuild();
  });
  cloneButton.addEventListener("click", () => {
    // The copy is a draft and nothing else. The file it came from is untouched, and no file exists under
    // the new name until somebody saves one.
    draft = { ...draft, name: freeName(draft.name, mapNames) };
    savedSource = undefined;
    rebuild();
  });
  drawAgain.addEventListener("click", rebuild);
  reloadButton.addEventListener("click", () => {
    run(reloadButton, "Reading the map from disk…", () => openMap(draft.name));
  });
  refreshButton.addEventListener("click", () => {
    run(refreshButton, "Asking what the library holds…", refreshLists);
  });
  saveButton.addEventListener("click", () => {
    run(saveButton, "Validating and saving the map…", () =>
      saveCanonical("map", sourceFrom(draft), draft.name).then(() => {
        savedSource = settled(sourceFrom(draft));
        return refreshLists();
      }),
    );
  });
  playButton.addEventListener("click", () => {
    window.open(`/?map=${encodeURIComponent(draft.name)}`, "_blank", "noopener");
  });

  // Which file is open is a different question from what it says, so the file operations sit in their
  // own row above the form rather than posing as fields of the map.
  const openRow = document.createElement("div");
  openRow.className = "workbench-open-row";
  openRow.append(field("Open map", mapSelect), newButton, cloneButton, reloadButton, refreshButton);

  grid.append(
    field("Name", nameInput),
    field("Width", widthInput),
    field("Height", heightInput),
    field("Rooms drawn from the pool", drawInput),
  );
  actions.append(saveButton, playButton);

  // Re-drawing is the preview's own control — it changes what is looked at, not what is written.
  const previewActions = document.createElement("div");
  previewActions.className = "debug-button-row workbench-preview-actions";
  previewActions.append(drawAgain);

  const slots = document.createElement("h3");
  const pool = document.createElement("h3");
  slots.className = "workbench-section-title";
  pool.className = "workbench-section-title";
  slots.textContent = "Slots";
  pool.textContent = "Pool";
  form.body.append(openRow, grid, slots, slotGrid, pool, poolList, addToPool, actions, status);
  previewPanel.body.append(previewActions, preview.element);
  root.append(form.panel, previewPanel.panel);

  refresh();
  run(refreshButton, "Asking what the library holds…", () =>
    refreshLists().then(() => openMap(mapSelect.value || "pantry-depths")),
  );

  return root;
}

/** Builds the page and hands back nothing: the page owns everything it made. */
export function renderMapWorkbench(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "Map Workbench",
    description:
      "Lay out a floor and author the rooms it is built from. Every draw is the assembler the game calls, so what is on screen is what a run would arrive in.",
    width: "wide",
  });
  const tabs = document.createElement("div");
  const mapTab = actionButton("Maps");
  const roomTab = actionButton("Rooms");
  const mapSection = document.createElement("div");
  const roomSection = document.createElement("div");

  tabs.className = "workbench-tabs";
  tabs.setAttribute("role", "tablist");
  mapTab.setAttribute("role", "tab");
  mapTab.setAttribute("aria-controls", "map-workbench-tab");
  roomTab.setAttribute("role", "tab");
  roomTab.setAttribute("aria-controls", "room-workbench-tab");
  mapSection.id = "map-workbench-tab";
  mapSection.setAttribute("role", "tabpanel");
  roomSection.id = "room-workbench-tab";
  roomSection.setAttribute("role", "tabpanel");
  tabs.append(mapTab, roomTab);

  const selectTab = (tab: "map" | "room"): void => {
    mapTab.setAttribute("aria-selected", String(tab === "map"));
    roomTab.setAttribute("aria-selected", String(tab === "room"));
    mapSection.hidden = tab !== "map";
    roomSection.hidden = tab !== "room";
  };

  mapTab.addEventListener("click", () => selectTab("map"));
  roomTab.addEventListener("click", () => selectTab("room"));

  mapSection.append(createMapSurface());
  roomSection.append(createRoomSurface());
  selectTab("map");
  content.append(tabs, mapSection, roomSection);
  mount.replaceChildren(page);
}
