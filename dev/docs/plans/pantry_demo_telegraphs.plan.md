# Telegraphed Threats And Directional Damage

## Goal

Make every committed enemy attack in the demo state where it will land before it lands, and make every hit the player takes say which way to turn. Today a wind-up marker is drawn against a target the attack re-picks at the instant it fires, so what the player is shown during a wind-up is never what actually happens; and a hit from off screen is a full-screen flash that carries no direction at all.

## Requirements

1. An attack that shows a wind-up locks its target point when the wind-up begins and resolves against that point however the player moves afterwards — a warning that re-aims is not a warning, and every other requirement here is built on this one guarantee.
2. Each attack wears its own red symbol while it winds up — a reticle, a flame, a blade — instead of the one exclamation mark three attacks currently share, and each enemy also shows the wind-up on its own body. The shared mark is not merely bland: it is picked by asking whether the attack is a charge, so a swordsman raising its sword is currently wearing the shooter's badge.
3. A shooter's wind-up draws the line its shot will travel, ending where the shot would end rather than continuing through cover, so "step out of the line" and "put a wall in it" are both readable without a HUD.
4. A hit from a known source raises a directional mark around the crosshair that points at that source's world position, recomputed as the player turns — an indicator that freezes to the screen tells the player they were hit, not where to look.
5. The charger's wind-up runs three seconds, paints its locked lane on the floor as one red strip whose fill doubles as the countdown, and visibly burns while it gathers.
6. A charge that ends against masonry damages it, and a charge that stalls leaves the charger stunned for five seconds — a three-second wind-up removes the charger as a threat, so it has to become a demolition tool the player positions instead, which is the only version of this change worth making.
7. Any stunned enemy shows it with orbiting stars overhead. Stun is currently a state with no picture, and after requirement 6 it is the most valuable window in a fight.
8. The floor carries a fixed, breakable mortar emplacement that locks onto a randomly chosen body more than two tiles away — player or enemy, with no preference — marks the ground it stood on, and shells that mark five seconds later. It is the floor's weapon rather than any creature's, and having no side is what makes it a chaos generator the player can work with rather than one more thing hunting them.

## Design

### The aim lock

Every wind-up records the point it is aimed at when it starts. Both committed enemy attacks — the direct shot and the charge — read that recorded point when they resolve, and the mortar emplacement follows the same rule on its own schedule. Contact melee is unaffected: it already re-checks range at resolution and misses when the player has stepped away, which is the same promise by a different route.

The lock is what converts each telegraph from decoration into a contract. A three-second charge that re-aims at the end is unavoidable; a three-second charge that commits to a lane at the start is trivially avoidable, which is the intent.

### One symbol per attack, and a body that shows it

The floating mark becomes three marks, all in one warning red: a reticle for the shot, a flame for the charge, a blade for the sword. Red for all three because the player should read "something is about to hit you" from the colour without learning a palette, and separate shapes because what to do about it differs completely — get out of the line, get out of the lane, get out of reach.

That also fixes a defect. The current mark is chosen by asking whether the attack is a charge, so the charge gets the red one and everything else gets the blue one, which means a swordsman raising its sword is wearing the shooter's badge.

Each enemy also shows its wind-up on its own body, so a committed enemy is legible with its mark off screen or lost in a crowd:

| Enemy          | On the body while it winds up                                                      |
| -------------- | ---------------------------------------------------------------------------------- |
| Shooter        | Swells and fills, with a brightening core near the crown, and a small light        |
| Charger        | Crouches and gathers, pours embers, and carries a reddening swelling light         |
| Swordsman      | A bright arc swept along the path the cut will take, brightening at the end        |
| Ordinary slime | Nothing — it has no wind-up, and a cue would advertise a commitment it never makes |

The swordsman is the odd one out because it is an authored sprite sheet rather than a soft body, so there is nothing to squash. What it can show instead is where the blade is going, which is the more useful half anyway.

### The sight line

While a shooter winds up a direct shot, a line of small bright beads runs from the shooter to the locked point, at the height the shot flies. The beads stop at the first surface that would stop the shot, so a barricade or a wall visibly truncates the line. Brightness and density climb as the wind-up completes.

Beads rather than a solid rod: a solid rod in this scene is opaque and dims with distance, which darkens the warning exactly when it is furthest away and most needed. A dotted line also simply reads as a sight line.

### Directional damage marks

A hit with a known origin records that origin's world position and a severity. For as long as the mark lives, a soft arc is drawn around the crosshair at the screen angle from the player's current facing to that stored position. Several live marks stack, so being surrounded draws itself.

The stored value is a world position, never a screen angle. Turning the view has to sweep the arc toward the edge and off it; a mark that keeps its screen position while the player turns is worse than nothing, because it points at a place the threat is not.

### The charger

The wind-up grows from 0.8 s to 3.0 s and gains three overlapping cues: the body crouches and gathers, embers pour off it at a rising rate, and a light on it reddens and brightens so the whole room knows something is charging over there.

The floor chevrons are replaced by one red strip laid along the locked lane, running the full charge distance. The strip is dim along its whole length from the moment the lane locks — that is the "where" — and a bright fill sweeps from the charger outward as the wind-up completes — that is the "when". One object carries both, and the flame over its head keeps its own job of saying that an attack is coming at all.

A charge that ends against masonry damages that masonry, and a stalled charge stuns the charger for 5.0 s. Together those turn a wound-up charger into a battering ram the player lines up against a wall and then has five free seconds to work on.

### Stun stars

Three small star sprites orbit above any enemy whose stun timer is running, fading in and out with it. Applies to every enemy rather than only slimes: the state is the same state, and a picture that appears for some bodies and not others reads as a bug.

### The mortar emplacement

A fixed, breakable block standing in the floor, placed the way the iron barricades are. It runs a four-beat cycle on its own schedule, with no relationship to any creature: pick a body at random from everything more than two tiles away, lock the ground that body is standing on, hold for five seconds, then launch an arcing shell at that point. Three seconds idle, then pick again.

Its circle is drawn on the floor from the moment it locks: a fixed outer ring at the blast radius and an inner disc that grows to meet the ring as the shell comes in. A short column of bright beads stands at the centre, because a flat circle at the player's feet is nearly invisible at the camera's pitch and the one place the marker must be legible is the place the player is standing.

Everything inside the circle takes the blast, enemies included, and the target roll has no side. With fourteen to twenty enemies alive, the emplacement spends most of its time thinning them, and being shelled yourself is the uncommon case — which is the intended feel. It is a hazard the player learns to fight beside rather than one more thing hunting them.

The two-tile dead zone is the counter. It cannot shell anything close to itself, so walking up to it and breaking it down is always available and always safe.

It looks like a squat mortar tube on a timber carriage, with the tube pointing straight up. That is the honest shape as well as the buildable one: a weapon that shells every direction around itself has no reason to be angled, and it reads the same from every approach. Its muzzle glows through the five-second lock and the shell leaves it upward.

A kill the shell makes counts as the player's, exactly as any other kill does — the run's tally, the lifesteal blessing, the drop table. Positioning yourself so the floor's own artillery does the work is a way of playing it, not a way of cheating it.

### Numbers

| Knob                      | Before | After   |
| ------------------------- | ------ | ------- |
| Charger wind-up           | 0.8 s  | 3.0 s   |
| Charger stall stun        | 1.6 s  | 5.0 s   |
| Charge damage to masonry  | none   | 2       |
| Direct-shot wind-up       | 1.0 s  | 1.0 s   |
| Directional mark lifetime | —      | 1.3 s   |
| Orbiting stars per stun   | —      | 3       |
| Emplacements per floor    | —      | 2 to 3  |
| Emplacement health        | —      | 8       |
| Emplacement lock time     | —      | 5.0 s   |
| Emplacement idle time     | —      | 3.0 s   |
| Emplacement dead zone     | —      | 2 tiles |
| Shell blast diameter      | —      | 2 tiles |
| Shell damage              | —      | 24      |

Stone walls take 4 damage to break and wood takes 2, so a charge is worth half a stone wall and a whole wooden one — meaningful without displacing the bomb, which still flattens stone in one throw.

### Child overview

| Child | Focus                                                       | Current form                                                                  |
| ----- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 01    | Lock every wind-up's target at the moment it begins         | `pantry_demo_telegraphs_01_locked_aim.implementation_spec.md`                 |
| 02    | Three red attack symbols, the shooter's sight line and body | `pantry_demo_telegraphs_02_shooter_telegraph.implementation_spec.md`          |
| 03    | Charger wind-up, lane strip, burn, wall break, longer stun  | `pantry_demo_telegraphs_03_charger.implementation_spec.md`                    |
| 04    | Stun stars, and the swordsman's wind-up arc                 | `pantry_demo_telegraphs_04_enemy_cues.implementation_spec.md`                 |
| 05    | Directional damage marks around the crosshair               | `pantry_demo_telegraphs_05_damage_direction.implementation_spec.md` (draft)   |
| 06    | Fixed mortar emplacement that shells everyone alike         | `pantry_demo_telegraphs_06_mortar_emplacement.implementation_spec.md` (draft) |

Landing order is 01 through 06 as numbered. Child 01 is a hard prerequisite for 02 and 03 — the warnings those two draw are only true once the aim is locked. Child 02 bakes the whole symbol set, including the charger's flame, so the vocabulary lands as one piece rather than a shape at a time; it also introduces the bead helper that 04 and 06 both reuse. Child 05 is independent and could land anywhere. Child 04 follows 03 because the five-second stall stun is what makes the stun picture worth having. Child 06 owns no enemy behavior at all and lands last because it is the largest and reaches furthest into the floor generator.

## Non-Goals

1. No audio of any kind.
2. No change to `src/core/` or `src/content/` — every number and behavior here belongs to the demo's own world.
3. No automated tests. The demo half is verified by playing it, and adding coverage here is forbidden outright.
4. No new renderer capability. Every visual in this plan is built from scene primitives that already exist, so the shipped renderer is untouched.
5. No new enemy archetype, and no change to the archetype mix a floor spawns. The mortar emplacement is terrain, not a creature: it does not move, path, or take part in the enemy count. Kills its shell makes still count as the player's.
6. No broader difficulty pass. The numbers table above is the whole of the balance change.
7. No lobbed or indirect attack for any enemy. The shooter keeps its direct bolt and nothing else.
8. No wall damage from the shell. Demolition stays the charger's and the bomb's job.

## Acceptance Criteria

1. A shooter that begins a wind-up while aimed at the player fires at where the player stood when the wind-up began, and a player who walks two paces sideways is missed.
2. A shooter, a charger, and a swordsman winding up are told apart by their overhead symbols alone; all three are red, and the swordsman no longer wears the shooter's.
3. Each of those three also shows its wind-up on its own body, so a committed enemy is recognizable with its symbol off screen. The ordinary slime shows nothing, because it has no wind-up.
4. A shooter's wind-up shows a line to that locked point, and interposing a wall or barricade visibly shortens the line to that obstruction.
5. Taking a hit from behind or from either side raises an arc on the corresponding side of the crosshair, and turning to face the source sweeps that arc to the top of the crosshair before it fades.
6. A charger that commits paints one red strip down its lane, holds that lane for three seconds while burning, and runs down the strip it painted — not after the player.
7. A charge that reaches masonry damages it, and a charge that stalls leaves the charger inert and visibly stunned for five seconds.
8. Any enemy with a running stun timer has stars orbiting over its head for the duration, whatever put it there.
9. Every floor carries two or three breakable emplacements, each of which locks a random body beyond two tiles, marks the ground it stood on, and shells that mark five seconds later whatever the target does afterwards.
10. Enemies are shelled as readily as the player is, take the blast the same way, and a kill the shell makes counts as the player's.
11. Standing within two tiles of an emplacement cannot be shelled by it, and breaking it down stops it firing.
12. `npm run verify` passes, and the demo's manual playtest confirms each criterion above.
