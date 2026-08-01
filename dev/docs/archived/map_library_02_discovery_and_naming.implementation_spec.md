# Maps And Rooms Are Found, And Addressed By Name

Parent Plan: `map_library.plan.md`

## Goal

Stop listing maps and rooms in source. Both directories are globbed, so a file dropped into one is available without an edit anywhere, and the authoring endpoint gains the ability to read and write either by name — refusing a name that is not a plain slug.

## Summary

Child 01 made a room a file and a map a list of names, but both were still statically imported, and the endpoint's whitelist still pointed at exactly one map file. An editor that creates files cannot use either.

Discovery replaces the static imports. A room library and a map library sit beside the schema in the content layer, each globbing its own directory eagerly at module load and refusing a file whose declared identity is not what its filename says — a map's file is named after the map, a room's after the room, and a disagreement between the two is a file the endpoint and the address bar would reach different answers about. `src/demo/maps.ts` keeps only the address bar's question: which name plays, and what a name nobody recognises does. The default is named rather than taken as the first map found, because the directory's order is alphabetical and a map added later would otherwise silently become the one the game opens on.

The endpoint's whitelist grows a second shape. Most targets stay one path, because a target with one file is honestly described by one path; maps and rooms become a directory plus the suffix a file in it wears, and a request for one of those has to carry a third path segment naming which. That name is checked against the content layer's own slug pattern — twice, once where the request is read and again where the path is built — which is the whole of what keeps a development-only endpoint that writes to the working tree inside the directory it was pointed at. A slug holds no separator, no dot and no drive letter, so the join cannot climb out.

Saving a map or a room also checks that the identity inside the file is the name it was addressed as. That is not tidiness: the libraries refuse the whole library on a mismatch, not just the offending file, so a save that disagreed with its own filename would take the game down on the next load.

The result: adding `src/content/maps/<name>.map.json` or `src/content/rooms/<name>.room.json` makes it available with no source file edited, and the endpoint can read and write either.

## Relational Context

- `dev/tools/authoring/api-contract.ts` is imported by `vite.config.ts`, which is bundled without the `@/` alias. It must therefore hold paths and nothing else: a rule imported from `src/` there breaks the development server rather than the tooling. The slug patterns live in `authoring-api.ts`, which is only ever loaded through vite-node with the alias in place.
- The slug patterns are the content layer's own — a map name's from `map-schema.ts`, a room id's from `room-schema.ts` — rather than a third copy written in the endpoint. A name the library would refuse to load is a name the endpoint has no business writing, and two rules drifting apart is how a file gets saved that nothing can open.
- `AuthoringDependencies` now takes a target-and-optional-name pair rather than a bare target, in both directions. The filesystem implementation is the only thing that turns that pair into a path, and it re-checks the name rather than trusting the request that carried it.
- `vite.config.ts` derives its unwatched-file list from the same whitelist, so a directory target has to become a glob there. Chokidar matches with picomatch, which is posix-only, so a Windows path is spelled with forward slashes. Getting this wrong costs a full page reload on every save, not correctness.
- `src/content/maps/map-library.ts` imports the room library and the resolver; nothing in `dev/tools/` imports either, so `import.meta.glob` never has to resolve under vite-node.
- `src/app/debug/authoring-client.ts` gains an optional name on both calls. Every existing workbench passes none and is unaffected.
- `test/unit/dev/tools/authoring/authoring-api.test.ts` asserts the dependency shape and the whitelist, so it moves with them. Updating it is not adding a test.

## Scope

### Included

- Eager glob discovery of every room file and every map file, with identity checked against filename.
- The demo's map module reduced to the address bar's question, with a named default.
- A whitelist carrying both a single-file and a directory shape, and an endpoint that addresses the directory targets by name.
- A slug check on every name, at the request boundary and again at the path join.
- A save-time check that a map or room's declared identity is the name it was saved as.
- The dev server's unwatched list covering the two directories.
- The authoring test moved onto the new dependency shape.

### Excluded

- The sandbox map — child 03.
- Any workbench that edits a map or a room. The endpoint can now serve one; nothing builds one.
- Any change to what a map or a room file contains.
- New tests.

## Files to Change

| File                                                  | Change Size | Purpose                                                |
| ----------------------------------------------------- | ----------- | ------------------------------------------------------ |
| `src/content/maps/room-library.ts`                    | Small (new) | Every room in the tree, found rather than listed       |
| `src/content/maps/map-library.ts`                     | Small (new) | Every map, found and resolved against the room library |
| `src/demo/maps.ts`                                    | Medium      | Reduced to which name the address bar may use          |
| `dev/tools/authoring/api-contract.ts`                 | Medium      | A whitelist with two shapes, and paths only            |
| `dev/tools/authoring/authoring-api.ts`                | Large       | Names in the path, slug checks, and the room target    |
| `src/app/debug/authoring-client.ts`                   | Small       | An optional name on both calls                         |
| `vite.config.ts`                                      | Small       | A directory target becomes a watch glob                |
| `test/unit/dev/tools/authoring/authoring-api.test.ts` | Small       | Moved onto the target-and-name dependency shape        |

## Execution Outline

1. Write the two libraries, each globbing its own directory eagerly and refusing an identity that is not its filename.
2. Cut `src/demo/maps.ts` back to the default name, the lookup, and the fallback warning.
3. Reshape the whitelist, keeping every single-file target as it was and giving maps and rooms a directory and a suffix.
4. Teach the endpoint the third path segment, the slug check, the room target, and the identity check on save.
5. Give the browser client its optional name, and the dev server its directory globs.
6. Move the authoring test onto the new dependency shape, adding no case.
7. Run `npm run verify`, then open the game and confirm the discovered map is the map that plays.

## Implementation Notes

- **Why the default is named.** Glob order is alphabetical. Taking the first map found would make a map added later the one a run with no address plays, which the plan's requirement that today's run keeps playing forbids.
- **Where the name is checked.** Twice, deliberately. The request boundary refuses early with a readable message; the path join refuses again because it is the only place a request-supplied string reaches the filesystem, and this endpoint writes into the working tree.
- **What the boundary check reports.** The discovered JSON leaves the module graph rather than becoming an orphan, because nothing statically imports it any more — so the dependency cruiser reports no new warning and simply cruises four fewer modules.

## Edge Cases

| Case                                                         | Expected Handling                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| A request names a directory target without a name            | Refused as a bad request                                            |
| A request gives a name to a single-file target               | Refused as a bad request                                            |
| A name holds a separator, a dot, or anything but a slug      | Refused before any path is built, and again if one is               |
| A saved map or room declares an identity other than its name | Refused, and the file on disk is not touched                        |
| A room file whose id is not its filename                     | The library refuses at load, naming the file and the id it declares |

## Acceptance Criteria

1. Adding a map file or a room file to the working tree makes it available with no source file edited.
2. A run with no map named, or with the existing map named, plays the floor it plays today.
3. The endpoint reads and writes a map or a room chosen by name.
4. A name that is not a plain slug, or that would reach outside its directory, is refused.
5. The verification gate passes, and no test case is added.
