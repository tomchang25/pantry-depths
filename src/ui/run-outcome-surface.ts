import type { RunSummaryView } from "@/ui/hud-view";

const OUTCOME_HEADINGS: Readonly<Record<RunSummaryView["outcome"], string>> = {
  dead: "You died in the depths",
  victory: "You left the depths",
};

export type MountedRunOutcomeSurface = Readonly<{
  element: HTMLElement;
  update: (summary: RunSummaryView | undefined) => void;
}>;

function statistic(term: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "hud-outcome__statistic";
  const label = document.createElement("dt");
  label.textContent = term;
  const detail = document.createElement("dd");
  detail.textContent = value;
  row.append(label, detail);
  return row;
}

/**
 * The terminal surface is the only blocking element in the readout, so it owns focus while it is
 * open: a run that ended without moving focus is indistinguishable from a hang for a keyboard-only
 * player, which is the defect this whole surface exists to remove.
 */
export function createRunOutcomeSurface(onRestart: () => void): MountedRunOutcomeSurface {
  const element = document.createElement("section");
  element.className = "hud-outcome";
  element.hidden = true;
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "true");
  const heading = document.createElement("h2");
  heading.className = "hud-outcome__heading";
  const statistics = document.createElement("dl");
  statistics.className = "hud-outcome__statistics";
  const restart = document.createElement("button");
  restart.type = "button";
  restart.className = "hud-outcome__restart";
  restart.textContent = "Start a new run";
  restart.addEventListener("click", onRestart);
  element.append(heading, statistics, restart);
  const headingId = "hud-outcome-heading";
  heading.id = headingId;
  element.setAttribute("aria-labelledby", headingId);
  let shownOutcome: RunSummaryView["outcome"] | undefined;

  const update = (summary: RunSummaryView | undefined): void => {
    if (!summary) {
      element.hidden = true;
      shownOutcome = undefined;
      return;
    }

    heading.textContent = OUTCOME_HEADINGS[summary.outcome];
    statistics.replaceChildren(
      statistic("Deepest floor", summary.deepestFloorId),
      statistic("Health", `${summary.health} / ${summary.maxHealth}`),
      statistic("Attack", String(summary.attack)),
      statistic("Defense", String(summary.defense)),
      statistic("Doors opened", String(summary.doorsOpened)),
    );
    element.hidden = false;

    // Only on the transition into a terminal outcome, so a redraw never steals focus back.
    if (shownOutcome !== summary.outcome) {
      shownOutcome = summary.outcome;
      restart.focus();
    }
  };

  return { element, update };
}
