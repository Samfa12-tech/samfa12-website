// Do not edit.
import { ShaderStore } from "../../Engines/shaderStore";
const name = "logDepthFragment";
const shader = `#ifdef LOGARITHMICDEPTH
fragmentOutputs.fragDepth=log2(fragmentInputs.vFragmentDepth)*uniforms.logarithmicDepthConstant*0.5;
#endif
`;
// Sideeffect
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
    ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
/** @internal */
export const logDepthFragmentWGSL = { name, shader };
