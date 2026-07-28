/**
 * Demo entry point.
 *
 * A second HTML entry rather than a route on the shipped one, so the demo's stylesheet, input
 * model, and frame loop can never reach the ordinary play surface.
 */

import { mountDemo } from "@/demo/demo-surface";

const mount = document.querySelector<HTMLDivElement>("#demo");

if (!mount) {
  throw new Error("demo bootstrap: #demo mount point is missing from demo.html");
}

const demoMount = mount;

void mountDemo(demoMount).catch((error: unknown) => {
  console.error("demo failed to load", error);
  const failure = document.createElement("main");
  failure.textContent = "Demo 載入失敗，請看瀏覽器主控台。";
  demoMount.replaceChildren(failure);
});
