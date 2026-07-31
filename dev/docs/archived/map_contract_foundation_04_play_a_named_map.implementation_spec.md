# The Game Plays A Named Map

Parent Plan: `map_contract_foundation.plan.md`

## Goal

Make the map file the only floor source. A floor is assembled from a map — its main region and the rooms drawn into its side slots, each built the way the room itself declares — and the map is named in the address the game is already played at. Nothing observable changes: the map that ships describes what the generator produced, so the run is the run.

## Summary

Three children built the pieces and none of them is load-bearing yet: the extent travels with the floor, the middle of the floor is a room, and a map is a file with two refusals. This one deletes the generator's private layout and assembles a floor from a map instead — one path, not two.

**A room paints itself.** The grid starts as boundary brick everywhere. Each room in turn paints its own block: carved is a backtracker run and then perforated, open is floor throughout, authored is the cells as written. That is what makes the main region and a side room the same thing built differently, and it is why the drawn rooms can be decided between the fixed rooms painting and the drawn ones painting rather than before either.

**The draw sits exactly where the role shuffle sat**, and that is deliberate rather than incidental: `npm run capture` seeds `Math.random`, so a floor assembled with the same sequence of draws is the same floor picture for picture. Preserving the position is what makes the contact sheet worth reading for this child instead of merely different.

**The map reaches the game through the address.** `resolveAppRoute` is not touched — the parent's own execution note prefers whatever leaves it answering one question, and it answers which surface, not which map. The bootstrap reads the query parameter and hands the name to the mount call; an unknown name falls back to the shipped map with a console warning rather than a blank screen.

**The load-time refusal gets its caller.** Every assembled floor goes through `validateDrawnFloor` before the world is built around it, which is what child 03 shipped without a runtime consumer.

## Approach

- `DemoTileKind` and `DemoRoomRole` become aliases of the content layer's lists. One list, aliased by the half that may import it — the arrangement the prop table already uses, and the only one where a kind added later cannot go missing and compile anyway.
- `DemoBlock` gains a width and a height. A room can now be oblong, and the block is where that first shows.
- `buildDemoFloor(map)` replaces `generateDemoMaze()`. The main region's block sits centred in the grid; a side room's block sits flush against its own grid edge, centred on the other axis — the placement child 03's at-rest rules were written against.
- The doorway walk is generalised: it runs from one cell inside the room's inward edge through both wall rings to the main region's first interior cell, however far apart those are. For a room as deep as its margin — which is every room the shipped map has — that is the same five cells as before.
- `DemoWorld` carries the map it is playing, because descending draws a new floor from the same one.

## What It Replaces

- `generateDemoMaze()` and everything private to it: the grid side constant, the main block, the room block size, the two room insets, the side order, the fixed role list, and the generated crowd. All of them are declarations in the map file now.
- The `TODO.md` line pointing at this plan, cut as the last child ships.

## Shapes To Avoid

- A second floor source kept beside the map path "for the default". The default is a map; there is one path.
- Teaching the route resolver about maps. It answers which surface a pathname wants, and a second question in it is a second reason to change it.
- Moving the draw earlier because it reads more naturally there. It would shift every subsequent draw in a seeded run and cost the only cheap evidence this plan has.
- Validating the drawn floor inside the assembly. The assembly produces a floor; whether that floor is legal is the refusal's job, and folding them together makes an unrefusable assembly.

## Verification

`npm run verify`, then `npm run capture` and read the pictures: with the seed fixed, the floor should be the same floor it was before this change.

## Acceptance Criteria

1. A run with no map named plays exactly as it did: same floor shape, same rooms, same crowd, same feel.
2. A run with the shipped map named in the address is the same run, and its main region still differs every time.
3. The map file is the only floor source; nothing generates a layout of its own.
4. A floor with no route to the way out is refused when it is loaded, naming the draw.
5. An unknown map name falls back to the shipped map rather than failing to start.
