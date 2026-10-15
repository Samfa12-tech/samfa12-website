import { Geometry, fishGeometry, rgb } from './geometry.js';
import { vec } from '../game/math.js';
declare const BABYLON:any;
/** Separate small 3D bench view, disposed on every menu transition. No save state. */
export class PreparationView {
 engine:any;scene:any;knife:any;fish:any;cutMarks:any[]=[];scales:any[]=[];fillets:any[]=[];clock=0;stage=-1;strokeAt=-10;resizeObserver:ResizeObserver;
 constructor(canvas:HTMLCanvasElement,public scaling=false) {
  const B=BABYLON;this.engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:false},false);this.engine.setHardwareScalingLevel(1);this.scene=new B.Scene(this.engine);this.scene.clearColor=new B.Color4(.035,.11,.13,1);
  const camera=new B.FreeCamera('preparation-camera',new B.Vector3(0,2.0,-1.65),this.scene);camera.setTarget(new B.Vector3(0,.05,0));camera.minZ=.05;camera.fov=.73;this.scene.activeCamera=camera;
  // The pinned offline engine closure uses custom lighting; keep this bench
  // self-contained rather than adding unbundled Babylon light registrations.
  B.Effect.ShadersStore.benchVertexShader=`precision highp float;attribute vec3 position;attribute vec3 normal;attribute vec4 color;uniform mat4 world;uniform mat4 viewProjection;varying vec3 n;varying vec4 c;void main(){n=normalize(mat3(world)*normal);c=color;gl_Position=viewProjection*world*vec4(position,1.0);}`;
  B.Effect.ShadersStore.benchFragmentShader=`precision highp float;varying vec3 n;varying vec4 c;void main(){float light=.5+.65*max(0.0,dot(normalize(n),normalize(vec3(-.4,1.0,-.6))));gl_FragColor=vec4(c.rgb*light,1.0);}`;
  const mat=new B.ShaderMaterial('bench-material',this.scene,{vertex:'bench',fragment:'bench'},{attributes:['position','normal','color'],uniforms:['world','viewProjection']});mat.backFaceCulling=false;
  const make=(name:string,g:Geometry)=>{const m=new B.Mesh(name,this.scene),v=new B.VertexData();v.positions=g.positions;v.normals=g.normals;v.colors=g.colors;v.indices=g.indices;v.uvs=g.uvs;v.applyToMesh(m);m.material=mat;return m;};
  const board=new Geometry();board.box(vec(0,-.11,0),vec(2.25,.14,1.3),rgb('#a78760'));for(let i=0;i<12;i++)board.box(vec(-1.05+i*.19,-.033,0),vec(.006,.003,1.2),rgb('#866746'));make('wooden-fillet-board',board);
  const body=fishGeometry('lionfish');
  // Lay the same recognisable striped fish on its side with fins resting flat.
  // Transform normals too, rather than leaving upright display fins on the board.
  for(let i=0;i<body.positions.length;i+=3){let [x,y,z]=body.positions.slice(i,i+3);x=Math.sign(x)*Math.min(Math.abs(x),.18+Math.max(0,Math.abs(x)-.18)*.25);y=Math.sign(y)*Math.min(Math.abs(y),.30+Math.max(0,Math.abs(y)-.30)*.22);body.positions.splice(i,3,z,x*.7,-y*.8);const [nx,ny,nz]=body.normals.slice(i,i+3);body.normals.splice(i,3,nz,nx,-ny);}
  this.fish=make('landed-lionfish',body);this.fish.position.y=.25;
  const tray=new Geometry();tray.box(vec(.78,.02,.45),vec(.5,.055,.38),rgb('#c3cdc0'));make('prepared-fillet-tray',tray);
  const blade=new Geometry();blade.quad(vec(-.25,0,0),vec(.20,0,0),vec(.31,-.08,0),vec(-.25,-.11,0),rgb('#c3d8d8'));blade.box(vec(-.39,-.035,0),vec(.3,.09,.07),rgb('#205855'));this.knife=make(scaling?'scaling-tool':'fillet-knife',blade);this.knife.position.set(-.7,.54,0);
  for(let i=0;i<3;i++){const cut=new Geometry();cut.rod(vec(.48-i*.44,.45,-.23),vec(.48-i*.44,.45,.23),.009,.009,rgb('#edcb86'),6);this.cutMarks.push(make('guided-cut-'+i,cut));}
  if(!scaling)for(let i=0;i<3;i++){const flesh=new Geometry();flesh.ellipsoid(vec(),vec(.16,.045,.11),rgb('#e1c9b1'),14,8);for(let j=0;j<4;j++)flesh.rod(vec(-.10+j*.06,.041,-.07),vec(-.08+j*.06,.046,.07),.003,.002,rgb('#f4dfc7'),4);const m=make('prepared-fillet-'+i,flesh);m.position.set(.62+i*.12,.11,.42);m.setEnabled(false);this.fillets.push(m);}
  if(scaling)for(let i=0;i<18;i++){const scale=new Geometry();scale.ellipsoid(vec(),vec(.026,.008,.033),rgb('#c8c6a6'),6,3);const m=make('loosened-scale-'+i,scale);m.position.set(-.6+(i%6)*.20,.27,(Math.floor(i/6)-1)*.12);this.scales.push(m);}
  this.resizeObserver=new ResizeObserver(()=>this.engine.resize());this.resizeObserver.observe(canvas);this.engine.resize();this.engine.runRenderLoop(()=>{this.clock=performance.now()/1000;const age=this.clock-this.strokeAt;this.knife.position.y=.45-Math.sin(Math.min(1,age/.48)*Math.PI)*.20;this.fillets.forEach((m,i)=>{if(i<this.stage)m.scaling.setAll(Math.min(1,(age+.12*i)*3));});this.scene.render();});
 }
 update(position:number,stage:number){if(stage!==this.stage){if(this.stage>=0)this.strokeAt=performance.now()/1000;this.stage=stage;}
  this.knife.position.x=this.scaling?-.88+position*1.76:.88-position*1.76;this.knife.position.z=this.scaling?Math.sin(position*Math.PI)*.13:-.05;this.knife.rotation.z=this.scaling?Math.sin(position*12)*.16:-.4;
  this.cutMarks.forEach((m,i)=>{m.setEnabled(i>=stage);m.scaling.set(1,i===stage?1.35:1,1);});this.fillets.forEach((m,i)=>m.setEnabled(i<stage));
  if(this.scaling)this.scales.forEach((m,i)=>{if(i<stage*6){const flight=Math.min(1,Math.max(0,(performance.now()/1000-this.strokeAt)*2));m.position.y=.27+Math.sin(flight*Math.PI)*.25-flight*.23;m.position.z=.12+flight*(.32+(i%3)*.04);}});
 }
 dispose(){this.resizeObserver.disconnect();this.engine.stopRenderLoop();this.scene.dispose();this.engine.dispose();}
}
