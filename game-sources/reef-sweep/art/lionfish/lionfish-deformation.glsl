// Apply only when uMode==2 and uv.x==5.0.
// defense is PER FISH, supplied by a draw binding or per-instance attribute.
// This helper has no global defense uniform. Input positions are the relaxed mesh.
vec3 lionfishRotate(vec3 q, vec3 axis, float a) {
 return q*cos(a)+cross(axis,q)*sin(a)+axis*dot(axis,q)*(1.0-cos(a));
}
void deformLionfish(inout vec3 p, inout vec3 n, float tag, float defense, float time) {
 vec3 pivot=vec3(0.0), axis=vec3(0.0,1.0,0.0);
 float delta=0.0, idle=0.0;
 if (abs(tag-1.0)<0.1) { pivot=vec3(-0.2,-0.04,0.24); axis=vec3(0.0,1.0,0.0); delta=0.75; idle=-0.035; }
 else if (abs(tag-2.0)<0.1) { pivot=vec3(0.2,-0.04,0.24); axis=vec3(0.0,1.0,0.0); delta=-0.75; idle=0.035; }
 else if (abs(tag-10.0)<0.1) { pivot=vec3(0.0,0.2428824,0.3); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-11.0)<0.1) { pivot=vec3(0.0,0.2644541,0.236); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-12.0)<0.1) { pivot=vec3(0.0,0.2860259,0.172); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-13.0)<0.1) { pivot=vec3(0.0,0.2897409,0.108); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-14.0)<0.1) { pivot=vec3(0.0,0.29288,0.044); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-15.0)<0.1) { pivot=vec3(0.0,0.296019,-0.02); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-16.0)<0.1) { pivot=vec3(0.0,0.2876317,-0.084); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-17.0)<0.1) { pivot=vec3(0.0,0.274005,-0.148); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-18.0)<0.1) { pivot=vec3(0.0,0.2603783,-0.212); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-19.0)<0.1) { pivot=vec3(0.0,0.2467517,-0.276); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-20.0)<0.1) { pivot=vec3(0.0,0.22034,-0.34); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-21.0)<0.1) { pivot=vec3(0.0,0.193076,-0.404); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-22.0)<0.1) { pivot=vec3(0.0,0.165812,-0.468); axis=vec3(1.0,0.0,0.0); delta=0.61; idle=0.0; }
 else if (abs(tag-3.0)<0.1) { pivot=vec3(-0.12,-0.205,0.12); axis=vec3(0.0,0.0,1.0); delta=-0.5; idle=-0.025; }
 else if (abs(tag-4.0)<0.1) { pivot=vec3(0.12,-0.205,0.12); axis=vec3(0.0,0.0,1.0); delta=0.5; idle=0.025; }
 else if (abs(tag-5.0)<0.1) { pivot=vec3(0.0,-0.025,-0.76); axis=vec3(0.0,1.0,0.0); delta=0.0; idle=0.12; }
 else if (abs(tag-6.0)<0.1) { pivot=vec3(0.0,0.12,-0.45); axis=vec3(0.0,0.0,1.0); delta=0.0; idle=0.035; }
 else if (abs(tag-7.0)<0.1) { pivot=vec3(0.0,-0.105,-0.43); axis=vec3(0.0,0.0,1.0); delta=0.0; idle=0.035; }
 float angle=clamp(defense,0.0,1.0)*delta+idle*sin(time*2.1+tag*.7);
 p=pivot+lionfishRotate(p-pivot,axis,angle);
 n=lionfishRotate(n,axis,angle);
 // Gentle posterior-body sway. Pectoral/dorsal hinges are never scaled.
 if (tag<0.5) p.x+=sin(time*2.1+p.z*7.0)*pow(max(0.0,-p.z),2.0)*.025;
}
