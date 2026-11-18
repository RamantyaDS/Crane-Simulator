// Crane models. SPEC, FLY and BLOCKS always hold the selected model (setModel switches them in place, so the rest of
// the code reads them like constants).
//
// Link-Belt RTC-80160 Series II, 145 t rough terrain crane. From the Link-Belt technical data 5825: 6-section pin &
// latch boom 12.9–59.5 m, boom angle −2.5° to 80°, five extend modes; 9.4 / 16.8 m offset fly (2–45°); Cummins QSL
// 8.9 L 257 kW at 2000 rpm, 1424 Nm at 1500; swing 1.5 rpm; main winch 22 mm rope, 115 kN line pull, 43.6 / 86 m/min
// (layer 1), rope permissible load 9 809 kg per part; outriggers full / intermediate / retracted, 0.66 m pontoons,
// 72.6 t jack reaction; counterweight 15.9 t or 26.7 t (hydraulic removal); 3.00 m wide, 4.90 m wheelbase, six
// 23.5R25 tyres, 6x6, steer modes front / rear / all / crab, 25.4 km/h; base machine 65.1 t with 15.9 t.
//
// Zoomlion ZAT40000H763, 4 000 t all-terrain crane. From Zoomlion's product page: 10-axle chassis, 7-section main boom
// 19.8–95.4 m, boom angle −0.6° to 87°, wind-power boom 51–111 m (hook height to 206 m), Y-type superlift, outrigger
// base 16 × 16 m, carrier 22.5 × 3.0 × 3.31 m, 73.7 t travelling, 70 km/h, slew 0–0.7 rpm, single-line hoist speed
// 120 m/min, boom raising 360 s, telescoping 30 min, maximum load moment 8 000 t·m (basic boom) and 6 300 t·m (long main
// boom + long wind boom). No public load chart: its ratings are estimated (see chart.ts). Values marked est. are not
// published (counterweight, masses, dimensions of the upper).
export type ModelId = 'linkbelt' | 'zoomlion';

const LINKBELT = {
  model: 'linkbelt' as ModelId,
  name: 'Link-Belt RTC-80160 II',
  width: 3.0,
  wheelbase: 4.9,
  axles: [2.45, -1.05, -2.45], // z of the axles from the carrier centre (est. spacing)
  steerAxles: 1, // axles at the front that steer with the front
  tyreR: 0.81, // 23.5R25
  tyreW: 0.6,
  track: 2.4, // tyre centre to tyre centre (est.)
  carrierLen: 11.2, // est.
  deckY: 1.75, // carrier deck height (est.)
  // upper: swing centre at the carrier centre, boom foot pin at the rear of the upper
  pin: { z: -1.15, y: 2.75 }, // est., in the upper's frame
  headLen: 0.45, // pin to the head sheave line beyond the nominal length (est.)
  boomMin: 12.88,
  boomMax: 59.5,
  // pinned lengths: the chart columns (range columns use their lower bound)
  stops: [12.88, 16.8, 21.3, 25.9, 30.5, 35.1, 39.49, 44.2, 47.23, 48.8, 51.8, 53.3, 54.94, 56.4, 59.5],
  angleMin: (-2.5 * Math.PI) / 180,
  angleMax: (80 * Math.PI) / 180,
  luffRate: (1.6 * Math.PI) / 180, // rad/s at full engine speed (est.: −2.5 → 80° in about 50 s)
  teleRate: 0.35, // m/s of boom length (est.: pin & latch, one section at a time)
  fastNote: '', // which motions run faster than the real crane (for playability)
  swingRate: (1.5 * 2 * Math.PI) / 60, // 1.5 rpm
  swingAccel: 0.06, // rad/s² (est.)
  // winch
  lineSpeed: [43.6 / 60, 86 / 60], // m/s per part, normal / high
  linePull: 115450, // N
  ropeLimit: 9809, // kg per part (37x7 rotation resistant, 22 mm)
  ropeTotal: 274.3, // m on the main drum
  // outriggers: pontoon centres from the carrier centre (est. from the outline drawing)
  outrigger: {
    full: { x: 4.1, z: 3.9 },
    mid: { x: 2.8, z: 3.9 },
    retracted: { x: 1.65, z: 3.9 },
    pad: 0.66, // m pontoon diameter
    stroke: 0.75, // jack stroke below the beam (est.)
    jackRate: 0.05, // m/s
  },
  counterweights: [0, 15.9, 26.7], // t
  // masses (t) for stability (est. split of the 65.1 t base machine with 15.9 t counterweight)
  mass: { carrier: 31.0, upper: 8.2, boomBase: 9.5, boomPerM: 0.12, fly: [0, 1.3, 2.1] },
  cwArm: -3.55, // counterweight centre behind the swing centre (est.)
  superlift: false,
  flyBall: true, // the fly works on a single line with the hook ball
  cwBox: { x: 1.4, z: 0.9, y0: 1.6, y1: 3.6 }, // counterweight block for collisions (upper frame, half sizes)
  deflRef: 59.5, // boom deflection: reference length and stiffness factor
  deflK: 1,
  cabEye: [1.15, 3.8, 1.7], // operator's eye in the upper frame
  // engine
  idleRpm: 750,
  maxRpm: 2100,
  topSpeed: 25.4 / 3.6,
  lowSpeed: 8 / 3.6,
  maxSteer: 0.6, // rad
  fuelL: 568, // est.
};

export type Spec = typeof LINKBELT;

const ZOOMLION: Spec = {
  model: 'zoomlion',
  name: 'Zoomlion ZAT40000H763',
  width: 3.0,
  wheelbase: 18.4,
  axles: [9.2, 7.15, 5.1, 3.05, 1.0, -1.0, -3.05, -5.1, -7.15, -9.2], // 10 axles (est. spacing over the 22.5 m chassis)
  steerAxles: 5,
  tyreR: 0.78,
  tyreW: 0.52,
  track: 2.45,
  carrierLen: 22.5,
  deckY: 2.2,
  pin: { z: -3.2, y: 4.8 }, // est.
  headLen: 1.4,
  boomMin: 19.8,
  boomMax: 95.4,
  stops: [19.8, 32.4, 45.0, 57.6, 70.2, 82.8, 95.4], // base + 6 telescopic sections, pinned at full stroke (est.)
  angleMin: (-0.6 * Math.PI) / 180,
  angleMax: (87 * Math.PI) / 180,
  luffRate: ((3 * 87.6) / 360 * Math.PI) / 180, // raising takes 360 s on the real crane: 3× faster here
  teleRate: 75.6 / 240, // telescoping takes 30 min on the real crane: 7.5× faster here
  fastNote: 'Dipercepat supaya bisa dimainkan: telescope 7,5× (aslinya 30 menit), luffing 3× (aslinya 360 s), hoist 3× (aslinya 120 m/menit tali tunggal).',
  swingRate: (0.7 * 2 * Math.PI) / 60, // 0.7 rpm
  swingAccel: 0.01,
  lineSpeed: [3.0, 6.0], // 120 m/min single line at high speed on the real crane: 3× here
  linePull: 300000, // est.
  ropeLimit: 25000, // kg per part (est., large-diameter rope)
  ropeTotal: 2600, // est. (two winches)
  outrigger: {
    full: { x: 8.0, z: 8.0 }, // 16 × 16 m
    mid: { x: 5.5, z: 8.0 },
    retracted: { x: 2.4, z: 8.0 },
    pad: 2.2, // est.
    stroke: 1.0,
    jackRate: 0.04,
  },
  counterweights: [0, 180, 360], // t (est.)
  mass: { carrier: 74, upper: 70, boomBase: 95, boomPerM: 0.4, fly: [0, 38, 55, 72] }, // est.
  cwArm: -8.5, // est.
  superlift: true,
  flyBall: false, // the wind boom carries a multi-sheave block
  cwBox: { x: 2.8, z: 2.0, y0: 3.0, y1: 7.0 },
  deflRef: 95.4,
  deflK: 0.2,
  cabEye: [2.15, 4.3, 1.9],
  idleRpm: 700,
  maxRpm: 1900,
  topSpeed: 70 / 3.6,
  lowSpeed: 12 / 3.6,
  maxSteer: 0.5,
  fuelL: 1200, // est.
};

export const SPEC: Spec = structuredClone(LINKBELT);

export const FLY = { lengths: [0, 9.4, 16.8], offsets: [2, 15, 30, 45], label: 'Fly jib' };

export interface Block {
  id: string;
  name: string;
  rating: number;
  sheaves: number;
  mass: number;
}
/** Hook blocks: rating, sheaves (parts of line = 2 × sheaves + 1), mass (mass est.). */
const LB_BLOCKS: Block[] = [
  { id: 'ball', name: 'Hook ball 10,8 t', rating: 10800, sheaves: 0, mass: 380 },
  { id: 'b1', name: 'Hook block 1 sheave 31,7 t', rating: 31700, sheaves: 1, mass: 640 },
  { id: 'b4', name: 'Hook block 4 sheave 45,3 t', rating: 45300, sheaves: 4, mass: 950 },
  { id: 'b5', name: 'Hook block 5 sheave 72,5 t', rating: 72500, sheaves: 5, mass: 1180 },
  { id: 'b6', name: 'Hook block 6 sheave 90,7 t', rating: 90700, sheaves: 6, mass: 1450 },
  { id: 'b7', name: 'Hook block 7 sheave 136 t', rating: 136000, sheaves: 7, mass: 1850 },
];
const ZL_BLOCKS: Block[] = [
  { id: 'ball', name: 'Hook ball 50 t', rating: 50000, sheaves: 0, mass: 2500 },
  { id: 'b1', name: 'Hook block 250 t', rating: 250000, sheaves: 5, mass: 4500 },
  { id: 'b4', name: 'Hook block 800 t', rating: 800000, sheaves: 16, mass: 12000 },
  { id: 'b5', name: 'Hook block 1 600 t', rating: 1600000, sheaves: 32, mass: 22000 },
  { id: 'b6', name: 'Hook block ganda 2 500 t', rating: 2500000, sheaves: 50, mass: 34000 },
  { id: 'b7', name: 'Hook block ganda 4 000 t', rating: 4000000, sheaves: 80, mass: 52000 },
];
export const BLOCKS: Block[] = [...LB_BLOCKS];
export type BlockId = string;
/** Most parts of line a block can take (head has enough sheaves): 2 per sheave, +1 with the dead end on the block. */
export const maxParts = (sheaves: number) => (sheaves === 0 ? 1 : sheaves * 2 + 1);

export const MODELS: { id: ModelId; name: string; note: string }[] = [
  { id: 'linkbelt', name: 'Link-Belt RTC-80160 II · 145 t', note: 'Rough terrain 6x6 · load chart resmi Link-Belt' },
  { id: 'zoomlion', name: 'Zoomlion ZAT40000H763 · 4 000 t', note: 'All-terrain 10 gandar · superlift · boom wind · chart perkiraan' },
];

const START_MODEL: ModelId = (() => {
  try {
    return localStorage.getItem('crane-model') === 'zoomlion' ? 'zoomlion' : 'linkbelt';
  } catch {
    return 'linkbelt';
  }
})();

/** Switch every model table to the chosen crane. */
export function setModel(id: ModelId) {
  const s = id === 'zoomlion' ? ZOOMLION : LINKBELT;
  Object.assign(SPEC, structuredClone(s));
  if (id === 'zoomlion') Object.assign(FLY, { lengths: [0, 51, 81, 111], offsets: [0, 5, 10, 15], label: 'Boom wind' });
  else Object.assign(FLY, { lengths: [0, 9.4, 16.8], offsets: [2, 15, 30, 45], label: 'Fly jib' });
  BLOCKS.splice(0, BLOCKS.length, ...(id === 'zoomlion' ? ZL_BLOCKS : LB_BLOCKS));
}

// Full-load torque (Nm) of the Cummins QSL 8.9: 1424 at 1500, 257 kW (1227 Nm) at 2000. The Zoomlion's engines are not
// published; the same curve shape is used only for sound and pump speed.
const TORQUE: [number, number][] = [
  [600, 700],
  [1000, 1150],
  [1300, 1380],
  [1500, 1424],
  [1800, 1340],
  [2000, 1227],
  [2150, 0],
];
export function maxTorque(rpm: number) {
  if (rpm <= TORQUE[0][0]) return TORQUE[0][1] * Math.max(0, rpm / TORQUE[0][0]);
  for (let i = 1; i < TORQUE.length; i++) {
    const [r0, t0] = TORQUE[i - 1];
    const [r1, t1] = TORQUE[i];
    if (rpm <= r1) return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
  }
  return 0;
}

if (START_MODEL !== 'linkbelt') setModel(START_MODEL);

/** Pick the crane: remembered, and the page reloads so every part is built for it. */
export function chooseModel(id: ModelId) {
  try {
    localStorage.setItem('crane-model', id);
  } catch {
    /* private mode: the choice lasts until the reload only */
  }
  location.reload();
}
