import { crownOfThorns } from './assets/crown-of-thorns.js';
import { Geometry, rgb, tint } from './geometry.js';
import { vec } from '../game/math.js';
export function seaStar(outbreak=false,treated=false) {
 if(outbreak){const g=Object.assign(new Geometry(),crownOfThorns);if(treated)g.colors=g.colors.map((v,i)=>i%4===3?v:v*.35+[.37,.48,.42][i%4]);return g;}

 const g=new Geometry(), colour=rgb(outbreak?'#804a82':'#d99a69'), arms=outbreak?13:5;
 g.ellipsoid(vec(0,.065,0),vec(outbreak?.38:.16,.11,outbreak?.38:.16),colour,14,7);
 for(let i=0;i<arms;i++){const a=i/arms*Math.PI*2,reach=outbreak?.70:.55;
  const p=(d:number,h:number,offset=0)=>vec(Math.cos(a+offset)*d,h,Math.sin(a+offset)*d);
  g.quad(p(.05,.09,-.5),p(reach,.025),p(.05,.09,.5),vec(0,.15,0),tint(colour,i%2?.95:1.1));
  g.quad(p(.05,.09,.5),p(reach,.025),p(.05,.09,-.5),vec(0,.005,0),tint(colour,.7));
  for(let j=1;j<5;j++){const d=reach*j/5,point=p(d,.11*(1-d/reach));if(outbreak)g.rod(point,p(d,.23),.018,0,rgb('#e3be92'),4);else g.ellipsoid(point,vec(.022,.012,.022),rgb('#f0c58c'),6,3);}
 }return g;
}
export function lobster() {
 const g=new Geometry(),shell=rgb('#a96b50'),dark=rgb('#694735');
 g.ellipsoid(vec(0,.14,.14),vec(.14,.13,.31),shell,14,8);
 for(let i=0;i<5;i++)g.ellipsoid(vec(0,.10,-.12-i*.08),vec(.15-i*.013,.09-i*.008,.07),tint(shell,i%2?.85:1.1),10,6);
 for(const side of [-1,1]){for(let i=0;i<5;i++){const z=.28-i*.11;g.rod(vec(side*.09,.12,z),vec(side*.34,.11,z-.08),.014,.009,dark,6);g.rod(vec(side*.34,.11,z-.08),vec(side*.42,.015,z-.21),.009,.004,shell,5);}
  g.rod(vec(side*.07,.20,.32),vec(side*.24,.34,.95),.011,.002,shell,5);g.ellipsoid(vec(side*.08,.23,.34),vec(.024,.025,.022),rgb('#172e30'),8,5);
  g.tri(vec(side*.02,.04,-.48),vec(side*.24,.02,-.61),vec(side*.15,.02,-.41),shell);
 }return g;
}
export function sponge(seed=0) {
 const g=new Geometry(),colour=rgb(seed%2?'#c7a45f':'#a16c81');
 for(let tube=0;tube<3;tube++){const x=(tube-1)*.33,z=tube%2*.24,h=.8+(tube%2)*.55,r=.20;
  for(let i=0;i<20;i++){const a=i/20*Math.PI*2,b=(i+1)/20*Math.PI*2,p=(angle:number,y:number,radius:number)=>vec(x+Math.cos(angle)*radius*(1+.07*Math.sin(angle*5+y*8)),y,z+Math.sin(angle)*radius);
   g.quad(p(a,0,r*.75),p(b,0,r*.75),p(b,h,r),p(a,h,r),tint(colour,.8+.15*Math.sin(a)));
   g.quad(p(a,h,r),p(b,h,r),p(b,h,r*.72),p(a,h,r*.72),tint(colour,1.2));
   g.quad(p(a,h,r*.72),p(b,h,r*.72),p(b,.15,r*.55),p(a,.15,r*.55),tint(colour,.48));
  }
 }return g;
}
export function habitatChair() {
 const g=new Geometry(),wood=rgb('#688675');g.box(vec(0,.55,0),vec(.70,.08,.70),wood);
 for(const x of [-.29,.29])for(const z of [-.29,.29])g.rod(vec(x,0,z),vec(x,z>.0?1.3:.55,z),.028,.023,tint(wood,.8),7);
 for(const y of [.83,1.05,1.26])g.box(vec(0,y,.29),vec(.66,.09,.04),wood);
 for(let i=0;i<6;i++)g.ellipsoid(vec(Math.sin(i*2)*.28,.58,Math.cos(i*2)*.28),vec(.12,.08,.10),rgb(i%2?'#9a9c64':'#a77873'),8,5);
 return g;
}
export function charmGeometry(id:string) {
 const g=new Geometry(),gold=rgb('#c9a868'),pale=rgb('#e3d8ae');
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2,b=(i+1)/16*Math.PI*2;g.rod(vec(Math.cos(a)*.048,Math.sin(a)*.048,0),vec(Math.cos(b)*.048,Math.sin(b)*.048,0),.007,.007,gold,5);}
 g.rod(vec(0,-.05,0),vec(0,-.13,0),.007,.007,gold,5);
 if(id==='brass-compass'){g.ellipsoid(vec(0,-.19,0),vec(.065,.065,.015),gold,16,8);g.tri(vec(0,-.135,-.017),vec(-.017,-.205,-.018),vec(.017,-.205,-.018),rgb('#315e63'));}
 else if(id==='glass-ray'){const blue=rgb('#68c6be');g.tri(vec(0,-.14,0),vec(-.11,-.22,0),vec(0,-.26,0),blue);g.tri(vec(0,-.14,0),vec(0,-.26,0),vec(.11,-.22,0),blue);g.rod(vec(0,-.25,0),vec(.02,-.34,0),.008,.001,blue,5);}
 else if(id==='root-knot'){for(let i=0;i<20;i++){const a=i/20*Math.PI*2,b=(i+1)/20*Math.PI*2;g.rod(vec(Math.cos(a)*.06,-.20+Math.sin(a)*.06,Math.sin(a*2)*.018),vec(Math.cos(b)*.06,-.20+Math.sin(b)*.06,Math.sin(b*2)*.018),.018,.018,rgb('#a87a51'),6);}}
 else if(id==='moon-shell'){for(let i=0;i<8;i++){const a=(i/7-.5)*2;g.rod(vec(0,-.27,0),vec(Math.sin(a)*.07,-.17-Math.abs(a)*.015,.018*Math.cos(a)),.013,.008,pale,6);}}
 else {g.box(vec(0,-.20,0),vec(.08,.11,.045),gold);g.box(vec(0,-.20,-.027),vec(.048,.065,.008),rgb('#bfe3bd'));g.rod(vec(-.04,-.14,0),vec(.04,-.14,0),.012,.012,gold,6);}
 return g;
}
