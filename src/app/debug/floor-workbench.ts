import { renderFloorSetInspector } from "@/app/debug/floor-viewer";
import { parseFloorSet } from "@/content/floor/floor-schema";
import { validateFloorSet, type FloorValidationResult } from "@/content/floor/floor-validation";

const API_ROOT = "/__debug/floor-set";

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
  button.style.minHeight = "2.75rem";
  button.style.padding = "0.5rem 0.8rem";
  button.addEventListener("click", () => {
    void Promise.resolve(action()).catch(reportError);
  });
  return button;
}

function createCountField(id: string, label: string, value: number, min: number): HTMLLabelElement {
  const field = document.createElement("label");
  const input = document.createElement("input");
  field.textContent = `${label} `;
  field.htmlFor = id;
  input.id = id;
  input.type = "number";
  input.min = String(min);
  input.step = "1";
  input.value = String(value);
  input.style.width = "5rem";
  field.append(input);
  return field;
}

function fieldValue(field: HTMLLabelElement): number {
  return Number(field.querySelector("input")?.value ?? "0");
}

/** Hands the validated draft to the browser as a downloaded file without touching committed content. */
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

/** Renders the development-only generate, edit, validate, preview, and explicit-save workflow. */
export function renderFloorWorkbench(mount: HTMLElement): void {
  const page = document.createElement("main");
  const heading = document.createElement("h1");
  const description = document.createElement("p");
  const generatorHeading = document.createElement("h2");
  const generatorControls = document.createElement("div");
  const seedField = createCountField("floor-workbench-seed", "Seed", 1, Number.MIN_SAFE_INTEGER);
  const floorField = createCountField("floor-workbench-floors", "Floors", 5, 1);
  const keyField = createCountField("floor-workbench-keys", "Keys per floor", 1, 0);
  const doorField = createCountField("floor-workbench-doors", "Doors per floor", 1, 0);
  const enemyField = createCountField("floor-workbench-enemies", "Enemies per floor", 1, 0);
  const editorHeading = document.createElement("h2");
  const editorLabel = document.createElement("label");
  const editor = document.createElement("textarea");
  const actions = document.createElement("div");
  const status = document.createElement("p");
  const validationHeading = document.createElement("h2");
  const validationFindings = document.createElement("ul");
  const previewHeading = document.createElement("h2");
  const preview = document.createElement("section");
  let validatedText: string | undefined;
  let validatedResult: FloorValidationResult | undefined;

  heading.textContent = "Floor Set Workbench";
  description.textContent =
    "Generate a solvable random draft or load canonical content, tune the JSON by hand, validate and preview it, then export the result as a file or explicitly save it to canonical content. Only a validated draft can leave this page.";
  generatorHeading.textContent = "Generator";
  editorHeading.textContent = "JSON Editor";
  editorLabel.textContent = "Floor-set JSON";
  editorLabel.htmlFor = "floor-workbench-editor";
  editor.id = editorLabel.htmlFor;
  editor.rows = 28;
  editor.spellcheck = false;
  editor.style.boxSizing = "border-box";
  editor.style.fontFamily = "monospace";
  editor.style.width = "100%";
  previewHeading.textContent = "Validated Preview";
  validationHeading.textContent = "Validation Findings";
  status.setAttribute("role", "status");
  generatorControls.style.display = "flex";
  generatorControls.style.flexWrap = "wrap";
  generatorControls.style.gap = "1rem";
  actions.style.display = "flex";
  actions.style.flexWrap = "wrap";
  actions.style.gap = "0.5rem";

  const reportError = (caught: unknown): void => {
    status.textContent = caught instanceof Error ? caught.message : "Unable to complete the authoring action.";
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

  const saveButton = createButton(
    "Save Canonical JSON",
    async () => {
      if (editor.value !== validatedText || !validatedResult?.solution) {
        status.textContent = "Validate the current draft before saving.";
        return;
      }

      const payload = await requestJson("save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "canonical", source: JSON.parse(editor.value) as unknown }),
      });
      status.textContent = payload.message ?? "Canonical floor-set content saved.";
    },
    reportError,
  );
  saveButton.disabled = true;

  const exportButton = createButton(
    "Export JSON File",
    () => {
      if (editor.value !== validatedText || !validatedResult?.solution) {
        status.textContent = "Validate the current draft before exporting.";
        return;
      }

      downloadJson(`floor-set-seed-${fieldValue(seedField)}.json`, `${editor.value}\n`);
      status.textContent = "Validated draft exported as a downloaded file. Committed content is unchanged.";
    },
    reportError,
  );
  exportButton.disabled = true;

  const applySource = (source: unknown, sourceLabel: string): void => {
    editor.value = JSON.stringify(source, null, 2);
    validatedText = undefined;
    validatedResult = undefined;
    saveButton.disabled = true;
    exportButton.disabled = true;
    preview.replaceChildren();
    renderFindings(undefined);
    status.textContent = `${sourceLabel} loaded as an unsaved draft. Validate it to enable preview, export, and save.`;
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

      if (errors.length > 0 || !validation.solution) {
        preview.replaceChildren();
        status.textContent = `Validation failed with ${errors.length} error findings. Export and canonical save remain disabled.`;
        return;
      }

      renderFloorSetInspector(preview, parseFloorSet(source), validation, "Draft Floor Set", true);
      status.textContent = `Valid draft with a ${validation.solution.length}-step structural solution. Export and explicit save are enabled.`;
    } catch (caught) {
      validatedText = editor.value;
      validatedResult = undefined;
      saveButton.disabled = true;
      exportButton.disabled = true;
      preview.replaceChildren();
      renderFindings(undefined, caught instanceof Error ? caught.message : "Draft JSON could not be parsed.");
      status.textContent = caught instanceof Error ? caught.message : "Draft JSON could not be parsed.";
    }
  };

  const loadCanonical = async (): Promise<void> => {
    const payload = await requestJson("canonical");
    applySource(payload.source, "Canonical JSON");
  };

  const generate = async (): Promise<void> => {
    status.textContent = "Generating a solvable candidate. Dense key and door counts take longer to validate.";

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
    validatedText = undefined;
    validatedResult = undefined;
    saveButton.disabled = true;
    exportButton.disabled = true;
    renderFindings(undefined);
    status.textContent = "Draft changed. Validate again before previewing, exporting, or saving.";
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
    createButton("Validate and Preview", validateDraft, reportError),
    exportButton,
    saveButton,
  );
  page.append(
    heading,
    description,
    generatorHeading,
    generatorControls,
    editorHeading,
    editorLabel,
    editor,
    actions,
    status,
    validationHeading,
    validationFindings,
    previewHeading,
    preview,
  );
  mount.replaceChildren(page);
  renderFindings(undefined);
  status.textContent = "Loading canonical floor-set JSON.";
  void loadCanonical().catch((caught: unknown) => {
    status.textContent = caught instanceof Error ? caught.message : "Unable to load canonical floor-set JSON.";
  });
}
