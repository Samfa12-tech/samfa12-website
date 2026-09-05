// A single opaque background draw: local cloud data is generated once and the
// sun follows the existing directional light rather than adding another light.
export const DAY_SKY = Object.freeze({
  textureWidth: 512,
  textureHeight: 256,
  sunDirection: Object.freeze([0.2, 0.9, 0.3]),
  cloudDriftPerSecond: 0.00012,
});

function smoothstep(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function lattice(x, y, period) {
  const wrapped = ((x % period) + period) % period;
  let seed = Math.imul(wrapped + 173, 374761393) ^ Math.imul(y + 7919, 668265263);
  seed = Math.imul(seed ^ (seed >>> 13), 1274126177);
  return ((seed ^ (seed >>> 16)) >>> 0) / 4294967295;
}

function cloudNoise(u, v, period) {
  const x = u * period;
  const y = v * period * 0.7;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smoothstep(0, 1, x - ix), fy = smoothstep(0, 1, y - iy);
  const lower = lattice(ix, iy, period) * (1 - fx) + lattice(ix + 1, iy, period) * fx;
  const upper = lattice(ix, iy + 1, period) * (1 - fx) + lattice(ix + 1, iy + 1, period) * fx;
  return lower * (1 - fy) + upper * fy;
}

/** Deterministic, horizontally seamless cloud cover; never rebuilt per frame. */
export function createDayCloudTextureData(width = DAY_SKY.textureWidth, height = DAY_SKY.textureHeight) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1), v = y / Math.max(1, height - 1);
      const coarse = cloudNoise(u, v, 12);
      const detail = cloudNoise(u, v, 24) * 0.25 + cloudNoise(u, v, 48) * 0.12 + cloudNoise(u, v, 96) * 0.06;
      const density = smoothstep(0.46, 0.70, coarse * 0.57 + detail);
      const offset = (y * width + x) * 4;
      pixels[offset] = Math.round(density * 255);
      pixels[offset + 1] = Math.round((0.48 + smoothstep(0.16, 0.36, detail) * 0.52) * 255);
      pixels[offset + 2] = 0;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

export function daySkySunDirection(direction = DAY_SKY.sunDirection) {
  const values = Array.isArray(direction) ? direction : [direction?.x, direction?.y, direction?.z];
  const magnitude = Math.hypot(...values);
  return Number.isFinite(magnitude) && magnitude > 0
    ? values.map(value => value / magnitude)
    : daySkySunDirection(DAY_SKY.sunDirection);
}

const VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vSkyDirection;
void main(void) {
  vSkyDirection = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
  // Behind world geometry at every camera position, inside the far clip plane.
  gl_Position.z = gl_Position.w * 0.999999;
}`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec3 vSkyDirection;
uniform sampler2D cloudTexture;
uniform vec3 sunDirection;
uniform vec3 horizonColor;
uniform float cloudOffset;
void main(void) {
  vec3 direction = normalize(vSkyDirection);
  float altitude = max(0.0, direction.y);
  vec3 haze = vec3(0.70, 0.76, 0.72);
  vec3 zenith = vec3(0.22, 0.43, 0.57);
  vec3 sky = mix(haze, zenith, pow(altitude, 0.55));
  // The horizon shares the world fog colour; the dome itself must not be fogged.
  sky = mix(horizonColor, sky, smoothstep(-0.025, 0.16, direction.y));
  float alignment = max(0.0, dot(direction, sunDirection));
  sky += vec3(0.22, 0.17, 0.08) * pow(alignment, 12.0);
  vec2 uv = vec2(atan(direction.z, direction.x) / 6.2831853 + 0.5 + cloudOffset,
    asin(clamp(direction.y, -1.0, 1.0)) / 3.14159265 + 0.5);
  vec2 clouds = texture2D(cloudTexture, uv).rg;
  float cloudCover = clouds.r * smoothstep(0.015, 0.19, altitude)
    * (1.0 - smoothstep(0.86, 1.0, altitude));
  vec3 cloudColor = mix(vec3(0.62, 0.69, 0.68), vec3(0.91, 0.91, 0.80), clouds.g);
  cloudColor += vec3(0.08, 0.065, 0.025) * pow(alignment, 6.0);
  sky = mix(sky, cloudColor, cloudCover * 0.82);
  float halo = pow(alignment, 320.0) * 0.32;
  float disc = smoothstep(0.99984, 0.99994, alignment);
  float sunVisibility = 1.0 - cloudCover * 0.78;
  sky += vec3(1.0, 0.73, 0.33) * halo * sunVisibility;
  sky = mix(sky, vec3(1.0, 0.96, 0.76), disc * sunVisibility);
  gl_FragColor = vec4(sky, 1.0);
}`;

export function createDaySky(BABYLON, scene, {sunDirection = DAY_SKY.sunDirection} = {}) {
  const texture = BABYLON.RawTexture.CreateRGBATexture(
    createDayCloudTextureData(), DAY_SKY.textureWidth, DAY_SKY.textureHeight,
    scene, false, false, BABYLON.Texture.BILINEAR_SAMPLINGMODE,
  );
  texture.name = 'briar-day-clouds';
  texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  texture.gammaSpace = false;
  const material = new BABYLON.ShaderMaterial('briar-day-sky-material', scene,
    {vertexSource: VERTEX_SHADER, fragmentSource: FRAGMENT_SHADER}, {
      attributes: ['position'],
      uniforms: ['worldViewProjection', 'sunDirection', 'horizonColor', 'cloudOffset'],
      samplers: ['cloudTexture'],
    });
  const direction = daySkySunDirection(sunDirection);
  material.setVector3('sunDirection', new BABYLON.Vector3(...direction));
  material.setColor3('horizonColor', BABYLON.Color3.FromHexString('#708b82'));
  material.setFloat('cloudOffset', 0);
  material.setTexture('cloudTexture', texture);
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  material.fogEnabled = false;
  const mesh = BABYLON.MeshBuilder.CreateSphere('briar-day-sky', {diameter: 2, segments: 16}, scene);
  mesh.infiniteDistance = true;
  mesh.isPickable = false;
  mesh.checkCollisions = false;
  mesh.applyFog = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.renderingGroupId = 0;
  mesh.material = material;
  mesh.setEnabled(false);
  let enabled = false;
  let cloudOffset = 0;
  return {
    setPresentationProfile(profile) {
      enabled = String(typeof profile === 'string' ? profile : profile?.key ?? '').startsWith('day');
      mesh.setEnabled(enabled);
      if (profile?.fogColor) material.setColor3('horizonColor', BABYLON.Color3.FromHexString(profile.fogColor));
    },
    // World time is in seconds. Reduced motion fixes clouds at their initial pose.
    update(now, {reducedMotion = false} = {}) {
      if (!enabled) return;
      const time = Number.isFinite(now) ? Math.max(0, now) : 0;
      cloudOffset = reducedMotion ? 0 : (time * DAY_SKY.cloudDriftPerSecond) % 1;
      material.setFloat('cloudOffset', cloudOffset);
    },
    diagnostics() {
      return {enabled, sunDirection: [...direction], cloudOffset,
        textureSize: [DAY_SKY.textureWidth, DAY_SKY.textureHeight],
        textureBytes: DAY_SKY.textureWidth * DAY_SKY.textureHeight * 4, drawCalls: enabled ? 1 : 0};
    },
    dispose() {
      mesh.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
