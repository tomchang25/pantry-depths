import { loadDemoImages } from "@/demo/demo-sprites";
import {
  CanvasGameplayRenderer,
  type PresentationRenderEffects,
  type RendererPreferences,
} from "@/presentation/canvas-gameplay-renderer";
import type { RenderScene } from "@/presentation/render-scene";
import type { PresentationImages } from "@/presentation/presentation-image-loader";

export type RenderPanelTiming = Readonly<{
  elapsedSeconds: number;
  frameSeconds: number;
}>;

export type RenderPanelFrame = Readonly<{
  scene: RenderScene;
  elapsedSeconds?: number;
  effects?: PresentationRenderEffects;
  preferences?: Omit<RendererPreferences, "reducedMotion"> & Readonly<{ reducedMotion?: boolean }>;
}>;

export type RenderPanelOptions = Readonly<{
  ariaLabel: string;
  frame: (timing: RenderPanelTiming, renderer: CanvasGameplayRenderer) => RenderPanelFrame;
}>;

export type RenderPanel = Readonly<{
  canvas: HTMLCanvasElement;
  element: HTMLDivElement;
  close: () => void;
}>;

let presentationImagesPromise: Promise<PresentationImages> | undefined;

function loadSharedPresentationImages(): Promise<PresentationImages> {
  if (!presentationImagesPromise) {
    presentationImagesPromise = loadDemoImages().catch((error: unknown) => {
      presentationImagesPromise = undefined;
      throw error;
    });
  }

  return presentationImagesPromise;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/** Mounts one self-contained renderer loop whose scene remains owned by the calling workbench. */
export function createRenderPanel(options: RenderPanelOptions): RenderPanel {
  const element = document.createElement("div");
  const canvas = document.createElement("canvas");
  const status = document.createElement("p");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let animationFrame = 0;
  let closed = false;
  let previousFrame: number | undefined;
  let startedAt: number | undefined;

  element.className = "render-panel";
  element.dataset.state = "loading";
  canvas.className = "render-panel__canvas";
  canvas.setAttribute("aria-label", options.ariaLabel);
  canvas.textContent = options.ariaLabel;
  status.className = "render-panel__status";
  status.setAttribute("role", "status");
  status.textContent = "Loading renderer…";
  element.append(canvas, status);

  const close = (): void => {
    if (closed) {
      return;
    }

    closed = true;
    window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("pagehide", close);
    element.dataset.state = "closed";
  };

  window.addEventListener("pagehide", close, { once: true });

  void loadSharedPresentationImages()
    .then((images) => {
      if (closed) {
        return;
      }

      const renderer = new CanvasGameplayRenderer(canvas, images);
      element.dataset.state = "ready";
      status.textContent = "Renderer ready.";

      const render = (now: number): void => {
        if (closed) {
          return;
        }

        startedAt ??= now;
        const timing = {
          elapsedSeconds: (now - startedAt) / 1000,
          frameSeconds: previousFrame === undefined ? 0 : Math.min(0.1, (now - previousFrame) / 1000),
        };
        previousFrame = now;

        try {
          const frame = options.frame(timing, renderer);
          renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
          renderer.render(frame.scene, frame.elapsedSeconds ?? timing.elapsedSeconds, frame.effects, {
            reducedMotion: frame.preferences?.reducedMotion ?? reducedMotion,
            ...frame.preferences,
          });
        } catch (error: unknown) {
          element.dataset.state = "error";
          status.setAttribute("role", "alert");
          status.textContent = `Renderer stopped: ${errorMessage(error)}`;
          return;
        }

        animationFrame = window.requestAnimationFrame(render);
      };

      animationFrame = window.requestAnimationFrame(render);
    })
    .catch((error: unknown) => {
      if (closed) {
        return;
      }

      element.dataset.state = "error";
      status.setAttribute("role", "alert");
      status.textContent = `Unable to load renderer: ${errorMessage(error)}`;
    });

  return { canvas, element, close };
}
