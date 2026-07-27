import "@/app/game-surface.css";

import type { FloorSetSource } from "@/content/floor/floor-schema";
import type { RunSnapshot, SemanticEvent } from "@/core/run-state";
import { GamePresentation } from "@/presentation/game-presentation";
import { commandForKey } from "@/runtime/keymap";
import { TurnRunner } from "@/runtime/turn-runner";
import { createHudOverlay } from "@/ui/hud-overlay";
import { deriveHudView } from "@/ui/hud-view";
import type { GameSession } from "@/runtime/game-session";

export type MountedGameSurface = Readonly<{ dispose: () => void }>;

const REJECTION_MESSAGE_VISIBLE_MS = 1800;

/** Anything that owns its own activation, so a gameplay key never fires it and vice versa. */
const INTERACTIVE_SELECTOR = "a[href], button, input, select, textarea, [tabindex]";

export function mountGameSurface(
  mount: HTMLElement,
  floorSet: FloorSetSource,
  createSession: () => GameSession,
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
  let session = createSession();

  /**
   * The one value the readout needs that a snapshot cannot answer: stairs run both ways, so the
   * snapshot only knows where the player is now. It dies with the session and resets on restart.
   */
  let deepestFloorId = session.getSnapshot().player.floorId;

  const floorDepth = (floorId: string): number => session.world.floors.findIndex((floor) => floor.id === floorId);

  const hud = createHudOverlay(() => {
    if (presentation) {
      startRun(presentation);
    }
  });
  surface.append(hud.element);

  const refreshHud = (snapshot: RunSnapshot, events: readonly SemanticEvent[]): void => {
    if (floorDepth(snapshot.player.floorId) > floorDepth(deepestFloorId)) {
      deepestFloorId = snapshot.player.floorId;
    }

    hud.update(deriveHudView(session.world, snapshot, events, deepestFloorId));
  };

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

  /**
   * Binds a fresh run to the loaded presentation. A `settle` intent rebuilds the render scene and
   * reseats the camera, so restarting reuses the presentation instead of disposing it and paying
   * for image loading again. The runner is replaced rather than reset because held-forward and
   * buffered-command state lives on it and must not survive into the new run.
   */
  const startRun = (activePresentation: GamePresentation): void => {
    session = createSession();
    deepestFloorId = session.getSnapshot().player.floorId;
    void activePresentation.present(session.getSnapshot(), [], { kind: "settle" });
    turnRunner = new TurnRunner(session, activePresentation, {
      onRejectionMessage: showRejectionMessage,
      onSettled: refreshHud,
    });
    refreshHud(session.getSnapshot(), []);
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
      turnRunner = new TurnRunner(session, nextPresentation, {
        onRejectionMessage: showRejectionMessage,
        onSettled: refreshHud,
      });
      refreshHud(session.getSnapshot(), []);
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

    // Keys are listened for on the window, so a focused control would otherwise receive its own
    // activation and a gameplay command from the same press.
    if (event.target instanceof HTMLElement && event.target.closest(INTERACTIVE_SELECTOR)) {
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

  /**
   * Left click spends the cell the player is facing: an enemy there is attacked, a door, stair,
   * spring, or exit is used. Both branches already have a keyboard binding, so the pointer stays a
   * convenience and never becomes the only way to reach anything.
   */
  const handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !turnRunner) {
      return;
    }

    event.preventDefault();
    turnRunner.submit(session.hasInteractionTargetAhead() ? "interact" : "forward");
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", releaseHeldForward);
  canvas.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  void load();

  return {
    dispose: () => {
      disposed = true;
      presentation?.dispose();
      hud.dispose();
      turnRunner = undefined;

      if (messageHideTimer !== undefined) {
        globalThis.clearTimeout(messageHideTimer);
      }

      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseHeldForward);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      surface.remove();
    },
  };
}
