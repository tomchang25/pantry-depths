import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import type { IncomingMessage } from "node:http";
import { normalizePath, type Plugin, type ViteDevServer } from "vite";
import { defineConfig } from "vitest/config";

import { AUTHORING_API_ROOT, CANONICAL_AUTHORING_PATHS } from "./dev/tools/authoring/api-contract";

const AUTHORING_RUNNER_PATH = fileURLToPath(new URL("./node_modules/vite-node/vite-node.mjs", import.meta.url));
const AUTHORING_SCRIPT_PATH = fileURLToPath(new URL("./dev/tools/run-authoring-request.ts", import.meta.url));
const AUTHORING_CONFIG_PATH = fileURLToPath(new URL("./dev/tools/vite-node.config.ts", import.meta.url));

type AuthoringResponse = Readonly<{ status: number; body: unknown }>;

/**
 * The canonical authored files, which the dev server deliberately does not watch.
 *
 * Saving from a workbench writes one of these, and they live under `src/` where a module imports them —
 * so the write used to look to Vite exactly like an edit. JSON has no hot-update boundary and nothing in
 * the chain accepts one, so the fallback fired and the whole page reloaded: every slider back to its
 * loaded value, the selected subject lost, and any other tab reloaded too, including a game mid-run.
 *
 * Nothing is given up by not watching them. The endpoint validates before it writes, so a file that
 * could not be loaded back cannot be written in the first place, and the tool that saved already has the
 * new values on screen. Reading the file back is a button in each workbench rather than something the
 * watcher does behind everyone's back.
 *
 * Derived from the whitelist so a target added later is covered without anybody remembering to.
 *
 * **The directory targets are covered too, and that is a reversal.** Maps and rooms were watched
 * because the watcher was the only thing that noticed a file appearing in a library — but the tool that
 * now edits them is the tool that writes them, so every save reloaded the page doing the editing. Both
 * jobs the watcher was doing are owned explicitly instead: the editor asks for its listing through the
 * authoring endpoint, and a save invalidates the modules below without telling any open page.
 */
const UNWATCHED_AUTHORED_PATHS = Object.values(CANONICAL_AUTHORING_PATHS).map((entry) =>
  "file" in entry
    ? { file: normalizePath(fileURLToPath(new URL(entry.file, import.meta.url))) }
    : {
        directory: normalizePath(fileURLToPath(new URL(entry.directory, import.meta.url))),
        suffix: entry.suffix,
      },
);

/**
 * Whether one path is a canonical authored file.
 *
 * **A directory target matches by its suffix, not by its directory alone**, and that distinction is
 * load-bearing rather than fussy: `src/content/maps` holds the map files *and* the schema, resolver and
 * library modules that read them. Ignoring the whole directory would stop the development server
 * noticing an edit to any of that source, which looks like the server having silently died.
 *
 * A predicate rather than a list of globs because these are absolute paths, and on Windows a backslash
 * is an escape character to a matcher rather than a separator. Both sides are normalised to forward
 * slashes for the same reason: the watcher reports a path in one spelling and this file builds it in the
 * other, and a path compared across that difference never matches — which reads as the ignore silently
 * not working.
 */
function isUnwatchedAuthoredPath(path: string): boolean {
  const normalized = normalizePath(path);

  return UNWATCHED_AUTHORED_PATHS.some((entry) =>
    "file" in entry
      ? normalized === entry.file
      : normalized.startsWith(`${entry.directory}/`) && normalized.endsWith(entry.suffix),
  );
}

/**
 * The module holding each directory target's glob.
 *
 * Editing a map or a room makes a module the library already imports stale, and invalidating that file
 * is enough. **Creating one is the case this exists for:** a file nothing has imported yet has no module
 * to invalidate, and the only thing that would notice it is the glob being expanded again — which
 * happens when the module holding the glob is transformed again.
 *
 * Named here rather than in the target whitelist because the endpoint never touches these files. What
 * goes stale is the development server's view of a directory, not a file the endpoint may write.
 */
const LIBRARY_MODULE_BY_TARGET: Readonly<Record<string, string>> = {
  map: "src/content/maps/map-library.ts",
  room: "src/content/maps/room-library.ts",
};

/**
 * Drops what the development server holds about the files a save changed, and tells no open page.
 *
 * Silent on purpose, and it is the whole reason the directories above can go unwatched. A broadcast
 * here would be the page reload this change exists to remove; without one, nothing on screen moves and
 * the next document loaded — the game the editor's play action opens — reads what was written.
 */
function invalidateAfterSave(server: ViteDevServer, target: string, name: string | undefined): void {
  const entry = CANONICAL_AUTHORING_PATHS[target as keyof typeof CANONICAL_AUTHORING_PATHS];

  if (!entry) {
    return;
  }

  const written =
    "file" in entry ? entry.file : name === undefined ? undefined : `${entry.directory}/${name}${entry.suffix}`;
  const library = LIBRARY_MODULE_BY_TARGET[target];
  const graph = server.environments.client.moduleGraph;

  for (const relative of [written, library]) {
    if (relative === undefined) {
      continue;
    }

    for (const module of graph.getModulesByFile(normalizePath(fileURLToPath(new URL(relative, import.meta.url)))) ??
      []) {
      graph.invalidateModule(module);
    }
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > 1_000_000) {
      throw new Error("Authoring request exceeds the 1 MB limit.");
    }

    chunks.push(buffer);
  }

  return chunks.length === 0 ? undefined : (JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
}

function runAuthoringRequest(request: Readonly<{ method: string; pathname: string; body?: unknown }>) {
  return new Promise<AuthoringResponse>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [AUTHORING_RUNNER_PATH, "--config", AUTHORING_CONFIG_PATH, AUTHORING_SCRIPT_PATH],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    const standardOutput: Buffer[] = [];
    const standardError: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => standardOutput.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => standardError.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(standardError).toString("utf8") || `Authoring runner exited with ${code}.`));
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(standardOutput).toString("utf8")) as AuthoringResponse);
      } catch (caught) {
        reject(caught);
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

function authoringPlugin(): Plugin {
  return {
    name: "pantry-authoring",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        void (async () => {
          try {
            const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

            if (!pathname.startsWith(`${AUTHORING_API_ROOT}/`)) {
              next();
              return;
            }

            const body = request.method === "POST" ? await readJsonBody(request) : undefined;
            const result = await runAuthoringRequest({
              method: request.method ?? "GET",
              pathname,
              ...(body === undefined ? {} : { body }),
            });
            const [target, operation, name] = pathname.slice(AUTHORING_API_ROOT.length + 1).split("/");

            if (result.status === 200 && operation === "save" && target !== undefined) {
              invalidateAfterSave(server, target, name);
            }

            response.statusCode = result.status;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify(result.body));
          } catch (caught) {
            const message = caught instanceof Error ? caught.message : "Unable to parse authoring request.";
            response.statusCode = 400;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ message }));
          }
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [authoringPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5273,
    strictPort: true,
    watch: {
      ignored: isUnwatchedAuthoredPath,
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
      },
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
