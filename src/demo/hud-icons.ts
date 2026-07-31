/**
 * Every mark the interface draws for a thing you can be given, built rather than typed.
 *
 * They were characters — `⚔`, `⚡`, `✋`, `🔪` — and several of them were emoji. A font decides what an
 * emoji looks like, which meant a colour picture arrived where a stroke in the row's own colour was
 * wanted, `color` was ignored entirely, and a mark stayed bright in a row meant to read as dimmed. It
 * also meant the set did not match itself: some marks were hairline glyphs and some were full-colour
 * pictures at the same size.
 *
 * So the whole set is drawn here instead, as one stroke weight on one grid, in `currentColor`. Every
 * place that shows one — the bar during play, the pause roster, the award card, the run-end sheet —
 * asks this for the same mark, so there is one answer to what each of these things looks like.
 *
 * The blessing marks are keyed by the blessing's own id, so a new blessing does not typecheck until
 * it has been drawn.
 */

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type HudIconId =
  // The blessings that never repeat
  | "heavyStrike"
  | "explosiveBody"
  | "stormStone"
  | "lifesteal"
  | "hostageGuard"
  // The blessings that stack
  | "vigour"
  | "brutality"
  | "swiftness"
  | "longReach"
  // The melee bases a core can be
  | "cleaver"
  | "mallet"
  | "skewer"
  | "ladle"
  // What is neither: surplus health, a sealed reward, and the floor getting hungrier
  | "vitality"
  | "seal"
  | "threat";

/**
 * One mark, as the shapes it is made of.
 *
 * Paths and circles only. Everything here is drawn on a 24-unit square and stroked, never filled, so
 * a mark reads the same against the panel it sits on and against the room behind a transparent one.
 */
type IconPart = Readonly<{ circle: readonly [number, number, number] }> | Readonly<{ path: string }>;

const HUD_ICON_PARTS: Readonly<Record<HudIconId, readonly IconPart[]>> = {
  // A sword stood on its point: a blade with width to it, a crossguard, a grip and a pommel.
  //
  // The blade is an outline rather than a line. At the size the play-time bar draws these — about
  // fifteen pixels — a one-stroke blade with a small pommel disc reads as a tick mark, and the two
  // details doing the work of saying "sword" are the ones that disappear first.
  heavyStrike: [
    { path: "M12 2 L14.3 6.2 V13 H9.7 V6.2 Z" },
    { path: "M6.2 13 H17.8" },
    { path: "M12 13 V19" },
    { path: "M9.6 19.5 H14.4" },
  ],
  // A body coming apart: a core, and eight things leaving it.
  explosiveBody: [
    { circle: [12, 12, 3.2] },
    { path: "M12 2 L12 6" },
    { path: "M12 18 L12 22" },
    { path: "M2 12 L6 12" },
    { path: "M18 12 L22 12" },
    { path: "M5 5 L7.7 7.7" },
    { path: "M16.3 16.3 L19 19" },
    { path: "M19 5 L16.3 7.7" },
    { path: "M7.7 16.3 L5 19" },
  ],
  stormStone: [{ path: "M13.5 2 L6 13 L11 13 L10.5 22 L18 11 L13 11 Z" }],
  // A drop with a cross in it: what a kill gives back.
  lifesteal: [
    { path: "M12 2 C12 2 4.5 10.4 4.5 14.9 A7.5 7.5 0 0 0 19.5 14.9 C19.5 10.4 12 2 12 2 Z" },
    { path: "M12 11 V18.4" },
    { path: "M8.3 14.7 H15.7" },
  ],
  hostageGuard: [{ path: "M12 2.5 L20 5.5 V12 C20 17 16.4 20.4 12 21.5 C7.6 20.4 4 17 4 12 V5.5 Z" }],
  vigour: [
    {
      path: "M12 20.8 C12 20.8 3.5 15.4 3.5 9.8 A4.7 4.7 0 0 1 12 7.1 A4.7 4.7 0 0 1 20.5 9.8 C20.5 15.4 12 20.8 12 20.8 Z",
    },
  ],
  // The four-point spark a heavier hit throws.
  brutality: [{ path: "M12 2 L14.7 9.3 L22 12 L14.7 14.7 L12 22 L9.3 14.7 L2 12 L9.3 9.3 Z" }],
  swiftness: [{ path: "M4.5 5.5 L11 12 L4.5 18.5" }, { path: "M13 5.5 L19.5 12 L13 18.5" }],
  longReach: [{ path: "M3 12 L20 12" }, { path: "M14.5 6.5 L20 12 L14.5 17.5" }],
  // A broad blade with a tang: even weight, even reach.
  cleaver: [{ path: "M3.5 5.5 H14.5 V15 H3.5 Z" }, { path: "M14.5 8.5 H20.5 V12 H14.5" }],
  mallet: [{ path: "M5 4.5 H19 V10.5 H5 Z" }, { path: "M12 10.5 V21" }],
  skewer: [{ path: "M12 2.5 V21.5" }, { path: "M9.4 6.2 L12 2.5 L14.6 6.2" }, { path: "M9 14.5 H15" }],
  ladle: [{ path: "M6.5 12 A5.5 5.5 0 0 0 17.5 12 Z" }, { path: "M12 5 V12" }, { path: "M12 5 H16" }],
  // What the stacking tier pays into once the named blessings are spent.
  vitality: [{ circle: [12, 12, 8.6] }, { path: "M12 7.4 L12 16.6" }, { path: "M7.4 12 L16.6 12" }],
  seal: [{ path: "M12 2.5 L21.5 12 L12 21.5 L2.5 12 Z" }, { path: "M12 7.6 L16.4 12 L12 16.4 L7.6 12 Z" }],
  threat: [
    { path: "M5 11.5 A7 7 0 0 1 19 11.5 V14 A3 3 0 0 1 16 17 H8 A3 3 0 0 1 5 14 Z" },
    { circle: [9.3, 11.4, 1.6] },
    { circle: [14.7, 11.4, 1.6] },
    { path: "M9.2 17 V20.2" },
    { path: "M12 17 V20.8" },
    { path: "M14.8 17 V20.2" },
  ],
};

/**
 * Builds one mark, sized by the box it is put in.
 *
 * No width or height attribute: `demo.css` sizes it from the surrounding type scale, so the same mark
 * is small in the play-time bar and large on the award card without this knowing either number.
 */
export function createHudIcon(id: HudIconId): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("demo__icon");

  for (const part of HUD_ICON_PARTS[id]) {
    if ("circle" in part) {
      const circle = document.createElementNS(SVG_NAMESPACE, "circle");
      circle.setAttribute("cx", String(part.circle[0]));
      circle.setAttribute("cy", String(part.circle[1]));
      circle.setAttribute("r", String(part.circle[2]));
      svg.append(circle);
      continue;
    }

    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", part.path);
    svg.append(path);
  }

  return svg;
}
