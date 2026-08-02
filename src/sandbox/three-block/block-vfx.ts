import * as THREE from "three";

/**
 * The arc a swing leaves behind, swept along wherever the weapon's tip actually went.
 *
 * It reads the tip's world position each frame rather than being told the shape of the swing, so a
 * table edited to chop differently gets a different arc without anybody updating this file. That
 * matters more than it sounds: the thesis this workbench tests is that key poses plus an effect
 * carry a strike, so an arc that could drift out of agreement with the pose would be testing the
 * wrong pipeline.
 *
 * Drawn by the presentation side rather than baked into the asset, because that is where it lives
 * in the shipped game — the demo's renderer already draws its own blade arcs.
 */
export class SwingArc {
  readonly root = new THREE.Group();

  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.MeshBasicMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly trail: THREE.Vector3[] = [];

  /** How many sampled tip positions the ribbon spans. Short: a smear, not a ribbon dancer. */
  private readonly span = 10;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xdfe8ff,
      depthWrite: false,
      side: THREE.DoubleSide,
      transparent: true,
      vertexColors: true,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 30;
    this.root.add(this.mesh);
    this.clear();
  }

  clear(): void {
    this.trail.length = 0;
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(0), 3));
    this.mesh.visible = false;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  /**
   * Feed the tip's position and the hand it swings from; the fan spans between them.
   *
   * A ribbon along the tip alone would be a wire. Building each quad between the hand and the tip
   * gives the swept area a blade actually covers, which is what reads at forty pixels.
   */
  sample(hand: THREE.Vector3, tip: THREE.Vector3): void {
    this.trail.push(hand.clone(), tip.clone());

    while (this.trail.length > this.span * 2) {
      this.trail.splice(0, 2);
    }

    const segments = this.trail.length / 2 - 1;

    if (segments < 1) {
      this.mesh.visible = false;
      return;
    }

    const positions = new Float32Array(segments * 6 * 3);
    const colours = new Float32Array(segments * 6 * 3);

    for (let index = 0; index < segments; index += 1) {
      const nearOld = this.trail[index * 2]!;
      const farOld = this.trail[index * 2 + 1]!;
      const nearNew = this.trail[index * 2 + 2]!;
      const farNew = this.trail[index * 2 + 3]!;
      const corners = [nearOld, farOld, farNew, nearOld, farNew, nearNew];
      // Older samples fade, so the smear trails behind the blade rather than sitting around it.
      const olderFade = (index / segments) ** 2;
      const newerFade = ((index + 1) / segments) ** 2;
      const fades = [olderFade, olderFade, newerFade, olderFade, newerFade, newerFade];

      for (let corner = 0; corner < 6; corner += 1) {
        const target = (index * 6 + corner) * 3;
        positions.set(corners[corner]!.toArray(), target);
        const fade = fades[corner]!;
        colours.set([fade, fade * 0.94, fade * 0.8], target);
      }
    }

    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    this.geometry.attributes.position!.needsUpdate = true;
    this.mesh.visible = true;
  }
}
