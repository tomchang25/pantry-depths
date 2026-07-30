/**
 * The browser half of the development-only authoring API.
 *
 * Every workbench that edits canonical content needs the same two calls and the same error handling,
 * and until now each wrote its own copy of the fetch — five of them, drifting in what they did with a
 * non-OK response. They live here instead, so a tool spends its own code on the thing it is tuning.
 *
 * Neither call reshapes what it carries. The endpoint writes a validator's return value verbatim, so a
 * client that helpfully rearranged a payload would write a file its own next load rejects; the caller
 * hands over exactly what belongs in the file and gets back exactly what is in it.
 */

/** Client-side copy held equal to the tooling namespace by a unit contract test. */
export const AUTHORING_API_ROOT = "/__debug/authoring";

function messageOf(body: unknown, fallback: string): string {
  return body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
    ? (body as { message: string }).message
    : fallback;
}

/**
 * Reads one target's canonical file as it is on disk right now.
 *
 * The manual half of what the file watcher used to do by force. A workbench calls this when the person
 * using it asks to see what is saved — after editing the file by hand, or to throw away changes that
 * were slid but never saved — and it touches nothing the caller has not asked it to.
 */
export async function loadCanonical(target: string): Promise<unknown> {
  const response = await fetch(`${AUTHORING_API_ROOT}/${target}/canonical`);
  const body = (await response.json()) as { source?: unknown };

  if (!response.ok) {
    throw new Error(messageOf(body, `Load failed with ${response.status}.`));
  }

  return body.source;
}

/** Writes one target's canonical file, and answers what the endpoint said about it. */
export async function saveCanonical(target: string, source: unknown): Promise<string> {
  const response = await fetch(`${AUTHORING_API_ROOT}/${target}/save`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source }),
  });
  const body = (await response.json()) as { message?: string };

  if (!response.ok) {
    throw new Error(messageOf(body, `Save failed with ${response.status}.`));
  }

  return messageOf(body, `Saved canonical ${target} content.`);
}
