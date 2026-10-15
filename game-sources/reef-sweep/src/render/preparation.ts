import { Geometry, fishGeometry, rgb } from './geometry.js';
import { vec } from '../game/math.js';
declare const BABYLON:any;
/** Separate small 3D bench view, disposed on every menu transition. No save state. */
export class PreparationView {
 engine:any;scene:any;knife:any;fish:any;cutMarks:any[]=[];scales:any[]=[];fillets:any[]=[];clock=0;
 constructor(canvas:HTMLCanvasElement,public scaling=false) {
  const B=BABYLON;this.engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:false},false);this.engine.setHardwareScalingLevel(1);this.scene=new B.Scene(this.engine);this.scene.clearColor=new B.Color4(.035,.11,.13,1);
  const camera=new B.FreeCamera('preparation-camera',new B.Vector3(0,1.6,-1.5),this.scene);camera.setTarget(new B.Vector3(0,.05,0));camera.minZ=.05;camera.fov=.62;this.scene.activeCamera=camera;
  // The pinned offline engine closure uses custom lighting; keep this bench
  // self-contained rather than adding unbundled Babylon light registrations.
  B.Effect.ShadersStore.benchVertexShader=`precision highp float;attribute vec3 position;attribute vec3 normal;attribute vec4 color;uniform mat4 world;uniform mat4 viewProjection;varying vec3 n;varying vec4 c;void main(){n=normalize(mat3(world)*normal);c=color;gl_Position=viewProjection*world*vec4(position,1.0);}`;
  B.Effect.ShadersStore.benchFragmentShader=`precision highp float;varying vec3 n;varying vec4 c;void main(){float light=.5+.65*max(0.0,dot(normalize(n),normalize(vec3(-.4,1.0,-.6))));gl_FragColor=vec4(c.rgb*light,1.0);}`;
  const mat=new B.ShaderMaterial('bench-material',this.scene,{vertex:'bench',fragment:'bench'},{attributes:['position','normal','color'],uniforms:['world','viewProjection']});mat.backFaceCulling=false;
  const make=(name:string,g:Geometry)=>{const m=new B.Mesh(name,this.scene),v=new B.VertexData();v.positions=g.positions;v.normals=g.normals;v.colors=g.colors;v.indices=g.indices;v.uvs=g.uvs;v.applyToMesh(m);m.material=mat;return m;};
  const board=new Geometry();board.box(vec(0,-.11,0),vec(2.25,.14,1.3),rgb('#786249'));for(let i=0;i<12;i++)board.box(vec(-1.05+i*.19,-.033,0),vec(.006,.003,1.2),rgb('#584a38'));make('wooden-fillet-board',board);
  this.fish=make('landed-lionfish',fishGeometry('lionfish'));this.fish.rotation.set(0,Math.PI/2,Math.PI/2);this.fish.position.y=.19;
  const blade=new Geometry();blade.quad(vec(-.25,0,0),vec(.20,0,0),vec(.31,-.08,0),vec(-.25,-.11,0),rgb('#c3d8d8'));blade.box(vec(-.39,-.035,0),vec(.3,.09,.07),rgb('#205855'));this.knife=make(scaling?'scaling-tool':'fillet-knife',blade);this.knife.position.set(-.7,.54,0);
  for(let i=0;i<3;i++){const cut=new Geometry();cut.rod(vec(-.48+i*.44,.31,-.17),vec(-.48+i*.44,.31,.17),.009,.009,rgb('#edcb86'),6);this.cutMarks.push(make('guided-cut-'+i,cut));}
  if(!scaling)for(let i=0;i<3;i++){const flesh=new Geometry();flesh.ellipsoid(vec(),vec(.16,.045,.11),rgb('#e1c9b1'),14,8);for(let j=0;j<4;j++)flesh.rod(vec(-.10+j*.06,.041,-.07),vec(-.08+j*.06,.046,.07),.003,.002,rgb('#f4dfc7'),4);const m=make('prepared-fillet-'+i,flesh);m.position.set(-.35+i*.28,.18,.42);m.setEnabled(false);this.fillets.push(m);}
  if(scaling)for(let i=0;i<18;i++){const scale=new Geometry();scale.ellipsoid(vec(),vec(.026,.008,.033),rgb('#c8c6a6'),6,3);const m=make('loosened-scale-'+i,scale);m.position.set(-.6+(i%6)*.20,.27,(Math.floor(i/6)-1)*.12);this.scales.push(m);}
  this.engine.resize();this.engine.runRenderLoop(()=>{this.clock+=.016;this.scene.render();});
 }
 update(position:number,stage:number){this.knife.position.x=-.88+position*1.76;this.knife.position.z=Math.sin(position*Math.PI)*.13;this.knife.rotation.z=this.scaling?Math.sin(position*12)*.16:-.4;this.cutMarks.forEach((m,i)=>m.setEnabled(i>=stage));this.fillets.forEach((m,i)=>m.setEnabled(i<stage));if(this.scaling)this.scales.forEach((m,i)=>{if(i<stage*6){m.position.y=.02;m.position.z=.43+(i%3)*.04;}});}
 dispose(){this.engine.stopRenderLoop();this.scene.dispose();this.engine.dispose();}
}
