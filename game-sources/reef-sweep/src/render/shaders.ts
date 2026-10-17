import { lionfishGLSL } from './assets/lionfish-deformation.js';
import { oceanGLSL } from '../game/ocean.js';
export const reefVertex = `precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
uniform float uTime;
uniform float uMode;
uniform float uMotion;
uniform float uSurface;
uniform float uNight;
uniform float uFold;
uniform float uLionfishDefense;
uniform float uSea;
uniform float uRadius;
uniform vec2 uCurrent;
uniform mat4 uSunMatrix;
uniform mat4 uTorchMatrix;
#ifdef INSTANCES
attribute vec4 world0;
attribute vec4 world1;
attribute vec4 world2;
attribute vec4 world3;
#endif
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vColor;
varying vec2 vUV;
varying vec4 vSunCoord;
varying vec4 vTorchCoord;
${oceanGLSL}
${lionfishGLSL}
void main(){
 mat4 w=world;
 #ifdef INSTANCES
 w=mat4(world0,world1,world2,world3);
 #endif
 vec3 p=position;
 vec3 n=normal;
 if(uMode==1.0){
  p.x+=sin(uTime*.75+p.z*.7+p.x*.5)*uv.y*.08*uMotion;
  p.z+=sin(uTime*.54+p.x*.6)*uv.y*.04*uMotion;
 }
 if(uMode==2.0 && uv.x==5.0){deformLionfish(p,n,uv.y,uLionfishDefense,uTime);}
 else if(uMode==2.0){
  float phase=uTime+dot(w[3].xz,vec2(.17,.23));
  float tail=max(0.0,-p.z), fin=uv.y;
  if(uv.x==2.0){p.y+=sin(phase*1.8+p.z*.9)*fin*.23; p.z+=cos(phase*1.8)*fin*.08;}
  else if(uv.x==3.0){p.y+=sin(phase*2.0-abs(p.x)*1.5)*fin*.24;p.x*=1.0-fin*.018*cos(phase*2.0);}
  else if(uv.x==4.0){p.x+=sin(phase*2.4+p.z*3.5)*tail*tail*.09; p.y+=sin(phase*1.3)*max(0.0,p.z-.38)*.08;}
  else {float frequency=uv.x==5.0?2.1:uv.x==6.0?2.6:4.3;
   p.x+=sin(phase*frequency+p.z*7.0)*tail*tail*(uv.x==5.0?.055:.12);
   p.y+=sin(phase*6.0+p.z*3.0)*fin*.26;
  }
 }
 if(uMode==13.0){
  float phase=dot(w[3].xz,vec2(.19,.07));
  float bout=smoothstep(.72,.94,.5+.5*sin(uTime*.23+phase*.3));
  p.y+=sin(uTime*3.5+phase)*(.10+.30*bout)*uv.y*uMotion;
 }
 if(uMode==11.0){float age=fract(uTime*1.8+uv.x);p.y+=age*.9-age*age*1.6;p.x+=sign(p.x)*age*.6;p.z-=age*1.8;}
 if(uMode==12.0){p.x-=sign(p.x)*max(0.0,abs(p.x)-.12)*uFold*.84;p.y-=sign(p.y)*max(0.0,abs(p.y)-.20)*uFold*.70;}
 if(uMode==3.0||uMode==10.0){
  vec2 q=(w*vec4(p,1.0)).xz;
  float swell=oceanSurface(q,uTime).x;
  p.y+=uSea*swell+(1.0-uSea)*(sin(p.x*.30+uTime*.48)*.14+sin(p.z*.28-uTime*.3)*.09);
 }
 if(uMode==6.0){p.x+=sin(uTime*.17+p.y)*.35;p.y+=sin(uTime*.34+p.z)*.20;p.z+=mod(uTime*.23,6.0);}
 if(uMode==7.0){
  float channel=exp(-pow((p.x-uCurrent.y)/12.0,2.0));
  float current=uCurrent.x*(.45+channel*1.8)*(1.0+.12*sin(uTime*.023));
  float tip=uv.y*uv.y*uMotion;
  float phase=uTime*(.72+current*.55)+uv.x*6.28318+p.x*.31+p.z*.19;
  p.x+=(sin(phase)*.14+current*.48*.16)*tip;
  p.z+=(sin(phase-1.1)*.16+current*.48)*tip;
 }
 vec4 pos=w*vec4(p,1.0);
 vWorld=pos.xyz;
 vSunCoord=uSunMatrix*vec4(pos.xyz+normalize(mat3(w)*n)*.10,1.0);
 vTorchCoord=uTorchMatrix*vec4(pos.xyz+normalize(mat3(w)*n)*.025,1.0);
 vNormal=normalize(mat3(w)*n);
 vColor=color;
 vUV=uv;
 gl_Position=viewProjection*pos;
}`;

export const reefFragment = `precision highp float;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vColor;
varying vec2 vUV;
varying vec4 vSunCoord;
varying vec4 vTorchCoord;
uniform vec3 uEye;
uniform vec3 uForward;
uniform vec3 uWaterColor;
uniform float uTime;
uniform float uMode;
uniform float uSurface;
uniform float uFog;
uniform float uLight;
uniform float uNight;
uniform float uFold;
uniform float uSea;
uniform float uRadius;
uniform vec2 uTorch;
uniform float uShadows;
uniform float uTorchShadows;
uniform sampler2D uSunShadow;
uniform sampler2D uTorchShadow;
float shadowVisibility(sampler2D shadowMap,vec4 coordinate,float texel,float bias,float depthSpan){
 if(coordinate.w<=0.0)return 1.0;
 vec3 q=coordinate.xyz/coordinate.w*.5+.5;
 if(q.x<.002||q.x>.998||q.y<.002||q.y>.998||q.z<0.0||q.z>1.0)return 1.0;
 vec4 blockerPacked=texture2D(shadowMap,q.xy);
 float blockerDepth=dot(blockerPacked,vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0));
 float radius=1.0+clamp((q.z-blockerDepth)*depthSpan*.2,0.0,.5);
 float visible=0.0;
 for(int x=0;x<4;x++)for(int y=0;y<4;y++){
  vec4 packed=texture2D(shadowMap,q.xy+(vec2(float(x),float(y))-1.5)*texel*radius);
  float depth=dot(packed,vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0));
  visible+=step(q.z-bias,depth);
 }
 return visible/16.0;
}
float caustic(vec2 p){
 float a=sin(p.x*1.47+uTime*.33+sin(p.y*.82-uTime*.23));
 float b=sin(p.y*1.42-uTime*.29+cos(p.x*.71+uTime*.17));
 return pow(max(0.0,1.0-abs(a+b)*.87),11.0);
}
${oceanGLSL}
float foamHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float foamNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(foamHash(i),foamHash(i+vec2(1,0)),f.x),mix(foamHash(i+vec2(0,1)),foamHash(i+vec2(1,1)),f.x),f.y);}
void main(){
 vec3 n=normalize(vNormal);
 float dist=length(vWorld-uEye);
 float depth=max(0.0,uSurface-vWorld.y);
 vec3 col=vColor.rgb;
 float alpha=1.0;
 if(uMode==3.0){
  vec2 p=vWorld.xz;
  float w=sin(p.x*.62+uTime*.44+sin(p.y*.26))+sin(p.y*.49-uTime*.3);
  float threads=pow(max(0.0,1.0-abs(w)*.6),5.0);
  vec3 waveNormal=normalize(vec3(-cos(p.x*.065+p.y*.028+uTime*.9)*.025+cos(p.y*.09-p.x*.026-uTime*.72)*.005,1.0,-cos(p.x*.065+p.y*.028+uTime*.9)*.011-cos(p.y*.09-p.x*.026-uTime*.72)*.018));
  vec3 to=normalize(vWorld-uEye);
  float sun=pow(max(0.0,dot(to,normalize(vec3(-.35,1.0,.25)))),120.0);
  vec3 daylight=mix(vec3(.12,.53,.60),vec3(.44,.78,.73),.48+w*.11)+threads*.055+sun*vec3(.66,.73,.57);
  vec3 moonlight=vec3(.025,.105,.17)+threads*.025+sun*vec3(.15,.24,.34);
  float fresnel=pow(1.0-max(0.0,dot(waveNormal,-to)),3.0);
  float glitter=pow(max(0.0,dot(reflect(to,waveNormal),normalize(vec3(-.35,1.0,.25)))),120.0);
  daylight=mix(daylight,vec3(.60,.79,.82),fresnel*.72)+glitter*vec3(.9,.80,.56)*uSea;
  if(uSea>.5){
   vec3 sw=oceanSurface(p,uTime);
   float detailFade=1.0-smoothstep(22.0,115.0,dist);
   // Advected, domain-warped wind chop. Noise gradients prevent the old regular
   // sine stripes, and remove sub-pixel detail before the grazing horizon.
   vec2 wind=p*.34+vec2(uTime*.29,-uTime*.18);
   vec2 warp=vec2(foamNoise(wind*.27),foamNoise(wind*.31+17.0))*1.6;
   float h0=foamNoise(wind+warp),hx=foamNoise(wind+warp+vec2(.17,0)),hz=foamNoise(wind+warp+vec2(0,.17));
   vec2 chop=vec2(hx-h0,hz-h0)*.31*detailFade;
   vec3 rippleN=normalize(vec3(-sw.y-chop.x,1.0,-sw.z-chop.y));
   float sky=pow(1.0-max(0.0,dot(rippleN,-to)),3.2);
   vec3 sunDirection=normalize(vec3(-.35,1.0,.25));
   float glint=pow(max(0.0,dot(reflect(to,rippleN),sunDirection)),48.0);
   float broad=foamNoise(p*.021+vec2(uTime*.018,0.0));
   daylight=mix(vec3(.035,.32,.38),vec3(.60,.78,.81),sky*.86)
    +(broad-.5)*vec3(.022,.035,.029)+glint*vec3(.62,.56,.40)*mix(.32,.75,detailFade);
   daylight=mix(daylight,vec3(.55,.75,.80),smoothstep(160.0,580.0,dist)*.55);
  }
  col=mix(daylight,moonlight,uNight);
  if(uSea<.5&&uEye.y<uSurface){vec3 horizon=mix(mix(uWaterColor,vec3(.012,.047,.085),uNight),mix(uWaterColor*1.20+vec3(.09,.09,.06),vec3(.035,.12,.20),uNight),clamp((uEye.y+2.0)/uSurface,0.0,1.0));col=mix(col,horizon,smoothstep(uRadius+4.0,uRadius+70.0,length(vWorld.xz)));}
 }
 else if(uMode==11.0){float age=fract(uTime*1.8+vUV.x);col=vec3(.85,.98,.96);alpha=(1.0-age)*.55;}
 else if(uMode==10.0){float foam=foamNoise(vWorld.xz*3.7+vec2(uTime*.8,-uTime*1.2))*.65+foamNoise(vWorld.xz*8.4-uTime)*.35;col=vec3(.82,.97,.93);alpha=(1.0-vUV.x)*smoothstep(1.0,.48,abs(vUV.y))*(.08+.62*smoothstep(.32,.75,foam));}
 else if(uMode==5.0){alpha=(1.0-vUV.y)*.075*pow(max(0.0,sin(vUV.x*3.14159)),1.5);if(uShadows>.5)alpha*=shadowVisibility(uSunShadow,vSunCoord,1.0/2048.0,.00055,190.0);col=mix(vec3(.62,.87,.76),vec3(.15,.39,.56),uNight);}
 else if(uMode==8.0){float rim=pow(1.0-abs(dot(n,normalize(uEye-vWorld))),2.0);col=vec3(.58,.86,.91);alpha=.10+rim*.50;}
 else if(uMode==6.0){col=mix(vec3(.54,.82,.78),vec3(.24,.47,.66),uNight);alpha=.34;}
 else {
  float sunNormal=max(0.0,dot(n,normalize(vec3(-.4,1.0,-.23))));
  float sunShadow=uShadows>.5?shadowVisibility(uSunShadow,vSunCoord,1.0/2048.0,.00055+.00055*(1.0-sunNormal),190.0):1.0;
  float light=.65+.52*sunNormal*sunShadow;
  float side=.08*max(0.0,dot(n,normalize(vec3(.7,.2,.5))));
  col*=mix(light+side,.25+.18*max(0.0,n.y),uNight);
  col*=mix(vec3(.82,.93,1.0),vec3(1.0),mix(1.0,sunShadow,smoothstep(.05,.4,sunNormal)*(1.0-uNight)));
  if(uMode!=4.0&&uMode!=12.0){
   float c=(caustic(vWorld.xz)+caustic(vWorld.xz*.51+.3)*.35)*(1.0-step(uSurface+.03,vWorld.y));
   col+=mix(vec3(.30,.47,.35),vec3(.10,.20,.30),uNight)*c*max(.10,n.y)*exp(-depth*.037)*(1.0-uNight)*sunShadow;
   col*=vec3(exp(-depth*.008),1.0,1.0);
   float alignment=max(0.0,dot(normalize(vWorld-uEye),uForward));
   float cone=pow(alignment,max(5.0,uTorch.x))*uLight*exp(-dist*max(.001,uTorch.y));
   float core=pow(alignment,40.0)*uLight*exp(-dist*.12);
   float torchShadow=uTorchShadows>.5?shadowVisibility(uTorchShadow,vTorchCoord,1.0/1024.0,.000015,0.0):1.0;
   col+=vColor.rgb*(cone*.82+core*.45)*torchShadow;
  }
  else col=col*.85+vColor.rgb*.3;
 }
 if(uMode!=4.0&&uMode!=12.0&&uMode!=3.0&&uMode!=6.0){
  float underwater=1.0-step(uSurface,vWorld.y);
  float outer=smoothstep(uRadius+3.0,uRadius+55.0,length(vWorld.xz));
  float submergedFog=(1.0-exp(-dist*uFog-max(0.0,length(vWorld.xz)-uRadius)*.045))*underwater;
  vec3 deepFog=mix(uWaterColor,vec3(.012,.047,.085),uNight);
  vec3 farFog=mix(uWaterColor*1.20+vec3(.09,.09,.06),vec3(.035,.12,.20),uNight);
  vec3 waterFog=mix(deepFog,farFog,clamp((vWorld.y+2.0)/uSurface,0.0,1.0));
  vec3 horizonFog=mix(deepFog,farFog,clamp((uEye.y+2.0)/uSurface,0.0,1.0));waterFog=mix(waterFog,horizonFog,outer);
  col=mix(col,waterFog,clamp(submergedFog,0.0,.985));
  float aboveFog=(1.0-exp(-dist*uFog*(uMode==9.0?.09:.34)))*(1.0-underwater);
  vec3 skyFog=mix(vec3(.58,.77,.80),vec3(.018,.045,.10),uNight);
  col=mix(col,skyFog,clamp(aboveFog,0.0,.8));
 }
 col=pow(max(col,vec3(0.0)),vec3(.96));
 gl_FragColor=vec4(col,alpha);
}`;
