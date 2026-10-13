// Do not edit.
import { ShaderStore } from "../../Engines/shaderStore";
const name = "mainUVVaryingDeclaration";
const shader = `#ifdef MAINUV{X}
varying vec2 vMainUV{X};
#endif
`;
// Sideeffect
if (!ShaderStore.IncludesShadersStore[name]) {
    ShaderStore.IncludesShadersStore[name] = shader;
}
/** @internal */
export const mainUVVaryingDeclaration = { name, shader };
