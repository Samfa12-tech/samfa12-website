// Animate the existing authored flame on the GPU. One shared material and one
// texture serve every sconce/brazier; world position gives each its own phase.
export const FIRE_VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 viewProjection;
#include<instancesDeclaration>
varying vec2 vUV;
varying vec3 vWorld;
varying float vPhase;
void main(void) {
  #include<instancesVertex>
  vec4 worldPosition = finalWorld * vec4(position, 1.0);
  vUV = uv;
  vWorld = worldPosition.xyz;
  vPhase = finalWorld[3].x * 0.71 + finalWorld[3].z * 0.37;
  gl_Position = viewProjection * worldPosition;
}`;

export const FIRE_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D flameSampler;
uniform float fireTime;
uniform float motionAmount;
uniform float fogDensity;
uniform vec3 fogColor;
uniform vec3 cameraPosition;
varying vec2 vUV;
varying vec3 vWorld;
varying float vPhase;
void main(void) {
  float t = fireTime + vPhase;
  float tip = smoothstep(0.12, 0.95, vUV.y);
  vec2 flowUV = vUV;
  // Rising waves bend the tongues while the fuel-contact point stays fixed.
  flowUV.x += (sin(vUV.y * 18.0 - t * 6.2) * 0.042
    + sin(vUV.y * 31.0 - t * 9.7) * 0.021) * tip * motionAmount;
  flowUV.y += sin(vUV.y * 24.0 - t * 5.6) * 0.026
    * sin(vUV.y * 3.14159265) * motionAmount;
  // Match StandardMaterial's authored image orientation: the bright fuel base
  // sits on the holder and the wispy tip rises above it.
  vec4 fire = texture2D(flameSampler, clamp(vec2(flowUV.x, 1.0 - flowUV.y), 0.0, 1.0));
  float pulse = 0.94 + sin(t * 5.7) * 0.04 + sin(t * 9.1) * 0.02;
  float tongues = 1.0 - tip * 0.14 * (0.5 + 0.5 * sin(vUV.x * 28.0 + vUV.y * 21.0 - t * 8.0));
  float alpha = fire.a * tongues;
  if (alpha < 0.08) discard;
  float distanceToEye = length(vWorld - cameraPosition);
  float fog = clamp(exp(-fogDensity * fogDensity * distanceToEye * distanceToEye), 0.0, 1.0);
  vec3 color = fire.rgb * pulse * vec3(1.08, 0.98, 0.89);
  gl_FragColor = vec4(mix(fogColor, color, fog), alpha * 0.98);
}`;

export function createAnimatedFireMaterial(BABYLON, scene, texture) {
  const material = new BABYLON.ShaderMaterial('animated-defensive-fire-mat', scene, {
    vertexSource: FIRE_VERTEX_SHADER, fragmentSource: FIRE_FRAGMENT_SHADER,
  }, {
    attributes: ['position', 'uv'],
    uniforms: ['world', 'viewProjection', 'fireTime', 'motionAmount', 'fogDensity', 'fogColor', 'cameraPosition'],
    samplers: ['flameSampler'],
    needAlphaBlending: true,
  });
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  material.setTexture('flameSampler', texture);
  material.setFloat('fireTime', 0);
  material.setFloat('motionAmount', 1);
  const update = (now, camera, reducedMotion = false) => {
    material.setFloat('fireTime', now);
    material.setFloat('motionAmount', reducedMotion ? 0.24 : 1);
    material.setFloat('fogDensity', scene.fogDensity);
    material.setColor3('fogColor', scene.fogColor);
    material.setVector3('cameraPosition', camera.position);
  };
  return {material, update};
}
