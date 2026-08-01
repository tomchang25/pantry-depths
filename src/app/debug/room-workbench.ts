/**
 * A room, edited on its own and previewed as a floor of one room.
 *
 * A room is its own file because it is the unit that gets reused, so it is edited on its own rather than
 * through whichever map happens to name it. What a room declares is almost entirely numbers nobody would
 * tune by hand — how many bodies stand in it and how fast they come back, how much of it is water, how
 * open the carve leaves it, what its walls are made of — which is the whole reason this surface exists.
 *
 * **The preview is a small, honest lie.** A one-room map is made on the spot: the draft room in the main
 * slot, an empty pool, and an extent equal to the room's own. No map is being edited and none is saved.
 * What it buys is that the room's cells are assembled by the code that will assemble them, rather than by
 * a second drawing path that could quietly disagree. With no side rooms the fit check is never reached,
 * so any room the reader accepts previews.
 *
 * **Both spellings of a quantity are kept as written.** The reader leaves a bare number a bare number and
 * a range a range, because the endpoint writes its return value verbatim — and because a range consumes a
 * random number where a bare number does not, so normalising every quantity would move every floor the
 * capture harness has ever photographed.
 */

import { listCanonical, loadCanonical, saveCanonical } from "@/app/debug/authoring-client";
import { actionButton, field, numberInput } from "@/app/debug/debug-form";
import { createDebugPanel } from "@/app/debug/debug-shell";
import { createFloorPreview } from "@/app/debug/floor-preview";
import { resolveMap } from "@/content/maps/map-resolver";
import { parseMapSource } from "@/content/maps/map-schema";
import { ROOM_LIBRARY } from "@/content/maps/room-library";
import {
  MAP_ROOM_ROLES,
  MAP_TILE_KINDS,
  parseRoomSource,
  unfillableEnclosesRegion,
  type MapQuantity,
  type MapRoom,
  type MapTileKind,
} from "@/content/maps/room-schema";
import { PROP_KINDS, type PropKind } from "@/content/presentation/prop-display-schema";
import { createDemoWorld, type DemoWorld } from "@/demo/world";

/** The name the throwaway preview map wears. It is never written, and no file is ever called this. */
const PREVIEW_MAP = "room-preview";

const NO_ROLE = "";

/**
 * A draft is the file's own shape, held loosely enough to be edited in place.
 *
 * Deliberately not the parsed type: a draft passes through states no room file may hold — a half-typed
 * identity, a cap below its starting count — and the reader is what says so, at the moment a preview is
 * attempted, rather than the draft being unable to represent the mistake.
 */
type RoomDraft = Record<string, unknown> & { id?: unknown; width?: unknown; height?: unknown };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

/** What a draft comes to once read, or nothing when it cannot be read at all. */
function settled(value: unknown): string | undefined {
  try {
    return JSON.stringify(parseRoomSource(value));
  } catch {
    return undefined;
  }
}

function quantityOf(value: unknown, fallback: number): MapQuantity {
  if (typeof value === "number") {
    return value;
  }

  const record = asRecord(value);
  return typeof record.minimum === "number" && typeof record.maximum === "number"
    ? { minimum: record.minimum, maximum: record.maximum }
    : fallback;
}

/**
 * One quantity, in whichever of its two spellings the draft holds, with a way to change which.
 *
 * The switch seeds the other spelling from the one that was there, so the first thing an author sees
 * after switching is the room they already had. Nothing is written until a switch or an edit happens,
 * which is what keeps opening a file from rewriting it.
 */
function quantityField(
  label: string,
  value: MapQuantity,
  step: number,
  onChange: (next: MapQuantity) => void,
): HTMLElement {
  const wrapper = document.createElement("div");
  const spelling = document.createElement("select");
  const inputs = document.createElement("div");
  const exact = typeof value === "number";

  wrapper.className = "room-workbench-quantity";
  inputs.className = "room-workbench-quantity__inputs";

  for (const [key, text] of [
    ["exact", "exactly"],
    ["range", "between"],
  ] as const) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = text;
    spelling.append(option);
  }

  spelling.value = exact ? "exact" : "range";

  if (exact) {
    const only = numberInput(value, step);
    only.addEventListener("change", () => onChange(Number(only.value)));
    inputs.append(only);
  } else {
    const low = numberInput(value.minimum, step);
    const high = numberInput(value.maximum, step);
    low.addEventListener("change", () => onChange({ minimum: Number(low.value), maximum: Number(high.value) }));
    high.addEventListener("change", () => onChange({ minimum: Number(low.value), maximum: Number(high.value) }));
    inputs.append(low, high);
  }

  spelling.addEventListener("change", () => {
    onChange(
      spelling.value === "exact"
        ? typeof value === "number"
          ? value
          : value.minimum
        : typeof value === "number"
          ? { minimum: value, maximum: value }
          : value,
    );
  });

  wrapper.append(spelling, inputs);
  return field(label, wrapper);
}

/** Whatever the draft holds for authored cells, as rows this surface can paint into. */
function rowsOf(value: unknown): MapTileKind[][] {
  return Array.isArray(value)
    ? value.map((row) => (Array.isArray(row) ? row.map((cell) => (isTileKind(cell) ? cell : "open")) : []))
    : [];
}

function isTileKind(value: unknown): value is MapTileKind {
  return typeof value === "string" && (MAP_TILE_KINDS as readonly string[]).includes(value);
}

/**
 * A grid to start painting from: a wall ring with floor inside it.
 *
 * The only seed that is certainly legal and certainly not empty. All-open would be a room with no
 * boundary, which reads as a mistake rather than a starting point; all-wall would have no interior to
 * paint into at all.
 */
function seededCells(width: number, height: number): MapTileKind[][] {
  return Array.from({ length: Math.max(0, height) }, (_row, y) =>
    Array.from({ length: Math.max(0, width) }, (_cell, x): MapTileKind =>
      x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "border" : "open",
    ),
  );
}

/**
 * Fits an existing grid to a new extent, keeping every interior cell that still has somewhere to be.
 *
 * The reader demands the grid and the extent agree exactly, so an extent change has to rewrite the grid
 * rather than leave it stale — a room that grows gains ring and floor, and one that shrinks loses
 * whatever fell outside it.
 *
 * **The old wall ring is deliberately not kept.** Carrying it over leaves the room's former boundary
 * standing as an interior wall, which seals the new floor off behind it — a room widened by four cells
 * came back refused rather than wider. What an author means by making a room bigger is that the wall
 * moves, so the ring is re-drawn at the new extent and whatever it used to occupy becomes floor.
 */
function reshaped(rows: readonly (readonly MapTileKind[])[], width: number, height: number): MapTileKind[][] {
  const wasHeight = rows.length;
  const wasWidth = rows[0]?.length ?? 0;
  const wasRing = (x: number, y: number): boolean => x === 0 || y === 0 || x === wasWidth - 1 || y === wasHeight - 1;

  return seededCells(width, height).map((row, y) =>
    row.map((cell, x) => (cell === "border" || wasRing(x, y) ? cell : (rows[y]?.[x] ?? cell))),
  );
}

/** Whether one optional thing is there at all, and — when it is — how much of it, kept in one cell. */
function option(toggle: HTMLElement, amount: HTMLElement | undefined): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "room-workbench-option";
  wrapper.append(toggle);

  if (amount) {
    wrapper.append(amount);
  }

  return wrapper;
}

/** A control that adds or removes a whole optional block, because absent and zero are different statements. */
function optionalBlock(label: string, present: boolean, onToggle: (present: boolean) => void): HTMLElement {
  const wrapper = document.createElement("label");
  const box = document.createElement("input");
  wrapper.className = "debug-field room-workbench-toggle";
  box.type = "checkbox";
  box.checked = present;
  box.addEventListener("change", () => onToggle(box.checked));
  wrapper.append(box, label);
  return wrapper;
}

/** What each kind is painted as in the palette and the grid, matching the diagram beside it. */
const CELL_COLOURS: Readonly<Record<MapTileKind, string>> = {
  open: "#2b3240",
  border: "#0a0c11",
  stone: "#7b8494",
  wood: "#9a6134",
  water: "#2f6fb5",
  barricade: "#c08a3e",
  filled: "#454d5e",
  mortar: "#b1522a",
  trench: "#05070b",
};

/**
 * Which kind the next click paints.
 *
 * Held across rebuilds of the form, because the form is rebuilt on every edit and an author painting a
 * run of water does not expect the brush to fall back to the first kind between two clicks.
 */
let brush: MapTileKind = "stone";

/**
 * The cells themselves, one button each.
 *
 * Buttons rather than a canvas because a cell is a thing to click, and a canvas would mean rebuilding
 * the hit-testing the browser already does. Holding the pointer down and moving paints a run.
 */
function paintingGrid(rows: MapTileKind[][], onChange: (rows: MapTileKind[][]) => void): HTMLElement {
  const wrapper = document.createElement("div");
  const palette = document.createElement("div");
  const grid = document.createElement("div");
  const width = rows[0]?.length ?? 0;
  let painting = false;

  wrapper.className = "room-workbench-authored";
  palette.className = "room-workbench-palette";
  grid.className = "room-workbench-grid";
  grid.style.setProperty("--cells", String(width));
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", "The room's cells");

  for (const kind of MAP_TILE_KINDS) {
    const swatch = actionButton(kind);
    swatch.className = "room-workbench-swatch";
    swatch.style.setProperty("--swatch", CELL_COLOURS[kind]);
    swatch.setAttribute("aria-pressed", String(kind === brush));
    swatch.addEventListener("click", () => {
      brush = kind;

      for (const other of palette.querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other.textContent === kind));
      }
    });
    palette.append(swatch);
  }

  const paint = (x: number, y: number): void => {
    const row = rows[y];

    if (!row || row[x] === brush) {
      return;
    }

    onChange(rows.map((cells, index) => (index === y ? cells.map((cell, at) => (at === x ? brush : cell)) : cells)));
  };

  for (const [y, row] of rows.entries()) {
    for (const [x, cell] of row.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "room-workbench-cell";
      button.style.setProperty("--cell", CELL_COLOURS[cell]);
      button.title = `${x}, ${y} — ${cell}`;
      button.setAttribute("aria-label", `Cell ${x}, ${y}, ${cell}`);
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        painting = true;
        paint(x, y);
      });
      button.addEventListener("pointerenter", () => {
        if (painting) {
          paint(x, y);
        }
      });
      grid.append(button);
    }
  }

  // On the window rather than the grid, so releasing the pointer outside it still ends the run.
  const stop = (): void => {
    painting = false;
  };
  window.addEventListener("pointerup", stop);

  wrapper.append(palette, grid);
  return wrapper;
}

/** Builds the room tab, which owns its own draft, preview and saving and nothing else's. */
export function createRoomSurface(): HTMLElement {
  const root = document.createElement("div");
  const form = createDebugPanel(
    "The room",
    "Its extent, the business it holds, the crowd it keeps, what is scattered into it, and how its cells come to exist.",
  );
  const previewPanel = createDebugPanel(
    "The room the game builds",
    "A floor of one room, from above and from inside it.",
  );
  const preview = createFloorPreview();
  const roomSelect = document.createElement("select");
  const idInput = document.createElement("input");
  const fields = document.createElement("div");
  const actions = document.createElement("div");
  const drawAgain = actionButton("Draw again");
  const saveButton = actionButton("Save room", true);
  const reloadButton = actionButton("Reload from disk");
  const refreshButton = actionButton("Refresh room list");
  const status = document.createElement("p");

  let draft: RoomDraft = {};
  let savedSource: string | undefined;
  let world: DemoWorld | undefined;
  let failure: string | undefined;

  root.className = "room-workbench";
  idInput.type = "text";
  fields.className = "room-workbench-fields";
  actions.className = "debug-button-row workbench-actions";
  status.className = "debug-status";
  status.setAttribute("role", "status");

  const dirty = (): boolean => savedSource === undefined || settled(draft) !== savedSource;

  /**
   * Assembles the draft room as a floor of one room.
   *
   * The extent of the throwaway map is the room's own, which is what leaves no margin for a side room and
   * therefore nothing for the fit check to refuse.
   */
  const rebuild = (): void => {
    try {
      // Asked before the reader is, so a sealed region reports as the thing that is wrong rather than as
      // whatever the reader happens to complain about first. It is the one refusal an author can paint
      // their way into and the one the runtime repair cannot undo.
      const held = asRecord(draft.structure);

      if (held.authored !== undefined) {
        const rows = rowsOf(held.authored);

        if (unfillableEnclosesRegion(rows, Number(draft.width ?? 0), Number(draft.height ?? 0))) {
          throw new TypeError(
            "These cells seal a region off: nothing could walk out of it, and neither water nor a trench can be filled in to reach it.",
          );
        }
      }

      const room: MapRoom = parseRoomSource(draft);
      const library = new Map(ROOM_LIBRARY);
      library.set(room.id, room);
      world = createDemoWorld(
        resolveMap(
          parseMapSource({
            name: PREVIEW_MAP,
            width: room.width,
            height: room.height,
            fixed: [{ slot: "main", room: room.id }],
            pool: [],
            draw: 0,
          }),
          library,
        ),
      );
      failure = undefined;
    } catch (error: unknown) {
      failure = error instanceof Error ? error.message : String(error);
    }

    refresh();
  };

  const edit = (change: (draft: RoomDraft) => void): void => {
    change(draft);
    rebuild();
  };

  /** A section heading with the spacing a section deserves, which the shared h3 does not carry. */
  const heading = (text: string): HTMLHeadingElement => {
    const title = document.createElement("h3");
    title.className = "workbench-section-title";
    title.textContent = text;
    return title;
  };

  /** The indented body under a toggle, so what belongs to a declaration is visibly inside it. */
  const section = (...children: readonly HTMLElement[]): HTMLDivElement => {
    const wrapper = document.createElement("div");
    wrapper.className = "room-workbench-section";
    wrapper.append(...children);
    return wrapper;
  };

  const buildFields = (): void => {
    fields.replaceChildren();

    const identity = document.createElement("div");
    identity.className = "debug-form-grid";
    const roleSelect = document.createElement("select");

    for (const [value, text] of [[NO_ROLE, "— none —"], ...MAP_ROOM_ROLES.map((role) => [role, role])] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      roleSelect.append(option);
    }

    roleSelect.value = typeof draft.role === "string" ? draft.role : NO_ROLE;
    roleSelect.addEventListener("change", () =>
      edit((next) => {
        if (roleSelect.value === NO_ROLE) {
          delete next.role;
        } else {
          next.role = roleSelect.value;
        }
      }),
    );

    const widthInput = numberInput(Number(draft.width ?? 11));
    const heightInput = numberInput(Number(draft.height ?? 11));

    // The reader demands an authored grid match the extent exactly, so an extent change carries the grid
    // with it rather than leaving a file that can no longer be read.
    const resize = (patch: Record<string, number>): void =>
      edit((next) => {
        Object.assign(next, patch);
        const held = asRecord(next.structure);

        if (held.authored !== undefined) {
          next.structure = {
            authored: reshaped(rowsOf(held.authored), Number(next.width ?? 0), Number(next.height ?? 0)),
          };
        }
      });

    widthInput.addEventListener("change", () => resize({ width: Number(widthInput.value) }));
    heightInput.addEventListener("change", () => resize({ height: Number(heightInput.value) }));
    identity.append(field("Role", roleSelect), field("Width", widthInput), field("Height", heightInput));
    fields.append(identity);

    // Crowd. Everything a declaration owns sits indented under its toggle, so the eye can answer
    // "what does this room declare" from the left edge alone.
    const crowd = draft.crowd === undefined ? undefined : asRecord(draft.crowd);
    fields.append(
      heading("Crowd"),
      optionalBlock("Bodies live here", crowd !== undefined, (present) =>
        edit((next) => {
          if (present) {
            next.crowd = { cap: 8, starting: 4 };
          } else {
            delete next.crowd;
          }
        }),
      ),
    );

    if (crowd) {
      const crowdGrid = document.createElement("div");
      crowdGrid.className = "debug-form-grid";
      const capInput = numberInput(Number(crowd.cap ?? 0));
      capInput.addEventListener("change", () =>
        edit((next) => (next.crowd = { ...asRecord(next.crowd), cap: Number(capInput.value) })),
      );
      crowdGrid.append(
        field("Cap", capInput),
        quantityField("Standing at the start", quantityOf(crowd.starting, 0), 1, (value) =>
          edit((next) => (next.crowd = { ...asRecord(next.crowd), starting: value })),
        ),
      );

      const reinforcement = crowd.reinforcement === undefined ? undefined : asRecord(crowd.reinforcement);
      const crowdBody = section(
        crowdGrid,
        optionalBlock("They are replaced", reinforcement !== undefined, (present) =>
          edit((next) => {
            const held = asRecord(next.crowd);

            if (present) {
              held.reinforcement = { every: 5, count: 1 };
            } else {
              delete held.reinforcement;
            }

            next.crowd = held;
          }),
        ),
      );

      if (reinforcement) {
        const arrivals = document.createElement("div");
        arrivals.className = "debug-form-grid";
        const setReinforcement = (patch: Record<string, unknown>): void =>
          edit((next) => {
            const held = asRecord(next.crowd);
            held.reinforcement = { ...asRecord(held.reinforcement), ...patch };
            next.crowd = held;
          });
        arrivals.append(
          // Seconds are the one quantity that may be a fraction of one.
          quantityField("Seconds between arrivals", quantityOf(reinforcement.every, 5), 0.5, (value) =>
            setReinforcement({ every: value }),
          ),
          quantityField("Arriving together", quantityOf(reinforcement.count, 1), 1, (value) =>
            setReinforcement({ count: value }),
          ),
        );
        crowdBody.append(section(arrivals));
      }

      fields.append(crowdBody);
    }

    // Scatter.
    const scatter = draft.scatter === undefined ? undefined : asRecord(draft.scatter);
    fields.append(
      heading("Scattered onto its floor"),
      optionalBlock("Something is scattered here", scatter !== undefined, (present) =>
        edit((next) => {
          if (present) {
            next.scatter = {};
          } else {
            delete next.scatter;
          }
        }),
      ),
    );

    if (scatter) {
      const setScatter = (patch: Record<string, unknown>): void =>
        edit((next) => (next.scatter = { ...asRecord(next.scatter), ...patch }));
      const dropScatter = (key: string): void =>
        edit((next) => {
          const held = asRecord(next.scatter);
          delete held[key];
          next.scatter = held;
        });
      const pools = scatter.pools === undefined ? undefined : asRecord(scatter.pools);
      const scatterBody = section(
        optionalBlock("Water", pools !== undefined, (present) =>
          present ? setScatter({ pools: { share: 0.05, size: { minimum: 1, maximum: 4 } } }) : dropScatter("pools"),
        ),
      );

      if (pools) {
        const poolGrid = document.createElement("div");
        poolGrid.className = "debug-form-grid";
        const shareInput = numberInput(Number(pools.share ?? 0), 0.01);
        shareInput.max = "1";
        shareInput.addEventListener("change", () =>
          setScatter({ pools: { ...asRecord(scatter.pools), share: Number(shareInput.value) } }),
        );
        poolGrid.append(
          field("Share of the room that is water", shareInput),
          quantityField("Cells one pool grows to", quantityOf(pools.size, 1), 1, (value) =>
            setScatter({ pools: { ...asRecord(scatter.pools), size: value } }),
          ),
        );
        scatterBody.append(section(poolGrid));
      }

      const counted = document.createElement("div");
      counted.className = "room-workbench-kit";

      for (const key of ["barricades", "mortars"] as const) {
        counted.append(
          option(
            optionalBlock(key, scatter[key] !== undefined, (present) =>
              present ? setScatter({ [key]: 1 }) : dropScatter(key),
            ),
            scatter[key] === undefined
              ? undefined
              : quantityField("How many", quantityOf(scatter[key], 1), 1, (value) => setScatter({ [key]: value })),
          ),
        );
      }

      const props = scatter.props === undefined ? undefined : asRecord(scatter.props);
      scatterBody.append(
        counted,
        optionalBlock("Kit lying on the floor (read from a map's main room only)", props !== undefined, (present) =>
          present ? setScatter({ props: {} }) : dropScatter("props"),
        ),
      );

      if (props) {
        const propGrid = document.createElement("div");
        propGrid.className = "room-workbench-kit";

        for (const kind of PROP_KINDS) {
          const held = props[kind as PropKind];
          propGrid.append(
            option(
              optionalBlock(kind, held !== undefined, (present) =>
                setScatter({
                  props: present
                    ? { ...asRecord(scatter.props), [kind]: 1 }
                    : Object.fromEntries(Object.entries(asRecord(scatter.props)).filter(([name]) => name !== kind)),
                }),
              ),
              held === undefined
                ? undefined
                : quantityField("How many", quantityOf(held, 1), 1, (value) =>
                    setScatter({ props: { ...asRecord(scatter.props), [kind]: value } }),
                  ),
            ),
          );
        }

        scatterBody.append(section(propGrid));
      }

      fields.append(scatterBody);
    }

    // Structure.
    const structure = asRecord(draft.structure);
    fields.append(heading("How its cells come to exist"));

    const structureGrid = document.createElement("div");
    const kindSelect = document.createElement("select");
    structureGrid.className = "debug-form-grid";

    for (const [value, text] of [
      ["carved", "carved into corridors"],
      ["open", "open floor throughout"],
      ["authored", "authored cell by cell"],
    ] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      kindSelect.append(option);
    }

    kindSelect.value =
      structure.authored !== undefined ? "authored" : structure.generated === "open" ? "open" : "carved";
    kindSelect.addEventListener("change", () =>
      edit((next) => {
        const width = Number(next.width ?? 0);
        const height = Number(next.height ?? 0);
        next.structure =
          kindSelect.value === "open"
            ? { generated: "open" }
            : kindSelect.value === "authored"
              ? { authored: seededCells(width, height) }
              : { generated: "carved", openShare: 0.6, walls: { stone: 58, wood: 42 } };
      }),
    );
    structureGrid.append(field("Structure", kindSelect));

    if (structure.authored !== undefined) {
      fields.append(
        structureGrid,
        paintingGrid(rowsOf(structure.authored), (rows) => edit((next) => (next.structure = { authored: rows }))),
      );
      return;
    }

    if (structure.generated === "carved") {
      const openShare = numberInput(Number(structure.openShare ?? 0), 0.01);
      const walls = asRecord(structure.walls);
      const stone = numberInput(Number(walls.stone ?? 0));
      const wood = numberInput(Number(walls.wood ?? 0));
      openShare.max = "1";
      openShare.addEventListener("change", () =>
        edit((next) => (next.structure = { ...asRecord(next.structure), openShare: Number(openShare.value) })),
      );

      for (const [input, key] of [
        [stone, "stone"],
        [wood, "wood"],
      ] as const) {
        input.addEventListener("change", () =>
          edit((next) => {
            const held = asRecord(next.structure);
            held.walls = { ...asRecord(held.walls), [key]: Number(input.value) };
            next.structure = held;
          }),
        );
      }

      structureGrid.append(
        field("How open it ends up", openShare),
        field("Wall mix · stone", stone),
        field("Wall mix · timber", wood),
      );
    }

    fields.append(structureGrid);
  };

  const refresh = (): void => {
    idInput.value = typeof draft.id === "string" ? draft.id : "";
    roomSelect.value = idInput.value;
    saveButton.disabled = failure !== undefined;
    buildFields();

    if (world) {
      preview.show(world, `Room ${idInput.value}`);
    }

    status.dataset.tone = failure === undefined ? "success" : "error";
    status.textContent =
      failure ??
      (world
        ? `${idInput.value}: ${world.maze.width} by ${world.maze.height}, ${world.enemies.length} bodies standing.${dirty() ? " Unsaved." : ""}`
        : "Nothing assembled yet.");
  };

  const openRoom = (name: string): Promise<void> =>
    loadCanonical("room", name).then((source) => {
      draft = asRecord(source);
      savedSource = settled(source);
      rebuild();
    });

  const refreshList = (): Promise<void> =>
    listCanonical("room").then((names) => {
      roomSelect.replaceChildren();

      for (const name of names) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        roomSelect.append(option);
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

  idInput.addEventListener("input", () => {
    draft.id = idInput.value;
    refresh();
  });
  roomSelect.addEventListener("change", () => {
    run(reloadButton, `Reading "${roomSelect.value}" from disk…`, () => openRoom(roomSelect.value));
  });
  drawAgain.addEventListener("click", rebuild);
  reloadButton.addEventListener("click", () => {
    run(reloadButton, "Reading the room from disk…", () => openRoom(String(draft.id ?? "")));
  });
  refreshButton.addEventListener("click", () => {
    run(refreshButton, "Asking what the library holds…", refreshList);
  });
  saveButton.addEventListener("click", () => {
    run(saveButton, "Validating and saving the room…", () =>
      saveCanonical("room", draft, String(draft.id ?? "")).then(() => {
        savedSource = settled(draft);
        return refreshList();
      }),
    );
  });

  // Which file is open is a different question from what it says, so the file operations sit in their
  // own row above the form rather than posing as fields of the room.
  const openRow = document.createElement("div");
  openRow.className = "workbench-open-row";
  openRow.append(field("Open room", roomSelect), reloadButton, refreshButton);

  const identityGrid = document.createElement("div");
  identityGrid.className = "debug-form-grid";
  identityGrid.append(field("Identity", idInput));
  actions.append(saveButton);

  // Re-drawing is the preview's own control — it changes what is looked at, not what is written.
  const previewActions = document.createElement("div");
  previewActions.className = "debug-button-row workbench-preview-actions";
  previewActions.append(drawAgain);

  form.body.append(openRow, identityGrid, fields, actions, status);
  previewPanel.body.append(previewActions, preview.element);
  root.append(form.panel, previewPanel.panel);

  refresh();
  run(refreshButton, "Asking what the library holds…", () =>
    refreshList().then(() => openRoom(roomSelect.value || "main-region")),
  );

  return root;
}
