/** Local canvas illustration with responsive food/action animation. No assets or
 * renderer dependencies; the buttons remain the accessible primary controls. */
export class CookingView {
 lastStage=0;actionAt=-10;
 constructor(public canvas:HTMLCanvasElement,public recipe:'citrus'|'stew'){}
 update(heat:number,stage:number){
  const canvas=this.canvas,c=canvas.getContext('2d')!,w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(2,devicePixelRatio);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  c.setTransform(dpr,0,0,dpr,0,0);const time=performance.now()/1000;if(stage!==this.lastStage){this.lastStage=stage;this.actionAt=time;}
  const pulse=Math.max(0,1-(time-this.actionAt)/.7),stew=this.recipe==='stew';
  const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#254a47');bg.addColorStop(1,'#102f33');c.fillStyle=bg;c.fillRect(0,0,w,h);
  c.strokeStyle='#48685c';c.lineWidth=2;for(let i=0;i<10;i++){c.beginPath();c.moveTo(i*w/9,0);c.lineTo(i*w/9+30,h);c.stroke();}
  const size=Math.min(w*.33,h*.40),cx=w*.49,cy=h*.52-pulse*size*.12;
  // Warm hob, then a dimensional cast pan / ceramic stew pot.
  const glow=c.createRadialGradient(cx,cy,size*.2,cx,cy,size*1.4);glow.addColorStop(0,`rgba(225,146,65,${.12+heat*.18})`);glow.addColorStop(1,'#db914500');c.fillStyle=glow;c.fillRect(0,0,w,h);
  c.save();c.translate(cx,cy);c.rotate(stew?0:-pulse*.12);
  c.fillStyle='#102326';c.beginPath();c.ellipse(0,size*.18,size*1.04,size*.83,0,0,7);c.fill();
  c.lineCap='round';c.lineWidth=size*.19;c.strokeStyle='#1b2c2b';c.beginPath();c.moveTo(size*.7,size*.1);c.lineTo(size*1.6,size*.55);c.stroke();c.lineWidth=size*.08;c.strokeStyle='#657870';c.stroke();
  c.fillStyle=stew?'#97683f':'#52625b';c.beginPath();c.ellipse(0,0,size,size*.80,0,0,7);c.fill();
  const food=c.createRadialGradient(-size*.2,-size*.2,0,0,0,size);food.addColorStop(0,stew?'#d7ad6b':'#394541');food.addColorStop(1,stew?'#967343':'#263832');c.fillStyle=food;c.beginPath();c.ellipse(0,-size*.03,size*.88,size*.67,0,0,7);c.fill();
  if(stew){for(let i=0;i<15;i++){const a=i*2.4+time*.1,d=Math.sqrt(i/15)*size*.7;c.fillStyle=i%3?'#dbb975':'#7c9e68';c.beginPath();c.ellipse(Math.cos(a)*d,Math.sin(a)*d*.62,4,2,0,0,7);c.fill();}}
  // Three fillets, crisp edge, scored flesh and a visible turn on each lift.
  for(let i=0;i<(stew&&stage===0?0:3);i++){
   const x=(i-1)*size*.42,y=(i%2?-.16:.12)*size,flip=stew?1:Math.cos(pulse*Math.PI*2);
   c.save();c.translate(x,y);c.rotate(-.25+i*.20);c.scale(1,Math.max(.18,Math.abs(flip)));c.fillStyle=stage>0?'#d4a252':'#e9cba0';
   c.beginPath();c.moveTo(-size*.31,-size*.01);c.bezierCurveTo(-size*.23,-size*.23,size*.19,-size*.23,size*.31,-size*.04);c.bezierCurveTo(size*.34,size*.14,size*.06,size*.23,-size*.20,size*.14);c.bezierCurveTo(-size*.28,size*.12,-size*.33,size*.06,-size*.31,-size*.01);c.fill();c.strokeStyle=stage>0?'#ae7437':'#f6e2c6';c.lineWidth=2;
   for(let j=-2;j<=2;j++){c.beginPath();c.moveTo(j*size*.075-size*.06,-size*.11);c.lineTo(j*size*.075+size*.06,size*.10);c.stroke();}c.restore();
  }
  if(stew){const a=time*.65+pulse*3;c.save();c.rotate(a);c.fillStyle='#b99a69';c.fillRect(-3,-size*.2,7,size*1.5);c.beginPath();c.ellipse(0,-size*.18,10,17,0,0,7);c.fill();c.restore();}
  if(stage>=2)for(let i=0;i<9;i++){const a=i*2.4,d=Math.sqrt(i/9)*size*.72;c.fillStyle='#84ac67';c.beginPath();c.ellipse(Math.cos(a)*d,Math.sin(a)*d*.65,5,2,a,0,7);c.fill();}
  c.restore();
  // Lime, herbs, folded towel: authored kitchen context rather than empty bars.
  c.save();c.translate(w*.15,h*.70);c.fillStyle='#bdcbbb';c.rotate(-.16);c.fillRect(-size*.48,-size*.42,size*.85,size*.75);c.strokeStyle='#6a9c90';for(let i=0;i<4;i++){c.beginPath();c.moveTo(-size*.40+i*size*.2,-size*.42);c.lineTo(-size*.40+i*size*.2,size*.33);c.stroke();}c.restore();
  for(let i=0;i<2;i++){const x=w*.82+i*size*.35,y=h*.75-i*size*.1;c.fillStyle='#79a359';c.beginPath();c.arc(x,y,size*.22,0,7);c.fill();c.fillStyle='#d6dd8a';c.beginPath();c.arc(x,y,size*.17,0,7);c.fill();c.strokeStyle='#f2e3ab';for(let j=0;j<6;j++){const a=j*Math.PI/3;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*size*.17,y+Math.sin(a)*size*.17);c.stroke();}}
  c.strokeStyle='#e1ede26b';c.lineWidth=2;for(let i=0;i<4;i++){const age=(time*.3+i*.24)%1,x=cx+(i-1.5)*size*.32,y=cy-size*.5-age*size*.9;c.globalAlpha=(1-age)*.5;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+10,y-12,x-8,y-18,x+4,y-30);c.stroke();}c.globalAlpha=1;
 }
 dispose(){}
}
