import { Geometry } from './geometry.js';
import { LIONFISH_MESH } from './assets/lionfish-mesh.js';
import type { LionfishDefense } from './lionfish-defense.js';

/** Copy only during scene/bench construction. World fish share one GPU geometry. */
export function lionfishGeometry(scale = 1) {
    const g = new Geometry();
    g.positions = LIONFISH_MESH.positions.map(v => v * scale);
    g.normals = LIONFISH_MESH.normals.slice(); g.colors = LIONFISH_MESH.colors.slice();
    g.uvs = LIONFISH_MESH.uvs.slice(); g.indices = LIONFISH_MESH.indices.slice();
    return g;
}

/** Mesh._draw invokes this after the selected colour/depth effect is bound.
 * Set the actual effect every draw, even when Babylon reuses a shared material. */
export function bindLionfishDraw(mesh: any, engine: any, state: LionfishDefense) {
    mesh.onBeforeDrawObservable.add(() => {
        const value = mesh.material?._reefMode === 2 ? state.value : 0;
        engine._currentEffect?.setFloat('uLionfishDefense', value);
        mesh._lionfishBindings[engine.currentRenderPassId] = value;
    });
}
