/**
 * The shipped renderer's light, as shaders.
 *
 * The first build of this experiment gave the floor a physical lighting model — an ambient term, a
 * point light for the torch, inverse-square falloff, and a tone curve to stop it blowing out. Judged
 * against a recording of the real game it came out too dark and too cold, and the reason turned out
 * not to be calibration. **The Canvas renderer has no physical model to approximate.** It has four
 * short analytic formulas, one per surface class, and they are the look. So this module runs those
 * formulas rather than something that resembles them, and every constant below is quoted from
 * `src/presentation/canvas-gameplay-renderer.ts` rather than chosen.
 *
 * Three consequences worth stating, because all three are surprising and all three are deliberate:
 *
 * Every number is an sRGB byte over 255, and none of it is colour-managed. The Canvas renderer
 * composites `rgba(13, 5, 24, fog)` onto a canvas — that arithmetic happens on sRGB-encoded values,
 * and the same sums performed on linearised ones give a visibly different, darker picture. So the
 * textures are uploaded unmanaged, the colours arrive as raw triples, and the fragment writes what
 * it computed with no conversion on the way out.
 *
 * Walls and floors never read the light list. Their warmth is a function of distance to the eye and
 * nothing else — the lightmap that would pool a placed light onto masonry exists in the renderer and
 * is switched off everywhere. Only bodies, pickups and effects consult the lights.
 *
 * Structures take no warmth at all. A box is distance-shaded by its face and that is the whole of it.
 * Anything that looks warm near an altar looks that way because the altar's own colour is warm.
 */

import * as THREE from "three";

/** Beyond this everything is fully fogged. `MAX_DEPTH` in the Canvas renderer. */
const MAX_DEPTH = 18;

/** How many placed lights a frame can carry. Well above what a floor holds; costs a loop, not a recompile. */
const MAX_LIGHTS = 24;

/** The ink every surface class fades toward with distance. */
const FOG_INK = "vec3(13.0, 5.0, 24.0) / 255.0";

/** What a wall is washed with near the eye, and the flat term a floor adds. */
const WALL_TORCH_INK = "vec3(255.0, 112.0, 35.0) / 255.0";
const PLANE_FOG_FLAT = "vec3(18.0, 11.0, 28.0) / 255.0";
const PLANE_TORCH_GAIN = "vec3(31.0, 12.0, -3.0) / 255.0";

/** The warmth a body takes when no placed light reaches it. `DEFAULT_TORCH_COLOR`. */
const DEFAULT_TORCH = "vec3(255.0, 112.0, 45.0) / 255.0";

export type SceneLight = Readonly<{
  x: number;
  y: number;
  radius: number;
  intensity: number;
  /** Packed as the renderer holds it: 0-255 per channel. */
  color: readonly [number, number, number];
}>;

/**
 * What every material shares: where the eye is, how far along the flicker is, and the light list.
 *
 * The uniform objects are handed out by reference, so one write here reaches every material built by
 * this module — which is what lets the light list grow past the four a forward renderer's real
 * lights would have cost.
 */
type SharedUniforms = {
  uElapsed: { value: number };
  uLightCount: { value: number };
  uLights: { value: THREE.Vector4[] };
  uLightColors: { value: THREE.Vector4[] };
};

const COMMON_GLSL = `
uniform float uElapsed;
uniform int uLightCount;
uniform vec4 uLights[${MAX_LIGHTS}];
uniform vec4 uLightColors[${MAX_LIGHTS}];

varying vec3 vWorldPos;
varying float vDepth;

/** The torch's own tremor. One term, slow, and the same one the walls and the floor both read. */
float torchFlicker() {
  return 0.96 + sin(uElapsed * 7.1) * 0.025;
}

/**
 * How warm a point is and what colour that warmth is.
 *
 * A base that falls off with distance to the eye, raised by whichever placed light reaches it
 * hardest — not summed. The renderer takes the strongest single light and its colour, which is why a
 * body standing between two lamps takes one of them rather than a blend.
 */
vec4 warmthAt(vec3 world, float depth) {
  float warmth = clamp(1.0 - depth / 7.0, 0.0, 0.42);
  vec3 warmColor = ${DEFAULT_TORCH};

  for (int index = 0; index < ${MAX_LIGHTS}; index += 1) {
    if (index >= uLightCount) {
      break;
    }

    vec4 placed = uLights[index];
    float distanceTo = distance(placed.xz, world.xz);
    float reach = clamp(1.0 - distanceTo / max(placed.w, 0.0001), 0.0, 1.0) * uLightColors[index].a;

    if (reach > warmth) {
      warmth = reach;
      warmColor = uLightColors[index].rgb;
    }
  }

  return vec4(warmColor, min(warmth, 1.0));
}
`;

/**
 * The vertex half, shared by every kind.
 *
 * `vDepth` is perpendicular view depth, which is what the raycaster means by distance: its rays are
 * fisheye-corrected, so its "distance" is already the projection onto the view axis.
 */
const VERTEX_GLSL = `
#include <common>
#include <skinning_pars_vertex>

varying vec3 vWorldPos;
varying float vDepth;
varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  vUv = uv;

  // Skinning through three's own chunks rather than by hand. They are no-ops unless the renderer
  // defines USE_SKINNING, which it does per object for a skinned mesh whatever material it wears —
  // so one vertex shader serves the armature and the masonry both.
  vec3 objectNormal = vec3(normal);
  vec3 transformed = vec3(position);
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>

  vec4 local = vec4(transformed, 1.0);
  vec3 localNormal = objectNormal;

  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
    localNormal = mat3(instanceMatrix) * localNormal;
  #endif

  vec4 world = modelMatrix * local;
  vWorldPos = world.xyz;
  vec4 viewPosition = viewMatrix * world;
  vDepth = -viewPosition.z;
  vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
  gl_Position = projectionMatrix * viewPosition;
}
`;

/**
 * Which of the three face shades a surface wears.
 *
 * The renderer's box pass gives an east or west face full value, a north or south face 0.78, and a
 * top face its own brighter colour. The wall pass says the same thing in different words — its
 * `side === 0` hits are the ones crossing an x boundary. One convention, applied by normal.
 */
const FACE_SHADE_GLSL = `
float faceShade(vec3 normalWorld) {
  if (abs(normalWorld.y) > 0.5) {
    return -1.0;
  }

  return abs(normalWorld.x) > 0.5 ? 1.0 : 0.78;
}
`;

function fragmentFor(body: string, extraUniforms = ""): string {
  return `
${extraUniforms}
${COMMON_GLSL}
${FACE_SHADE_GLSL}

varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
${body}
}
`;
}

/**
 * Masonry.
 *
 * Two composites over the texture, in order, exactly as `#tintedWallTexture` performs them: the fog
 * ink at an alpha that rises with distance and with the face's own darkening, then the torch wash at
 * up to 0.16. No light list, because the lightmap that would consult one is switched off.
 */
const WALL_FRAGMENT = fragmentFor(
  `
  vec4 texel = texture2D(uMap, vUv);
  float shade = faceShade(vWorldNormal);
  float sideDarkening = shade < 0.0 ? 0.0 : (1.0 - shade) * 0.15;
  float fog = clamp(clamp(vDepth / ${MAX_DEPTH}.0, 0.0, 0.88) + sideDarkening, 0.0, 1.0);
  vec3 color = mix(texel.rgb, ${FOG_INK}, fog);
  float torch = clamp(1.15 - vDepth / 7.5, 0.0, 1.0) * torchFlicker();
  color = mix(color, ${WALL_TORCH_INK}, torch * 0.16);
  gl_FragColor = vec4(color, 1.0);
`,
  "uniform sampler2D uMap;",
);

/**
 * Ground.
 *
 * Additive rather than a composite, and that is not a stylistic difference — the renderer's plane
 * pass writes `texel * fog + flat * (1 - fog) + gain * torch` per pixel, and the third term has a
 * negative blue. A floor near the torch therefore goes warm by losing blue as well as by gaining red.
 */
const PLANE_FRAGMENT = fragmentFor(
  `
  vec4 texel = texture2D(uMap, vUv);
  float fog = clamp(1.0 - vDepth / ${MAX_DEPTH}.0, 0.12, 1.0);
  float torch = clamp(1.2 - vDepth / 8.0, 0.0, 1.0) * torchFlicker();
  vec3 color = texel.rgb * fog + ${PLANE_FOG_FLAT} * (1.0 - fog) + ${PLANE_TORCH_GAIN} * torch;
  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
`,
  "uniform sampler2D uMap;",
);

/**
 * Structures.
 *
 * Distance and face, and nothing else. A top face takes its own brighter colour — the renderer's
 * `brighten(color, 1.28)` — and every side takes the flat one.
 */
const BOX_FRAGMENT = fragmentFor(
  `
  float shade = faceShade(vWorldNormal);
  vec3 source = shade < 0.0 ? min(uColor * 1.28, vec3(1.0)) : uColor;
  float level = clamp(1.0 - vDepth / ${MAX_DEPTH}.0, 0.2, 1.0) * (shade < 0.0 ? 1.0 : shade);
  gl_FragColor = vec4(source * level, 1.0);
`,
  "uniform vec3 uColor;",
);

/**
 * Bodies built from blocks.
 *
 * The face convention of a structure, because that is what a block body is, over the light response
 * of a sprite, because that is what a body was: the renderer's `#litImage` mixes toward the fog ink
 * by distance and then toward the warm colour at 0.22. The flash a hit raises lands last and full
 * strength, so a struck body reads from across an unlit room.
 */
const BODY_FRAGMENT = fragmentFor(
  `
  float shade = mix(1.0, faceShade(vWorldNormal), uFaceted);
  vec3 albedo = shade < 0.0 ? min(uColor * 1.28, vec3(1.0)) : uColor * shade;
  vec4 warm = warmthAt(vWorldPos, vDepth);
  vec3 color = mix(albedo, ${FOG_INK}, clamp(vDepth / ${MAX_DEPTH}.0, 0.0, 0.82));
  color = mix(color, warm.rgb, warm.a * 0.22);
  color = mix(color, vec3(1.0), uFlash);
  gl_FragColor = vec4(color, 1.0);
`,
  "uniform vec3 uColor;\nuniform float uFlash;",
);

/**
 * Everything drawn from a picture: pickups, particles, plumes, markers, trails.
 *
 * `#litImage` verbatim — fog ink by distance to 0.82, then the warm colour at 0.22 — with the
 * texture's own alpha carried through, because every one of these is a cut-out over the scene.
 */
const SPRITE_FRAGMENT = fragmentFor(
  `
  vec2 frame = uUvRect.xy + vUv * uUvRect.zw;
  vec4 texel = texture2D(uMap, frame);

  if (texel.a < 0.01) {
    discard;
  }

  vec4 warm = warmthAt(vWorldPos, vDepth);
  vec3 color = mix(texel.rgb * uTint, ${FOG_INK}, clamp(vDepth / ${MAX_DEPTH}.0, 0.0, 0.82));
  color = mix(color, warm.rgb, warm.a * 0.22);
  gl_FragColor = vec4(color, texel.a * uOpacity);
`,
  "uniform sampler2D uMap;\nuniform vec3 uTint;\nuniform float uOpacity;\nuniform vec4 uUvRect;",
);

/**
 * Everything small and numerous.
 *
 * A flat filled circle, which is what the renderer's particle pass literally draws — `arc` and
 * `fill`, one colour, one alpha, optionally additive. The first build made these tiny points and
 * lost most of the atmosphere with them: a dust puff is a large translucent disc, and a dozen of
 * them overlapping is the smoke a broken wall leaves.
 *
 * Distance-faded and nothing else — no fog ink, no warmth. A spark stays the colour it was lit.
 */
const PARTICLE_VERTEX_GLSL = `
varying vec3 vWorldPos;
varying float vDepth;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vParticleColor;
varying float vParticleAlpha;

attribute float aAlpha;

void main() {
  vUv = uv;
  vParticleColor = vec3(1.0);
  vParticleAlpha = aAlpha;

  #ifdef USE_INSTANCING_COLOR
    vParticleColor = instanceColor;
  #endif

  vec4 local = vec4(0.0, 0.0, 0.0, 1.0);
  vec2 span = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));

  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
    span *= vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
  #endif

  vec2 offset = span * position.xy;

  vec4 world = modelMatrix * local;
  vWorldPos = world.xyz;
  vec4 viewPosition = viewMatrix * world;
  viewPosition.xy += offset;
  vDepth = -viewPosition.z;
  vWorldNormal = vec3(0.0, 1.0, 0.0);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const PARTICLE_FRAGMENT = `
${COMMON_GLSL}

varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vParticleColor;
varying float vParticleAlpha;

void main() {
  // The disc is computed rather than sampled, so its edge is exactly the one a canvas arc leaves.
  float radius = length(vUv - 0.5);
  float edge = 1.0 - smoothstep(0.47, 0.5, radius);

  if (edge <= 0.01 || vParticleAlpha <= 0.002) {
    discard;
  }

  float fade = clamp(1.0 - vDepth / ${MAX_DEPTH}.0, 0.15, 1.0);
  gl_FragColor = vec4(vParticleColor * fade, vParticleAlpha * edge);
}
`;

/**
 * A billboard's vertex half, which differs from the shared one in exactly one way: the quad is
 * turned to face the eye before it is placed, so a puff of dust is a disc from wherever it is seen.
 *
 * The turn is done on the model-view matrix rather than by rebuilding geometry per frame — the
 * rotation part is replaced with the identity, which is the standard way of saying "keep the
 * translation, drop the orientation".
 */
const BILLBOARD_VERTEX_GLSL = `
varying vec3 vWorldPos;
varying float vDepth;
varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 local = vec4(0.0, 0.0, 0.0, 1.0);
  // The quad's own size, taken from whichever matrix carries it — the mesh's when it stands alone,
  // the instance's when it is one of many. Reading the raw vertex offset here was a real defect:
  // every billboard came out one cell across whatever scale it had been given, so a wind-up marker
  // authored at a fifth of a cell drew the size of the body it was floating over.
  vec2 span = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));

  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
    span *= vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
  #endif

  vec2 offset = span * position.xy;
  vec4 world = modelMatrix * local;
  vWorldPos = world.xyz;
  vec4 viewPosition = viewMatrix * world;
  viewPosition.xy += offset;
  vDepth = -viewPosition.z;
  vWorldNormal = vec3(0.0, 1.0, 0.0);
  gl_Position = projectionMatrix * viewPosition;
}
`;

/**
 * A hex colour as three raw sRGB fractions.
 *
 * `THREE.Color` would linearise it, which is right for a physically lit scene and wrong here: the
 * formulas these feed were written against bytes.
 */
function rawColor(hex: number): THREE.Vector3 {
  return new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
}

export class SceneLighting {
  private readonly shared: SharedUniforms = {
    uElapsed: { value: 0 },
    uLightCount: { value: 0 },
    uLights: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
    uLightColors: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
  };

  /** Masonry: one material per wall texture. */
  wall(map: THREE.Texture): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { ...this.shared, uMap: { value: map } },
      vertexShader: VERTEX_GLSL,
      fragmentShader: WALL_FRAGMENT,
    });
  }

  /** Ground: one material per floor texture. */
  plane(map: THREE.Texture): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { ...this.shared, uMap: { value: map } },
      vertexShader: VERTEX_GLSL,
      fragmentShader: PLANE_FRAGMENT,
    });
  }

  /** A structure, in one flat colour. */
  box(color: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { ...this.shared, uColor: { value: rawColor(color) } },
      vertexShader: VERTEX_GLSL,
      fragmentShader: BOX_FRAGMENT,
    });
  }

  /**
   * A body, with its own hit flash.
   *
   * `faceted` decides whether the box convention applies. A block skeleton wants it — flat faces are
   * what make it read as built from blocks. A rounded body does not: on a sphere the top-face rule
   * finds every upward-facing facet and brightens it, which caps the thing in white.
   */
  body(color: number, faceted = true): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        ...this.shared,
        uColor: { value: rawColor(color) },
        uFlash: { value: 0 },
        uFaceted: { value: faceted ? 1 : 0 },
      },
      vertexShader: VERTEX_GLSL,
      fragmentShader: BODY_FRAGMENT,
    });
  }

  /**
   * Something drawn from a picture.
   *
   * `billboard` turns the quad to face the eye, which is what everything soft wants; geometry that
   * is already oriented — a ground glow lying flat, a wall mark — passes false.
   */
  sprite(
    map: THREE.Texture,
    options: Readonly<{ billboard?: boolean; depthWrite?: boolean; tint?: number; opacity?: number }> = {},
  ): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        ...this.shared,
        uMap: { value: map },
        uTint: { value: rawColor(options.tint ?? 0xffffff) },
        uOpacity: { value: options.opacity ?? 1 },
        // Which cell of a strip to read. Whole texture by default; a wind-up marker that fills as it
        // charges narrows this to one frame of eight.
        uUvRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      },
      vertexShader: options.billboard ? BILLBOARD_VERTEX_GLSL : VERTEX_GLSL,
      fragmentShader: SPRITE_FRAGMENT,
      transparent: true,
      depthWrite: options.depthWrite ?? false,
    });
  }

  /**
   * Dots: dust, chips, embers, trails, sight lines, beacons.
   *
   * `additive` is the renderer's own `globalCompositeOperation = "lighter"`, which is what makes a
   * sight line brighten the room rather than darken with distance like an opaque rod would.
   */
  particle(additive: boolean): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { ...this.shared },
      vertexShader: PARTICLE_VERTEX_GLSL,
      fragmentShader: PARTICLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
  }

  /**
   * Puts this frame's light list where every material can read it.
   *
   * The list is the scene's own — the torch first, then whatever the floor's fittings are throwing —
   * and it is uploaded whole rather than culled to the nearest few, because a loop over an unused
   * uniform slot costs a comparison and culling costs a body going dark as the player walks.
   */
  update(elapsedSeconds: number, lights: readonly SceneLight[]): void {
    this.shared.uElapsed.value = elapsedSeconds;
    const count = Math.min(lights.length, MAX_LIGHTS);
    this.shared.uLightCount.value = count;

    for (let index = 0; index < count; index += 1) {
      const light = lights[index]!;
      this.shared.uLights.value[index]!.set(light.x, 0, light.y, light.radius);
      this.shared.uLightColors.value[index]!.set(
        light.color[0] / 255,
        light.color[1] / 255,
        light.color[2] / 255,
        light.intensity,
      );
    }
  }
}
