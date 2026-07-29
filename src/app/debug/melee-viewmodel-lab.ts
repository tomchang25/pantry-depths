import { createDebugPage, createDebugPanel } from "@/app/debug/debug-shell";
import {
  chooseMeleeAttack,
  drawMeleeAttack,
  drawMeleeViewmodel,
  MELEE_ATTACKS,
  MELEE_IDLE_POSE,
  MELEE_SWING_SECONDS,
  MELEE_VIEW_HEIGHT,
  MELEE_VIEW_WIDTH,
  type MeleeAttackDefinition,
} from "@/content/viewmodel/melee-viewmodel";

type PreviewState = {
  currentAttack: MeleeAttackDefinition | undefined;
  history: MeleeAttackDefinition[];
  lastAttack: MeleeAttackDefinition | undefined;
  lockedAttack: MeleeAttackDefinition | undefined;
  startedAt: number | undefined;
};

/**
 * A corridor to read the arm against, and the lab's alone.
 *
 * The demo draws this same arm over a real dungeon. Here there is nothing behind it, and an arm on a
 * flat field is impossible to judge — the whole question a viewmodel answers is how it sits in a
 * scene. So the lab paints a cheap one: raking light, converging masonry, a crosshair where the game
 * would have one.
 */
function drawDungeon(context: CanvasRenderingContext2D, elapsedSeconds: number): void {
  const background = context.createLinearGradient(0, 0, 0, MELEE_VIEW_HEIGHT);
  background.addColorStop(0, "#15182c");
  background.addColorStop(0.58, "#252331");
  background.addColorStop(1, "#120f17");
  context.fillStyle = background;
  context.fillRect(0, 0, MELEE_VIEW_WIDTH, MELEE_VIEW_HEIGHT);

  const torch = context.createRadialGradient(510, 146, 0, 510, 146, 280);
  const flicker = 0.82 + Math.sin(elapsedSeconds * 7.7) * 0.06;
  torch.addColorStop(0, `rgb(242 147 72 / ${0.3 * flicker})`);
  torch.addColorStop(0.42, `rgb(157 71 49 / ${0.14 * flicker})`);
  torch.addColorStop(1, "rgb(25 17 30 / 0)");
  context.fillStyle = torch;
  context.fillRect(0, 0, MELEE_VIEW_WIDTH, MELEE_VIEW_HEIGHT);

  context.strokeStyle = "rgb(103 94 113 / 20%)";
  context.lineWidth = 2;

  for (let row = 0; row < 7; row += 1) {
    const y = 30 + row * 47;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(MELEE_VIEW_WIDTH, y + 12);
    context.stroke();
  }

  for (let column = -1; column < 11; column += 1) {
    const x = column * 82;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + 40, MELEE_VIEW_HEIGHT);
    context.stroke();
  }

  context.fillStyle = "rgb(9 8 13 / 58%)";
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(170, 0);
  context.lineTo(275, 218);
  context.lineTo(0, 320);
  context.closePath();
  context.fill();

  context.beginPath();
  context.moveTo(MELEE_VIEW_WIDTH, 0);
  context.lineTo(574, 0);
  context.lineTo(478, 218);
  context.lineTo(MELEE_VIEW_WIDTH, 320);
  context.closePath();
  context.fill();

  context.fillStyle = "rgb(7 7 11 / 42%)";
  context.beginPath();
  context.moveTo(0, MELEE_VIEW_HEIGHT);
  context.lineTo(280, 218);
  context.lineTo(478, 218);
  context.lineTo(MELEE_VIEW_WIDTH, MELEE_VIEW_HEIGHT);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgb(244 223 176 / 42%)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(MELEE_VIEW_WIDTH / 2 - 8, MELEE_VIEW_HEIGHT / 2);
  context.lineTo(MELEE_VIEW_WIDTH / 2 + 8, MELEE_VIEW_HEIGHT / 2);
  context.moveTo(MELEE_VIEW_WIDTH / 2, MELEE_VIEW_HEIGHT / 2 - 8);
  context.lineTo(MELEE_VIEW_WIDTH / 2, MELEE_VIEW_HEIGHT / 2 + 8);
  context.stroke();
}

function updateHistory(historyList: HTMLUListElement, history: readonly MeleeAttackDefinition[]): void {
  historyList.replaceChildren();

  for (const attack of history) {
    const item = document.createElement("li");
    item.textContent = attack.label;
    historyList.append(item);
  }
}

function createAttackStage(): Readonly<{
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  stage: HTMLElement;
}> {
  const stage = document.createElement("section");
  const canvas = document.createElement("canvas");
  const hint = document.createElement("p");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("melee viewmodel lab: Canvas 2D is unavailable");
  }

  stage.className = "melee-prototype-stage";
  canvas.className = "melee-prototype-canvas";
  canvas.width = MELEE_VIEW_WIDTH;
  canvas.height = MELEE_VIEW_HEIGHT;
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "八種劍擊測試區，按滑鼠左鍵或 Enter 攻擊");
  canvas.setAttribute("role", "button");
  hint.className = "melee-prototype-hint";
  hint.textContent = "滑鼠左鍵攻擊 · 攻擊中輸入不排隊";
  stage.append(canvas, hint);
  return { canvas, context, stage };
}

/** Previews the eight-move, non-combo sword arm the demo draws, at the stage's own size. */
export function renderMeleeViewmodelLab(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "方案一 · Eight-Attack Prototype",
    description: "三姿勢攻擊錯覺，與遊戲共用同一份繪製。左鍵隨機抽招、連續兩招不重複；也可點擊招式鎖定 Debug 預覽。",
    width: "wide",
  });
  const controls = createDebugPanel(
    "Prototype rules",
    "八種攻擊共用同一把劍與 600 ms 時間軸。點招式一次鎖定、再點一次解除；改點其他招式會直接取代鎖定。",
  );
  const modeList = document.createElement("ul");
  const status = document.createElement("p");
  const historyPanel = createDebugPanel("Attack history", "只保留最近八次，用來確認隨機順序不會連續重複。");
  const historyList = document.createElement("ul");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { canvas, context, stage } = createAttackStage();
  const state: PreviewState = {
    currentAttack: undefined,
    history: [],
    lastAttack: undefined,
    lockedAttack: undefined,
    startedAt: undefined,
  };
  const modeControls: Array<{ attack: MeleeAttackDefinition; button: HTMLButtonElement }> = [];

  modeList.className = "melee-prototype-modes";

  for (const attack of MELEE_ATTACKS) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    item.dataset.attackId = attack.id;
    button.type = "button";
    button.textContent = attack.label;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      state.lockedAttack = state.lockedAttack?.id === attack.id ? undefined : attack;

      for (const control of modeControls) {
        control.button.setAttribute("aria-pressed", String(control.attack.id === state.lockedAttack?.id));
      }

      status.textContent = state.lockedAttack
        ? `已鎖定「${state.lockedAttack.label}」；左鍵只會使用這一招。`
        : "已解除招式鎖定；左鍵恢復隨機且不連續重複。";
    });
    item.append(button);
    modeList.append(item);
    modeControls.push({ attack, button });
  }

  status.className = "melee-lab-status";
  status.setAttribute("role", "status");
  status.textContent = "待機中。左鍵點擊畫面，隨機抽取第一招。";
  controls.body.append(modeList, status);

  historyList.className = "melee-prototype-history";
  historyList.setAttribute("aria-label", "最近的攻擊順序");
  historyPanel.body.append(historyList);

  let animationFrame = 0;

  const requestAttack = (): void => {
    if (state.startedAt !== undefined) {
      status.textContent = `正在執行「${state.currentAttack?.label ?? "攻擊"}」；這次輸入已忽略，不會形成連擊。`;
      return;
    }

    const attack = state.lockedAttack ?? chooseMeleeAttack(state.lastAttack?.id);
    state.currentAttack = attack;
    state.lastAttack = attack;
    state.startedAt = performance.now();
    state.history = [attack, ...state.history].slice(0, 8);
    updateHistory(historyList, state.history);
    status.textContent = state.lockedAttack
      ? `攻擊：${attack.label}（已鎖定）。`
      : `攻擊：${attack.label}。下一次將從其餘七招抽取。`;

    for (const item of modeList.children) {
      item.toggleAttribute("data-active", (item as HTMLElement).dataset.attackId === attack.id);
    }
  };

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 0) {
      requestAttack();
    }
  });
  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  canvas.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      requestAttack();
    }
  });

  const renderFrame = (now: number): void => {
    let progress = 0;

    if (state.startedAt !== undefined) {
      progress = (now - state.startedAt) / (MELEE_SWING_SECONDS * 1000);

      if (progress >= 1) {
        state.startedAt = undefined;
        state.currentAttack = undefined;
        progress = 0;
        status.textContent = state.lockedAttack
          ? `已回正。目前鎖定「${state.lockedAttack.label}」，左鍵可再次預覽。`
          : `已回正。上一招是「${state.lastAttack?.label ?? "無"}」，左鍵可隨機發動下一招。`;
      }
    }

    context.clearRect(0, 0, MELEE_VIEW_WIDTH, MELEE_VIEW_HEIGHT);
    drawDungeon(context, now / 1000);

    if (state.currentAttack && state.startedAt !== undefined) {
      // No aim: there is nothing in a lab to hit, so every arc stays where it was authored. In the
      // demo the same call carries the point the swing landed on and the arc moves onto it.
      drawMeleeAttack(context, state.currentAttack, progress, { strength: reducedMotion ? 0.45 : 1 });
    } else {
      drawMeleeViewmodel(context, MELEE_IDLE_POSE);
    }

    animationFrame = window.requestAnimationFrame(renderFrame);
  };

  window.addEventListener(
    "pagehide",
    () => {
      window.cancelAnimationFrame(animationFrame);
    },
    { once: true },
  );

  content.append(controls.panel, stage, historyPanel.panel);
  mount.replaceChildren(page);
  animationFrame = window.requestAnimationFrame(renderFrame);
}
