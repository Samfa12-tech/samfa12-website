/** Shared, non-parallel long swells. Mesh displacement and hull probes use the
 * exact same amplitudes/phases. Fine wind detail belongs in the fragment normal. */
export const OCEAN_SWELLS=[
 [.052,.019,.68,.25,.4],[-.027,.073,-.57,.16,1.7],
 [.038,-.044,.43,.12,3.1],[.083,.051,-.82,.065,.9],
 [-.061,.029,.61,.075,4.3],[.014,.103,-.93,.038,2.2]
] as const;
export function oceanSurfaceHeight(x:number,z:number,t:number){return OCEAN_SWELLS.reduce((h,[kx,kz,speed,a,phase])=>h+Math.sin(x*kx+z*kz+t*speed+phase)*a,0);}
const f=(n:number)=>Number.isInteger(n)?n.toFixed(1):String(n);
export const oceanGLSL=`vec3 oceanSurface(vec2 p,float t){vec3 wave=vec3(0.0);\n${OCEAN_SWELLS.map(([kx,kz,speed,a,phase])=>`{float q=dot(p,vec2(${f(kx)},${f(kz)}))+t*${f(speed)}+${f(phase)};wave+=vec3(sin(q)*${f(a)},cos(q)*${f(a*kx)},cos(q)*${f(a*kz)});}`).join('\n')}\nreturn wave;}`;
