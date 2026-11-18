// Factory construction site: a half-built steel-frame factory with a mezzanine deck and an annex roof, a genset house,
// a transformer bay, a tank foundation and a press pit; compacted gravel with a soft fill strip by an excavation and
// a 20 kV overhead line along the east edge. The loads wait in the laydown yard; each has a marked destination.
// World axes: x east, z north, y up, metres.
import { inside, type Obb } from './geom';

export type Ground = 'gravel' | 'soft' | 'concrete';
/** Allowable ground bearing pressure (kPa) of each surface. */
export const BEARING: Record<Ground, number> = { gravel: 600, soft: 110, concrete: 1500 }; // kPa: well-compacted gravel, loose fill, slab

function box(id: string, x: number, z: number, sx: number, sz: number, y0: number, y1: number, yaw = 0): Obb {
  return { id, x, z, hx: sx / 2, hz: sz / 2, yaw, y0, y1 };
}

// ---------- buildings ----------
export const FACTORY = { x0: -6, x1: 34, z0: 14, z1: 44, eave: 12, mezz: { x0: 18, x1: 34, z0: 30, z1: 44, y: 6 } };
export const ANNEX = { x0: 40, x1: 54, z0: 12, z1: 26, h: 8 };
export const GENHOUSE = { x: -24, z: 24, w: 9, d: 5.5, h: 4 };
export const SOFT = { x0: -14, x1: 2, z0: -34, z1: -24 }; // soft fill beside the excavation
export const EXCAVATION = { x0: -12, x1: 0, z0: -42, z1: -35, depth: 3 };
export const POWERLINE = { x: 66, y: 11, z0: -60, z1: 60 }; // three 20 kV conductors at y 11, x 65.2/66/66.8
export const MIN_APPROACH = 3.05; // m, ≤ 50 kV (ASME B30.5 / OSHA 1926.1408 table A)

/** Columns of the factory frame: 8 m bays. */
export const COLUMNS: [number, number][] = [];
for (let x = FACTORY.x0; x <= FACTORY.x1; x += 8) for (const z of [FACTORY.z0, FACTORY.z1]) COLUMNS.push([x, z]);
for (let z = FACTORY.z0 + 10; z < FACTORY.z1; z += 10) for (const x of [FACTORY.x0, FACTORY.x1]) COLUMNS.push([x, z]);

/** Raised surfaces a load can be set on: [id, box in plan, top height]. */
export const SURFACES: { id: string; b: Obb; y: number }[] = [
  { id: 'mezz', b: box('mezz', (FACTORY.mezz.x0 + FACTORY.mezz.x1) / 2, (FACTORY.mezz.z0 + FACTORY.mezz.z1) / 2, FACTORY.mezz.x1 - FACTORY.mezz.x0, FACTORY.mezz.z1 - FACTORY.mezz.z0, 0, FACTORY.mezz.y), y: FACTORY.mezz.y },
  { id: 'annex', b: box('annex', (ANNEX.x0 + ANNEX.x1) / 2, (ANNEX.z0 + ANNEX.z1) / 2, ANNEX.x1 - ANNEX.x0, ANNEX.z1 - ANNEX.z0, 0, ANNEX.h), y: ANNEX.h },
];

export const OBSTACLES: Obb[] = [
  ...COLUMNS.map(([x, z], i) => box(`col${i}`, x, z, 0.5, 0.5, 0, FACTORY.eave)),
  // eaves beams and roof trusses over the east half (the west half is still open)
  box('eaveN', (FACTORY.x0 + FACTORY.x1) / 2, FACTORY.z1, FACTORY.x1 - FACTORY.x0, 0.5, FACTORY.eave - 0.8, FACTORY.eave),
  box('eaveS', (FACTORY.x0 + FACTORY.x1) / 2, FACTORY.z0, FACTORY.x1 - FACTORY.x0, 0.5, FACTORY.eave - 0.8, FACTORY.eave),
  box('roofE', 26, (FACTORY.z0 + FACTORY.z1) / 2, 16, FACTORY.z1 - FACTORY.z0, FACTORY.eave - 0.2, FACTORY.eave + 2.5),
  box('mezzdeck', (FACTORY.mezz.x0 + FACTORY.mezz.x1) / 2, (FACTORY.mezz.z0 + FACTORY.mezz.z1) / 2, FACTORY.mezz.x1 - FACTORY.mezz.x0, FACTORY.mezz.z1 - FACTORY.mezz.z0, FACTORY.mezz.y - 0.4, FACTORY.mezz.y),
  box('annex', (ANNEX.x0 + ANNEX.x1) / 2, (ANNEX.z0 + ANNEX.z1) / 2, ANNEX.x1 - ANNEX.x0, ANNEX.z1 - ANNEX.z0, 0, ANNEX.h),
  // genset house: three walls (open to the south for the set to come in from above), no roof yet
  box('ghW', GENHOUSE.x - GENHOUSE.w / 2, GENHOUSE.z, 0.25, GENHOUSE.d, 0, GENHOUSE.h),
  box('ghE', GENHOUSE.x + GENHOUSE.w / 2, GENHOUSE.z, 0.25, GENHOUSE.d, 0, GENHOUSE.h),
  box('ghN', GENHOUSE.x, GENHOUSE.z + GENHOUSE.d / 2, GENHOUSE.w, 0.25, 0, GENHOUSE.h),
  // transformer fire walls
  box('fwW', -38, -2, 0.3, 6, 0, 5),
  box('fwE', -30, -2, 0.3, 6, 0, 5),
  // site cabins and the fence
  box('cabin1', 30, -40, 6, 2.5, 0, 2.7),
  box('cabin2', 37, -40, 6, 2.5, 0, 2.7),
  box('fenceS', 0, -62, 140, 0.3, 0, 2.2),
  box('fenceW', -70, 0, 0.3, 124, 0, 2.2),
  box('fenceN', 0, 62, 140, 0.3, 0, 2.2),
  ...[-50, -25, 0, 25, 50].map((z, i) => box(`pole${i}`, POWERLINE.x, z, 0.5, 0.5, 0, POWERLINE.y + 1)),
];

export function groundAt(x: number, z: number): Ground {
  if (x > SOFT.x0 && x < SOFT.x1 && z > SOFT.z0 && z < SOFT.z1) return 'soft';
  if (x > FACTORY.x0 && x < FACTORY.x1 && z > FACTORY.z0 && z < FACTORY.z1) return 'concrete';
  return 'gravel';
}

export const inExcavation = (x: number, z: number) => x > EXCAVATION.x0 && x < EXCAVATION.x1 && z > EXCAVATION.z0 && z < EXCAVATION.z1;

/** Top of whatever a load set down at (x, z) rests on (ground, foundations, timbers, raised decks). */
export function surfaceAt(x: number, z: number) {
  let h = inExcavation(x, z) ? -EXCAVATION.depth : 0;
  for (const s of SURFACES) if (inside(s.b, x, z)) h = Math.max(h, s.y);
  for (const f of FOUNDATIONS) if (inside(f.b, x, z)) h = Math.max(h, f.y);
  return h;
}

// ---------- loads ----------
export interface LoadDef {
  id: string;
  name: string;
  kg: number;
  size: [number, number, number]; // x (length), y (height), z (width)
  cg: [number, number, number]; // centre of mass from the base centre
  points: [number, number, number][]; // lifting points from the base centre
  pairs: number[][]; // which points a 2-leg sling uses (the first) / a 4-leg uses all
  start: { x: number; z: number; yaw: number; y: number };
  dest: { x: number; z: number; yaw: number; y: number; label: string };
  note: string;
  look: 'genset' | 'transformer' | 'chiller' | 'slab' | 'beams' | 'tank' | 'press';
}

export const FOUNDATIONS: { id: string; b: Obb; y: number }[] = [];
function dest(id: string, x: number, z: number, yaw: number, y: number, sx: number, sz: number, label: string, raised = 0) {
  if (raised > 0) FOUNDATIONS.push({ id, b: box(id, x, z, sx, sz, 0, raised, yaw), y: raised });
  return { x, z, yaw, y, label };
}

const LAY = { x: 12, z: -18 }; // laydown yard

export const LOADS: LoadDef[] = [
  {
    id: 'genset',
    name: 'Genset Traknus 2250 kVA',
    kg: 14800,
    size: [5.9, 2.55, 2.2],
    cg: [0.13, 1.05, 0],
    points: [
      [-2.75, 0.36, 1.03],
      [2.75, 0.36, 1.03],
      [2.75, 0.36, -1.03],
      [-2.75, 0.36, -1.03],
    ],
    pairs: [[0, 1, 2, 3]],
    start: { x: LAY.x - 14, z: LAY.z, yaw: 0, y: 0.2 },
    dest: dest('genset', GENHOUSE.x, GENHOUSE.z - 0.2, 0, 0.3, 6.6, 2.8, 'Rumah genset', 0.3),
    note: 'Empat lifting eye di rangka dasar. Pakai spreader bar supaya sling tidak menekan radiator dan panel.',
    look: 'genset',
  },
  {
    id: 'transformer',
    name: 'Trafo daya 60 MVA',
    kg: 45000,
    size: [4.6, 3.7, 2.7],
    cg: [0.2, 1.5, 0],
    points: [
      [-2.0, 3.4, 1.1],
      [2.0, 3.4, 1.1],
      [2.0, 3.4, -1.1],
      [-2.0, 3.4, -1.1],
    ],
    pairs: [[0, 1, 2, 3]],
    start: { x: LAY.x - 3, z: LAY.z, yaw: 0, y: 0 },
    dest: dest('transformer', -34, -2, Math.PI / 2, 0.5, 5.2, 3.2, 'Bay trafo', 0.5),
    note: 'Lifting lug di atas tangki. Berat: harus dekat crane (radius kecil).',
    look: 'transformer',
  },
  {
    id: 'chiller',
    name: 'Chiller AC pabrik',
    kg: 9200,
    size: [9.0, 2.5, 2.3],
    cg: [-0.6, 1.0, 0],
    points: [
      [-4.2, 0.15, 1.15],
      [4.2, 0.15, 1.15],
      [4.2, 0.15, -1.15],
      [-4.2, 0.15, -1.15],
    ],
    pairs: [[0, 1, 2, 3]],
    start: { x: LAY.x + 8, z: LAY.z, yaw: 0, y: 0.15 },
    dest: dest('chiller', 47, 19, 0, ANNEX.h + 0.3, 9.6, 2.8, 'Atap annex (8 m)', 0),
    note: 'Titik angkat di rangka bawah: wajib spreader bar. Pusat berat tidak di tengah (sisi kompresor).',
    look: 'chiller',
  },
  {
    id: 'slab',
    name: 'Pelat beton precast',
    kg: 12000,
    size: [10, 0.4, 2.4],
    cg: [0, 0.2, 0],
    points: [
      [-3.0, 0.4, 0.6],
      [3.0, 0.4, 0.6],
      [3.0, 0.4, -0.6],
      [-3.0, 0.4, -0.6],
    ],
    pairs: [[0, 1, 2, 3]],
    start: { x: LAY.x - 3, z: LAY.z - 9, yaw: 0, y: 0.15 },
    dest: dest('slab', 26, 37, 0, FACTORY.mezz.y, 10.5, 2.8, 'Lantai mezzanine (6 m)', 0),
    note: 'Empat insert angkat. Diletakkan masuk ke dalam rangka gedung: awas kolom dan balok.',
    look: 'slab',
  },
  {
    id: 'beams',
    name: 'Bundel balok baja WF',
    kg: 7400,
    size: [12, 0.9, 1.0],
    cg: [0.4, 0.45, 0],
    points: [
      [-3.5, 0.9, 0],
      [3.5, 0.9, 0],
    ],
    pairs: [[0, 1]],
    start: { x: LAY.x + 8, z: LAY.z - 9, yaw: 0, y: 0.15 },
    dest: dest('beams', 10, 22, 0, 0, 12.6, 1.6, 'Lantai gedung (dalam rangka)', 0),
    note: 'Panjang 12 m: gampang berputar, pakai tag line. Sling 2 kaki model choker.',
    look: 'beams',
  },
  {
    id: 'tank',
    name: 'Tangki proses 60 t',
    kg: 60000,
    size: [10, 3.8, 3.6],
    cg: [0, 1.9, 0],
    points: [
      [-3.0, 3.8, 0],
      [3.0, 3.8, 0],
    ],
    pairs: [[0, 1]],
    start: { x: LAY.x + 22, z: LAY.z + 2, yaw: 0, y: 0 },
    dest: dest('tank', 4, -6, 0, 0.6, 10.6, 4.0, 'Pondasi tangki', 0.6),
    note: 'Dua lug di atas. Perlu counterweight 26,7 t, outrigger penuh, dan radius pendek.',
    look: 'tank',
  },
  {
    id: 'press',
    name: 'Mesin press stamping 100 t (BEBAN MAKSIMAL)',
    kg: 100000,
    size: [3.0, 4.2, 2.5],
    cg: [0.1, 1.8, 0],
    points: [
      [-1.2, 4.2, 0.9],
      [1.2, 4.2, 0.9],
      [1.2, 4.2, -0.9],
      [-1.2, 4.2, -0.9],
    ],
    pairs: [[0, 1, 2, 3]],
    start: { x: -14 + 3.4, z: 2, yaw: Math.PI / 2, y: 0.25 },
    dest: dest('press', -14 - 3.4, 2, Math.PI / 2, 0.4, 3.4, 3.0, 'Pondasi press', 0.4),
    note: 'Dengan hook block 7 sheave dan spreader berat, total ±103 t: hanya boleh di radius ≤ 3,5 m (chart 106,6 t), CW 26,7 t, outrigger penuh. Posisikan crane di titik "lift plan".',
    look: 'press',
  },
];

/** Where the lift plan puts the crane for the press (between the press and its pit). */
export const PRESS_SPOT = { x: -14, z: 2, heading: 0 };
/** Where the crane starts: by the gate. */
export const START = { x: -30, z: -50, heading: Math.PI / 2 };

// ---------- rigging ----------
export interface RigItem {
  id: string;
  name: string;
  kind: 'bridle2' | 'bridle4' | 'spreader';
  legLen: number; // m (for a spreader: the top legs; the bottom legs hang straight)
  wll: number; // kg per leg
  span?: number; // spreader length
  spreaderWll?: number;
  kg: number; // mass of the whole set
}

export const RIGGING: RigItem[] = [
  { id: 's2-4-10', name: 'Sling baja 2 kaki · 4 m · 10 t/kaki', kind: 'bridle2', legLen: 4, wll: 10000, kg: 90 },
  { id: 's2-6-20', name: 'Sling baja 2 kaki · 6 m · 20 t/kaki', kind: 'bridle2', legLen: 6, wll: 20000, kg: 210 },
  { id: 's2-6-35', name: 'Sling baja 2 kaki · 6 m · 35 t/kaki', kind: 'bridle2', legLen: 6, wll: 35000, kg: 380 },
  { id: 's4-3-5', name: 'Sling rantai 4 kaki · 3 m · 5,3 t/kaki', kind: 'bridle4', legLen: 3, wll: 5300, kg: 120 },
  { id: 's4-4-11', name: 'Sling rantai 4 kaki · 4 m · 11,2 t/kaki', kind: 'bridle4', legLen: 4, wll: 11200, kg: 260 },
  { id: 's4-6-22', name: 'Sling rantai 4 kaki · 6 m · 22,4 t/kaki', kind: 'bridle4', legLen: 6, wll: 22400, kg: 640 },
  { id: 'sp4', name: 'Spreader bar 4 m (30 t) + sling 4 m', kind: 'spreader', legLen: 4, wll: 16000, span: 4, spreaderWll: 30000, kg: 620 },
  { id: 'sp6', name: 'Spreader bar 5,5 m (25 t) + sling 6 m', kind: 'spreader', legLen: 6, wll: 16000, span: 5.5, spreaderWll: 25000, kg: 900 },
  { id: 'sp9', name: 'Spreader bar 9 m (20 t) + sling 6 m', kind: 'spreader', legLen: 6, wll: 11200, span: 9, spreaderWll: 20000, kg: 1150 },
  { id: 'sp3h', name: 'Spreader berat 3 m (150 t) + sling 4 m', kind: 'spreader', legLen: 4, wll: 60000, span: 3, spreaderWll: 150000, kg: 2200 },
];
