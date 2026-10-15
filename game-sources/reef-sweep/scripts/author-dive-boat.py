"""Original Samfa12 dive skiff. Run with Blender --background --python this_file.
Blender metres: X starboard, Y bow, Z up. Runtime: X starboard, Y up, Z bow.
No external textures. GLB is the archival exchange asset; a deterministic colour
mesh bake feeds this game's existing offline Babylon source closure.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'art'/'dive-skiff'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name, colour, metallic=0, roughness=.5):
 m=bpy.data.materials.new(name);m.diffuse_color=(*colour,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*colour,1);bs.inputs['Metallic'].default_value=metallic;bs.inputs['Roughness'].default_value=roughness
 return m
ivory=material('Warm fibreglass',(.83,.86,.78),0,.32)
blue=material('Lantern teal hull',(.025,.18,.23),.12,.32)
rubber=material('Rubber and outboard graphite',(.025,.041,.048),.12,.36)
chrome=material('Brushed stainless fittings',(.55,.65,.65),.8,.26)
deck=material('Sand nonslip deck',(.48,.44,.32),0,.85)
teak=material('Weathered teak',(.38,.23,.12),0,.65)
glass=material('Blue smoked windshield',(.13,.32,.38),.35,.18)
orange=material('Rescue orange',(.88,.31,.075),0,.6)
canvas=material('Sea green bimini canvas',(.08,.28,.27),0,.9)
objects=[]
def finish(obj,name,mat,bevel=0):
 obj.name=name;obj.data.materials.append(mat)
 if bevel:
  mod=obj.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=2
  obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 objects.append(obj);return obj
def box(name,p,s,mat,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);obj=bpy.context.object;obj.scale=s
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(obj,name,mat,bevel)
def rod(name,a,b,r,mat,vertices=10):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(Vector(a)+Vector(b))*.5)
 obj=bpy.context.object;obj.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(obj,name,mat)
def curve(name,pts,r,mat):
 for i in range(len(pts)-1):rod(name,pts[i],pts[i+1],r,mat)
def mesh(name,verts,faces,mat):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);return finish(obj,name,mat)
# Lofted hard-chine hull, individual inner liner and genuine open cockpit.
sections=[(-3.0,1.07,.70),(-2.3,1.19,.68),(-1.2,1.25,.68),(0,1.23,.71),(1.2,1.05,.84),(2.2,.65,1.01),(2.85,.06,1.15)]
verts=[]
for y,w,h in sections:
 verts.extend([(-w,y,h),(-w*.92,y,.15),(-w*.55,y,-.23),(0,y,-.49),(w*.55,y,-.23),(w*.92,y,.15),(w,y,h)])
faces=[]
for i in range(len(sections)-1):
 for j in range(6):a=i*7+j;faces.append((a,a+1,a+8,a+7))
faces.append(tuple(range(6,-1,-1)))
mesh('Hand lofted V hull',verts,faces,blue)
for side in [-1,1]:
 inner=[]
 for y,w,h in sections:inner.extend([(side*w,y,h),(side*(w-.11),y,h-.03),(side*(w-.18),y,.30)])
 mesh('Cockpit inner liner',inner,[(i*3+j,i*3+j+1,(i+1)*3+j+1,(i+1)*3+j) for i in range(6) for j in range(2)],ivory)
 curve('Continuous rub rail',[(side*w,y,h-.08) for y,w,h in sections],.037,rubber)
 curve('Rounded gunwale',[(side*(w-.045),y,h+.015) for y,w,h in sections],.055,ivory)
box('Transom', (0,-2.95,.38),(2.05,.13,.66),ivory)
mesh('Nonslip cockpit sole',[(-.94,-2.8,.28),(.94,-2.8,.28),(.95,.9,.28),(.55,1.8,.31),(-.55,1.8,.31),(-.95,.9,.28)],[(0,1,2,3,4,5)],deck)
mesh('Raised foredeck',[(-.88,1.15,.82),(.88,1.15,.82),(.59,2.2,1.0),(0,2.76,1.11),(-.59,2.2,1.0)],[(0,1,2,3,4)],ivory)
box('Anchor hatch',(0,1.7,.94),(.70,.68,.055),ivory,.04)
box('Anchor hatch pull',(0,1.48,.98),(.16,.035,.025),chrome,.01)
# Centre console with sloping windshield, instruments and helm.
box('Helm console',(0,.30,.78),(.82,.86,.98),ivory,.08)
box('Instrument panel',(0,.02,1.28),(.70,.27,.07),rubber,.04)
for x in [-.19,0,.19]:
 rod('Round instrument bezel',(x,-.09,1.32),(x,-.09,1.34),.062,chrome,16)
 rod('Instrument glass',(x,-.09,1.34),(x,-.09,1.35),.048,glass,16)
mesh('One piece windshield',[(-.46,.19,1.25),(.46,.19,1.25),(.43,.48,1.83),(-.43,.48,1.83)],[(0,1,2,3)],glass)
curve('Windshield top surround',[(-.46,.19,1.25),(-.43,.48,1.83),(.43,.48,1.83),(.46,.19,1.25)],.018,chrome)
rod('Helm spindle',(0,-.16,1.03),(0,-.35,1.18),.035,chrome)
wheel=[]
for i in range(25):a=i/24*math.tau;wheel.append((math.sin(a)*.19,-.36,1.19+math.cos(a)*.19))
curve('Steering wheel',wheel,.018,rubber)
for a in [0,2.09,4.18]:rod('Wheel spoke',(0,-.36,1.19),(math.sin(a)*.18,-.36,1.19+math.cos(a)*.18),.012,chrome)
box('Throttle pedestal',(.48,-.05,.99),(.11,.23,.24),rubber)
rod('Throttle lever',(.48,-.05,1.1),(.48,-.12,1.31),.014,chrome)
# Proper bench, storage/ice chest, dive bottle rack, ladder, outboard.
box('Helm seat base',(0,-.87,.51),(.87,.65,.44),ivory,.07)
box('Helm cushion',(0,-.87,.77),(.90,.68,.15),deck,.07)
box('Helm backrest',(0,-1.19,1.03),(.90,.14,.45),deck,.06)
box('Catch ice chest',(-.61,-2.0,.55),(.60,1.0,.50),ivory,.06)
box('Ice chest lid',(-.61,-2.0,.84),(.65,1.04,.09),ivory,.025)
for y in [-2.3,-1.7]:box('Chest latches',(-.27,y,.75),(.03,.10,.10),chrome,.01)
for y in [-2.18,-1.72]:
 rod('Dive tank',(.68,y,.35),(.68,y,1.10),.13,chrome,16)
 rod('Tank valve',(.68,y,1.1),(.68,y,1.23),.035,rubber)
 box('Bottle retaining strap',(.68,y,.78),(.29,.29,.07),rubber,.015)
box('Outboard transom bracket',(0,-3.08,.18),(.42,.28,.48),chrome)
box('Outboard 90 cowl',(0,-3.37,.48),(.57,.62,.74),rubber,.12)
box('Outboard teal accent',(0,-3.39,.65),(.585,.48,.08),blue,.015)
rod('Lower drive leg',(0,-3.35,.18),(0,-3.36,-.70),.09,rubber)
box('Anti ventilation plate',(0,-3.39,-.48),(.55,.44,.035),rubber,.015)
rod('Propeller hub',(0,-3.44,-.70),(0,-3.67,-.70),.07,chrome)
for a in [0,2.09,4.18]:
 prop=box('Propeller blade',(math.sin(a)*.15,-3.61,-.70+math.cos(a)*.15),(.11,.045,.30),chrome,.03);prop.rotation_euler.y=a
for x in [.82,1.12]:rod('Boarding ladder', (x,-3.08,.65),(x,-3.13,-.62),.025,chrome)
for z in [-.46,-.16,.14,.44]:rod('Ladder rung',(.82,-3.13,z),(1.12,-3.13,z),.024,teak)
# Bimini, navigation lights, rails, cleats and ring buoy.
for x in [-.91,.91]:
 for y in [-1.37,.7]:rod('Bimini support',(x,y,.70),(x*.93,y,2.13),.026,chrome)
mesh('Tensioned bimini',[(-.98,-1.62,2.16),(.98,-1.62,2.16),(.98,.96,2.16),(-.98,.96,2.16),(0,-.33,2.26)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],canvas)
for side in [-1,1]:
 curve('Bow safety rail',[(side*.78,1.23,.99),(side*.68,1.63,1.33),(side*.42,2.21,1.46),(0,2.64,1.49)],.023,chrome)
 for y in [-2.65,1.3]:
  w=.98 if y<0 else .83
  rod('Mooring cleat',(side*w-.08,y,.83),(side*w+.08,y,.83),.025,chrome)
rod('Antenna',(.37,.7,1.3),(.37,.7,2.4),.009,chrome)
for i in range(24):
 a=i/24*math.tau;b=(i+1)/24*math.tau
 rod('Rescue ring',(math.sin(a)*.23,-1.28,1.06+math.cos(a)*.23),(math.sin(b)*.23,-1.28,1.06+math.cos(b)*.23),.048,orange)
# Apply modifiers, export named parts to GLB, bake one shared colour draw.
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
 obj.select_set(True);bpy.context.view_layer.objects.active=obj
 for mod in list(obj.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 obj.select_set(False)
for obj in objects:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'lantern-dive-skiff.glb'),use_selection=True,export_format='GLB')
data={'positions':[],'normals':[],'colors':[],'uvs':[],'indices':[]}
for obj in objects:
 me=obj.data;me.calc_loop_triangles();mat=obj.data.materials[0].diffuse_color[:3]
 for tri in me.loop_triangles:
  for vi in tri.vertices:
   v=obj.matrix_world@me.vertices[vi].co;n=obj.matrix_world.to_3x3()@tri.normal;n.normalize()
   data['indices'].append(len(data['positions'])//3)
   data['positions'].extend(round(float(x),4) for x in [v.x,v.z,v.y])
   data['normals'].extend(round(float(x),4) for x in [n.x,n.z,n.y])
   data['colors'].extend([*mat,1]);data['uvs'].extend([0,0])
src=ROOT/'src'/'render'/'assets';src.mkdir(exist_ok=True)
(src/'dive-skiff.ts').write_text('// Generated by Blender author-dive-boat.py. Metres, +Y up, +Z bow.\nexport const diveSkiff = '+json.dumps(data,separators=(',',':'))+';\n')
(OUT/'asset-manifest.json').write_text(json.dumps({'name':'Lantern dive skiff','origin':'Samfa12 original Blender model','units':'metres','runtimeAxes':'+Y up, +Z bow','triangles':len(data['indices'])//3,'draws':1,'textures':0,'collision':'XZ capsule, half width 1.3, half length 3.7; navigation simulation owns collision'},indent=2))
# Render evidence with studio environment; lights/camera are not in exports.
world=bpy.data.worlds.new('Soft marine studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.23,.28,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;bpy.context.scene.world=world
bpy.ops.object.light_add(type='AREA',location=(3,-1,7));bpy.context.object.data.energy=1400;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=7
bpy.ops.object.camera_add(location=(7,-10,7));camera=bpy.context.object;camera.rotation_euler=(Vector((0,-.2,.6))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=9.5
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1000;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.render.filepath=str(OUT/'blender-stern-quarter.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'lantern-dive-skiff.blend'))
bpy.ops.render.render(write_still=True)
camera.location=(6,9,5.8);camera.rotation_euler=(Vector((0,0,.65))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/'blender-bow-quarter.png');bpy.ops.render.render(write_still=True)
print('BOAT_ASSET',len(data['indices'])//3,'triangles')
