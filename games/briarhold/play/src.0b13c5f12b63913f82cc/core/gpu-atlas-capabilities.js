export const GPU_ATLAS_STATE_MODES = Object.freeze(['off', 'auto', 'force']);

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function normalizeGpuAtlasStateMode(value, legacyAtlas = false) {
  if (legacyAtlas) return 'off';
  const normalized = String(value || 'auto').trim().toLowerCase();
  return GPU_ATLAS_STATE_MODES.includes(normalized) ? normalized : 'auto';
}
export function inspectGpuAtlasCapabilities(input = {}) {
  const reasons = [];
  const warnings = [];
  const webGLVersion = Math.max(1, Math.floor(finite(input.webGLVersion, 1)));
  const maxVertexTextureImageUnits = Math.max(
    0,
    Math.floor(finite(input.maxVertexTextureImageUnits))
  );
  const maxVertexAttributes = Math.max(
    0,
    Math.floor(finite(input.maxVertexAttributes))
  );
  const maxTextureSize = Math.max(0, Math.floor(finite(input.maxTextureSize)));
  const maxVaryingVectors = Math.max(
    0,
    Math.floor(finite(input.maxVaryingVectors))
  );
  const vertexHighFloatPrecision = Math.max(
    0,
    Math.floor(finite(input.vertexHighFloatPrecision))
  );
  const textureFloat = input.textureFloat === true;
  const textureHalfFloat = input.textureHalfFloat === true;
  const rawTexture = input.rawTexture === true;
  const thinInstanceCustomAttributes = input.thinInstanceCustomAttributes === true;
  const partialBufferUpdates = input.partialBufferUpdates === true;

  if (maxVertexTextureImageUnits < 1) {
    reasons.push('vertex texture sampling is unavailable');
  }
  if (!textureFloat && !textureHalfFloat) {
    reasons.push('neither float nor half-float textures are available');
  }
  if (!rawTexture) reasons.push('Babylon RawTexture is unavailable');
  if (!thinInstanceCustomAttributes) {
    reasons.push('thin-instance custom attributes are unavailable');
  }
  if (!partialBufferUpdates) {
    reasons.push('thin-instance partial buffer updates are unavailable');
  }
  if (maxVertexAttributes < 9) {
    reasons.push(`only ${maxVertexAttributes} vertex attributes are available; 9 required`);
  }
  if (maxTextureSize < 128) {
    reasons.push(`maximum texture size ${maxTextureSize} is below 128`);
  }
  if (maxVaryingVectors < 1) {
    reasons.push('no varying vectors are available');
  }
  if (vertexHighFloatPrecision < 16) {
    reasons.push(
      `vertex highp float precision ${vertexHighFloatPrecision} is below 16 bits`
    );
  }
  if (webGLVersion < 2 && textureFloat) {
    warnings.push('WebGL 1 float vertex textures require driver validation');
  }

  return {
    supported: reasons.length === 0,
    reasons,
    warnings,
    webGLVersion,
    maxVertexTextureImageUnits,
    maxVertexAttributes,
    maxTextureSize,
    maxVaryingVectors,
    vertexHighFloatPrecision,
    textureType: textureFloat ? 'float' : textureHalfFloat ? 'half-float' : null,
    textureFloat,
    textureHalfFloat,
    rawTexture,
    thinInstanceCustomAttributes,
    partialBufferUpdates
  };
}

export function decideGpuAtlasState(modeValue, capabilities) {
  const mode = normalizeGpuAtlasStateMode(modeValue);
  const supported = capabilities?.supported === true;
  if (mode === 'off') {
    return {
      mode,
      attempt: false,
      enabled: false,
      forced: false,
      reason: 'disabled by gpuAtlasState=off'
    };
  }
  if (mode === 'force') {
    return {
      mode,
      attempt: true,
      enabled: supported,
      forced: true,
      reason: supported
        ? 'forced GPU atlas state; capability checks passed'
        : `forced GPU atlas attempt despite: ${(capabilities?.reasons || []).join('; ')}`
    };
  }
  return {
    mode,
    attempt: supported,
    enabled: supported,
    forced: false,
    reason: supported
      ? 'automatic GPU atlas capability checks passed'
      : `automatic GPU atlas disabled: ${(capabilities?.reasons || []).join('; ')}`
  };
}
