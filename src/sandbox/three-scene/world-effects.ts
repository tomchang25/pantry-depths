/**
 * Everything transient: what is lying on the floor, what is flying over it, and what it is stained
 * with.
 *
 * The three are together because they share one property that decides how they are drawn — none of
 * them is ever still. Pickups and stains change rarely and are pooled; flights and particles change
 * every frame and are written into one buffer apiece, so a busy floor costs a handful of draw calls
 * rather than one per spark.
 *
 * Ground marks are the interesting half. The Canvas renderer paints them per pixel at sub-cell
 * resolution, which no mesh can do; here the whole floor's staining is one canvas texture laid over
 * the ground and redrawn only when the rules say the stains changed. That is the plan's declared
 * decal reinterpretation, and whether it survives being walked over is a thing to look at.
 */

import * as THREE from "three";

import { projectileHeight, type World } from "@/core/world";

/** Cap the rules stain a cell to. Anything at or above this is as bloody as ground gets. */
const MAX_STAIN = 0.72;

/** Texels per cell in the stain overlay. Coarse on purpose — it is a stain, not a decal sheet. */
const STAIN_RESOLUTION = 8;

/** The thrown weapons drawn as a long shaft rather than a stub, which is what tells one apart in flight. */
const LONG_FLIGHTS: ReadonlySet<string> = new Set(["skeletonJavelin", "skeletonJavelinCracked", "stick"]);

/** How many sparks the buffer has room for. Above the rules' own particle cap, so it never clips. */
const PARTICLE_CAPACITY = 512;

const PARTICLE_COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
  blood: [0.55, 0.08, 0.11],
  stoneChip: [0.55, 0.5, 0.6],
  woodChip: [0.48, 0.32, 0.17],
  dust: [0.42, 0.38, 0.46],
  ember: [1, 0.62, 0.28],
  splash: [0.35, 0.6, 0.75],
  bone: [0.86, 0.83, 0.7],
};

export type WorldEffects = Readonly<{
  root: THREE.Group;
  sync(world: World): void;
  dispose(): void;
}>;

export function createWorldEffects(): WorldEffects {
  const root = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  // Pickups. One box apiece and pooled by index rather than by identity: what matters is how many
  // are on the floor, and a pickup has no state worth following between frames.
  const propGeometry = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const propMaterial = new THREE.MeshLambertMaterial({ color: 0xe6d3a6 });
  const props = new THREE.InstancedMesh(propGeometry, propMaterial, 64);
  props.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  props.count = 0;
  root.add(props);
  disposables.push(propGeometry, propMaterial, props);

  // Flights: one thin rod each, oriented along the direction of travel, for both thrown props and
  // incoming fire. A rod is what tells a javelin from a rock at a distance, and it is the cheapest
  // shape that can say which way something is going.
  const flightGeometry = new THREE.BoxGeometry(0.055, 0.055, 1);
  const flightMaterial = new THREE.MeshLambertMaterial({ color: 0xe8e0c8 });
  const flights = new THREE.InstancedMesh(flightGeometry, flightMaterial, 48);
  flights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  flights.count = 0;
  root.add(flights);
  disposables.push(flightGeometry, flightMaterial, flights);

  // Lit from inside, because incoming fire has to be legible against a floor the torch does not reach.
  const hazardMaterial = new THREE.MeshLambertMaterial({ color: 0xff6048, emissive: 0x571a14 });
  const hazards = new THREE.InstancedMesh(flightGeometry, hazardMaterial, 32);
  hazards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  hazards.count = 0;
  root.add(hazards);
  disposables.push(hazardMaterial, hazards);

  const particlePositions = new Float32Array(PARTICLE_CAPACITY * 3);
  const particleColors = new Float32Array(PARTICLE_CAPACITY * 3);
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));
  const particleMaterial = new THREE.PointsMaterial({ size: 0.09, vertexColors: true, sizeAttenuation: true });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  root.add(particles);
  disposables.push(particleGeometry, particleMaterial);

  let stainMesh: THREE.Mesh | undefined;
  let stainCanvas: HTMLCanvasElement | undefined;
  let stainTexture: THREE.CanvasTexture | undefined;
  let stainVersion = -1;
  let stainExtent = "";

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const up = new THREE.Vector3(0, 0, 1);

  return {
    root,

    sync(world) {
      syncProps(world);
      syncFlights(world);
      syncParticles(world);
      syncStains(world);
    },

    dispose() {
      for (const disposable of disposables) {
        disposable.dispose();
      }

      stainTexture?.dispose();
      root.clear();
    },
  };

  function syncProps(world: World): void {
    const count = Math.min(world.props.length, props.instanceMatrix.count);

    for (let index = 0; index < count; index += 1) {
      const prop = world.props[index]!;
      position.set(prop.x, 0.12, prop.y);
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), index * 0.7);
      scale.setScalar(1);
      props.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    }

    props.count = count;
    props.instanceMatrix.needsUpdate = true;
  }

  function syncFlights(world: World): void {
    let index = 0;

    for (const projectile of world.projectiles) {
      if (index >= flights.instanceMatrix.count) {
        break;
      }

      forward.set(projectile.directionX, 0, projectile.directionY).normalize();
      position.set(projectile.x, projectileHeight(projectile) + 0.2, projectile.y);
      quaternion.setFromUnitVectors(up, forward);
      // Long enough to read as a shaft in flight; a cube travelling at speed reads as a glitch.
      scale.set(1, 1, LONG_FLIGHTS.has(projectile.kind) ? 1.3 : 0.7);
      flights.setMatrixAt(index, matrix.compose(position, quaternion, scale));
      index += 1;
    }

    flights.count = index;
    flights.instanceMatrix.needsUpdate = true;

    let incoming = 0;

    for (const hazard of world.hazards) {
      if (incoming >= hazards.instanceMatrix.count) {
        break;
      }

      forward.set(hazard.directionX, 0, hazard.directionY).normalize();
      const rise = hazard.arc > 0 ? hazardHeight(hazard.travelled, hazard.range, hazard.arc, hazard.fall) : 0;
      position.set(hazard.x, 0.55 + rise, hazard.y);
      quaternion.setFromUnitVectors(up, forward);
      scale.set(1, 1, hazard.kind === "shell" ? 0.5 : 0.9);
      hazards.setMatrixAt(incoming, matrix.compose(position, quaternion, scale));
      incoming += 1;
    }

    hazards.count = incoming;
    hazards.instanceMatrix.needsUpdate = true;
  }

  function syncParticles(world: World): void {
    const items = world.particles.items;
    const count = Math.min(items.length, PARTICLE_CAPACITY);

    for (let index = 0; index < count; index += 1) {
      const particle = items[index]!;
      particlePositions[index * 3] = particle.x;
      particlePositions[index * 3 + 1] = particle.z;
      particlePositions[index * 3 + 2] = particle.y;
      const color = PARTICLE_COLORS[particle.kind] ?? [1, 1, 1];
      // Faded by how much life is left, so a spray thins out rather than vanishing at once.
      const left = Math.max(0, 1 - particle.age / Math.max(0.0001, particle.life));
      particleColors[index * 3] = color[0] * left;
      particleColors[index * 3 + 1] = color[1] * left;
      particleColors[index * 3 + 2] = color[2] * left;
    }

    particleGeometry.setDrawRange(0, count);
    particleGeometry.getAttribute("position").needsUpdate = true;
    particleGeometry.getAttribute("color").needsUpdate = true;
  }

  /**
   * The floor's staining, as one texture over the whole grid.
   *
   * Redrawn only when the rules bump their own version, which is what makes a per-texel overlay
   * affordable: a floor is stained a few times a fight and read every frame.
   */
  function syncStains(world: World): void {
    const extent = `${world.maze.width}x${world.maze.height}`;

    if (extent !== stainExtent) {
      stainExtent = extent;
      stainVersion = -1;

      if (stainMesh) {
        root.remove(stainMesh);
        stainMesh.geometry.dispose();
      }

      stainTexture?.dispose();
      stainCanvas = document.createElement("canvas");
      stainCanvas.width = world.maze.width * STAIN_RESOLUTION;
      stainCanvas.height = world.maze.height * STAIN_RESOLUTION;
      stainTexture = new THREE.CanvasTexture(stainCanvas);
      stainTexture.colorSpace = THREE.SRGBColorSpace;
      const geometry = new THREE.PlaneGeometry(world.maze.width, world.maze.height);
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(world.maze.width / 2, 0.006, world.maze.height / 2);
      const material = new THREE.MeshLambertMaterial({
        map: stainTexture,
        transparent: true,
        depthWrite: false,
      });
      stainMesh = new THREE.Mesh(geometry, material);
      // Just above the ground and drawn after it, which is what keeps a stain out of the depth
      // fight it would otherwise have with the flagstones it is lying on.
      stainMesh.renderOrder = 1;
      root.add(stainMesh);
      disposables.push(material);
    }

    if (!stainCanvas || !stainTexture || world.stainsVersion === stainVersion) {
      return;
    }

    stainVersion = world.stainsVersion;
    const context = stainCanvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(0, 0, stainCanvas.width, stainCanvas.height);

    for (let y = 0; y < world.maze.height; y += 1) {
      for (let x = 0; x < world.maze.width; x += 1) {
        const amount = world.stains[y * world.maze.width + x] ?? 0;

        if (amount <= 0) {
          continue;
        }

        context.fillStyle = `rgba(96, 12, 18, ${Math.min(1, amount / MAX_STAIN) * 0.85})`;
        context.fillRect(x * STAIN_RESOLUTION, y * STAIN_RESOLUTION, STAIN_RESOLUTION, STAIN_RESOLUTION);
      }
    }

    stainTexture.needsUpdate = true;
  }
}

/** Where a shell is in its arc, in the same terms the rules give a thrown thing. */
function hazardHeight(travelled: number, range: number, arc: number, fall: number): number {
  const share = range > 0 ? Math.min(1, travelled / range) : 0;
  return arc * share - fall * share * share;
}
