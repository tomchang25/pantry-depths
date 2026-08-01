/**
 * The two form primitives every authoring surface builds its controls out of.
 *
 * Small enough that each workbench used to hold its own copy, which was fine while a copy was four
 * lines and stopped being fine when two surfaces in one tool disagreed about what a labelled field is.
 */

/** A labelled control, in the shape the debug stylesheet lays out. */
export function field(label: string, input: HTMLElement): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "debug-field";
  wrapper.append(label, input);
  return wrapper;
}

/** A number a person types. `step` is what separates a count of things from a number of seconds. */
export function numberInput(value: number, step = 1): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = String(step);
  input.value = String(value);
  return input;
}

/** A button that does something rather than submitting anything, which is every button here. */
export function actionButton(label: string, primary = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;

  if (primary) {
    button.classList.add("debug-button--primary");
  }

  return button;
}
