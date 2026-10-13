// Do not edit.
import { ShaderStore } from "../../Engines/shaderStore";
const name = "fogVertex";
const shader = `#ifdef FOG
vFogDistance=(view*worldPos).xyz;
#endif
`;
// Sideeffect
if (!ShaderStore.IncludesShadersStore[name]) {
    ShaderStore.IncludesShadersStore[name] = shader;
}
/** @internal */
export const fogVertex = { name, shader };
