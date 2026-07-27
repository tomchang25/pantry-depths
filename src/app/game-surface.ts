import "@/app/game-surface.css";

import type { FloorSetSource } from "@/content/floor/floor-schema";
import { GamePresentation } from "@/presentation/game-presentation";
import type { GameSession } from "@/runtime/game-session";

export type MountedGameSurface = Readonly<{ dispose: () => void }>;

export function mountGameSurface(
  mount: HTMLElement,
  floorSet: FloorSetSource,
  session: GameSession,
): MountedGameSurface {
  const surface = document.createElement("main");
  surface.className = "game-surface";
  const canvas = document.createElement("canvas");
  canvas.className = "game-surface__canvas";
  canvas.setAttribute("aria-label", "First-person view of the Pantry Depths dungeon");
  const status = document.createElement("section");
  status.className = "game-surface__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  surface.append(canvas, status);
  mount.replaceChildren(surface);
  let presentation: GamePresentation | undefined;
  let disposed = false;

  const load = async (): Promise<void> => {
    status.replaceChildren();
    const message = document.createElement("p");
    message.textContent = "Lighting the torch…";
    status.append(message);
    status.hidden = false;
    canvas.classList.remove("game-surface__canvas--ready");

    try {
      const nextPresentation = await GamePresentation.create(canvas, floorSet, session.world, session.getSnapshot());

      if (disposed) {
        nextPresentation.dispose();
        return;
      }

      presentation?.dispose();
      presentation = nextPresentation;
      canvas.classList.add("game-surface__canvas--ready");
      status.hidden = true;
    } catch (caught) {
      if (disposed) {
        return;
      }

      console.error("game presentation failed to load", caught);
      const detail = document.createElement("p");
      detail.textContent = caught instanceof Error ? caught.message : "The dungeon view could not be loaded.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Retry loading";
      retry.addEventListener("click", () => void load(), { once: true });
      status.replaceChildren(detail, retry);
      status.hidden = false;
    }
  };

  void load();

  return {
    dispose: () => {
      disposed = true;
      presentation?.dispose();
      surface.remove();
    },
  };
}
