/**
 * Copies the SFX review record into the audio library's projects area.
 *
 * The record's canonical home is this repository — its keys are cue ids, and cue ids are defined
 * here — so what the library holds is an exported snapshot, one file per project, written only by
 * that project's exporter. One writer per file is the whole concurrency story: the audition server
 * never loads the projects area, so nothing can overwrite this from a stale in-memory copy.
 *
 * Validated on the way out with the same parser the file is loaded with, so a hand edit that broke
 * the record fails here with a row-naming message instead of arriving at the library as junk.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { parseSfxReview } from "@/content/sfx/sfx-review-schema";

const PROJECT = "pantry-depths";
const REVIEW_PATH = fileURLToPath(new URL("../../src/content/sfx/sfx-review.json", import.meta.url));
const LIBRARY_REPO = process.env.AUDIO_LIBRARY_REPO ?? "E:/Code/audio-library";

const entries = parseSfxReview(JSON.parse(await readFile(REVIEW_PATH, "utf8")));
const destination = resolve(LIBRARY_REPO, "catalog", "projects", `${PROJECT}.json`);
const payload = {
  project: PROJECT,
  exportedAt: new Date().toISOString(),
  entries,
};

await mkdir(resolve(LIBRARY_REPO, "catalog", "projects"), { recursive: true });
await writeFile(destination, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Exported ${entries.length} review entries to ${destination}`);
