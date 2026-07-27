export type DebugPageWidth = "standard" | "wide";

export type DebugPageOptions = Readonly<{
  description: string;
  isHub?: boolean;
  title: string;
  width?: DebugPageWidth;
}>;

export type DebugPageShell = Readonly<{
  content: HTMLDivElement;
  page: HTMLElement;
}>;

/** Creates the shared landmark structure used by every development-only page. */
export function createDebugPage(options: DebugPageOptions): DebugPageShell {
  const page = document.createElement("main");
  const header = document.createElement("header");
  const identity = document.createElement("div");
  const eyebrow = document.createElement("p");
  const heading = document.createElement("h1");
  const description = document.createElement("p");
  const content = document.createElement("div");

  page.className = `debug-page debug-page--${options.width ?? "standard"}`;
  header.className = "debug-page__header";
  identity.className = "debug-page__identity";
  eyebrow.className = "debug-page__eyebrow";
  eyebrow.textContent = "Pantry Depths · Development Console";
  heading.className = "debug-page__title";
  heading.textContent = options.title;
  description.className = "debug-page__description";
  description.textContent = options.description;
  content.className = "debug-page__content";

  if (!options.isHub) {
    const navigation = document.createElement("nav");
    const backLink = document.createElement("a");
    navigation.className = "debug-page__navigation";
    navigation.setAttribute("aria-label", "Debug tools");
    backLink.className = "debug-page__back-link";
    backLink.href = "/debug";
    backLink.textContent = "← All debug tools";
    navigation.append(backLink);
    header.append(navigation);
  }

  identity.append(eyebrow, heading, description);
  header.append(identity);
  page.append(header, content);

  return { page, content };
}

/** Creates a consistently structured section without taking ownership of its domain content. */
export function createDebugPanel(
  title: string,
  description?: string,
): Readonly<{ body: HTMLDivElement; panel: HTMLElement }> {
  const panel = document.createElement("section");
  const heading = document.createElement("h2");
  const body = document.createElement("div");

  panel.className = "debug-panel";
  // A named section is a landmark region, so a debug page with several panels stays navigable and
  // each panel's own status text is attributable to the panel that owns it.
  panel.setAttribute("aria-label", title);
  heading.className = "debug-panel__title";
  heading.textContent = title;
  body.className = "debug-panel__body";
  panel.append(heading);

  if (description) {
    const copy = document.createElement("p");
    copy.className = "debug-panel__description";
    copy.textContent = description;
    panel.append(copy);
  }

  panel.append(body);
  return { panel, body };
}

/** Wraps wide tabular or map content so overflow stays inside the owning region. */
export function createDebugScroller(content: HTMLElement, ariaLabel: string): HTMLDivElement {
  const scroller = document.createElement("div");
  scroller.className = "debug-scroller";
  scroller.setAttribute("aria-label", ariaLabel);
  scroller.setAttribute("role", "region");
  scroller.tabIndex = 0;
  scroller.append(content);
  return scroller;
}
