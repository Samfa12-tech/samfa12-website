import type { Vec } from './types.js';
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const vec = (x = 0, y = 0, z = 0): Vec => ({ x, y, z });
export const add = (a: Vec, b: Vec): Vec => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec, b: Vec): Vec => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec, n: number): Vec => vec(a.x * n, a.y * n, a.z * n);
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a: Vec) => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Vec, b: Vec) => length(sub(a, b));
export const norm = (a: Vec) => scale(a, 1 / (length(a) || 1));
export const direction = (yaw: number, pitch: number) => vec(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
export const rng = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export function hash(s: string) { let h = 2166136261; for (const c of s)
    h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function raySphere(o: Vec, d: Vec, c: Vec, r: number) { const v = sub(o, c), b = dot(v, d), k = dot(v, v) - r * r, q = b * b - k; if (q < 0)
    return Infinity; const t = -b - Math.sqrt(q); return t >= 0 ? t : (-b + Math.sqrt(q) >= 0 ? 0 : Infinity); }
export function rayEllipsoid(o: Vec, d: Vec, c: Vec, s: Vec) { const v = vec((o.x - c.x) / s.x, (o.y - c.y) / s.y, (o.z - c.z) / s.z), u = vec(d.x / s.x, d.y / s.y, d.z / s.z); const a = dot(u, u), b = dot(v, u), q = b * b - a * (dot(v, v) - 1); if (q < 0)
    return Infinity; const t = (-b - Math.sqrt(q)) / a; return t >= 0 ? t : Infinity; }
export function angleLerp(a: number, b: number, t: number) { return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t; }
export const money = (n: number) => '$' + Math.round(n).toLocaleString('en');
export const timeText = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
