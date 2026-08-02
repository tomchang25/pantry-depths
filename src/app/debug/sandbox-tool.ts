import { createDebugPage, type DebugPageWidth } from "@/app/debug/debug-shell";

/**
 * What a sandbox experiment hands the debug surface.
 *
 * The direction matters. A sandbox experiment (`dev/standards/sandbox_track.md`) may not import
 * anything outside its own folder, `src/core/`, and `src/content/`, so it cannot build the debug
 * page chrome itself. It describes the page it wants and fills the content region; the debug
 * surface — the one place allowed to reach into `src/sandbox/` — owns the shell.
 */
export type SandboxExperiment = Readonly<{
  description: string;
  /** Applied to the page element, so the experiment's own stylesheet can scope itself. */
  pageClass: string;
  title: string;
  width?: DebugPageWidth;
  mount(content: HTMLElement): void;
}>;

/** Adapts an experiment descriptor into the render function the tool catalog expects. */
export function mountSandboxExperiment(experiment: SandboxExperiment): (mount: HTMLElement) => void {
  return (mount) => {
    const { page, content } = createDebugPage({
      title: experiment.title,
      description: experiment.description,
      // Spread rather than pass through: under exactOptionalPropertyTypes an explicit `undefined`
      // is not the same as an absent key, and absent is what selects the shell's own default.
      ...(experiment.width === undefined ? {} : { width: experiment.width }),
    });

    page.classList.add(experiment.pageClass);
    experiment.mount(content);
    mount.replaceChildren(page);
  };
}
