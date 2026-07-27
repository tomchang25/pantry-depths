import { ACTION_TIMINGS } from "@/content/presentation/action-timings";
import type { FloorSetSource } from "@/content/floor/floor-schema";
import {
  CanvasGameplayRenderer,
  type DeathRenderEffect,
  type EnemyRenderEffect,
  type PresentationRenderEffects,
} from "@/presentation/canvas-gameplay-renderer";
import { loadPresentationImages } from "@/presentation/presentation-image-loader";
import { ProceduralAudio, type AudioCapability } from "@/presentation/procedural-audio";
import { createRenderScene, type CameraPose, type RenderScene } from "@/presentation/render-scene";
import type { RunSnapshot, RunWorld, SemanticEvent } from "@/core/run-state";

type TimedEnemyEffect = Readonly<{
  entityId: string;
  state: "attack" | "hurt";
  startedAt: number;
  duration: number;
  flashDuration: number;
}>;

type TimedDeath = Omit<DeathRenderEffect, "progress"> & Readonly<{ startedAt: number; duration: number }>;

/**
 * What a settled command asks presentation to play. Resolving one of these to the point the
 * runtime can accept the next command is presentation's only completion contract; presentation
 * never decides what resolves next, only reports that its own animation is done.
 */
export type PresentationIntent =
  | Readonly<{ kind: "move" }>
  | Readonly<{ kind: "turn"; direction: "left" | "right" }>
  | Readonly<{ kind: "attack" }>
  | Readonly<{ kind: "rejectBlocked" }>
  | Readonly<{ kind: "settle" }>;

type ActiveTween =
  | Readonly<{ kind: "move"; fromX: number; fromY: number; toX: number; toY: number; angle: number; startedAt: number }>
  | Readonly<{ kind: "turn"; x: number; y: number; fromAngle: number; toAngle: number; startedAt: number }>
  | Readonly<{ kind: "attack"; startedAt: number }>
  | Readonly<{ kind: "rejectBlocked"; startedAt: number }>;

export type PresentationStatus = Readonly<{
  audio: AudioCapability;
  reducedMotion: boolean;
}>;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

/**
 * Smoothstep, applied to the turn only. Forward is authored as a linear slide, but a linear turn
 * starts and stops the rotational optical flow on a hard edge, which the inner ear reads as the
 * view being yanked rather than turned. Easing both ends keeps the same authored duration while
 * removing the abrupt onset.
 */
function easeInOut(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

/** Attack keeps its existing reduced-motion scale; move/turn collapse to an immediate settle. */
function effectiveDurationMs(kind: ActiveTween["kind"], reducedMotion: boolean): number {
  if (kind === "attack") {
    return reducedMotion ? ACTION_TIMINGS.attackReducedDurationMs : ACTION_TIMINGS.attackDurationMs;
  }

  if (kind === "rejectBlocked") {
    return ACTION_TIMINGS.blockedMoveDurationMs;
  }

  if (kind === "move") {
    return reducedMotion ? 0 : ACTION_TIMINGS.forwardMoveDurationMs;
  }

  return reducedMotion ? 0 : ACTION_TIMINGS.turnDurationMs;
}

export class GamePresentation {
  readonly #renderer: CanvasGameplayRenderer;
  readonly #audio = new ProceduralAudio();
  readonly #mediaQuery: MediaQueryList;
  readonly #resizeObserver: ResizeObserver | undefined;
  #scene: RenderScene;
  #restCamera: CameraPose;
  #activeTween: ActiveTween | undefined;
  #activeResolve: (() => void) | undefined;
  #animationFrame = 0;
  #startedAt = performance.now();
  #enemyEffects: TimedEnemyEffect[] = [];
  #deaths: TimedDeath[] = [];
  #playerHitStartedAt = Number.NEGATIVE_INFINITY;
  #pointerLeanTarget = 0;
  #pointerLean = 0;
  #lastFrameAt: number | undefined;
  #disposed = false;

  private constructor(
    readonly canvas: HTMLCanvasElement,
    readonly floorSet: FloorSetSource,
    readonly world: RunWorld,
    snapshot: RunSnapshot,
    renderer: CanvasGameplayRenderer,
  ) {
    this.#renderer = renderer;
    this.#scene = createRenderScene(floorSet, world, snapshot);
    this.#restCamera = this.#scene.camera;
    this.#mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.#resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            this.#resize();
          });
    this.#resizeObserver?.observe(canvas);
    window.addEventListener("resize", this.#resize);
    window.addEventListener("keydown", this.#activateAudio);
    window.addEventListener("pointerdown", this.#activateAudio);
    canvas.addEventListener("pointermove", this.#trackPointerLean);
    canvas.addEventListener("pointerleave", this.#releasePointerLean);
    this.#resize();
    this.#animationFrame = requestAnimationFrame(this.#renderFrame);
  }

  public static async create(
    canvas: HTMLCanvasElement,
    floorSet: FloorSetSource,
    world: RunWorld,
    snapshot: RunSnapshot,
  ): Promise<GamePresentation> {
    const images = await loadPresentationImages();
    const renderer = new CanvasGameplayRenderer(canvas, images);
    return new GamePresentation(canvas, floorSet, world, snapshot, renderer);
  }

  public get status(): PresentationStatus {
    return { audio: this.#audio.capability, reducedMotion: this.#mediaQuery.matches };
  }

  /**
   * Reconciles a newly settled snapshot and its semantic events, then plays the intent's
   * animation. The returned promise resolves once that animation completes, which is how the
   * runtime learns it may resolve the next command; presentation never decides that itself.
   */
  public present(snapshot: RunSnapshot, events: readonly SemanticEvent[], intent: PresentationIntent): Promise<void> {
    const now = performance.now();

    for (const event of events) {
      if (event.type === "entityDamaged") {
        this.#enemyEffects = this.#enemyEffects.filter((effect) => effect.entityId !== event.entityId);
        this.#enemyEffects.push({
          entityId: event.entityId,
          state: "hurt",
          startedAt: now,
          duration: 260,
          flashDuration: 95,
        });
      } else if (event.type === "entityRetaliated") {
        this.#enemyEffects = this.#enemyEffects.filter((effect) => effect.entityId !== event.entityId);
        this.#enemyEffects.push({
          entityId: event.entityId,
          state: "attack",
          startedAt: now,
          duration: 340,
          flashDuration: 0,
        });
        this.#playerHitStartedAt = now;
      } else if (event.type === "entityDefeated") {
        const sprite = this.#scene.sprites.find(
          (candidate) => candidate.id === event.entityId && candidate.appearanceId,
        );

        if (sprite?.appearanceId) {
          this.#deaths.push({
            entityId: sprite.id,
            appearanceId: sprite.appearanceId,
            x: sprite.x,
            y: sprite.y,
            scale: sprite.scale,
            verticalAnchor: sprite.verticalAnchor,
            startedAt: now,
            duration: 920,
          });
        }
      }
    }

    this.#audio.play(events);

    if (intent.kind === "rejectBlocked") {
      this.#audio.playRejection();
    }

    this.#scene = createRenderScene(this.floorSet, this.world, snapshot);
    return this.#beginTween(intent, now);
  }

  public dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    cancelAnimationFrame(this.#animationFrame);
    this.#resizeObserver?.disconnect();
    window.removeEventListener("resize", this.#resize);
    this.canvas.removeEventListener("pointermove", this.#trackPointerLean);
    this.canvas.removeEventListener("pointerleave", this.#releasePointerLean);
    this.#removeActivationListeners();
    void this.#audio.dispose();
  }

  #beginTween(intent: PresentationIntent, now: number): Promise<void> {
    const settledCamera = this.#scene.camera;

    if (intent.kind === "attack") {
      this.#activeTween = { kind: "attack", startedAt: now };
    } else if (intent.kind === "move") {
      this.#activeTween = {
        kind: "move",
        fromX: this.#restCamera.x,
        fromY: this.#restCamera.y,
        toX: settledCamera.x,
        toY: settledCamera.y,
        angle: this.#restCamera.angle,
        startedAt: now,
      };
    } else if (intent.kind === "turn") {
      const delta = intent.direction === "left" ? -Math.PI / 2 : Math.PI / 2;
      this.#activeTween = {
        kind: "turn",
        x: this.#restCamera.x,
        y: this.#restCamera.y,
        fromAngle: this.#restCamera.angle,
        toAngle: this.#restCamera.angle + delta,
        startedAt: now,
      };
    } else if (intent.kind === "rejectBlocked") {
      this.#activeTween = { kind: "rejectBlocked", startedAt: now };
    } else {
      this.#restCamera = settledCamera;
      this.#activeTween = undefined;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.#activeResolve = resolve;
    });
  }

  /** Finalizes a tween whose effective duration has elapsed, before this frame is drawn. */
  #advanceTween(now: number, reducedMotion: boolean): void {
    const tween = this.#activeTween;

    if (!tween) {
      return;
    }

    const duration = effectiveDurationMs(tween.kind, reducedMotion);

    if (duration > 0 && now - tween.startedAt < duration) {
      return;
    }

    if (tween.kind === "move") {
      this.#restCamera = { x: tween.toX, y: tween.toY, angle: tween.angle };
    } else if (tween.kind === "turn") {
      this.#restCamera = { x: tween.x, y: tween.y, angle: tween.toAngle };
    }

    this.#activeTween = undefined;
    const resolve = this.#activeResolve;
    this.#activeResolve = undefined;
    resolve?.();
  }

  #cameraNow(now: number, reducedMotion: boolean): CameraPose {
    const tween = this.#activeTween;

    if (!tween || tween.kind === "attack") {
      return this.#restCamera;
    }

    if (tween.kind === "rejectBlocked") {
      return reducedMotion ? this.#restCamera : this.#recoiledCamera(now);
    }

    const duration = effectiveDurationMs(tween.kind, reducedMotion);
    const progress = duration <= 0 ? 1 : clamp01((now - tween.startedAt) / duration);

    if (tween.kind === "move") {
      return {
        x: lerp(tween.fromX, tween.toX, progress),
        y: lerp(tween.fromY, tween.toY, progress),
        angle: tween.angle,
      };
    }

    return { x: tween.x, y: tween.y, angle: lerp(tween.fromAngle, tween.toAngle, easeInOut(progress)) };
  }

  /**
   * Pulls the camera straight back along its own facing and lets it spring home, which reads as a
   * flinch. Offsetting the drawn frame instead would slide the whole world sideways or vertically,
   * which reads as the walls bobbing rather than the view recoiling.
   */
  #recoiledCamera(now: number): CameraPose {
    const rest = this.#restCamera;
    const tween = this.#activeTween;

    if (tween?.kind !== "rejectBlocked") {
      return rest;
    }

    const progress = clamp01((now - tween.startedAt) / ACTION_TIMINGS.blockedMoveDurationMs);
    const recoil = Math.sin(progress * Math.PI) * ACTION_TIMINGS.blockedMoveRecoilCells;
    return {
      x: rest.x - Math.cos(rest.angle) * recoil,
      y: rest.y - Math.sin(rest.angle) * recoil,
      angle: rest.angle,
    };
  }

  /**
   * The pointer only ever leans the drawn view. It never reaches `#restCamera`, so the discrete
   * facing that the sword, interactions, and enemy adjacency all read stays exactly where the last
   * Q or E left it — the lean is a glance down a side passage, not a second way to aim.
   */
  readonly #trackPointerLean = (event: PointerEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();

    if (bounds.width === 0) {
      return;
    }

    const offset = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.#pointerLeanTarget = Math.max(-1, Math.min(1, offset)) * ACTION_TIMINGS.pointerLeanRadians;
  };

  readonly #releasePointerLean = (): void => {
    this.#pointerLeanTarget = 0;
  };

  /**
   * Travels toward the target at a constant angular speed, which is also what pulls the view back
   * to centre once the pointer stops asking for a lean. Easing proportionally instead would make
   * the return asymptotic, so the view would never quite settle and the walls would keep creeping.
   */
  #advancePointerLean(now: number, reducedMotion: boolean): void {
    const previous = this.#lastFrameAt;
    this.#lastFrameAt = now;
    const target = reducedMotion ? 0 : this.#pointerLeanTarget;

    if (previous === undefined) {
      this.#pointerLean = target;
      return;
    }

    const step = (ACTION_TIMINGS.pointerLeanSpeedRadiansPerSecond * Math.max(0, now - previous)) / 1000;
    const remaining = target - this.#pointerLean;
    this.#pointerLean += Math.sign(remaining) * Math.min(Math.abs(remaining), step);
  }

  readonly #resize = (): void => {
    const bounds = this.canvas.getBoundingClientRect();
    this.#renderer.resize(bounds.width, bounds.height, window.devicePixelRatio || 1);
  };

  /** Browser audio needs a gesture, and this game is played on the keyboard, so any input counts. */
  readonly #activateAudio = (): void => {
    this.#removeActivationListeners();
    void this.#audio.activate();
  };

  #removeActivationListeners(): void {
    window.removeEventListener("keydown", this.#activateAudio);
    window.removeEventListener("pointerdown", this.#activateAudio);
  }

  readonly #renderFrame = (now: number): void => {
    if (this.#disposed) {
      return;
    }

    const reducedMotion = this.#mediaQuery.matches;
    this.#advanceTween(now, reducedMotion);
    this.#advancePointerLean(now, reducedMotion);
    const settled = this.#cameraNow(now, reducedMotion);
    const camera = { ...settled, angle: settled.angle + this.#pointerLean };
    const effects = this.#effectsAt(now, reducedMotion);
    this.#renderer.render({ ...this.#scene, camera }, (now - this.#startedAt) / 1000, effects, { reducedMotion });
    this.#animationFrame = requestAnimationFrame(this.#renderFrame);
  };

  #effectsAt(now: number, reducedMotion: boolean): PresentationRenderEffects {
    this.#enemyEffects = this.#enemyEffects.filter((effect) => now - effect.startedAt < effect.duration);
    this.#deaths = this.#deaths.filter((effect) => now - effect.startedAt < effect.duration);
    const enemies: EnemyRenderEffect[] = this.#enemyEffects.map((effect) => ({
      entityId: effect.entityId,
      state: effect.state,
      whiteFlash:
        effect.flashDuration === 0
          ? 0
          : Math.max(
              0,
              1 - (now - effect.startedAt) / (reducedMotion ? effect.flashDuration * 0.6 : effect.flashDuration),
            ),
    }));
    const deaths: DeathRenderEffect[] = this.#deaths.map((effect) => ({
      entityId: effect.entityId,
      appearanceId: effect.appearanceId,
      x: effect.x,
      y: effect.y,
      scale: effect.scale,
      verticalAnchor: effect.verticalAnchor,
      progress: reducedMotion ? 1 : (now - effect.startedAt) / effect.duration,
    }));
    const playerHit = clamp01(1 - (now - this.#playerHitStartedAt) / 220);
    const tween = this.#activeTween;
    let swing = 0;
    let walkBob = 0;
    let rejectionTorch = 1;
    let rejectionStaticCue = false;

    if (tween?.kind === "attack") {
      const duration = effectiveDurationMs("attack", reducedMotion);
      swing = duration <= 0 ? 0 : clamp01((now - tween.startedAt) / duration);
    } else if (tween?.kind === "move" && !reducedMotion) {
      const duration = effectiveDurationMs("move", reducedMotion);
      walkBob = duration <= 0 ? 0 : Math.sin(clamp01((now - tween.startedAt) / duration) * Math.PI);
    } else if (tween?.kind === "rejectBlocked") {
      const duration = effectiveDurationMs("rejectBlocked", reducedMotion);
      const envelope = Math.sin(clamp01((now - tween.startedAt) / duration) * Math.PI);
      rejectionTorch = 1 - envelope * (1 - ACTION_TIMINGS.blockedMoveTorchContraction);
      // The recoil itself rides the camera pose; reduced motion drops it for a static outline.
      rejectionStaticCue = reducedMotion;
    }

    return { enemies, deaths, swing, playerHit, walkBob, rejectionTorch, rejectionStaticCue };
  }
}
