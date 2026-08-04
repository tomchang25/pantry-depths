/**
 * The filming stage: a floor that loads the same way twice, so a take can be shot again.
 *
 * Everything here is a statement about a session rather than about a dungeon, which is exactly why
 * none of it is a field on a room or a map. A room describes what stands where; where the run arrives,
 * whether the bodies are held still, and which body the next reset stands up are all facts about the
 * person holding the camera. So this is a scene — an address with rules of its own — and the rules are
 * applied to a floor the ordinary assembler already built.
 *
 * What the dressing fixes is everything an ordinary floor randomises or hides in a room this small:
 * the arrival is drawn from the room's own cells, the plinth lands on the arrival whenever no room on
 * the floor holds one, and the way down sits loose in five cells of floor — where standing near it
 * with the floor's main task met descends. The main task is a body count, and a person filming a fight
 * kills bodies, so that last one is not a cosmetic problem.
 *
 * That it has to fix any of this is a workaround wearing the shape of a feature: a floor cannot yet
 * say it is not a dungeon, so a scene that is not one moves the fixtures out of shot instead. The
 * tracker holds that as its own decision; this file is what the game does until it is made.
 */

import { ENEMY_ARCHETYPES } from "@/content/enemies/enemy-archetypes";
import type { MapCastKind } from "@/core/room-contract";
import { mainRoom } from "@/core/maze";
import type { SceneHooks } from "@/runtime/scene-hooks";
import { announce, standCast, type World } from "@/core/world";

/**
 * What the next reset stands up: each body as its room declares it, or every body as one chosen kind.
 *
 * Eight states rather than seven. Starting at the room's own declaration means a mixed cast is the
 * default and overriding it is a deliberate act with a way back — an override with no way back would
 * make a hand-arranged cast something a keypress destroys.
 */
const CAST_CHOICES = [undefined, ...(Object.keys(ENEMY_ARCHETYPES) as MapCastKind[])] as const;

/**
 * Session state, held beside the world rather than on it.
 *
 * It survives a restart the way god mode does, because it describes what is being filmed rather than
 * what the floor is; and it is read at placement rather than applied when it changes, so stepping
 * through the list looking for the right body does not destroy the shot already standing.
 */
let choice = 0;

/**
 * What the next reset would stand, short enough for the panel to hold.
 *
 * The archetype's identifier rather than its display name, and that is a layout constraint rather
 * than a preference: the instrument panel is a fixed box sized to its longest possible line, and
 * "Skeleton Crossbowman" does not fit inside it. The identifiers read perfectly well in a monospace
 * column and every one of them is inside the budget.
 */
function choiceName(): string {
  return CAST_CHOICES[choice] ?? "as authored";
}

/** Steps the choice one either way, wrapping, and answers what is now held. */
function stepChoice(by: number): string {
  choice = (choice + by + CAST_CHOICES.length) % CAST_CHOICES.length;
  return choiceName();
}

/**
 * Clears the floor and stands the cast again, leaving the player exactly where they are.
 *
 * The bodies are dropped rather than killed. A reset is not a death: routing it through the ordinary
 * exit would leave a corpse, a drop and a stain on a floor whose whole purpose is to be photographed
 * clean — which is the opposite of what the kill-everything key is for, and why that one still goes
 * through the exit.
 *
 * Anything holding a body goes with them. A hand still holding a body that no longer exists, or a
 * javelin still carrying one, is a reference to something the floor has forgotten.
 */
function restageCast(world: World): number {
  world.enemies = [];

  if (world.held?.kind === "enemy") {
    world.held = undefined;
  }

  for (const projectile of world.projectiles) {
    projectile.payload = undefined;
    projectile.skewered.length = 0;
  }

  const stood = standCast(world, CAST_CHOICES[choice]);

  // Every body is turned to look at where the run arrives, because a body created anywhere else in
  // this game rolls its facing at random and then turns towards the player within a second — and a
  // held body never turns at all, so on a stage the roll is permanent and half the cast has its back
  // to the camera.
  //
  // Aimed at the arrival rather than at a fixed compass direction: today those are the same thing,
  // and only one of them survives the stage being made wider, longer, or turned around.
  for (const enemy of world.enemies) {
    enemy.facingAngle = Math.atan2(world.maze.entrance.y + 0.5 - enemy.y, world.maze.entrance.x + 0.5 - enemy.x);
  }

  return stood;
}

/**
 * Puts one freshly built floor into the state a take starts from.
 *
 * Reached both at mount and on restart, which is what makes restarting mean "shoot that again" rather
 * than "shoot something else": the cast returns to its cells, the arrival is the arrival, and the
 * bodies are held still whether or not they had been released.
 */
function dress(world: World): void {
  const room = mainRoom(world.maze);
  const arrival = { x: Math.floor((room.minX + room.maxX) / 2), y: room.maxY };
  // Outside every room's interior and never walkable, which is what puts the descent out of reach and
  // the plinth out of shot. Derived from the assembled room rather than from the shipped extent, so
  // editing the stage's size in the workbench moves the arrival with it instead of stranding it.
  const offstage = { x: 0, y: 0 };

  world.maze = { ...world.maze, entrance: arrival, exit: offstage, altar: offstage };
  world.player.x = arrival.x + 0.5;
  world.player.y = arrival.y + 0.5;
  // Straight up the room. Forward is the cosine and sine of this angle, so a quarter turn back from
  // zero points along negative Y, which is the far wall from the south edge the arrival stands on.
  world.player.angle = -Math.PI / 2;
  world.player.pitch = 0;
  world.altar = { ...world.altar, x: offstage.x + 0.5, y: offstage.y + 0.5 };
  world.mindsFrozen = true;
  restageCast(world);
}

function restage(world: World): void {
  const stood = restageCast(world);
  announce(world, stood > 0 ? `Cast restaged (${stood})` : "This room stands nobody", 2);
}

/**
 * The stage's three keys and one row.
 *
 * Choosing does not touch what is already standing — it decides what the next reset stands up — so a
 * person can step through the list looking for the right body without destroying the shot they are in.
 */
export const SOUNDSTAGE: SceneHooks = {
  dress,
  instrumentsHidden: true,
  chips: () => [`Cast · ${choiceName()} · Q E`],
  commands: [{ label: "Restage cast · C", run: restage }],
  onKey: (world, key) => {
    if (key === "q" || key === "e") {
      announce(world, `Next cast: ${stepChoice(key === "e" ? 1 : -1)}`, 2);
      return true;
    }

    if (key === "c") {
      restage(world);
      return true;
    }

    return false;
  },
};
