# A Picture Of Any Page, On Demand

Parent Plan: none (standalone sketch)

## Goal

Give the repository a way to photograph an arbitrary page — a named map, a workbench, anything the development server serves — without adding a scene to the curated set first. Today the screenshot harness can only shoot five fixed scenes at one hardcoded address, so anything else means improvising a throwaway script outside the repository.

## Summary

Two things go wrong when somebody wants to look at a page. The in-app browser's screenshot needs its pane displayed to composite frames, and when it is not, there is nothing to fall back on. The repository's own harness cannot help, because every scene it shoots goes to the same address and waits for a handle only the play surface publishes.

The direction favoured is **two commands rather than one flag**. The harness keeps doing what it is good at — a curated scene list, a fixed seed, and a contact sheet putting the previous run beside the latest — and gains the ability for a scene to say where it points. A second, much smaller command answers the other question entirely: one address in, one picture out, no rotation and no comparison.

They stay separate because of the contact sheet. Its value is that a picture keeps a stable identity across runs, so the same name can be compared with its own past. An address arriving from the command line destroys that: two runs would file unrelated pictures under one name, or file each under a new name and compare nothing. So the address a curated scene points at belongs in the checked-in scene, and the ad-hoc address belongs in a command that never rotates anything.

Neither command asserts anything, sets a threshold, or returns a verdict. That line belongs to `dev/agent_rules/test_operations.md` and this work inherits it unchanged: the tools may observe and must not judge.

If it holds up, the outcome is that "show me what this looks like" is one command against any address in the project, and the scene set can grow to cover pages it currently cannot reach.

## Requirements

1. A picture of any address the development server serves can be taken with one command, without editing a checked-in file first. The improvised alternative lives outside the repository, is written from scratch each time, and has already had to work around not being able to resolve the project's own dependencies.
2. Taking such a picture does not disturb the harness's comparison output. Its previous-versus-latest rotation is the whole reason it exists, and a casual screenshot must not be able to destroy it.
3. A curated scene can point at an address other than the play surface. Several things worth watching — a named map, a workbench being tuned — are unreachable today, and the reason is one hardcoded string.
4. A page that is not the play surface can be waited for. The current readiness check waits on a handle only the play surface publishes, so any other page would hang until it times out.
5. Neither command requires a development server to already be running, and neither may take the one the user owns. The harness already establishes both rules and the reason: a port the user is using is not the tool's to claim.
6. Nothing gains an assertion, a threshold, or a pass-fail verdict.

## Sketch

### Where the seam is

`dev/tools/capture-scenes.mjs` — verified today, but re-check before acting — holds four pieces that both commands need: an ephemeral-port helper, a wait-for-server loop, a seeded `Math.random` init script, and a settle-for-N-frames helper. It then does the browser work inline: launch Chromium, make a context at 1280 by 720, add the seed script, open a page, navigate, wait for readiness, hide the instrument panel.

The candidate shape is to lift that into something like `dev/tools/capture/browser.mjs` and have both commands import it. This is the only structural change; both features below become small once it exists. Leaving it un-lifted means two copies that drift, which is the risk worth naming.

### What a scene likely gains

Two optional fields, both defaulting to today's behaviour:

- an address, defaulting to the current hardcoded one, so a scene can name a map or a workbench;
- a readiness condition, defaulting to the play surface's handle, otherwise a CSS selector to wait for.

Passing a page function instead of a selector was considered and is not favoured: it has to be serialised into the page, and it is more rope than the two known cases need.

The address is one field rather than three, because a query string, a different pathname, and a workbench route are all the same thing at different depths. Verified today: the play surface reads its map from a query parameter, and the debug tools are exact pathnames resolved from a catalog.

### What the second command likely looks like

An address in, a picture out. Candidate switches: where to write it, which seed, what readiness means, how many frames to settle, and a port to attach to instead of starting a server.

Two choices worth recording because the reasoning is not obvious:

- **It should start its own server by default**, even though attaching to a running one is faster. A tool whose behaviour depends on state it does not own is a tool that fails differently depending on what else is open. Attaching stays available as a switch, and the switch is worth one line of documentation saying it photographs whatever that server is serving.
- **It should seed by default.** Reproducible-by-default costs nothing and matches how the harness already behaves; somebody who wants a different floor changes the number.

One demo-specific convenience is favoured despite the impurity: an option to turn the camera. Without it, a picture of an empty room is a picture of a wall, and a tool that photographs walls is not principled, just useless. Anything beyond aiming — walking, fighting, picking things up — is what a scene is for, and adding one is cheap once a scene can name its address.

Its output should live somewhere the harness's rotation does not touch. The rotation renames the latest directory to previous, so anything filed inside it would be destroyed by the next harness run.

### The hazard the later spec must carry forward

Both commands start a development server rooted in the working tree, which means the authoring endpoint is live and writes real files. `dev/agent_rules/test_operations.md` already forbids a browser spec from invoking that endpoint's save operation for exactly this reason, and the prohibition has to travel to whoever writes scenes — which means it belongs in the scene file's own header, not only in the contract document. A scene drives the page through real keys, so it can reach a save button; the ad-hoc command presses nothing and is immune, except when told to attach to a server whose working tree is the user's.

### A loose end found while looking

The address every scene navigates to carries a query parameter that nothing in the source reads — verified by search today. It is inert. It should either be removed or given a meaning, but not as part of this work; it is recorded here so the next person does not assume it is a switch.

### Candidate files to inspect

| File                                 | Why                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `dev/tools/capture-scenes.mjs`       | Holds everything that would be lifted, and the hardcoded address         |
| `dev/tools/capture/scenes.mjs`       | The scene shape, and where the save prohibition should be stated         |
| `package.json`                       | A new script name                                                        |
| `dev/agent_rules/test_operations.md` | Names the harness and its boundary; a second tool joins that description |

## Non-Goals

1. No assertion, threshold, pixel comparison, or exit code that means a picture is wrong. Both commands observe and never judge.
2. No generated scene list. A contact sheet is read by a person, and a scene per map does not survive the map library growing.
3. No per-scene viewport. The viewport is set on the browser context, so varying it per scene means a context per scene, and nothing needs it yet.
4. No key-driven behaviour in the ad-hoc command beyond aiming the camera. Anything that has to walk, fight, or pick something up is a scene.
5. No change to what the existing five scenes shoot.
6. No decision about the inert query parameter.
7. No new test of any kind.

## Acceptance Criteria

1. A picture of any address the development server serves can be taken with one command and no edit to a checked-in file.
2. Taking one leaves the harness's previous-versus-latest comparison intact.
3. A curated scene can name an address other than the play surface, including a named map and a workbench, and is waited for correctly.
4. Neither command claims the port the user's own development server uses, and both work when no server is running.
5. The verification gate passes, and no test file is added.
