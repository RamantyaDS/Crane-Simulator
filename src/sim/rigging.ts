// Rigging geometry and leg loads, the way a lift plan works them out: legs from the hook to the lifting points (or to
// a spreader's ends, then straight down), sling angle from vertical, tension per leg = weight / (legs sharing × cos),
// a 4-leg bridle on a rigid load counted as 3 legs sharing (ASME B30.9 practice), and the tilt the load takes when its
// centre of mass is not under the hook.
import type { LoadDef, RigItem } from './site';

export interface RigPlan {
  ok: boolean;
  problem: string;
  height: number; // hook bottom to the lifting points, m (taut)
  legAngle: number; // rad from vertical
  legTension: number; // kg per leg
  legWll: number;
  spreaderLoad: number; // kg on the spreader (0 if none)
  tilt: number; // rad the load hangs out of level
  massKg: number; // rigging mass that counts as load
  points: number[]; // which lifting points are used
  centre: [number, number, number]; // where the rigging meets the load, in the load's frame (centroid of the points)
}

export function plan(load: LoadDef, rig: RigItem): RigPlan {
  const bad = (problem: string): RigPlan => ({ ok: false, problem, height: rig.legLen, legAngle: 0, legTension: 0, legWll: rig.wll, spreaderLoad: 0, tilt: 0, massKg: rig.kg, points: [], centre: [0, 0, 0] });
  const four = load.points.length >= 4;
  if (rig.kind === 'bridle4' && !four) return bad('Beban ini hanya punya 2 titik angkat: pakai sling 2 kaki.');
  const pts = rig.kind === 'bridle2' && four ? [0, 1, 2, 3] : rig.kind === 'bridle2' ? [0, 1] : load.points.map((_, i) => i);
  const P = pts.map((i) => load.points[i]);
  const cx = P.reduce((a, p) => a + p[0], 0) / P.length;
  const cy = P.reduce((a, p) => a + p[1], 0) / P.length;
  const cz = P.reduce((a, p) => a + p[2], 0) / P.length;
  const W = load.kg;

  let height: number;
  let angle: number;
  let tension: number;
  let spreaderLoad = 0;
  if (rig.kind === 'spreader') {
    const half = (rig.span ?? 4) / 2;
    // the bar runs along the load's length; its bottom legs drop to the points at each end
    const along = Math.max(...P.map((p) => Math.abs(p[0] - cx)));
    if (Math.abs(along - half) > 0.6) return bad(`Panjang spreader ${rig.span} m tidak cocok dengan jarak titik angkat (${(along * 2).toFixed(1)} m).`);
    if (rig.legLen <= half) return bad('Sling atas terlalu pendek untuk spreader ini.');
    angle = Math.asin(half / rig.legLen);
    height = rig.legLen * Math.cos(angle) + 0.35 + 1.2; // top legs, bar, bottom legs
    tension = W / (2 * Math.cos(angle)); // the two top legs carry it all
    spreaderLoad = W;
    if (W > (rig.spreaderWll ?? 0)) return { ...bad(`Spreader bar kelebihan beban: ${(W / 1000).toFixed(1)} t, batas ${((rig.spreaderWll ?? 0) / 1000).toFixed(0)} t.`), legTension: tension, spreaderLoad };
  } else {
    // a 2-leg sling on a 4-point load hooks the two diagonal points; a 4-leg uses all four
    const used = rig.kind === 'bridle2' && four ? [P[0], P[2]] : P;
    const d = Math.max(...used.map((p) => Math.hypot(p[0] - cx, p[2] - cz)));
    if (rig.legLen <= d + 0.1) return bad(`Kaki sling ${rig.legLen} m terlalu pendek: titik angkat ${d.toFixed(1)} m dari tengah.`);
    angle = Math.asin(d / rig.legLen);
    height = rig.legLen * Math.cos(angle);
    const sharing = rig.kind === 'bridle4' ? 3 : 2;
    tension = W / (sharing * Math.cos(angle));
  }
  // the load hangs with its centre of mass under the hook: tilt from the offset over the drop
  const ex = load.cg[0] - cx;
  const ez = load.cg[2] - cz;
  const tilt = Math.atan2(Math.hypot(ex, ez), height + (cy - load.cg[1]));
  const res: RigPlan = { ok: true, problem: '', height, legAngle: angle, legTension: tension, legWll: rig.wll, spreaderLoad, tilt, massKg: rig.kg, points: pts, centre: [cx, cy, cz] };
  if (angle > (60 * Math.PI) / 180) return { ...res, ok: false, problem: 'Sudut sling terlalu landai (lebih dari 60° dari vertikal). Pakai kaki lebih panjang atau spreader.' };
  if (tension > rig.wll) return { ...res, ok: false, problem: `Tegangan per kaki ${(tension / 1000).toFixed(1)} t melebihi WLL ${(rig.wll / 1000).toFixed(1)} t.` };
  if (load.look === 'chiller' && rig.kind !== 'spreader') return { ...res, ok: false, problem: 'Titik angkat di rangka bawah: tanpa spreader, sling akan menekan dan merusak casing chiller.' };
  if (load.look === 'genset' && rig.kind !== 'spreader') return { ...res, ok: false, problem: 'Sling langsung akan menekan radiator dan panel genset: pakai spreader bar.' };
  if (load.look === 'blade' && rig.id !== 'yoke') return { ...res, ok: false, problem: 'Bilah fiberglass harus dijepit blade yoke: sling biasa bisa memecahkan atau melipat bilah.' };
  if (rig.id === 'yoke' && load.look !== 'blade') return { ...res, ok: false, problem: 'Blade yoke hanya untuk bilah rotor.' };
  if (load.look === 'nacelle' && rig.kind !== 'spreader') return { ...res, ok: false, problem: 'Sling langsung akan memecahkan cover nacelle (fiberglass): pakai spreader nacelle.' };
  return res;
}
