import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix
P=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
C=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
CREAM=(.89,.80,.63,1);RED=(.32,.085,.045,1);RUST=(.49,.19,.10,1);DARK=(.055,.035,.022,1);WEB=(.59,.46,.31,1)
parts=[]
def stripe(x,y,z):
 phase=z*43+y*4+math.sin(y*13)*.38
 return CREAM if math.sin(phase)>.05 else RED
class Part:
 def __init__(self,name,tag=0,pivot=(0,0,0),axis=(0,1,0),calm=0,flare=0,idle=0):
  self.name=name;self.tag=tag;self.pivot=Vector(pivot);self.axis=Vector(axis);self.calm=calm;self.flare=flare;self.idle=idle;self.v=[];self.c=[];self.f=[];parts.append(self)
 def vertex(self,v,c):self.v.append(tuple(v));self.c.append(c);return len(self.v)-1
 def tri(self,a,b,c):self.f.append((a,b,c))
 def quad(self,a,b,c,d):self.f.extend([(a,b,c),(a,c,d)])
 def rod(self,a,b,r1,r2,color=CREAM,n=5,steps=1,banded=False):
  a=Vector(a);b=Vector(b);d=(b-a).normalized();u=d.cross(Vector((1,0,0)) if abs(d.y)>.9 else Vector((0,1,0))).normalized();v=d.cross(u);st=len(self.v)
  for j in range(steps+1):
   t=j/steps;r=r1+(r2-r1)*t
   for k in range(n):
    p=a.lerp(b,t)+(u*math.cos(k/n*2*math.pi)+v*math.sin(k/n*2*math.pi))*r
    self.vertex(p,CREAM if banded and j%2 else color)
  for j in range(steps):
   for k in range(n):self.quad(st+j*n+k,st+j*n+(k+1)%n,st+(j+1)*n+(k+1)%n,st+(j+1)*n+k)
 def ell(self,p,r,color,seg=16,rings=9,paint=None):
  st=len(self.v)
  for j in range(rings+1):
   a=j/rings*math.pi
   for i in range(seg):
    b=i/seg*2*math.pi;v=(p[0]+math.sin(a)*math.cos(b)*r[0],p[1]+math.cos(a)*r[1],p[2]+math.sin(a)*math.sin(b)*r[2]);self.vertex(v,paint(*v) if paint else color)
  for j in range(rings):
   for i in range(seg):self.quad(st+j*seg+i,st+j*seg+(i+1)%seg,st+(j+1)*seg+(i+1)%seg,st+(j+1)*seg+i)
body=Part('Body — deep chest, tapered peduncle')
# Continuous longitudinal profile, tail to fleshy upper jaw.
profile=[(-.80,.037,.050,-.025),(-.65,.075,.090,-.01),(-.48,.115,.155,.015),(-.28,.18,.235,.025),(-.04,.24,.30,.015),(.17,.255,.305,0),(.34,.235,.26,-.015),(.47,.18,.20,-.055),(.58,.115,.12,-.075),(.65,.075,.07,-.075)]
def prof(z):
 for a,b in zip(profile,profile[1:]):
  if a[0]<=z<=b[0]:
   t=(z-a[0])/(b[0]-a[0]);return [a[i]+(b[i]-a[i])*t for i in range(1,4)]
 return list(profile[-1][1:])
N=48;M=24
for j in range(N+1):
 z=-.8+j/N*1.45;w,h,cy=prof(z)
 for i in range(M):
  a=i/M*2*math.pi;x=w*math.sin(a);y=cy+h*math.cos(a);body.vertex((x,y,z),stripe(x,y,z))
for j in range(N):
 for i in range(M):body.quad(j*M+i,j*M+(i+1)%M,(j+1)*M+(i+1)%M,(j+1)*M+i)
# Recessed lateral eyes, bony cheek/operculum, mouth and fleshy cirri.
for side in [-1,1]:
 body.ell((side*.193,.095,.415),(.030,.038,.038),RUST,12,7)
 body.ell((side*.212,.102,.428),(.018,.025,.022),DARK,12,8)
 body.ell((side*.225,.109,.434),(.006,.008,.007),(.8,.72,.49,1),8,5)
 for i in range(6):
  a=i/6*math.pi*.8;aa=(i+1)/6*math.pi*.8
  body.rod((side*(.215+math.sin(a)*.025),.16-math.sin(a)*.32,.31-math.cos(a)*.04),(side*(.215+math.sin(aa)*.025),.16-math.sin(aa)*.32,.31-math.cos(aa)*.04),.009,.008,RED)
 body.rod((side*.18,.14,.42),(side*.22,.29,.46),.015,.008,RUST,5,3,True)
 body.rod((side*.22,.29,.46),(side*.215,.34,.50),.008,.001,CREAM,5)
 body.rod((side*.065,-.125,.60),(side*.10,-.245,.60),.012,.002,RUST,5,4,True)
 body.rod((side*.145,-.075,.50),(side*.20,-.16,.52),.011,.002,CREAM,5)
body.ell((0,-.08,.638),(.086,.019,.022),DARK,18,6)
body.ell((0,-.111,.625),(.089,.025,.039),RUST,18,6, stripe)
# Pectoral fans. Fleshy membranes occupy the basal fan; separated filament tips.
for side,tag in [(-1,1),(1,2)]:
 root=(side*.20,-.04,.24);p=Part(('Left' if side<0 else 'Right')+' pectoral fan',tag,root,(0,1,0),side*.65,-side*.10,.035*side)
 tips=[]
 for i in range(16):
  a=-1.17+i/15*2.34
  tips.append(Vector(root)+Vector((side*(.44+.21*math.cos(a)),.46*math.sin(a)-.12,-.48-.27*math.cos(a))))
 for i in range(15):
  # Strip tessellation lets spot/banding remain visible without textures.
  for j in range(5):
   t0=j/5*.83;t1=(j+1)/5*.83
   ids=[]
   for t,tip in [(t0,tips[i]),(t0,tips[i+1]),(t1,tips[i+1]),(t1,tips[i])]:
    v=Vector(root).lerp(tip,t);c=CREAM if j%2==0 else RUST
    if j==4 and i%3==1:c=DARK
    ids.append(p.vertex(v,c))
   p.quad(*ids)
 for i,tip in enumerate(tips):p.rod(root,tip,.009,.0015,RUST,4,6,True)
# Thirteen independently hinged venomous dorsal spines; narrow basal sheaths.
for i in range(13):
 z=.30-i*.064;w,h,cy=prof(z);root=(0,cy+h*.94,z);length=.36+.26*math.sin((i+1)/14*math.pi)
 p=Part('Dorsal spine %02d'%(i+1),10+i,root,(1,0,0),-.48,.13,0)
 tip=Vector(root)+Vector((math.sin(i*.7)*.018,length,-.12-i*.004))
 p.rod(root,tip,.012,.0013,RUST,5,6,True)
 v0=p.vertex(root,RED);v1=p.vertex(Vector(root).lerp(tip,.58),CREAM);v2=p.vertex(Vector(root)+Vector((0,.07,-.055)),RUST);p.tri(v0,v1,v2)
# Pelvic fans and their leading spines, paired below the chest.
for side,tag in [(-1,3),(1,4)]:
 root=(side*.12,-.205,.12);p=Part(('Left' if side<0 else 'Right')+' pelvic fin',tag,root,(0,0,1),side*-.25,side*.25,.025*side)
 tips=[Vector(root)+Vector((side*(.11+.1*math.sin(i/6*math.pi)),-.22-.10*math.sin(i/6*math.pi),-.10-i*.05)) for i in range(7)]
 for i in range(6):
  a=p.vertex(root,RED);b=p.vertex(tips[i],CREAM if i%2 else RUST);c=p.vertex(tips[i+1],CREAM if i%2 else RUST);p.tri(a,b,c)
 for i,t in enumerate(tips):p.rod(root,t,.008 if i==0 else .004,.001,RUST,4,4,True)
# Rounded caudal fan, soft posterior dorsal and anal fins.
def softfan(name,tag,root,points,axis=(0,1,0),idle=.04):
 p=Part(name,tag,root,axis,0,0,idle)
 for i in range(len(points)-1):
  for j in range(4):
   t0=j/4;t1=(j+1)/4;ids=[]
   for t,tip in [(t0,points[i]),(t0,points[i+1]),(t1,points[i+1]),(t1,points[i])]:
    v=Vector(root).lerp(Vector(tip),t);color=DARK if j==2 and i%3==0 else CREAM if j%2==0 else WEB;ids.append(p.vertex(v,color))
   p.quad(*ids)
 for pt in points:p.rod(root,pt,.004,.001,RUST,4,3,True)
 return p
tailpts=[(.012*math.sin(i),.27*math.sin(-1.1+i/12*2.2)-.02,-.80-.31*math.cos(-1.1+i/12*2.2)) for i in range(13)]
softfan('Caudal fin — rounded spotted tail',5,(0,-.025,-.76),tailpts,idle=.12)
softfan('Soft posterior dorsal',6,(0,.12,-.45),[(0,.18+math.sin(i/10*math.pi)*.19,-.40-i*.035) for i in range(11)],(0,0,1),.035)
softfan('Anal soft fin',7,(0,-.105,-.43),[(0,-.16-math.sin(i/7*math.pi)*.16,-.37-i*.05) for i in range(8)],(0,0,1),.035)
for i in range(3):body.rod((0,-.15,-.23-i*.045),(0,-.36+i*.025,-.33-i*.05),.008,.001,RUST,5,4,True)
mat=bpy.data.materials.new('Maroon ivory stripes and spotted fins');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.64
vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';mat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
root=bpy.data.objects.new('Lionfish remodel — calm to defensive',None);bpy.context.collection.objects.link(root)
runtime={'positions':[],'normals':[],'colors':[],'uvs':[],'indices':[]};partmeta=[]
for p in parts:
 # Local pivot allows true hinge rotation with constant ray/spine lengths.
 verts=[C@(Vector(v)-p.pivot) for v in p.v];mesh=bpy.data.meshes.new(p.name);mesh.from_pydata(verts,[],p.f);mesh.update()
 ob=bpy.data.objects.new(p.name,mesh);bpy.context.collection.objects.link(ob);ob.parent=root;ob.location=C@p.pivot
 ob.rotation_mode='AXIS_ANGLE';ax=C@p.axis;ob.rotation_axis_angle=(p.calm,*ax);p.ob=ob
 ca=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
 for cc,c in zip(ca.data,p.c):cc.color_srgb=c
 mesh.materials.append(mat)
 # Fix face orientation locally; membranes are intentionally double sided.
 for poly in mesh.polygons:poly.use_smooth=True
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');ob.select_set(False)
 R=Matrix.Rotation(p.calm,3,p.axis);offset=len(runtime['positions'])//3
 for v,n,c in zip(p.v,mesh.vertices,p.c):
  q=p.pivot+R@(Vector(v)-p.pivot);normal=R@(C.transposed()@n.normal)
  runtime['positions'].extend(round(a,6) for a in q);runtime['normals'].extend(round(a,6) for a in normal);runtime['colors'].extend(c);runtime['uvs'].extend((5,p.tag))
 for poly in mesh.polygons:runtime['indices'].extend(offset+i for i in poly.vertices)
 partmeta.append({'name':p.name,'tag':p.tag,'pivot':list(p.pivot),'axis':list(p.axis),'calm':p.calm,'flare':p.flare,'delta':p.flare-p.calm,'idleAmplitude':p.idle})
(P/'lionfish-geometry.json').write_text(json.dumps(runtime,separators=(',',':')))
(P/'lionfish-parts.json').write_text(json.dumps(partmeta,indent=2))
# Calm, approach, defense hold, withdrawal and calm. Defense is a demo scalar, not a gameplay state change.
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def defense(t):return smooth((t-1.3)/1.2)*(1-smooth((t-5.0)/1.5))
s=bpy.context.scene;s.render.fps=24;s.frame_start=1;s.frame_end=193
for f in range(1,194):
 t=(f-1)/24;d=defense(t)
 root.location=(0,0,.018*math.sin(t*1.4));root.rotation_euler=(0,.045*math.sin(t*.8),0);root.keyframe_insert('location',frame=f);root.keyframe_insert('rotation_euler',frame=f)
 for p in parts:
  a=p.calm+(p.flare-p.calm)*d+p.idle*math.sin(t*2.1+p.tag*.7)
  p.ob.rotation_axis_angle[0]=a;p.ob.keyframe_insert('rotation_axis_angle',frame=f)
for a in bpy.data.actions:
 for fc in a.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
s.frame_set(1);bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for p in parts:p.ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(P/'lionfish-defensive-remodel.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='SCENE',export_force_sampling=True,export_frame_range=True)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.8,-2.9,1.45));cam=bpy.context.object;aim(cam,(0,.12,.08));cam.data.type='ORTHO';cam.data.ortho_scale=3.05;s.camera=cam
for name,loc,energy,size in [('Key',(1,-3,4),260,3),('Fill',(-3,-1,1),130,3),('Rim',(0,3,3),320,2)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,0))
s.world.use_nodes=True;s.world.node_tree.nodes.get('Background').inputs[0].default_value=(.025,.06,.075,1);s.world.node_tree.nodes.get('Background').inputs[1].default_value=.4
s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=False;s.render.threads_mode='FIXED';s.render.threads=6;s.render.resolution_x=800;s.render.resolution_y=640;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG'
bpy.context.view_layer.objects.active=root;bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(P/'lionfish-defensive-remodel.blend'),compress=True)
for frame,name in [(1,'calm'),(85,'defensive')]:
 s.frame_set(frame);s.render.filepath=str(P/(name+'.png'));bpy.ops.render.render(write_still=True)
(P/'build-stats.json').write_text(json.dumps({'vertices':len(runtime['positions'])//3,'triangles':len(runtime['indices'])//3,'parts':len(parts),'dorsalSpines':13,'animationFrames':193,'fps':24,'duration':8},indent=2))
