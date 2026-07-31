import * as THREE from "three";

import {
  addShadowFlags,
  createStandardMaterial,
  disposeObject,
  seededRandom,
  setObjectWireframe,
} from "./preview-utils";

export class ProceduralAltar {
  readonly root = new THREE.Group();
  private readonly energyLight: THREE.PointLight;
  private readonly glyphMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly motes: THREE.Points;

  constructor() {
    this.root.name = "procedural-altar";
    const stone = createStandardMaterial(0x45404b);
    stone.roughness = 0.92;
    const darkStone = createStandardMaterial(0x27232d);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 2.05, 0.46, 8), stone);
    plinth.position.y = 0.23;
    const middle = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 0.42, 8), darkStone);
    middle.position.y = 0.65;
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.3, 0.25, 12), stone);
    dais.position.y = 0.98;
    this.root.add(plinth, middle, dais);

    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2;
      const pillar = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.25, 0.28), darkStone);
      shaft.position.y = 1.58;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 5), stone);
      cap.position.y = 2.46;
      pillar.position.set(Math.sin(angle) * 1.18, 0, Math.cos(angle) * 1.18);
      pillar.rotation.y = angle;
      pillar.rotation.z = index % 2 === 0 ? 0.06 : -0.04;
      pillar.add(shaft, cap);
      this.root.add(pillar);
    }

    const glyphMaterial = new THREE.MeshStandardMaterial({
      color: 0x482f62,
      emissive: 0x1b0b28,
      emissiveIntensity: 0.2,
      metalness: 0.1,
      roughness: 0.45,
    });
    this.glyphMaterials.push(glyphMaterial);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.055, 6, 32), glyphMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.125;
    this.root.add(ring);

    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.32), glyphMaterial);
      glyph.position.set(Math.sin(angle) * 0.55, 1.15, Math.cos(angle) * 0.55);
      glyph.rotation.y = angle;
      this.root.add(glyph);
    }

    const positions = new Float32Array(36 * 3);
    const random = seededRandom(0xa17a);
    for (let index = 0; index < 36; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 0.25 + random() * 0.85;
      positions[index * 3] = Math.sin(angle) * radius;
      positions[index * 3 + 1] = 1.2 + random() * 1.8;
      positions[index * 3 + 2] = Math.cos(angle) * radius;
    }
    const moteGeometry = new THREE.BufferGeometry();
    moteGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.motes = new THREE.Points(
      moteGeometry,
      new THREE.PointsMaterial({
        blending: THREE.AdditiveBlending,
        color: 0xb55cff,
        depthWrite: false,
        opacity: 0,
        size: 0.085,
        transparent: true,
      }),
    );
    this.root.add(this.motes);

    this.energyLight = new THREE.PointLight(0xa448ff, 0, 6, 2);
    this.energyLight.position.y = 1.42;
    this.energyLight.castShadow = true;
    this.root.add(this.energyLight);
    addShadowFlags(this.root);
  }

  dispose(): void {
    disposeObject(this.root);
  }

  setDebug(options: Readonly<{ wireframe: boolean }>): void {
    setObjectWireframe(this.root, options.wireframe);
  }

  update(elapsedSeconds: number, strength: number): void {
    const pulse = 0.72 + Math.sin(elapsedSeconds * 5.5) * 0.28;
    const energy = THREE.MathUtils.clamp(strength, 0, 1) * pulse;
    for (const material of this.glyphMaterials) {
      material.emissive.setHex(strength > 0.04 ? 0x6d1aaa : 0x1b0b28);
      material.emissiveIntensity = 0.2 + energy * 3.8;
    }
    this.energyLight.intensity = energy * 18;
    this.motes.rotation.y += 0.002 + strength * 0.012;
    const material = this.motes.material;
    if (material instanceof THREE.PointsMaterial) {
      material.opacity = strength * 0.82;
    }
  }
}

export class ProceduralMortar {
  readonly barrel: THREE.Group;
  readonly muzzle = new THREE.Object3D();
  readonly pitch = new THREE.Group();
  readonly recoil = new THREE.Group();
  readonly root = new THREE.Group();
  readonly yaw = new THREE.Group();

  constructor() {
    this.root.name = "procedural-mortar";
    const iron = createStandardMaterial(0x3d4850);
    iron.metalness = 0.68;
    iron.roughness = 0.34;
    const brass = createStandardMaterial(0xa57b35);
    brass.metalness = 0.62;
    brass.roughness = 0.3;
    const wood = createStandardMaterial(0x4e3325);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 1.08, 0.34, 10), iron);
    base.position.y = 0.17;
    const turntable = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.7, 0.22, 12), brass);
    turntable.position.y = 0.45;
    this.root.add(base, this.yaw);
    this.yaw.position.y = 0.44;
    this.yaw.add(turntable, this.pitch);
    this.pitch.position.y = 0.2;
    this.pitch.add(this.recoil);

    this.barrel = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.38, 1.75, 12, 1, true), iron);
    tube.position.y = 0.86;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.075, 6, 12), brass);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.72;
    const darkMuzzle = new THREE.Mesh(
      new THREE.CircleGeometry(0.235, 12),
      new THREE.MeshBasicMaterial({ color: 0x0b0d0e }),
    );
    darkMuzzle.rotation.x = -Math.PI / 2;
    darkMuzzle.position.y = 1.726;
    const breech = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), iron);
    breech.scale.y = 0.72;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, 0.15), wood);
    handle.position.set(0.48, 0.22, 0);
    handle.rotation.z = -0.35;
    this.muzzle.position.y = 1.82;
    this.barrel.add(tube, collar, darkMuzzle, breech, handle, this.muzzle);
    this.recoil.add(this.barrel);
    this.pitch.rotation.x = Math.PI * 0.31;
    addShadowFlags(this.root);
  }

  aimAt(target: THREE.Vector3): void {
    const localTarget = target.clone().sub(this.root.position);
    this.yaw.rotation.y = Math.atan2(localTarget.x, localTarget.z);
  }

  dispose(): void {
    disposeObject(this.root);
  }

  setDebug(options: Readonly<{ wireframe: boolean }>): void {
    setObjectWireframe(this.root, options.wireframe);
  }
}
