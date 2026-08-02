/**
 * Every sound the game makes, on one page, played through the pipeline the game plays it through.
 *
 * The library's audition page answers what a recording sounds like; this tab answers the different
 * question of what a cue sounds like — at its authored loudness, through its rate limit, with its
 * pitch jitter — because that is the only version a player ever hears. Each row carries the cue's
 * authored numbers beside the project's verdict on the take, and the two save to their two files:
 * the cue table the game reads, and the review record the library's feedback loop exports.
 *
 * Edits are heard before they are saved. A changed number goes into a working copy that the audio
 * layer consults ahead of its parsed table, so replaying the cue answers the adjustment immediately;
 * saving is a separate, deliberate act, exactly as it is on every other workbench.
 */

import { loadCanonical, saveCanonical } from "@/app/debug/authoring-client";
import { createDebugPanel } from "@/app/debug/debug-shell";
import sfxCuesJson from "@/content/sfx/sfx-cues.json";
import sfxReviewJson from "@/content/sfx/sfx-review.json";
import { parseSfxCues, type SfxCue } from "@/content/sfx/sfx-cue-schema";
import { parseSfxReview, SFX_FITS, type SfxFit, type SfxReviewEntry } from "@/content/sfx/sfx-review-schema";
import { playSfx, setSfxCueOverrides, unlockSfx } from "@/presentation/audio/sfx";

/**
 * The two authored tables, as the working copies this tab edits.
 *
 * Arrays rather than lookups because that is the shape both files hold and both validators answer;
 * the save sends each back through the same parser its file is loaded with.
 */
let cues: SfxCue[] = [...parseSfxCues(sfxCuesJson)];
let review: SfxReviewEntry[] = [...parseSfxReview(sfxReviewJson)];

function numberCell(value: number, step: number, onChange: (next: number) => void): HTMLTableCellElement {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(step);
  input.value = String(value);
  input.style.width = "5em";
  input.addEventListener("change", () => {
    const next = Number(input.value);

    if (Number.isFinite(next)) {
      onChange(next);
    }
  });
  cell.append(input);
  return cell;
}

function textCell(value: string, placeholder: string, onChange: (next: string) => void): HTMLTableCellElement {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.placeholder = placeholder;
  input.style.width = "14em";
  input.addEventListener("change", () => onChange(input.value));
  cell.append(input);
  return cell;
}

export function renderSfxWorkbench(mount: HTMLElement): void {
  const controls = createDebugPanel(
    "SFX review",
    "Every cue at its authored settings, through the real limiter and pitch jitter. Loudness and pitch save to the cue table; fit, notes and tags save to the review record the library feedback loop exports.",
  );
  const status = document.createElement("p");
  const actions = document.createElement("div");
  const saveCuesButton = document.createElement("button");
  const saveReviewButton = document.createElement("button");
  const reloadButton = document.createElement("button");
  const table = document.createElement("table");
  status.className = "entity-workbench-status";
  status.setAttribute("role", "status");
  actions.className = "debug-button-row workbench-actions";
  saveCuesButton.type = "button";
  saveCuesButton.textContent = "Save cue table";
  saveReviewButton.type = "button";
  saveReviewButton.textContent = "Save review record";
  reloadButton.type = "button";
  reloadButton.textContent = "Reload both from disk";

  function markUnsaved(which: string): void {
    status.textContent = `Unsaved ${which} changes.`;
    setSfxCueOverrides(cues);
  }

  function rebuildTable(): void {
    table.replaceChildren();
    const head = document.createElement("tr");

    for (const title of ["", "Cue", "When it fires", "dB", "Pitch min", "Pitch max", "Fit", "Note", "Tags", "Source"]) {
      const cell = document.createElement("th");
      cell.textContent = title;
      cell.style.textAlign = "left";
      head.append(cell);
    }

    table.append(head);

    for (const cue of cues) {
      const entry = review.find((candidate) => candidate.id === cue.id);
      const row = document.createElement("tr");
      const playCell = document.createElement("td");
      const playButton = document.createElement("button");
      playButton.type = "button";
      playButton.textContent = "▶";
      playButton.title = `Play ${cue.id} at its authored settings`;
      playButton.addEventListener("click", () => {
        // The unlock is idempotent and needs a gesture; the play click is always one.
        unlockSfx();
        playSfx(cue.id);
      });
      playCell.append(playButton);

      const idCell = document.createElement("td");
      idCell.textContent = cue.id;

      const triggerCell = document.createElement("td");
      triggerCell.textContent = entry?.trigger ?? "";

      const replaceCue = (patch: Partial<SfxCue>): void => {
        cues = cues.map((candidate) => (candidate.id === cue.id ? ({ ...candidate, ...patch } as SfxCue) : candidate));
        markUnsaved("cue-table");
      };

      const replaceEntry = (patch: Partial<SfxReviewEntry>): void => {
        review = review.map((candidate) => (candidate.id === cue.id ? { ...candidate, ...patch } : candidate));
        status.textContent = "Unsaved review changes.";
      };

      const fitCell = document.createElement("td");
      const fitSelect = document.createElement("select");

      for (const fit of SFX_FITS) {
        const option = document.createElement("option");
        option.value = fit;
        option.textContent = fit;
        option.selected = entry?.fit === fit;
        fitSelect.append(option);
      }

      fitSelect.addEventListener("change", () => replaceEntry({ fit: fitSelect.value as SfxFit }));
      fitCell.append(fitSelect);

      const sourceCell = document.createElement("td");
      sourceCell.textContent = entry?.catalogPath ?? "";
      sourceCell.style.opacity = "0.7";

      row.append(
        playCell,
        idCell,
        triggerCell,
        numberCell(cue.volumeDb, 1, (next) => replaceCue({ volumeDb: next })),
        numberCell(cue.pitchMin, 0.01, (next) => replaceCue({ pitchMin: next })),
        numberCell(cue.pitchMax, 0.01, (next) => replaceCue({ pitchMax: next })),
        fitCell,
        textCell(entry?.note ?? "", "what is wrong or right about this take", (next) => replaceEntry({ note: next })),
        textCell(entry?.tags.join(", ") ?? "", "comma-separated", (next) =>
          replaceEntry({
            tags: next
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          }),
        ),
        sourceCell,
      );
      table.append(row);
    }
  }

  saveCuesButton.addEventListener("click", () => {
    saveCuesButton.disabled = true;
    status.textContent = "Validating and saving the cue table…";
    void saveCanonical("sfx", cues)
      .then((message) => {
        status.textContent = message;
      })
      .catch((error: unknown) => {
        status.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        saveCuesButton.disabled = false;
      });
  });

  saveReviewButton.addEventListener("click", () => {
    saveReviewButton.disabled = true;
    status.textContent = "Validating and saving the review record…";
    void saveCanonical("sfxReview", review)
      .then((message) => {
        status.textContent = message;
      })
      .catch((error: unknown) => {
        status.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        saveReviewButton.disabled = false;
      });
  });

  // Reading the files back is asked for rather than done to you, for the same reason every workbench
  // does it this way: the dev server deliberately does not watch canonical authored files.
  reloadButton.addEventListener("click", () => {
    reloadButton.disabled = true;
    status.textContent = "Reading both files from disk…";
    void Promise.all([loadCanonical("sfx"), loadCanonical("sfxReview")])
      .then(([cueSource, reviewSource]) => {
        cues = [...parseSfxCues(cueSource)];
        review = [...parseSfxReview(reviewSource)];
        setSfxCueOverrides(cues);
        rebuildTable();
        status.textContent = "Reloaded both files from disk.";
      })
      .catch((error: unknown) => {
        status.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        reloadButton.disabled = false;
      });
  });

  setSfxCueOverrides(cues);
  rebuildTable();
  actions.append(saveCuesButton, saveReviewButton, reloadButton);
  controls.body.append(table, actions, status);
  mount.append(controls.panel);
}
