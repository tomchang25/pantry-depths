import { createDebugPage, createDebugPanel } from "@/app/debug/debug-shell";
import { renderFloorSetInspector, type FloorInspectorSelection } from "@/app/debug/floor-viewer";
import { parseFloorSet } from "@/content/floor/floor-schema";
import { validateFloorSet, type FloorValidationResult } from "@/content/floor/floor-validation";

/**
 * Client-side copy of the development authoring endpoint namespace.
 *
 * Client code must not import `dev/`, so this literal cannot be shared with the tooling owner directly.
 * A unit test holds it equal to `dev/tools/floor-set/api-contract.ts`.
 */
export const API_ROOT = "/__debug/floor-set";

type ApiResponse = Readonly<{
  message?: string;
  source?: unknown;
}>;

async function requestJson(path: string, init?: RequestInit): Promise<ApiResponse> {
  const response = await fetch(`${API_ROOT}/${path}`, init);
  const payload = (await response.json()) as ApiResponse;

  if (!response.ok) {
    throw new Error(payload.message ?? `Floor authoring request failed with status ${response.status}.`);
  }

  return payload;
}

function createButton(
  label: string,
  action: () => void | Promise<void>,
  reportError: (caught: unknown) => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    void Promise.resolve(action()).catch(reportError);
  });
  return button;
}

function createCountField(id: string, label: string, value: number, min: number): HTMLLabelElement {
  const field = document.createElement("label");
  const input = document.createElement("input");
  field.textContent = label;
  field.className = "debug-field";
  field.htmlFor = id;
  input.id = id;
  input.type = "number";
  input.min = String(min);
  input.step = "1";
  input.value = String(value);
  field.append(input);
  return field;
}

function fieldValue(field: HTMLLabelElement): number {
  return Number(field.querySelector("input")?.value ?? "0");
}

/** Hands the validated draft to the browser as a downloaded file without touching canonical content. */
function downloadJson(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  // The anchor is attached before clicking and the URL is released on a later task because some
  // browsers ignore a detached anchor and cancel a download whose object URL is revoked synchronously.
  document.body.append(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Renders the development-only generate, inspect, validate, export, and explicit-save workflow. */
export function renderFloorWorkbench(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "Floor Set Workbench",
    description:
      "Generate, inspect, tune, validate, export, and explicitly save authored floor-set JSON through one development workspace.",
    width: "wide",
  });
  const generatorPanel = createDebugPanel(
    "Generator",
    "Create a solvable candidate from deterministic seed and aggregate content counts.",
  );
  const generatorControls = document.createElement("div");
  const seedField = createCountField("floor-workbench-seed", "Seed", 1, Number.MIN_SAFE_INTEGER);
  const floorField = createCountField("floor-workbench-floors", "Floors", 5, 1);
  const keyField = createCountField("floor-workbench-keys", "Keys per floor", 1, 0);
  const doorField = createCountField("floor-workbench-doors", "Doors per floor", 1, 0);
  const enemyField = createCountField("floor-workbench-enemies", "Enemies per floor", 1, 0);
  const mapPanel = createDebugPanel(
    "Draft Map",
    "The schema-valid JSON draft is projected here before full structural validation.",
  );
  const map = document.createElement("div");
  const editorPanel = createDebugPanel(
    "JSON Editor",
    "This text remains the complete draft authority until direct editing lands in later authoring work.",
  );
  const editorLabel = document.createElement("label");
  const editor = document.createElement("textarea");
  const departurePanel = createDebugPanel("Export and Save");
  const departureDescription = document.createElement("p");
  const actions = document.createElement("div");
  const status = document.createElement("p");
  const validationPanel = createDebugPanel("Validation Findings");
  const validationExplanation = document.createElement("p");
  const validationFindings = document.createElement("ul");
  let draftSelection: FloorInspectorSelection | undefined;
  let validatedText: string | undefined;
  let validatedResult: FloorValidationResult | undefined;

  editorLabel.textContent = "Floor-set JSON";
  editorLabel.className = "debug-field";
  editorLabel.htmlFor = "floor-workbench-editor";
  editor.id = editorLabel.htmlFor;
  editor.rows = 28;
  editor.spellcheck = false;
  departureDescription.textContent =
    "Export JSON File downloads the validated draft and leaves canonical content unchanged. Save Canonical JSON overwrites the canonical floor-set target used by the game.";
  validationExplanation.className = "debug-status debug-status--explanation";
  validationExplanation.textContent =
    "Structural validation reports invalid placements, stair destinations, and topology that cannot yield a legal solution.\nNo findings means this validation run reported no issues;\nExport and Save still require the exact current draft to have a structural solution.";
  status.setAttribute("role", "status");
  generatorControls.className = "debug-form-grid";
  actions.className = "debug-button-row";
  map.className = "debug-workbench-map";

  const reportStatus = (message: string, tone: "error" | "info" | "success" | "warning" = "info"): void => {
    status.textContent = message;
    status.dataset.tone = tone;
  };

  const reportError = (caught: unknown): void => {
    reportStatus(caught instanceof Error ? caught.message : "Unable to complete the authoring action.", "error");
  };

  const renderFindings = (validation: FloorValidationResult | undefined, fallback?: string): void => {
    validationFindings.replaceChildren();

    if (!validation) {
      const item = document.createElement("li");
      item.textContent = fallback ?? "Validate the current draft to inspect findings.";
      validationFindings.append(item);
      return;
    }

    if (validation.findings.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No findings.";
      validationFindings.append(item);
      return;
    }

    for (const finding of validation.findings) {
      const item = document.createElement("li");
      item.textContent = `${finding.severity.toUpperCase()} ${finding.code}: ${finding.message}`;
      validationFindings.append(item);
    }
  };

  const renderDraftMap = (): void => {
    map.replaceChildren();

    try {
      const source = JSON.parse(editor.value) as unknown;
      const floorSet = parseFloorSet(source);
      const currentValidation = editor.value === validatedText ? validatedResult : undefined;
      renderFloorSetInspector(map, floorSet, currentValidation, "Current Draft", {
        embedded: true,
        onSelectionChange: (selection) => {
          draftSelection = selection;
        },
        ...(draftSelection ? { selection: draftSelection } : {}),
      });
    } catch (caught) {
      const unavailable = document.createElement("p");
      const message = caught instanceof Error ? caught.message : "Draft JSON could not be parsed.";
      unavailable.textContent = `Draft map unavailable: ${message}`;
      map.append(unavailable);
    }
  };

  const saveButton = createButton(
    "Save Canonical JSON (Overwrites)",
    async () => {
      if (editor.value !== validatedText || !validatedResult?.solution) {
        reportStatus("Validate the current draft before overwriting canonical content.", "warning");
        return;
      }

      const payload = await requestJson("save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "canonical", source: JSON.parse(editor.value) as unknown }),
      });
      reportStatus(payload.message ?? "Canonical floor-set content overwritten.", "success");
    },
    reportError,
  );
  saveButton.className = "debug-button--danger";
  saveButton.disabled = true;

  const exportButton = createButton(
    "Export JSON File (Download Only)",
    () => {
      if (editor.value !== validatedText || !validatedResult?.solution) {
        reportStatus("Validate the current draft before exporting a download.", "warning");
        return;
      }

      downloadJson(`floor-set-seed-${fieldValue(seedField)}.json`, `${editor.value}\n`);
      reportStatus("Validated draft downloaded. Canonical content is unchanged.", "success");
    },
    reportError,
  );
  exportButton.className = "debug-button--primary";
  exportButton.disabled = true;

  const clearValidation = (): void => {
    validatedText = undefined;
    validatedResult = undefined;
    saveButton.disabled = true;
    exportButton.disabled = true;
    renderFindings(undefined);
  };

  const applySource = (source: unknown, sourceLabel: string): void => {
    editor.value = JSON.stringify(source, null, 2);
    draftSelection = undefined;
    clearValidation();
    renderDraftMap();
    reportStatus(
      `${sourceLabel} loaded as an unsaved draft. Validate it to enable download and canonical overwrite.`,
      "info",
    );
  };

  const validateDraft = (): void => {
    try {
      const source = JSON.parse(editor.value) as unknown;
      const validation = validateFloorSet(source);
      const errors = validation.findings.filter((finding) => finding.severity === "error");
      validatedText = editor.value;
      validatedResult = validation;
      renderFindings(validation);
      saveButton.disabled = errors.length > 0 || !validation.solution;
      exportButton.disabled = saveButton.disabled;
      renderDraftMap();

      if (errors.length > 0 || !validation.solution) {
        reportStatus(
          `Validation failed with ${errors.length} error findings. Download and canonical overwrite remain disabled.`,
          "error",
        );
        return;
      }

      reportStatus(
        `Valid draft with a ${validation.solution.length}-step structural solution. Download and canonical overwrite are enabled.`,
        "success",
      );
    } catch (caught) {
      clearValidation();
      renderDraftMap();
      const message = caught instanceof Error ? caught.message : "Draft JSON could not be parsed.";
      renderFindings(undefined, message);
      reportStatus(message, "error");
    }
  };

  const loadCanonical = async (): Promise<void> => {
    const payload = await requestJson("canonical");
    applySource(payload.source, "Canonical JSON");
  };

  const generate = async (): Promise<void> => {
    reportStatus("Generating a solvable candidate. Dense key and door counts take longer to validate.", "info");

    const payload = await requestJson("generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seed: fieldValue(seedField),
        floorCount: fieldValue(floorField),
        keysPerFloor: fieldValue(keyField),
        doorsPerFloor: fieldValue(doorField),
        enemiesPerFloor: fieldValue(enemyField),
      }),
    });
    applySource(payload.source, "Generated candidate");
  };

  editor.addEventListener("input", () => {
    clearValidation();
    renderDraftMap();
    reportStatus("Draft changed. Validate again before downloading or overwriting canonical content.", "warning");
  });

  generatorControls.append(
    seedField,
    floorField,
    keyField,
    doorField,
    enemyField,
    createButton("Generate Draft", generate, reportError),
  );
  actions.append(
    createButton("Load Canonical JSON", loadCanonical, reportError),
    createButton("Validate Draft", validateDraft, reportError),
    exportButton,
    saveButton,
  );
  generatorPanel.body.append(generatorControls);
  mapPanel.body.append(map);
  editorPanel.body.append(editorLabel, editor);
  departurePanel.body.append(departureDescription, actions, status);
  validationPanel.body.append(validationExplanation, validationFindings);
  content.append(generatorPanel.panel, departurePanel.panel, mapPanel.panel, editorPanel.panel, validationPanel.panel);
  mount.replaceChildren(page);
  renderFindings(undefined);
  reportStatus("Loading canonical floor-set JSON.");
  void loadCanonical().catch((caught: unknown) => {
    reportStatus(caught instanceof Error ? caught.message : "Unable to load canonical floor-set JSON.", "error");
  });
}
