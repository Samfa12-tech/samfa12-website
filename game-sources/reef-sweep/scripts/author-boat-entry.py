"""Original Reef Sweep crew and backward entry. Blender 4.3; no dependencies.
Reconstructs exact existing skiff from neighbouring script, preserving source.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
# Reuse geometry portion, no redundant export/render.
source=(ROOT/'scripts/author-dive-boat.py').read_text()
exec(compile(source.split('# Apply modifiers')[0],str(ROOT/'scripts/author-dive-boat.py'),'exec'))
OUT=ROOT/'art/boat-entry';OUT.mkdir(parents=True,exist_ok=True)
boat_objects=list(objects)
# Apply original bevels for correct source geometry and render.
for ob in boat_objects:
 bpy.context.view_layer.objects.active=ob
 for md in list(ob.modifiers):bpy.ops.object.modifier_apply(modifier=md.name)
objects=[]
def col(name,h):return material(name,tuple(int(h[i:i+2],16)/255 for i in (0,2,4)),0,.7)
suit=col('Wetsuit established 20434c','20434c');rub=col('Gloves established 102b32','102b32');seam=col('Seams established 59b9a9','59b9a9');skin=col('Warm skin','b87753');shirt=col('Pilot sand shirt','b7a779');mask=col('Mask smoked teal','32616b');fin=col('Fin sea green','438d83')
crew=[]
def empty(name,p=(0,0,0),parent=None):
 ob=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(ob);ob.location=p;ob.parent=parent;return ob
def sphere(name,p,s,mat,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=1,location=p);ob=bpy.context.object;ob.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(ob,name,mat);ob.parent=parent;crew.append(ob);return ob
def limb(name,a,b,r,mat,parent):
 ob=rod(name,a,b,r,mat,10);ob.parent=parent;crew.append(ob);return ob
def block(name,p,s,mat,parent):
 ob=box(name,p,s,mat,0);ob.parent=parent;crew.append(ob);return ob
arms={}
leg_roots=[]
def person(prefix,root,diver):
 m=suit if diver else shirt
 sphere(prefix+' pelvis',(0,0,.05),(.20,.23,.15),rub,root)
 sphere(prefix+' torso',(-.035,0,.35),(.18,.255,.30),m,root)
 sphere(prefix+' neck',(-.02,0,.64),(.065,.075,.08),skin,root)
 sphere(prefix+' head',(-.015,0,.78),(.115,.125,.155),rub if diver else skin,root)
 if diver:
  block(prefix+' mask frame',(.101,0,.81),(.07,.24,.105),rub,root)
  block(prefix+' lenses',(.140,0,.816),(.012,.195,.068),mask,root)
  sphere(prefix+' regulator',(.14,0,.71),(.056,.06,.045),rub,root)
  limb(prefix+' air cylinder',(-.255,0,.12),(-.255,0,.60),.105,chrome,root)
  for y in [-.175,.175]:limb(prefix+' BCD shoulder strap',(-.09,y,.61),(.10,y,.16),.045,rub,root)
  block(prefix+' weight belt',(.015,0,.11),(.35,.48,.065),rub,root)
  # Flexible-looking fixed regulator loop, remains attached throughout roll.
  for i in range(8):
   a=i/8*math.pi;b=(i+1)/8*math.pi
   limb(prefix+' regulator hose',(-.08+.24*math.cos(a),-.22,.53+.17*math.sin(a)),(-.08+.24*math.cos(b),-.22,.53+.17*math.sin(b)),.013,rub,root)
 else:
  sphere(prefix+' cap',(-.025,0,.895),(.126,.137,.065),blue,root)
  block(prefix+' cap brim',(.12,0,.88),(.20,.24,.025),blue,root)
  block(prefix+' sunglasses',(.102,0,.81),(.035,.21,.05),rub,root)
 for side in [-1,1]:
  y=side*.15
  lp=empty(prefix+' leg pivot '+str(side),parent=root) if diver else root
  if diver:leg_roots.append(lp)
  limb(prefix+' thigh '+str(side),(.03,y,.035),(.50,y,0),.105,rub,lp)
  limb(prefix+' shin '+str(side),(.50,y,0),(.52,y,-.48),.077,suit if diver else deck,lp)
  sphere(prefix+' foot '+str(side),(.62,y,-.49),(.15,.085,.065),rub,lp)
  if diver:block(prefix+' fin '+str(side),(.84,y,-.49),(.37,.19,.035),fin,lp)
  shoulder=(0,side*.25,.51);elbow=(.15,side*.31,.28);hand=(.35,side*.22,.24)
  up=limb(prefix+' upper arm '+str(side),shoulder,elbow,.073,m,root)
  low=limb(prefix+' forearm '+str(side),elbow,hand,.061,suit if diver else skin,root)
  palm=sphere(prefix+' hand '+str(side),hand,(.075,.055,.055),rub if diver else skin,root)
  arms[(prefix,side)]=(up,low,palm,shoulder)
pilot=empty('Pilot seated root',(0,-.92,.96));pilot.rotation_euler.z=math.pi/2;person('Pilot',pilot,False)
diver=empty('Diver entry root',(-.66,-2.10,1.00));person('Diver',diver,True)
# Rod meshes are authored at origin-aligned Z; animate endpoints via transforms.
def pose_arm(prefix,side,elbow,hand,frame):
 up,low,palm,shoulder=arms[(prefix,side)]
 for ob,a,b in [(up,shoulder,elbow),(low,elbow,hand)]:
  old=ob.dimensions.z # mesh local cylinder depth is fixed; use vertex range instead
  depth=max(v.co.z for v in ob.data.vertices)-min(v.co.z for v in ob.data.vertices)
  d=Vector(b)-Vector(a);ob.location=(Vector(a)+Vector(b))*.5;ob.rotation_euler=d.to_track_quat('Z','Y').to_euler();ob.scale.z=d.length/depth
  for path in ['location','rotation_euler','scale']:ob.keyframe_insert(path,frame=frame)
 palm.location=hand;palm.keyframe_insert('location',frame=frame)
for s in [-1,1]:pose_arm('Pilot',s,(.23,s*.28,.30),(.49,s*.15,.28),1)
# 24 fps, 3.6 seconds. Sitting on icechest -> scoot to gunwale -> lean/roll.
keys=[(1,(-.66,-2.10,1.00),0),(20,(-.66,-2.10,1.00),0),(34,(-.70,-2.10,1.02),0),(46,(-1.16,-2.10,1.03),-.10),(54,(-1.35,-2.10,1.02),-.55),(64,(-1.67,-2.10,.73),-1.55),(73,(-1.96,-2.10,.10),-2.40),(87,(-2.10,-2.10,-.90),-2.8)]
for frame,pos,angle in keys:
 diver.location=pos;diver.rotation_euler.y=angle;diver.keyframe_insert('location',frame=frame);diver.keyframe_insert('rotation_euler',frame=frame)
for frame in [1,10,20,34,46,54,64,73,87]:
 for s in [-1,1]:
  # One hand secures mask/regulator; other checks chest/straps then braces gear.
  if frame<10:el=(.15,s*.31,.28);ha=(.35,s*.22,.24)
  elif s==-1:el=(.25,-.31,.49);ha=(.18,-.035,.76)
  else:el=(.22,.30,.30);ha=(.13,.10,.39)
  pose_arm('Diver',s,el,ha,frame)
for leg in leg_roots:
 for f,a in [(1,0),(22,0),(34,-.85),(46,-.85),(64,-.65),(87,-.65)]:
  leg.rotation_euler.y=a;leg.keyframe_insert('rotation_euler',frame=f)
for ob in [diver]+leg_roots+crew:
 if ob.animation_data and ob.animation_data.action:
  for fc in ob.animation_data.action.fcurves:
   for kp in fc.keyframe_points:kp.interpolation='LINEAR'
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=87;scene.render.fps=24;scene.frame_set(1)
# Runtime geometry + world matrix bake uses exact axis conjugation S*M*S.
S=Matrix(((1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))
def geometry(ob):
 me=ob.data;me.calc_loop_triangles();rgb=list(me.materials[0].diffuse_color);g={k:[] for k in ['positions','normals','colors','uvs','indices']}
 for tri in me.loop_triangles:
  # Swapping Y/Z changes handedness, reverse winding for correct outward normals.
  for vi in reversed(tri.vertices):
   p=me.vertices[vi].co;n=tri.normal;g['positions'] += [round(x,5) for x in (p.x,p.z,p.y)];g['normals'] += [round(x,5) for x in (n.x,n.z,n.y)];g['colors']+=rgb;g['uvs'] += [0,0];g['indices'].append(len(g['indices']))
 return g
def matrix(ob):
 m=S@ob.matrix_world@S
 return [round(m[r][c],6) for c in range(4) for r in range(4)]
parts=[{'name':ob.name,'actor':'diver' if ob.name.startswith('Diver') else 'pilot','geometry':geometry(ob)} for ob in crew]
frames=[]
for f in range(1,88,2):
 scene.frame_set(f);frames.append({'time':round((f-1)/24,6),'matrices':[matrix(ob) for ob in crew]})
data={'duration':86/24,'fps':12,'axes':'+Y up +Z bow; column-major matrices, boat-local','parts':parts,'frames':frames,'events':{'gearCheck':.375,'rollStart':1.875,'waterContact':2.65,'submerged':3.583333},'idleFrame':0}
(ROOT/'src/render/assets/boat-entry.ts').write_text('// Blender-authored rigid-part clip. Apply geometry and per-part boat-local matrix.\nexport const boatEntry = '+json.dumps(data,separators=(',',':'))+';\n')
(OUT/'boat-entry.json').write_text(json.dumps(data,separators=(',',':')))
scene.frame_set(1);bpy.ops.object.select_all(action='DESELECT')
for ob in crew+[pilot,diver]+leg_roots:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'reef-crew-entry.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='SCENE',export_frame_range=True,export_force_sampling=True)
# Consolidate simultaneous rigid-part actions into one standard GLB clip.
import struct
glb=OUT/'reef-crew-entry.glb';raw=glb.read_bytes();size,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+size]);tail=raw[20+size:]
merged={'name':'BoatEntry','channels':[],'samplers':[]}
for action in doc.get('animations',[]):
 offset=len(merged['samplers']);merged['samplers']+=action['samplers']
 for channel in action['channels']:
  channel['sampler']+=offset;merged['channels'].append(channel)
doc['animations']=[merged];encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
glb.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
# Studio evidence includes original skiff, waterline at Blender Z=-.20 (runtime boat+.20).
world=bpy.data.worlds.new('Marine soft studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.21,.25,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;scene.world=world
bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));bpy.context.object.data.energy=1600;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=7
bpy.ops.object.camera_add(location=(-6,-8,5));cam=bpy.context.object;cam.rotation_euler=(Vector((-.4,-1.25,.9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=5.4;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=False;scene.render.resolution_x=800;scene.render.resolution_y=650;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'reef-crew-entry.blend'))
for f,label in [(1,'seated'),(25,'gear-check'),(57,'backward-roll'),(69,'water-entry')]:
 scene.frame_set(f);scene.render.filepath=str(OUT/('preview-'+label+'.png'));bpy.ops.render.render(write_still=True)
(OUT/'manifest.json').write_text(json.dumps({'sourceCommit':'ed337e47ae7a9a4c50ede668ce3b2b15daac1aa2','origin':'Original crew authored in Blender; existing original skiff reconstructed unchanged','crewTriangles':sum(len(p['geometry']['indices'])//3 for p in parts),'parts':len(parts),'frames':len(frames),'textures':0,'duration':86/24,'clip':'BoatEntry','notes':'Boat not included in crew GLB. Blender contains reference boat. Runtime bake includes crew only, world transforms relative to boat origin. Hide diver after submerged; retain pilot. Mask check, chest check, back roll. No splash mesh, runtime supplies water/splash/fade.'},indent=2))
print('COMPLETE',len(parts),'parts',sum(len(p['geometry']['indices'])//3 for p in parts),'triangles')
