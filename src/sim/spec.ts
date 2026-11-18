// Link-Belt RTC-80160 Series II, 145 t rough terrain crane. From the Link-Belt technical data 5825: 6-section pin &
// latch boom 12.9–59.5 m, boom angle −2.5° to 80°, five extend modes; 9.4 / 16.8 m offset fly (2–45°); Cummins QSL
// 8.9 L 257 kW at 2000 rpm, 1424 Nm at 1500; swing 1.5 rpm; main winch 22 mm rope, 115 kN line pull, 43.6 / 86 m/min
// (layer 1), rope permissible load 9 809 kg per part; outriggers full / intermediate / retracted, 0.66 m pontoons,
// 72.6 t jack reaction; counterweight 15.9 t or 26.7 t (hydraulic removal); 3.00 m wide, 4.90 m wheelbase, six
// 23.5R25 tyres, 6x6, steer modes front / rear / all / crab, 25.4 km/h; base machine 65.1 t with 15.9 t.
// Values marked est. are not in the document (dimensions read off drawings, mass split).
export const SPEC = {
  width: 3.0,
  wheelbase: 4.9,
  axles: [2.45, -1.05, -2.45], // z of the three axles from the carrier centre (est. spacing)
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
  counterweights: [0, 15.9, 26.7] as const, // t
  // masses (t) for stability (est. split of the 65.1 t base machine with 15.9 t counterweight)
  mass: { carrier: 31.0, upper: 8.2, boomBase: 9.5, boomPerM: 0.12, fly: [0, 1.3, 2.1] },
  cwArm: -3.55, // counterweight centre behind the swing centre (est.)
  // engine
  idleRpm: 750,
  maxRpm: 2100,
  topSpeed: 25.4 / 3.6,
  lowSpeed: 8 / 3.6,
  maxSteer: 0.6, // rad
  fuelL: 568, // est.
};

export const FLY = { lengths: [0, 9.4, 16.8], offsets: [2, 15, 30, 45] };

/** Hook blocks in the document: rating, sheaves, mass (mass est.). */
export const BLOCKS = [
  { id: 'ball', name: 'Hook ball 10,8 t', rating: 10800, sheaves: 0, mass: 380 },
  { id: 'b1', name: 'Hook block 1 sheave 31,7 t', rating: 31700, sheaves: 1, mass: 640 },
  { id: 'b4', name: 'Hook block 4 sheave 45,3 t', rating: 45300, sheaves: 4, mass: 950 },
  { id: 'b5', name: 'Hook block 5 sheave 72,5 t', rating: 72500, sheaves: 5, mass: 1180 },
  { id: 'b6', name: 'Hook block 6 sheave 90,7 t', rating: 90700, sheaves: 6, mass: 1450 },
  { id: 'b7', name: 'Hook block 7 sheave 136 t', rating: 136000, sheaves: 7, mass: 1850 },
] as const;
export type BlockId = (typeof BLOCKS)[number]['id'];
/** Most parts of line a block can take (head has enough sheaves): 2 per sheave, +1 with the dead end on the block. */
export const maxParts = (sheaves: number) => (sheaves === 0 ? 1 : sheaves * 2 + 1);

// Cummins QSL 8.9 full-load torque (Nm): 1424 at 1500, 257 kW (1227 Nm) at 2000
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
