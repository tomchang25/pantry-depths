import "@/app/game-surface.css";

import type { FloorSetSource } from "@/content/floor/floor-schema";
import { GamePresentation } from "@/presentation/game-presentation";
import { commandForKey } from "@/runtime/keymap";
import { TurnRunner } from "@/runtime/turn-runner";
import type { GameSession } from "@/runtime/game-session";

export type MountedGameSurface = Readonly<{ dispose: () => void }>;

const REJECTION_MESSAGE_VISIBLE_MS = 1800;

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
  const message = document.createElement("p");
  message.className = "game-surface__message";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  surface.append(canvas, status, message);
  mount.replaceChildren(surface);
  let presentation: GamePresentation | undefined;
  let turnRunner: TurnRunner | undefined;
  let messageHideTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let disposed = false;

  /**
   * Every refusal shows the line, but repeated refusals extend the one message rather than
   * replaying its entrance: restarting the fade on each press would flicker while the player is
   * still leaning on the key.
   */
  const showRejectionMessage = (text: string): void => {
    message.textContent = text;
    message.classList.add("game-surface__message--visible");

    if (messageHideTimer !== undefined) {
      globalThis.clearTimeout(messageHideTimer);
    }

    messageHideTimer = globalThis.setTimeout(() => {
      message.classList.remove("game-surface__message--visible");
    }, REJECTION_MESSAGE_VISIBLE_MS);
  };

  const load = async (): Promise<void> => {
    status.replaceChildren();
    const loadingMessage = document.createElement("p");
    loadingMessage.textContent = "Lighting the torch…";
    status.append(loadingMessage);
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
      turnRunner = new TurnRunner(session, nextPresentation, { onRejectionMessage: showRejectionMessage });
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

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!turnRunner) {
      return;
    }

    const command = commandForKey(event.key);

    if (!command) {
      return;
    }

    event.preventDefault();

    if (command === "forward") {
      if (!event.repeat) {
        turnRunner.startHeldForward();
      }

      return;
    }

    if (event.repeat) {
      return;
    }

    turnRunner.submit(command);
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    if (commandForKey(event.key) === "forward") {
      turnRunner?.stopHeldForward();
    }
  };

  const releaseHeldForward = (): void => {
    turnRunner?.stopHeldForward();
  };

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      releaseHeldForward();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", releaseHeldForward);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  void load();

  return {
    dispose: () => {
      disposed = true;
      presentation?.dispose();
      turnRunner = undefined;

      if (messageHideTimer !== undefined) {
        globalThis.clearTimeout(messageHideTimer);
      }

      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseHeldForward);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      surface.remove();
    },
  };
}
