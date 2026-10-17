import bpy
from pathlib import Path
P=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(P/'lionfish-defensive-remodel.blend'))
s=bpy.context.scene;s.render.resolution_x=720;s.render.resolution_y=576;s.cycles.samples=20
frames=P/'frames';frames.mkdir(exist_ok=True)
for i,f in enumerate(range(1,193,2)):
 s.frame_set(f);s.render.filepath=str(frames/f'{i:03d}.png');bpy.ops.render.render(write_still=True)
