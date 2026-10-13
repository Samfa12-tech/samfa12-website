// Do not edit.
import { ShaderStore } from "../../Engines/shaderStore";
const name = "fogVertexDeclaration";
const shader = `#ifdef FOG
varying vec3 vFogDistance;
#endif
`;
// Sideeffect
if (!ShaderStore.IncludesShadersStore[name]) {
    ShaderStore.IncludesShadersStore[name] = shader;
}
/** @internal */
export const fogVertexDeclaration = { name, shader };
