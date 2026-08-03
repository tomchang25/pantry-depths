/**
 * What stands in for a ceiling.
 *
 * The Canvas renderer treats the sky as a backdrop — a gradient written per pixel above the horizon,
 * with the stars placed in screen space because a point at infinite distance collapses onto the
 * horizon line in that projection. A perspective camera has no such problem, so this is the plan's
 * declared reinterpretation: the same colours and the same star count, but on a real dome, so they
 * hold still as the player walks and swing correctly as they turn.
 */

import * as THREE from "three";

/** The night the floor stands under, in the scene builder's own numbers. */
const HORIZON: readonly [number, number, number] = [38, 30, 58];
const ZENITH: readonly [number, number, number] = [8, 7, 20];
const STARS = 220;
const MOON_ANGLE = 2.1;

/** Far enough out that walking never closes on it, inside the camera's far plane. */
const DOME_RADIUS = 220;

export type Sky = Readonly<{
  root: THREE.Group;
  /** The colour the fog is tinted with, so the far distance and the horizon agree. */
  horizonColor: THREE.Color;
  dispose(): void;
}>;

function gradientTexture(): THREE.CanvasTexture {
  const surface = document.createElement("canvas");
  surface.width = 1;
  surface.height = 256;
  const context = surface.getContext("2d");

  if (!context) {
    throw new Error("three-scene: Canvas 2D is unavailable, and the sky gradient is drawn with it");
  }

  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, `rgb(${ZENITH[0]}, ${ZENITH[1]}, ${ZENITH[2]})`);
  // The band just above the horizon carries most of the colour, so the gradient is weighted towards
  // it rather than running evenly from top to bottom.
  gradient.addColorStop(
    0.72,
    `rgb(${Math.round((ZENITH[0] + HORIZON[0]) / 2)}, ${Math.round(
      (ZENITH[1] + HORIZON[1]) / 2,
    )}, ${Math.round((ZENITH[2] + HORIZON[2]) / 2)})`,
  );
  gradient.addColorStop(1, `rgb(${HORIZON[0]}, ${HORIZON[1]}, ${HORIZON[2]})`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 256);

  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The stars, scattered over the upper half of the dome.
 *
 * Placed by an index-driven hash rather than by `Math.random`, so two runs of the experiment stand
 * under the same sky and a screenshot taken today can be held against one taken tomorrow.
 */
function starField(): readonly [THREE.Points, THREE.BufferGeometry, THREE.PointsMaterial] {
  const positions = new Float32Array(STARS * 3);

  for (let index = 0; index < STARS; index += 1) {
    const spin = ((index * 2_654_435_761) % 100_003) / 100_003;
    const rise = ((index * 40_503 + 17) % 99_991) / 99_991;
    const azimuth = spin * Math.PI * 2;
    // Biased away from the horizon: stars sitting on it are hidden by the boundary wall anyway, and
    // the ones worth having are overhead where the missing ceiling used to be.
    const elevation = 0.12 + rise * 1.3;
    const radius = DOME_RADIUS * 0.94;
    positions[index * 3] = Math.cos(azimuth) * Math.cos(elevation) * radius;
    positions[index * 3 + 1] = Math.sin(elevation) * radius;
    positions[index * 3 + 2] = Math.sin(azimuth) * Math.cos(elevation) * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xd8d4ff, size: 1.6, sizeAttenuation: false, fog: false });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return [points, geometry, material];
}

export function buildSky(): Sky {
  const root = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  const domeGeometry = new THREE.SphereGeometry(DOME_RADIUS, 32, 16);
  const domeTexture = gradientTexture();
  const domeMaterial = new THREE.MeshBasicMaterial({
    map: domeTexture,
    side: THREE.BackSide,
    // Never fogged and never depth-written: it is a backdrop, and anything in the world must draw
    // over it regardless of how far away that thing is.
    fog: false,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(domeGeometry, domeMaterial);
  dome.renderOrder = -1;
  root.add(dome);
  disposables.push(domeGeometry, domeMaterial, domeTexture);

  const [stars, starGeometry, starMaterial] = starField();
  root.add(stars);
  disposables.push(starGeometry, starMaterial);

  const moonGeometry = new THREE.CircleGeometry(9, 24);
  const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xe8e2ff, fog: false, depthWrite: false });
  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
  const moonElevation = 0.62;
  moon.position.set(
    Math.cos(MOON_ANGLE) * Math.cos(moonElevation) * DOME_RADIUS * 0.9,
    Math.sin(moonElevation) * DOME_RADIUS * 0.9,
    Math.sin(MOON_ANGLE) * Math.cos(moonElevation) * DOME_RADIUS * 0.9,
  );
  moon.lookAt(0, 0, 0);
  root.add(moon);
  disposables.push(moonGeometry, moonMaterial);

  return {
    root,
    horizonColor: new THREE.Color(HORIZON[0] / 255, HORIZON[1] / 255, HORIZON[2] / 255),
    dispose() {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
  };
}
