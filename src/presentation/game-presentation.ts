import type { EnemyId } from "@/content/combat/enemies";
import type { FloorSetSource } from "@/content/floor/floor-schema";
import {
  CanvasGameplayRenderer,
  type DeathRenderEffect,
  type EnemyRenderEffect,
  type PresentationRenderEffects,
} from "@/presentation/canvas-gameplay-renderer";
import { loadPresentationImages } from "@/presentation/presentation-image-loader";
import { ProceduralAudio, type AudioCapability } from "@/presentation/procedural-audio";
import { createRenderScene, type RenderScene } from "@/presentation/render-scene";
import type { RunSnapshot, RunWorld, SemanticEvent } from "@/core/run-state";

type TimedEnemyEffect = Readonly<{
  entityId: string;
  state: "attack" | "hurt";
  startedAt: number;
  duration: number;
  flashDuration: number;
}>;

type TimedDeath = Omit<DeathRenderEffect, "progress"> & Readonly<{ startedAt: number; duration: number }>;

export type PresentationStatus = Readonly<{
  audio: AudioCapability;
  reducedMotion: boolean;
}>;

export class GamePresentation {
  readonly #renderer: CanvasGameplayRenderer;
  readonly #audio = new ProceduralAudio();
  readonly #mediaQuery: MediaQueryList;
  readonly #resizeObserver: ResizeObserver | undefined;
  #scene: RenderScene;
  #animationFrame = 0;
  #startedAt = performance.now();
  #enemyEffects: TimedEnemyEffect[] = [];
  #deaths: TimedDeath[] = [];
  #swingStartedAt = Number.NEGATIVE_INFINITY;
  #playerHitStartedAt = Number.NEGATIVE_INFINITY;
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
    this.#mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.#resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            this.#resize();
          });
    this.#resizeObserver?.observe(canvas);
    window.addEventListener("resize", this.#resize);
    canvas.addEventListener("pointerdown", this.#activateAudio, { once: true });
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

  /** Reconciles a newly settled snapshot and its already-resolved semantic events. */
  public present(snapshot: RunSnapshot, events: readonly SemanticEvent[]): void {
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
        this.#swingStartedAt = now;
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
        const sprite = this.#scene.sprites.find((candidate) => candidate.id === event.entityId && candidate.enemyId);

        if (sprite?.enemyId) {
          this.#deaths.push({
            entityId: sprite.id,
            enemyId: sprite.enemyId,
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
    this.#scene = createRenderScene(this.floorSet, this.world, snapshot);
  }

  public dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    cancelAnimationFrame(this.#animationFrame);
    this.#resizeObserver?.disconnect();
    window.removeEventListener("resize", this.#resize);
    this.canvas.removeEventListener("pointerdown", this.#activateAudio);
    void this.#audio.dispose();
  }

  readonly #resize = (): void => {
    const bounds = this.canvas.getBoundingClientRect();
    this.#renderer.resize(bounds.width, bounds.height, window.devicePixelRatio || 1);
  };

  readonly #activateAudio = (): void => {
    void this.#audio.activate();
  };

  readonly #renderFrame = (now: number): void => {
    if (this.#disposed) {
      return;
    }

    const reducedMotion = this.#mediaQuery.matches;
    const effects = this.#effectsAt(now, reducedMotion);
    this.#renderer.render(this.#scene, (now - this.#startedAt) / 1000, effects, { reducedMotion });
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
      enemyId: effect.enemyId as EnemyId,
      x: effect.x,
      y: effect.y,
      scale: effect.scale,
      verticalAnchor: effect.verticalAnchor,
      progress: reducedMotion ? 1 : (now - effect.startedAt) / effect.duration,
    }));
    const swingDuration = reducedMotion ? 180 : 330;
    const swing = clamp01((now - this.#swingStartedAt) / swingDuration);
    const playerHit = clamp01(1 - (now - this.#playerHitStartedAt) / 220);

    return {
      enemies,
      deaths,
      swing: swing < 1 ? swing : 0,
      playerHit,
    };
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
