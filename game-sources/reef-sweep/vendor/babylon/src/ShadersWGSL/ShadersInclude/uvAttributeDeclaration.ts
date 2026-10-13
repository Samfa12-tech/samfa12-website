// Do not edit.
import { ShaderStore } from "../../Engines/shaderStore";
const name = "uvAttributeDeclaration";
const shader = `#if defined(UV{X}) && !defined(USE_VERTEX_PULLING)
attribute uv{X}: vec2f;
#endif
`;
// Sideeffect
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
    ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
/** @internal */
export const uvAttributeDeclarationWGSL = { name, shader };
