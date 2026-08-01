# A Picture Of Any Page, On Demand

Parent Plan: none (standalone spec)

## Goal

Give the repository one command that photographs any address the development server serves, and let a curated capture scene name an address other than the play surface. Today the screenshot harness shoots five fixed scenes at one hardcoded address, so anything else means improvising a throwaway script outside the repository.

## Summary

Two things are wrong. The harness sends every scene to the same address and waits for a handle only the play surface publishes, so a named map or a workbench is unreachable by it. And nothing else in the repository can take a picture at all, so "show me what this looks like" ends in a script written from scratch outside the tree.

The answer is two commands rather than one flag. The harness keeps what it is good at — a curated scene list, a fixed seed, and a contact sheet putting the previous run beside the latest — and gains two optional fields per scene: where it points, and what readiness means there. A second, much smaller command answers the other question entirely: one address in, one picture out, no rotation and no comparison.

They stay separate because of the contact sheet. Its value is that a picture keeps a stable identity across runs, so a name can be compared with its own past. An address arriving from the command line destroys that: two runs would file unrelated pictures under one name. So the address a curated scene points at belongs in the checked-in scene, and the ad-hoc address belongs in a command that rotates nothing and writes outside the rotated directories.

Both commands need the same four things the harness holds inline today — a free port, a wait-for-server loop, the seeded `Math.random` init script, and a settle-for-N-frames helper — plus the browser launch and the navigate-and-wait step. That moves into one shared module both commands import. It is the only structural change; leaving it un-lifted means two copies that drift.

One correction to the sketch this spec replaces: the sketch recorded the `capture` query parameter as inert and read by nothing. It is not. The play surface reads it on development builds and treats the pointer as locked from the first frame, which is the one thing a headless browser cannot arrange for itself. Both commands therefore append it to every address rather than leaving it to whoever writes the scene, and the sketch's non-goal about deciding its meaning is satisfied by leaving that meaning exactly as it is.

Neither command asserts anything, sets a threshold, or returns a verdict. That line belongs to `dev/agent_rules/test_operations.md` and this work inherits it unchanged: the tools may observe and must not judge. Once it lands, a picture of any address is one command, and the scene set can grow to cover pages it currently cannot reach.

## Requirements

1. A picture of any address the development server serves can be taken with one command, without editing a checked-in file first.
2. Taking such a picture does not disturb the harness's previous-versus-latest rotation, which is the whole reason the harness exists.
3. A curated scene can point at an address other than the play surface — a named map, a workbench — because several things worth watching are unreachable today for want of one hardcoded string.
4. A page that is not the play surface can be waited for. The current readiness check waits on a handle only the play surface publishes, so any other page would hang until it times out.
5. Neither command requires a development server to already be running, and neither may take the one the user owns. A port the user is using is not the tool's to claim.
6. Nothing gains an assertion, a threshold, or a pass-fail verdict.

## Relational Context

- `dev/tools/capture-scenes.mjs` owns the output rotation: it renames `capture-output/latest/` to `previous/` at the start of every run. Anything the ad-hoc command writes inside either directory is destroyed by the next harness run, so its output goes to a third directory the rotation never touches.
- The play surface reads the `capture` query parameter in `src/demo/demo-surface.ts`, on development builds only, and treats the pointer as locked from the first frame. Without it the demo waits for a click that a headless browser cannot deliver. The parameter is appended by the shared browser module for every address, not by scene authors.
- Which map plays is the `map` query parameter, read in `src/app/main.ts`; an unknown name falls back to the default map with a console warning rather than failing. Debug tools are exact pathnames under `/debug/`, resolved by `src/app/app-route.ts` against the catalog in `src/app/debug/debug-tools.ts`. Address is therefore one field, not three.
- `window.demoWorld` is a development-only handle published by the play surface. It is the harness's readiness condition and its stats source; no other page publishes it, so any non-play address needs a different condition and never a `demoWorld` one.
- Seeding replaces `Math.random` through a page init script added to the browser context before any module runs. It must stay a context-level init script: adding it after navigation seeds nothing that has already generated a floor.
- `dev/tools/` may import `src/core/` and `src/content/` only, never `src/app/`, `src/demo/`, or a renderer. Both commands stay within that: they know the demo through the page, never through an import.
- A file directly under `dev/tools/` is an executable entrypoint; reusable implementation lives in a named subdirectory. The shared module is implementation and belongs beside the existing capture implementation modules, not at the top of the tree.
- Both commands start a development server rooted in the working tree, which means the authoring endpoint is live and writes real files. A scene drives the page through real keys and can therefore reach a save control; the prohibition already stated for browser specs in `dev/agent_rules/test_operations.md` has to reach scene authors, which means stating it in the scene file's own header. The ad-hoc command presses nothing and is immune, except when told to attach to a server whose working tree is the user's.

## Scope

### Included

- A shared capture browser module holding the port, server, seed, settle, launch, and navigate-and-wait pieces both commands need.
- Two optional scene fields: the address a scene points at, and a CSS selector standing in for the play surface's readiness handle.
- A second command taking one address and writing one picture, with switches for output path, seed, readiness, settle frames, an already-running server, and aiming the camera.
- One new npm script for it, and the additions to `dev/agent_rules/test_operations.md` that place the second command under the same observe-never-judge line.

### Excluded

- Any assertion, threshold, pixel comparison, or exit code meaning a picture is wrong.
- A generated scene list, a per-scene viewport, or any change to what the existing five scenes shoot.
- Key-driven behaviour in the ad-hoc command beyond aiming the camera; anything that walks, fights, or picks something up is a scene.
- Any new test of any kind.

## Files to Change

| File                                 | Change Size | Purpose                                                                                              |
| ------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------- |
| `dev/tools/capture/browser.mjs`      | Medium      | New. The pieces both commands share: free port, server start, seed script, settle, launch, open page |
| `dev/tools/capture-scenes.mjs`       | Medium      | Imports the shared module instead of holding it; honours the two new scene fields                    |
| `dev/tools/capture/scenes.mjs`       | Small       | Documents the two new fields and the prohibition on driving a scene into a save                      |
| `dev/tools/capture-page.mjs`         | Medium      | New. One address in, one picture out                                                                 |
| `package.json`                       | Small       | The new script name                                                                                  |
| `dev/agent_rules/test_operations.md` | Small       | Names the second command and holds it to the same line as the harness                                |
| `TODO.md`, `CHANGELOG.md`            | Small       | Tracking and the shipped record                                                                      |

## Execution Outline

1. Lift the shared pieces out of `dev/tools/capture-scenes.mjs` into `dev/tools/capture/browser.mjs` and rewrite the harness to import them, changing no behaviour. Doing this first means the harness proves the module before anything new depends on it.
2. Teach the harness the two optional scene fields, both defaulting to today's behaviour, and record the save prohibition and the new fields in the scene file's header.
3. Write `dev/tools/capture-page.mjs` on the shared module and add its npm script.
4. Update `dev/agent_rules/test_operations.md`: the second command in the tools table, and a sentence in the section that owns the observe-never-judge line.
5. Run the verification gate and the governance check, then run both commands and read the pictures.
6. Close out: delete this spec's tracker line, archive the spec, and record the outcome.

## Implementation Notes

- **Address handling.** A scene's or a command's address is a path with an optional query, resolved against the run's base URL. The `capture` parameter is appended only when absent, so an address that names it explicitly is left alone.
- **Readiness.** Three conditions: the play surface's handle, a CSS selector, and nothing beyond the page's own load. The harness defaults to the handle and takes a selector per scene; the ad-hoc command defaults to the handle when the address names the play surface's root path and to load otherwise, with a selector switch overriding either.
- **Attaching.** The ad-hoc command starts its own server by default. A tool whose behaviour depends on state it does not own fails differently depending on what else is open. Attaching to a given port stays available, photographs whatever that server is serving, and never stops it.
- **Aiming.** The one demo convenience: face the nearest enemy, or a heading in degrees, through the published development handle. Without it a picture of an empty room is a picture of a wall. On a page with no such handle it says so and takes the picture anyway.
- **Instrument panel.** The harness hides it, because a curated picture judges the game's own frame. The ad-hoc command hides nothing: it photographs the page as served.
- **Output.** The ad-hoc default filename is derived from the address so that repeat runs of the same address overwrite one picture rather than accumulating; the directory is a sibling of the rotated ones.

## Edge Cases

| Case                                                  | Expected Handling                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Address names a map that does not exist               | The play surface falls back to its default map and warns; the picture is still taken |
| Readiness never arrives                               | Fails with a message naming the address and what was waited for                      |
| Aiming asked for on a page with no development handle | Warns, skips the aim, and still takes the picture                                    |
| Attaching to a port with nothing listening            | Fails with a message saying which port was expected to be serving                    |
| Ad-hoc output directory does not exist                | Created; the rotated directories are neither read nor written                        |

## Acceptance Criteria

1. A picture of any address the development server serves can be taken with one command and no edit to a checked-in file.
2. Taking one leaves the previous-versus-latest comparison intact, and the picture survives the next harness run.
3. A curated scene can name an address other than the play surface, including a named map and a workbench, and is waited for correctly.
4. Neither command claims the port the user's own development server uses, and both work when no server is running.
5. Neither command asserts anything or returns a verdict about what it photographed.
6. The verification gate passes and no test file is added.
