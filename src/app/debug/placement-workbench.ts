/**
 * Where a thing sits on the floor, and how big it reads from where the player stands.
 *
 * Two tabs over one question. A body and a pickup are different objects with different authored
 * numbers, but the argument about both is the same argument — is it the right size, is the mark over
 * it in the right place, does it still read at four cells — and that argument is only ever settled by
 * looking from the distance the game looks from. So the two share a page, and the tab is there
 * because they cannot share a frame: judging a pickup means having nothing else on screen.
 *
 * They stand on an authored empty room rather than on a floor the assembler generated. That is the
 * whole reason this surface can be trusted: a generated dungeon drops the eye at a random arrival
 * facing a random way, so the same slider value showed a different picture on every reload, and half
 * of those pictures were a wall at arm's length.
 */

import { createBodyPreview } from "@/app/debug/body-preview";
import { createDebugPage } from "@/app/debug/debug-shell";
import { createPropWorkbench } from "@/app/debug/prop-workbench";

type PlacementTab = "body" | "pickup";

export function renderPlacementWorkbench(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "Placement Workbench",
    description:
      "How a body and a pickup sit on an authored floor, seen from the distance the game draws them at. Every number here is previewed live and written only when asked.",
    width: "wide",
  });

  const tabs = document.createElement("div");
  const bodyTab = document.createElement("button");
  const pickupTab = document.createElement("button");
  const bodySection = document.createElement("div");
  const pickupSection = document.createElement("div");

  tabs.className = "workbench-tabs";
  tabs.setAttribute("role", "tablist");
  bodyTab.type = "button";
  bodyTab.textContent = "Body";
  bodyTab.setAttribute("role", "tab");
  bodyTab.setAttribute("aria-controls", "placement-body-tab");
  pickupTab.type = "button";
  pickupTab.textContent = "Pickup";
  pickupTab.setAttribute("role", "tab");
  pickupTab.setAttribute("aria-controls", "placement-pickup-tab");
  bodySection.id = "placement-body-tab";
  bodySection.setAttribute("role", "tabpanel");
  pickupSection.id = "placement-pickup-tab";
  pickupSection.setAttribute("role", "tabpanel");
  tabs.append(bodyTab, pickupTab);

  let activeTab: PlacementTab = "body";
  const selectTab = (tab: PlacementTab): void => {
    activeTab = tab;
    bodyTab.setAttribute("aria-selected", String(activeTab === "body"));
    pickupTab.setAttribute("aria-selected", String(activeTab === "pickup"));
    bodySection.hidden = activeTab !== "body";
    pickupSection.hidden = activeTab !== "pickup";
  };

  bodyTab.addEventListener("click", () => selectTab("body"));
  pickupTab.addEventListener("click", () => selectTab("pickup"));

  // Both tabs are built at mount, and the hidden one keeps its renderer running. That is deliberate:
  // a panel rebuilt on every tab press loses the numbers being tuned, and the whole use of this page
  // is going back and forth between two objects with a value in your head.
  bodySection.append(createBodyPreview());
  pickupSection.append(createPropWorkbench());
  selectTab("body");
  content.append(tabs, bodySection, pickupSection);
  mount.replaceChildren(page);
}
