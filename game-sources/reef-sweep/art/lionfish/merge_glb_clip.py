import json,struct
from pathlib import Path
P=Path(__file__).resolve().parent;p=P/'lionfish-defensive-remodel.glb';b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);a={'name':'Calm - approach - defensive flare - relax','channels':[],'samplers':[]}
for clip in g.get('animations',[]):
 off=len(a['samplers']);a['samplers']+=clip['samplers']
 for c in clip['channels']:c['sampler']+=off;a['channels'].append(c)
g['animations']=[a];js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);tail=b[20+n:];out=struct.pack('<III',0x46546c67,2,20+len(js)+len(tail))+struct.pack('<II',len(js),0x4e4f534a)+js+tail;p.write_bytes(out);print('Merged channels:',len(a['channels']))
