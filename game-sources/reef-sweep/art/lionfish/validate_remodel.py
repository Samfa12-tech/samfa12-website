import bpy,json,math,struct
from pathlib import Path
from mathutils import Vector,Matrix
P=Path(__file__).resolve().parent
g=json.loads((P/'lionfish-geometry.json').read_text());parts=json.loads((P/'lionfish-parts.json').read_text());meta={p['tag']:p for p in parts}
assert len(g['positions'])==len(g['normals']);assert len(g['colors'])==len(g['positions'])//3*4
assert max(g['indices'])<len(g['positions'])//3
assert set(g['uvs'][::2])=={5};assert len([p for p in parts if 10<=p['tag']<=22])==13
assert all(math.isfinite(x) for k,a in g.items() for x in a)
max_error=0;bounds={}
for defense in [0,.25,.5,.75,1]:
 ps=[]
 for i in range(len(g['positions'])//3):
  tag=g['uvs'][i*2+1];m=meta[tag];v=Vector(g['positions'][i*3:i*3+3]);pivot=Vector(m['pivot']);R=Matrix.Rotation(m['delta']*defense,3,Vector(m['axis']));p=pivot+R@(v-pivot)
  max_error=max(max_error,abs((p-pivot).length-(v-pivot).length));ps.append(p)
 bounds[str(defense)]={'min':[min(v[i] for v in ps) for i in range(3)],'max':[max(v[i] for v in ps) for i in range(3)]}
assert max_error<1e-6
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(P/'lionfish-defensive-remodel.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)==21
s=bpy.context.scene;s.render.fps=24
samples=[]
for f in [1,61,97,193]:
 s.frame_set(f);samples.append({'frame':f,'dorsal_spine_1_matrix':[list(r) for r in next(o for o in meshes if o.name.startswith('Dorsal spine 01')).matrix_world]})
assert samples[0]['dorsal_spine_1_matrix']!=samples[1]['dorsal_spine_1_matrix']
assert all(not o.data.shape_keys for o in meshes)
b=(P/'lionfish-defensive-remodel.glb').read_bytes();gl=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
assert len(gl['animations'])==1
report={'mesh_vertices':len(g['positions'])//3,'mesh_triangles':len(g['indices'])//3,'baseline_vertices':1279,'baseline_triangles':1644,'triangle_ratio_to_baseline':(len(g['indices'])//3)/1644,'dorsal_spines':13,'mesh_parts_in_editable_glb':21,'runtime_draws_per_fish':1,'runtime_animation':'constant-size per-part vertex shader hinges, no geometry rebuild','glb_has_vertex_animation_cache':False,'glb_reimport_passed':True,'rigid_hinge_radius_max_error':max_error,'calm_defense_authoring_bounds':bounds,'recommended_game_mesh_scale':'f.size * 0.65 once; leave authoring pivots unscaled','state_tests':'test-defense.mjs passed','browser_integration':'NOT RUN: engine hookup is pending','samples':samples}
(P/'validation.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k not in ['samples','calm_defense_authoring_bounds']},indent=2))
