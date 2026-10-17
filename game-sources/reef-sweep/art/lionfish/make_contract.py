import json
from pathlib import Path
P=Path(__file__).resolve().parent
parts=json.loads((P/'lionfish-parts.json').read_text());g=json.loads((P/'lionfish-geometry.json').read_text())
(P/'lionfish-mesh.ts').write_text('/** Original Blender-authored lionfish remodel. Y-up, nose +Z; UV.x=5, UV.y=part tag. */\nexport const LIONFISH_MESH = '+json.dumps(g,separators=(',',':'))+';\n')
def n(x):return str(round(x,7)) if x%1 else str(int(x))+'.0'
def v(a):return 'vec3('+','.join(n(x) for x in a)+')'
s='''// Apply only when uMode==2 and uv.x==5.0.\n// defense is PER FISH, supplied by a draw binding or per-instance attribute.\n// This helper has no global defense uniform. Input positions are the relaxed mesh.\nvec3 lionfishRotate(vec3 q, vec3 axis, float a) {\n return q*cos(a)+cross(axis,q)*sin(a)+axis*dot(axis,q)*(1.0-cos(a));\n}\nvoid deformLionfish(inout vec3 p, inout vec3 n, float tag, float defense, float time) {\n vec3 pivot=vec3(0.0), axis=vec3(0.0,1.0,0.0);\n float delta=0.0, idle=0.0;\n'''
for i,a in enumerate(parts[1:]):
 s+=(' if' if i==0 else ' else if')+' (abs(tag-'+n(a['tag'])+')<0.1) { pivot='+v(a['pivot'])+'; axis='+v(a['axis'])+'; delta='+n(a['delta'])+'; idle='+n(a['idleAmplitude'])+'; }\n'
s+=''' float angle=clamp(defense,0.0,1.0)*delta+idle*sin(time*2.1+tag*.7);\n p=pivot+lionfishRotate(p-pivot,axis,angle);\n n=lionfishRotate(n,axis,angle);\n // Gentle posterior-body sway. Pectoral/dorsal hinges are never scaled.\n if (tag<0.5) p.x+=sin(time*2.1+p.z*7.0)*pow(max(0.0,-p.z),2.0)*.025;\n}\n'''
(P/'lionfish-deformation.glsl').write_text(s)
