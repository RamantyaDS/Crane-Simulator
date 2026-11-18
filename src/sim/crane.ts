// Link-Belt RTC-80160 Series II simulation. Pure logic; the scene, sound and panels read it.
//   carrier: hydrostatic 6x6 drive, steer modes front / rear / all / crab, outrigger beams and jacks, ground bearing
//            and sinking pads, levelling
//   upper:   swing with brake and lock, luffing, pin & latch telescope, offset fly, main winch with reeving, two-block
//   RCL:     rated capacity from the Link-Belt chart, dynamic hook load from the rope, lockout of moment-increasing
//            functions, bypass
//   lift:    rigging, a load hanging as a pendulum on the rope (swing-out, side pull, wind), lift-off, landing,
//            collisions, the power line
//   stability: real tipping about the edge of the support polygon (pads or tyres); boom failure where the chart is
//            limited by strength
// Frames: carrier "c" (x left, z forward, y up; origin carrier centre on the ground), upper "u" (same, turned by the
// slew), world (x, z, heading like the forklift: c+z → (sin h, cos h)).
import { rated, stopIndex, type Rating, type Support } from './chart';
import { clamp, inside, overlaps, toLocal, toWorld, type Obb } from './geom';
import { plan, type RigPlan } from './rigging';
import { BEARING, LOADS, MIN_APPROACH, OBSTACLES, POWERLINE, RIGGING, START, START_ZL, groundAt, inExcavation, surfaceAt, type LoadDef } from './site';
import { BLOCKS, FLY, SPEC, maxParts, maxTorque, type BlockId } from './spec';

const G = 9.81;
export type EngineState = 'off' | 'starting' | 'running' | 'stopping';
export type SteerMode = 'front' | 'rear' | 'all' | 'crab';
export type Dir = 'F' | 'N' | 'R';
export type BeamSet = 'retracted' | 'mid' | 'full';

export interface LoadState {
  def: LoadDef;
  x: number;
  y: number; // base bottom
  z: number;
  yaw: number;
  tilt: number; // hanging tilt (visual)
  state: 'rest' | 'air' | 'fallen';
  placed: boolean; // set down at its destination
  damage: number;
  slot?: number; // a rotor blade: which hub flange it was bolted to
}

export interface Crane {
  // carrier pose
  x: number;
  z: number;
  heading: number;
  v: number;
  steer: number;
  steerInput: number;
  steerMode: SteerMode;
  range: 'high' | 'low';
  dir: Dir;
  pedal: number;
  brake: number;
  park: boolean;
  // carrier attitude on its supports
  lift: number; // carrier raised above its ride height on the jacks
  pitch: number; // rad, nose up +
  roll: number; // rad, left up +
  onTyres: boolean;
  // outriggers
  beamSet: BeamSet;
  beam: number; // pad lateral distance now
  jacks: [number, number, number, number]; // extension (FL, FR, RL, RR)
  jackCmd: number; // −1 up, 0 hold, 1 down (all)
  autoLevel: boolean;
  mats: boolean;
  sink: [number, number, number, number];
  padKpa: [number, number, number, number];
  padLoad: [number, number, number, number]; // kg
  // engine
  engine: EngineState;
  starterT: number;
  rpm: number;
  hand: number; // hand throttle for crane work
  load: number;
  fuel: number;
  hours: number;
  // upper
  slew: number;
  slewV: number;
  swingBrake: number;
  swingLock: boolean;
  swingPark: boolean;
  cw: number; // t fitted
  cwTarget: number;
  cwT: number; // install / removal progress
  angle: number;
  length: number;
  fly: number; // 0, 9.4, 16.8 (erected length)
  flyTarget: number;
  flyOffset: number;
  flyT: number; // erection progress
  jibUp: number; // wind boom: 0 tip resting on the ground (as assembled), 1 raised to its working offset
  jibDown: boolean; // wind boom being let down onto the ground before it is taken apart
  pinTarget: number; // pin length the boom is telescoping to by itself (0 = none)
  // levers −1..1
  swingLever: number;
  luffLever: number; // + boom up
  teleLever: number; // + out
  hoistLever: number; // + up
  tagLever: number; // rigger's tag line: + turn the load left
  highSpeed: boolean;
  // winch and hook
  block: BlockId;
  parts: number;
  drum: number; // rope paid out from the drum, m
  hook: { x: number; y: number; z: number; vx: number; vy: number; vz: number };
  ropeLen: number; // suspension point to the hanging mass, m
  ropeRate: number;
  tension: number; // N on the rope at the hook (all parts)
  // lift
  loads: LoadState[];
  target: number; // index of the selected load
  rig: string | null; // rigging item fitted to the hook
  rigPlan: RigPlan | null;
  attached: number; // load on the rigging, −1 none
  take: number; // 0..1 share of the load's weight taken while it still rests
  // RCL and safety
  rating: Rating;
  hookKg: number;
  pct: number;
  lockout: boolean;
  bypass: boolean;
  twoBlock: boolean;
  limitBy: 'stabilitas' | 'struktur' | '-';
  tipLoadKg: number;
  wind: number; // m/s at the boom tip
  windSet: number; // mean wind
  lineDist: number; // closest approach to the power line, m
  // tipping
  tipEdge: number;
  tip: number;
  tipV: number;
  failed: '' | 'tipped' | 'boom' | 'line' | 'excavation' | 'sling';
  boomBend: number; // collapse animation 0..1
  // record
  maxPct: number;
  collisions: number;
  lockouts: number;
  time: number;
  events: string[];
  msg: string;
  rotor: number; // wind turbine hub angle, rad (turning gear, then free spinning)
  rotorV: number;
  turbine: boolean; // all blades on: the turbine runs
}

export function createLoads(): LoadState[] {
  return LOADS.filter((d) => !d.only || d.only === SPEC.model).map((def) => ({ def, x: def.start.x, y: def.start.y, z: def.start.z, yaw: def.start.yaw, tilt: 0, state: 'rest', placed: false, damage: 0 }));
}

export function create(): Crane {
  const zl = SPEC.model === 'zoomlion';
  const st = zl ? START_ZL : START;
  const c: Crane = {
    x: st.x,
    z: st.z,
    heading: st.heading,
    v: 0,
    steer: 0,
    steerInput: 0,
    steerMode: 'front',
    range: 'high',
    dir: 'N',
    pedal: 0,
    brake: 0,
    park: true,
    lift: 0,
    pitch: 0,
    roll: 0,
    onTyres: true,
    beamSet: 'retracted',
    beam: SPEC.outrigger.retracted.x,
    jacks: [0, 0, 0, 0],
    jackCmd: 0,
    autoLevel: false,
    mats: false,
    sink: [0, 0, 0, 0],
    padKpa: [0, 0, 0, 0],
    padLoad: [0, 0, 0, 0],
    engine: 'off',
    starterT: 0,
    rpm: 0,
    hand: 0,
    load: 0,
    fuel: 420,
    hours: 1520.3,
    slew: 0,
    slewV: 0,
    swingBrake: 0,
    swingLock: true,
    swingPark: true,
    cw: SPEC.counterweights[zl ? 2 : 1],
    cwTarget: SPEC.counterweights[zl ? 2 : 1],
    cwT: 0,
    angle: 0,
    length: SPEC.boomMin,
    fly: 0,
    flyTarget: 0,
    flyOffset: FLY.offsets[0],
    flyT: 0,
    jibUp: 1,
    jibDown: false,
    pinTarget: 0,
    swingLever: 0,
    luffLever: 0,
    teleLever: 0,
    hoistLever: 0,
    tagLever: 0,
    highSpeed: false,
    block: zl ? 'b5' : 'b4',
    parts: zl ? 8 : 4,
    drum: 0,
    hook: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    ropeLen: 2,
    ropeRate: 0,
    tension: 0,
    loads: createLoads(),
    target: 0,
    rig: null,
    rigPlan: null,
    attached: -1,
    take: 0,
    rating: { kg: 0, note: '' },
    hookKg: 0,
    pct: 0,
    lockout: false,
    bypass: false,
    twoBlock: false,
    limitBy: '-',
    tipLoadKg: 0,
    wind: 3,
    windSet: 3,
    lineDist: 99,
    tipEdge: -1,
    tip: 0,
    tipV: 0,
    failed: '',
    boomBend: 0,
    maxPct: 0,
    collisions: 0,
    lockouts: 0,
    time: 0,
    events: [],
    msg: '',
    rotor: 0,
    rotorV: 0,
    turbine: false,
  };
  // hook stowed: hanging a little below the boom head
  c.drum = ropeAlong(c) + 2.2 * c.parts;
  const tip = tipWorld(c);
  c.hook = { x: tip.x, y: tip.y - 2.6, z: tip.z, vx: 0, vy: 0, vz: 0 };
  c.ropeLen = 2.6;
  return c;
}

/** Lowering the hook runs this many times faster than the winch really pays out (waiting was too long). */
export const LOWER_BOOST = 3;

// ---------- geometry ----------

const blockOf = (c: Crane) => (c.fly > 0 && SPEC.flyBall ? BLOCKS[0] : BLOCKS.find((b) => b.id === c.block)!);
const partsOf = (c: Crane) => (c.fly > 0 && SPEC.flyBall ? 1 : c.parts);

/** Rope run from the drum along the boom (and fly) to the head, used for the hook's hanging length. */
function ropeAlong(c: Crane) {
  return c.length + SPEC.headLen + c.fly + 2;
}

/** Hanging length of each part of line, boom head to hook block. */
export const hangLen = (c: Crane) => Math.max(0.3, (c.drum - ropeAlong(c)) / partsOf(c));

/** Boom deflection at the head (m, downward from the straight line), from the hook load and the boom's own weight. */
export function deflection(c: Crane) {
  const k = (c.length + c.fly) / SPEC.deflRef;
  return (0.018 * (c.hookKg / 1000) + 0.05 * boomMass(c)) * k * k * k * 1.1 * Math.cos(c.angle) * SPEC.deflK;
}

const boomMass = (c: Crane) => SPEC.mass.boomBase + SPEC.mass.boomPerM * (c.length - SPEC.boomMin) + SPEC.mass.fly[FLY.lengths.indexOf(c.fly)];

/** Head (or fly tip) in the upper frame: x 0, y up, z outward along the boom. */
export function tipUpper(c: Crane) {
  const L = c.length + SPEC.headLen;
  let y = SPEC.pin.y + L * Math.sin(c.angle);
  let z = SPEC.pin.z + L * Math.cos(c.angle);
  if (c.fly > 0) {
    const a = jibElevation(c);
    y += c.fly * Math.sin(a);
    z += c.fly * Math.cos(a);
  }
  const d = deflection(c);
  return { y: y - d * Math.cos(c.angle), z: z + d * Math.sin(c.angle) * 0.4 };
}

/** Main boom angle at which the wind boom is raised from the ground (and let down again). */
export const JIB_RAISE_DEG = 75;

/** Elevation of the fly / wind boom (rad from horizontal). A wind boom just assembled lies with its tip on the ground
 *  (on the tip dolly) while the main boom goes up, and is raised to its offset once the boom is steep (jibUp); a raised
 *  one sits at its offset below the boom line. Never below the ground either way. */
function jibRest(c: Crane, len: number) {
  // head height above the ground, with the boom's sag and the crane standing on its jacks
  const h = SPEC.pin.y + (c.length + SPEC.headLen) * Math.sin(c.angle) - deflection(c) * Math.cos(c.angle) + c.lift;
  return -Math.asin(clamp((h - 0.6) / Math.max(1, len), -1, 1));
}
export function jibElevation(c: Crane, len = c.fly) {
  const rest = jibRest(c, len);
  const work = c.angle - (c.flyOffset * Math.PI) / 180;
  const up = c.flyTarget > c.fly ? 0 : c.jibUp; // still being assembled: on the ground
  const k = up * up * (3 - 2 * up);
  return Math.max(rest + (work - rest) * k, rest);
}
/** The wind boom's tip is on the ground (part of its weight goes there, not into the crane). */
const jibResting = (c: Crane) => c.fly > 0 && jibElevation(c) <= jibRest(c, c.fly) + 1e-6;

/** First thing in the way of a fly laid out on the ground ahead of the head (null: the strip is clear). */
export function laydownBlocked(c: Crane, len: number): string | null {
  const z0 = SPEC.pin.z + (c.length + SPEC.headLen) * Math.cos(c.angle);
  for (let d = 1; d <= len; d += 1.5) {
    const p = upperToWorld(c, 0, 1, z0 + d);
    for (const b of OBSTACLES) if (b.y0 < 2.5 && inside(b, p.x, p.z, 1.3)) return nameOf(b.id);
    for (const L of c.loads) if (L.state !== 'air' && !(L.def.bolt && L.placed) && L.y < 2.5 && inside(loadBox(L, L.x, L.y, L.z), p.x, p.z, 1.3)) return L.def.name;
  }
  return null;
}

/** Load radius as the RCL reads it: swing centre to the hook line, horizontal. */
export const radius = (c: Crane) => Math.max(0, tipUpper(c).z);

/** Carrier-frame point → world, with the carrier's attitude (small angles). */
function carrierToWorld(c: Crane, x: number, y: number, z: number) {
  // small-angle attitude: nose up (pitch +) lifts the front and leans high points back; left up (roll +) leans them right
  const yy = y + c.lift + z * Math.sin(c.pitch) + x * Math.sin(c.roll);
  const [wx, wz] = toWorld(c.x, c.z, c.heading, x - y * Math.sin(c.roll), z - y * Math.sin(c.pitch));
  return { x: wx, y: yy, z: wz };
}

function upperToCarrier(c: Crane, x: number, z: number) {
  const s = Math.sin(c.slew);
  const k = Math.cos(c.slew);
  return { x: x * k + z * s, z: -x * s + z * k };
}

export function upperToWorld(c: Crane, x: number, y: number, z: number) {
  const p = upperToCarrier(c, x, z);
  return carrierToWorld(c, p.x, y, p.z);
}

/** Put the hook right under the boom head at its hanging length (after moving the crane by hand). */
export function resetHook(c: Crane) {
  const t = tipWorld(c);
  c.ropeLen = hangLen(c) + 0.6;
  c.hook = { x: t.x, y: t.y - c.ropeLen, z: t.z, vx: 0, vy: 0, vz: 0 };
  c.tension = blockOf(c).mass * G;
}

export function tipWorld(c: Crane) {
  const t = tipUpper(c);
  return upperToWorld(c, 0, t.y, t.z);
}

/** Pad positions in the carrier frame: FL, FR, RL, RR. */
export function pads(c: Crane): [number, number][] {
  const zf = SPEC.outrigger.full.z;
  return [
    [c.beam, zf],
    [-c.beam, zf],
    [c.beam, -zf],
    [-c.beam, -zf],
  ];
}

const PAD_CLEAR = 0.42; // pad bottom above the ground with the jack retracted and the crane on its tyres

// ---------- driver actions ----------

const say = (c: Crane, m: string) => (c.msg = m);

export function startEngine(c: Crane) {
  if (c.engine !== 'off' || c.failed) return;
  if (c.dir !== 'N') return say(c, 'Tuas arah ke N (netral) dulu untuk menstarter mesin.');
  c.engine = 'starting';
  c.starterT = 0;
  c.events.push('start');
}
export function stopEngine(c: Crane) {
  if (c.engine === 'off' || c.engine === 'stopping') return;
  c.engine = 'stopping';
  c.events.push('stop');
}
export function setDir(c: Crane, d: Dir) {
  if (Math.abs(c.v) > 0.5 && d !== 'N' && ((d === 'F' && c.v < 0) || (d === 'R' && c.v > 0))) return say(c, 'Berhenti dulu sebelum ganti arah.');
  c.dir = d;
  c.events.push('dir');
}
export function setBeams(c: Crane, b: BeamSet) {
  if (c.jacks.some((j) => j > 0.02)) return say(c, 'Naikkan semua jack dulu sebelum menggerakkan beam outrigger.');
  c.beamSet = b;
  c.events.push('beam');
}
export function toggleSwingLock(c: Crane) {
  if (!c.swingLock) {
    const near = Math.abs(Math.sin(c.slew)) < 0.02;
    if (!near) return say(c, 'Swing lock hanya bisa dipasang saat boom lurus di depan atau belakang.');
    if (Math.abs(c.slewV) > 0.005) return say(c, 'Hentikan swing dulu.');
    c.slew = Math.round(c.slew / Math.PI) * Math.PI;
  }
  c.swingLock = !c.swingLock;
  c.events.push('lock');
}
export function setCounterweight(c: Crane, t: number) {
  if (c.attached >= 0 && c.loads[c.attached].state === 'air') return say(c, 'Turunkan beban dulu sebelum mengganti counterweight.');
  if (Math.abs(Math.sin(c.slew)) > 0.05 || Math.cos(c.slew) < 0) return say(c, 'Counterweight dipasang/dilepas hidraulik dengan upper menghadap belakang (boom di atas depan): putar upper sampai boom lurus di depan.');
  c.cwTarget = t;
  c.cwT = 0;
  c.events.push('cw');
}
/** Lock the boom on the nearest pin position (or the next one out / in with dir ±1). */
export function lockBoom(c: Crane, dir = 0) {
  if (c.attached >= 0 && c.loads[c.attached].state === 'air' && c.pct > 0.1) return say(c, 'Pin & latch: turunkan beban dulu, boom tidak bisa di-telescope saat membawa beban.');
  const stops = SPEC.stops;
  let target = stops.reduce((a, s) => (Math.abs(s - c.length) < Math.abs(a - c.length) ? s : a), stops[0]);
  if (dir > 0) target = stops.find((s) => s > c.length + 0.05) ?? stops[stops.length - 1];
  if (dir < 0) target = [...stops].reverse().find((s) => s < c.length - 0.05) ?? stops[0];
  c.pinTarget = target;
  say(c, `Telescope ke posisi pin ${target.toString().replace('.', ',')} m…`);
}

export function setFly(c: Crane, len: number) {
  if (len === c.fly && len === c.flyTarget) return;
  if (c.attached >= 0) return say(c, 'Lepas beban dulu.');
  if (SPEC.model === 'zoomlion' && c.fly > 0 && len !== c.fly && c.flyTarget === c.fly) {
    // an erected wind boom is first let down onto the ground (main boom steep), then the boom comes down
    if (c.jibUp > 0) {
      if (c.angle < (JIB_RAISE_DEG * Math.PI) / 180) return say(c, `Untuk membongkar: naikkan boom utama ke ${JIB_RAISE_DEG}° dulu, boom wind diturunkan sampai ujungnya rebah di tanah.`);
      if (c.hook.y - surfaceAt(c.hook.x, c.hook.z) > 2.5) return say(c, 'Turunkan hook sampai menyentuh tanah dulu: boom wind direbahkan dengan hook diparkir di tanah.');
      c.jibDown = true;
      return say(c, 'Boom wind diturunkan ke tanah…');
    }
  }
  if (c.length > SPEC.boomMin + 0.2 || c.angle > (6 * Math.PI) / 180) return say(c, 'Pasang/lepas fly: boom ditarik penuh dan diturunkan dulu (di bawah 6°).');
  if (SPEC.model === 'zoomlion') {
    // the wind boom is laid out on the ground in line with the boom and pinned to its head: the crane stands on its
    // outriggers first and the strip ahead must be clear
    if (c.onTyres) return say(c, 'Berdirikan crane dulu (outrigger, counterweight): boom wind dirakit dengan crane sudah di atas outrigger.');
    const block = len > c.fly ? laydownBlocked(c, len) : null;
    if (block) return say(c, `Jalur rakit ${len} m di depan boom tidak bebas: ada ${block}. Swing boom ke jalur oranye "AREA RAKIT BOOM WIND" (barat daya, lewat gerbang pagar).`);
  }
  c.flyTarget = len;
  c.flyT = 0;
  c.events.push('fly');
}
export function setBlock(c: Crane, id: BlockId, parts: number) {
  const b = BLOCKS.find((x) => x.id === id)!;
  if (c.attached >= 0) return say(c, 'Lepas rigging dulu sebelum mengganti hook block.');
  if (c.hook.y - surfaceAt(c.hook.x, c.hook.z) > 2.5) return say(c, 'Turunkan hook ke dekat tanah untuk mengganti hook block / reeving.');
  c.block = id;
  c.parts = clamp(Math.round(parts), 1, maxParts(b.sheaves));
  c.events.push('reeve');
}

/** Fit a rigging set to the hook and hook it onto the selected load (the hook must be over it and low). */
export function attachRig(c: Crane, rigId: string) {
  const L = c.loads[c.target];
  const rig = RIGGING.find((r) => r.id === rigId)!;
  const p = plan(L.def, rig);
  const lift = liftPoint(L, p);
  const dxz = Math.hypot(c.hook.x - lift.x, c.hook.z - lift.z);
  if (L.state !== 'rest') return say(c, 'Beban sedang tergantung.');
  if (c.fly > 0 && c.jibUp < 1) return say(c, 'Boom wind belum di posisi kerja: naikkan dulu sebelum mengangkat beban.');
  if (dxz > 2.0) return say(c, `Posisikan hook tepat di atas beban (sekarang meleset ${dxz.toFixed(1)} m).`);
  if (c.hook.y - lift.y > p.height + 2.5) return say(c, 'Turunkan hook mendekati beban supaya rigger bisa memasang sling.');
  c.rig = rigId;
  c.rigPlan = p;
  c.attached = c.target;
  c.take = 0;
  c.events.push('rig');
  say(c, p.ok ? `Rigging terpasang: ${rig.name}. Tegangan per kaki ${(p.legTension / 1000).toFixed(1)} t (WLL ${(p.legWll / 1000).toFixed(1)} t), sudut ${((p.legAngle * 180) / Math.PI).toFixed(0)}° dari vertikal.` : `PERINGATAN rigging: ${p.problem}`);
}

export function detachRig(c: Crane) {
  if (c.attached < 0) return;
  const L = c.loads[c.attached];
  if (L.state === 'air') return say(c, 'Beban masih tergantung: turunkan sampai menapak dulu.');
  if (c.take > 0.05) return say(c, 'Sling masih tegang: turunkan hook sedikit sampai kendur.');
  c.attached = -1;
  c.rig = null;
  c.rigPlan = null;
  c.events.push('unrig');
}

/** Top of the rigging (where it meets the hook) for a resting load, world. */
function liftPoint(L: LoadState, p: RigPlan) {
  const [cx, cy, cz] = p.centre;
  const [wx, wz] = toWorld(L.x, L.z, L.yaw, cx, cz);
  return { x: wx, y: L.y + cy, z: wz };
}

// ---------- step ----------

export function step(c: Crane, dt: number) {
  c.time += dt;
  engine(c, dt);
  outriggers(c, dt);
  drive(c, dt);
  upper(c, dt);
  hookAndLoad(c, dt);
  rcl(c);
  stability(c, dt);
  hazards(c);
}

function engine(c: Crane, dt: number) {
  if (c.engine === 'starting') {
    c.starterT += dt;
    c.rpm = Math.min(c.rpm + 400 * dt, 180);
    if (c.starterT > 1.4) {
      c.engine = 'running';
      c.rpm = 650;
      c.events.push('running');
    }
  }
  if (c.engine === 'stopping' || c.engine === 'off') {
    c.rpm = Math.max(0, c.rpm - dt * 700);
    if (c.rpm <= 0 && c.engine === 'stopping') c.engine = 'off';
    c.load = 0;
    return;
  }
  if (c.engine !== 'running') return;
  // demand: drive pedal, hand throttle, and the auto-throttle that crane functions bring
  const work = Math.max(Math.abs(c.swingLever), Math.abs(c.luffLever), Math.abs(c.teleLever), Math.abs(c.hoistLever), c.pinTarget > 0 ? 1 : 0);
  const throttle = Math.max(c.pedal, c.hand, 0.8 * work);
  const target = SPEC.idleRpm + throttle * (SPEC.maxRpm - SPEC.idleRpm);
  const hydraulic = 0.25 * work + (c.jackCmd !== 0 || c.autoLevel ? 0.15 : 0) + Math.abs(c.v) * 0.04;
  const sag = hydraulic * 140 * (1 - maxTorque(c.rpm) / 1500);
  c.rpm += (target - sag - c.rpm) * Math.min(1, dt * 3);
  c.load += (clamp(hydraulic + throttle * 0.2, 0, 1) - c.load) * Math.min(1, dt * 3);
  c.fuel = Math.max(0, c.fuel - (0.004 + c.load * 0.014) * dt);
  c.hours += dt / 3600;
}

/** Pump flow share 0..1: function speeds follow engine speed. */
const flow = (c: Crane) => (c.engine === 'running' ? clamp(0.3 + (0.7 * (c.rpm - SPEC.idleRpm)) / (SPEC.maxRpm - SPEC.idleRpm), 0.3, 1) : 0);

function outriggers(c: Crane, dt: number) {
  const on = c.engine === 'running';
  // beams run in and out with the jacks up
  const want = SPEC.outrigger[c.beamSet].x;
  if (on && Math.abs(c.beam - want) > 0.001 && c.jacks.every((j) => j < 0.02)) {
    c.beam += Math.sign(want - c.beam) * Math.min(Math.abs(want - c.beam), 0.35 * dt);
    if (Math.abs(c.beam - want) < 0.001) c.events.push('beamDone');
  }
  // jacks: all together, or the auto-leveller driving each one to level the carrier with the tyres clear
  const rate = SPEC.outrigger.jackRate * flow(c) * 1.6;
  if (on && c.autoLevel) {
    const clear = PAD_CLEAR + 0.25;
    let done = true;
    for (let i = 0; i < 4; i++) {
      const wantJ = clamp(clear + c.sink[i], 0, SPEC.outrigger.stroke);
      const d = wantJ - c.jacks[i];
      if (Math.abs(d) > 0.003) done = false;
      c.jacks[i] += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
    }
    if (done) {
      c.autoLevel = false;
      c.events.push('levelled');
    }
  } else if (on && c.jackCmd !== 0) {
    for (let i = 0; i < 4; i++) c.jacks[i] = clamp(c.jacks[i] + c.jackCmd * rate * dt, 0, SPEC.outrigger.stroke);
  }
  // carrier attitude from the four pads: each pad stands at jack − clearance − sink above the ride height
  const lifts = c.jacks.map((j, i) => j - PAD_CLEAR - c.sink[i]);
  const contact = lifts.map((l) => l > 0);
  const P = pads(c);
  if (contact.every(Boolean)) {
    // least-squares plane through the four pad heights
    const avg = lifts.reduce((a, b) => a + b, 0) / 4;
    const sx = P.reduce((a, p) => a + p[0] * p[0], 0);
    const sz = P.reduce((a, p) => a + p[1] * p[1], 0);
    const gx = P.reduce((a, p, i) => a + p[0] * lifts[i], 0) / sx;
    const gz = P.reduce((a, p, i) => a + p[1] * lifts[i], 0) / sz;
    c.lift = avg;
    c.roll = Math.atan(gx);
    c.pitch = Math.atan(gz);
  } else {
    // partly on jacks: the tyres still carry it
    const maxL = Math.max(0, ...lifts) * 0.5;
    c.lift = maxL > 0.15 ? maxL - 0.15 : 0;
    c.roll = 0;
    c.pitch = 0;
  }
  const wasOnTyres = c.onTyres;
  c.onTyres = !(contact.every(Boolean) && c.lift > 0.03);
  if (wasOnTyres && !c.onTyres) c.events.push('offTyres');
}

function drive(c: Crane, dt: number) {
  const running = c.engine === 'running';
  // steering (hydraulic)
  const want = c.steerInput * SPEC.maxSteer;
  c.steer += Math.sign(want - c.steer) * Math.min(Math.abs(want - c.steer), (running ? 0.5 : 0.05) * dt);
  const canDrive = running && c.onTyres && c.jacks.every((j) => j < 0.05) && !c.failed;
  const top = c.range === 'high' ? SPEC.topSpeed : SPEC.lowSpeed;
  let limit = top;
  // travel rules: beams in, boom low and short, load on tires only at a creep
  if (c.beam > SPEC.outrigger.retracted.x + 0.05) limit = Math.min(limit, 0.6);
  if (c.attached >= 0 && c.loads[c.attached].state === 'air') limit = Math.min(limit, 2.5 / 3.6);
  if (c.length > SPEC.boomMin + 1 || c.angle > 0.35) limit = Math.min(limit, 5 / 3.6);
  const sign = c.dir === 'F' ? 1 : c.dir === 'R' ? -1 : 0;
  const target = canDrive && !c.park ? sign * c.pedal * limit : 0;
  const braking = c.brake > 0.05 || c.park;
  const rate = braking ? 2.5 * Math.max(c.brake, c.park ? 1 : 0) : Math.abs(target) < Math.abs(c.v) ? 1.2 : 0.6;
  c.v += Math.sign(target - c.v) * Math.min(Math.abs(target - c.v), rate * dt);
  if (!c.onTyres) c.v = 0;
  if (Math.abs(c.v) < 1e-4) return;

  // kinematics per steer mode: front axle (group) to the centre of the rear axles
  const rearAx = SPEC.axles.slice(SPEC.steerAxles);
  const base = SPEC.axles[0] - rearAx.reduce((a, z) => a + z, 0) / rearAx.length;
  let yaw = 0;
  let crab = 0;
  if (c.steerMode === 'front') yaw = (c.v * Math.tan(c.steer)) / base;
  else if (c.steerMode === 'rear') yaw = (-c.v * Math.tan(c.steer)) / base;
  else if (c.steerMode === 'all') yaw = (2 * c.v * Math.tan(c.steer)) / base;
  else crab = c.steer;
  const nh = c.heading + yaw * dt;
  const nx = c.x + Math.sin(c.heading + crab) * c.v * dt;
  const nz = c.z + Math.cos(c.heading + crab) * c.v * dt;
  const save = { x: c.x, z: c.z, heading: c.heading };
  c.x = nx;
  c.z = nz;
  c.heading = nh;
  const hit = craneHits(c);
  if (hit) {
    Object.assign(c, save);
    if (Math.abs(c.v) > 0.5) {
      c.collisions++;
      c.events.push('bump');
      say(c, `Menabrak ${hit}! Perhatikan ujung boom dan buritan counterweight saat bermanuver.`);
    }
    c.v = 0;
  }
  if (inExcavation(c.x, c.z)) {
    c.failed = 'excavation';
    c.events.push('crash');
    say(c, 'Crane masuk ke galian! Selalu jaga jarak dari tepi galian.');
  }
}

/** Carrier, counterweight and boom against the site. */
function craneHits(c: Crane): string | null {
  const boxes: Obb[] = [];
  const add = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, frame: 'c' | 'u', id: string) => {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const p = frame === 'u' ? upperToCarrier(c, cx, cz) : { x: cx, z: cz };
    const [wx, wz] = toWorld(c.x, c.z, c.heading, p.x, p.z);
    boxes.push({ id, x: wx, z: wz, hx: Math.abs(x1 - x0) / 2, hz: Math.abs(z1 - z0) / 2, yaw: c.heading + (frame === 'u' ? c.slew : 0), y0: y0 + c.lift, y1: y1 + c.lift });
  };
  add(-SPEC.width / 2, -SPEC.carrierLen / 2, SPEC.width / 2, SPEC.carrierLen / 2, 0.3, SPEC.deckY + 1.2, 'c', 'carrier');
  const w = SPEC.cwBox;
  add(-w.x, SPEC.cwArm - w.z, w.x, SPEC.cwArm + w.z, w.y0, w.y1, 'u', 'counterweight');
  for (const b of OBSTACLES) for (const m of boxes) if (overlaps(m, b)) return nameOf(b.id);
  // the boom: points along it
  for (const p of boomPoints(c)) for (const b of OBSTACLES) if (inside(b, p.x, p.z, 0.4) && p.y > b.y0 && p.y < b.y1 + 0.4) return nameOf(b.id);
  // nor through the loads (the one on the hook and blades turning with the hub aside)
  for (const L of c.loads) {
    if (c.loads[c.attached] === L || (L.def.bolt && L.placed)) continue;
    const b = loadBox(L, L.x, L.y, L.z);
    for (const p of boomPoints(c)) if (inside(b, p.x, p.z, 0.4) && p.y > b.y0 && p.y < b.y1 + 0.4) return L.def.name;
  }
  return null;
}

function boomPoints(c: Crane) {
  const out: { x: number; y: number; z: number }[] = [];
  const t = tipUpper(c);
  const n = Math.ceil((c.length + c.fly) / 1.5);
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    out.push(upperToWorld(c, 0, SPEC.pin.y + (t.y - SPEC.pin.y) * k, SPEC.pin.z + (t.z - SPEC.pin.z) * k));
  }
  return out;
}

function nameOf(id = '') {
  if (id.startsWith('col')) return 'kolom gedung';
  if (id.startsWith('eave') || id.startsWith('roof')) return 'rangka atap';
  if (id.startsWith('gh')) return 'dinding rumah genset';
  if (id.startsWith('fw')) return 'dinding api trafo';
  if (id.startsWith('pole')) return 'tiang listrik';
  if (id.startsWith('fence')) return 'pagar';
  if (id.startsWith('cabin')) return 'kabin proyek';
  if (id === 'annex') return 'gedung annex';
  if (id === 'mezzdeck') return 'lantai mezzanine';
  return id;
}

/** Functions that would make the load moment bigger are locked out by the RCL. */
function locked(c: Crane, what: 'down' | 'out' | 'up' | 'swing') {
  if (c.bypass || c.failed) return false;
  if (what === 'swing') return false;
  return c.lockout;
}

function upper(c: Crane, dt: number) {
  const f = flow(c);
  const on = c.engine === 'running' && !c.failed;
  const save = { slew: c.slew, angle: c.angle, length: c.length };

  // counterweight change (hydraulic removal system) and fly erection: timed sequences
  if (c.cwTarget !== c.cw) {
    c.cwT += dt / 25;
    if (c.cwT >= 1) {
      c.cw = c.cwTarget;
      c.events.push('cwDone');
    }
  }
  if (c.flyTarget !== c.fly) {
    c.flyT += dt / 20;
    if (c.flyT >= 1) {
      const before = ropeAlong(c);
      c.fly = c.flyTarget;
      // a wind boom comes off the ground lying in line with the boom; it is raised later, with the boom steep
      c.jibUp = SPEC.model === 'zoomlion' && c.fly > 0 ? 0 : 1;
      c.jibDown = false;
      c.drum += ropeAlong(c) - before;
      c.events.push('flyDone');
      if (c.jibUp < 1) say(c, `Boom wind terpasang di tanah. Naikkan boom utama pelan sampai ${JIB_RAISE_DEG}°: ujungnya terseret di tanah, lalu boom wind terangkat sendiri ke posisi kerja.`);
    }
  }
  // wind boom: raised from the ground to its offset once the main boom is steep, let down again before dismantling
  if (c.fly > 0 && SPEC.model === 'zoomlion' && on) {
    const steep = c.angle >= (JIB_RAISE_DEG * Math.PI) / 180;
    if (c.jibDown) {
      if (steep && c.jibUp > 0) {
        c.jibUp = Math.max(0, c.jibUp - dt / 15);
        if (c.jibUp === 0) say(c, 'Boom wind sudah rebah di tanah. Turunkan boom utama di bawah 6°, lalu pilih "Tanpa" lagi untuk membongkar.');
      }
    } else if (steep && c.jibUp < 1 && c.attached < 0) {
      c.jibUp = Math.min(1, c.jibUp + dt / 15);
      if (c.jibUp === 1) {
        c.events.push('jibUp');
        say(c, 'Boom wind terangkat ke posisi kerja. Telescope boom utama penuh, lalu siap mengangkat.');
      }
    }
  }

  // swing: lever sets the speed (1.5 rpm), hydraulic acceleration, brake pedal, park brake and lock pin
  const wantV = on && !c.swingLock && !c.swingPark ? c.swingLever * SPEC.swingRate * f : 0;
  const acc = c.swingBrake > 0.05 ? 0.25 * c.swingBrake : SPEC.swingAccel;
  c.slewV += Math.sign(wantV - c.slewV) * Math.min(Math.abs(wantV - c.slewV), acc * dt);
  if (c.swingLock || c.swingPark) c.slewV = 0;
  c.slew += c.slewV * dt;

  // luffing: −2.5° … 80°; boom down is locked out by the RCL
  let lv = on ? c.luffLever : 0;
  if (lv < 0 && locked(c, 'down')) lv = 0;
  c.angle = clamp(c.angle + lv * SPEC.luffRate * f * dt, SPEC.angleMin, SPEC.angleMax);

  // telescope: pin & latch, no telescoping with a real load on the hook; out is locked out by the RCL
  let tv = on && c.flyTarget === c.fly ? c.teleLever : 0;
  if (tv !== 0 && c.attached >= 0 && c.loads[c.attached].state === 'air' && c.pct > 0.1) {
    tv = 0;
    if (!c.msg) say(c, 'Boom pin & latch tidak bisa di-telescope saat membawa beban. Turunkan beban dulu.');
  }
  if (tv > 0 && (locked(c, 'out') || c.twoBlock)) tv = 0;
  if (tv !== 0) {
    const before = c.length;
    c.length = clamp(c.length + tv * SPEC.teleRate * f * dt, SPEC.boomMin, SPEC.boomMax);
    // snap onto a pin position when the lever is let go close to one
    if (c.length !== before && c.fly > 0 && c.length < SPEC.boomMax - 0.01 && !c.msg) say(c, `${FLY.label} hanya diizinkan dengan boom penuh ${SPEC.boomMax.toString().replace('.', ',')} m.`);
    c.pinTarget = 0;
  } else if (c.pinTarget > 0 && on) {
    // "lock boom": the telescope runs to the chosen pin position by itself and latches there
    const d = c.pinTarget - c.length;
    c.length += Math.sign(d) * Math.min(Math.abs(d), SPEC.teleRate * f * dt);
    if (Math.abs(c.pinTarget - c.length) < 0.001) {
      c.length = c.pinTarget;
      c.pinTarget = 0;
      c.events.push('lock');
      say(c, `Boom terkunci pin di ${c.length.toString().replace('.', ',')} m.`);
    }
  } else {
    const near = SPEC.stops.reduce((a, s) => (Math.abs(s - c.length) < Math.abs(a - c.length) ? s : a), SPEC.stops[0]);
    if (Math.abs(near - c.length) < 0.6 && Math.abs(near - c.length) > 0.001 && on) c.length += Math.sign(near - c.length) * Math.min(Math.abs(near - c.length), 0.2 * dt);
  }

  // the boom must not run into anything
  if (craneHits(c)) {
    Object.assign(c, save);
    c.slewV = 0;
    c.events.push('boomHit');
    if (!c.msg) say(c, 'Boom atau counterweight menyentuh bangunan! Fungsi dihentikan.');
  }
}

let liftAt = -9;

function hookAndLoad(c: Crane, dt: number) {
  const on = c.engine === 'running' && !c.failed;
  const f = flow(c);
  const blk = blockOf(c);
  const parts = partsOf(c);
  const tip = tipWorld(c);
  const L = c.attached >= 0 ? c.loads[c.attached] : null;
  const air = !!L && L.state === 'air';
  const rigKg = c.rigPlan?.massKg ?? 0;
  const massKg = blk.mass + rigKg + (air ? L!.def.kg : 0);

  // hoist: rope from the drum; two-block switch stops hoisting up near the head; winch pull limit
  let hv = on ? c.hoistLever : 0;
  const hang = hangLen(c);
  c.twoBlock = hang < 1.1 && !c.bypass;
  if (hv > 0 && (c.twoBlock || locked(c, 'up'))) hv = 0;
  const pull = SPEC.linePull * parts * 0.92;
  if (hv > 0 && c.tension > pull) {
    hv = 0;
    if (!c.msg) say(c, 'Winch tidak kuat menarik: tambah jumlah jalur tali (parts of line).');
  }
  const lineV = SPEC.lineSpeed[c.highSpeed ? 1 : 0] * f * (1 - 0.35 * Math.min(1, c.tension / Math.max(1, pull)));
  const dDrum = -hv * lineV * (hv < 0 ? LOWER_BOOST : 1) * dt; // paying out = lowering (sped up for playability)
  if (hv < 0 && c.drum + dDrum >= SPEC.ropeTotal - 0.01 && !c.msg) say(c, `Tali di drum habis (${SPEC.ropeTotal} m dibagi ${parts} jalur): hook tidak bisa turun lagi. Kurangi jalur tali.`);
  c.drum = clamp(c.drum + dDrum, ropeAlong(c) + 0.3 * parts, SPEC.ropeTotal);
  const prevRope = c.ropeLen;

  // hanging length to the swinging mass: block + rigging + down to the load's centre of mass
  let ropeLen = hangLen(c) + 0.6;
  if (air && c.rigPlan) ropeLen += c.rigPlan.height + (c.rigPlan.centre[1] - L!.def.cg[1]);
  c.ropeRate += ((ropeLen - prevRope) / dt - c.ropeRate) * Math.min(1, dt * 10);
  c.ropeLen = ropeLen;

  // wind: gusting around the set mean
  c.wind += ((c.windSet * (1 + 0.35 * Math.sin(c.time * 0.7) * Math.sin(c.time * 0.23 + 1)) - c.wind) * Math.min(1, dt * 0.8));

  // the hanging mass: a point on a rope from the boom head (position-based, rope cannot push)
  const h = c.hook;
  const area = air ? L!.def.size[0] * L!.def.size[1] * 0.6 : 0.6;
  const windAcc = (0.5 * 1.2 * 1.1 * area * c.wind * c.wind) / Math.max(400, massKg);
  const [wdx, wdz] = [Math.cos(0.6), Math.sin(0.6)];
  h.vx += windAcc * wdx * dt;
  h.vz += windAcc * wdz * dt;
  h.vy -= G * dt;
  const damp = 1 - Math.min(1, dt * 0.08);
  h.vx *= damp;
  h.vz *= damp;
  let px = h.x + h.vx * dt;
  let py = h.y + h.vy * dt;
  let pz = h.z + h.vz * dt;
  let dx = px - tip.x;
  let dy = py - tip.y;
  let dz = pz - tip.z;
  let d = Math.hypot(dx, dy, dz);
  if (d > ropeLen) {
    const k = ropeLen / d;
    px = tip.x + dx * k;
    py = tip.y + dy * k;
    pz = tip.z + dz * k;
  }
  // the hook (or load) on the ground or on a surface
  let floor = air ? landingHeight(L!, px, pz) + L!.def.cg[1] : surfaceAt(px, pz) + 0.35;
  if (L && !air && c.rigPlan) floor = Math.max(floor, liftPoint(L, c.rigPlan).y + 0.4);
  let landed = false;
  if (py < floor && !(air && c.time - liftAt < 0.6 && c.ropeRate <= 0.01)) {
    landed = true;
    py = floor;
  }
  // collisions of a hanging load with the site and the crane
  if (air) {
    const box = loadBox(L!, px, py - L!.def.cg[1], pz);
    const hit = OBSTACLES.find((o) => overlaps(box, o)) ?? null;
    const other = c.loads.find((o) => o !== L && !(o.def.bolt && o.placed) && overlaps(box, loadBox(o, o.x, o.y, o.z)));
    if (hit || other) {
      const sp = Math.hypot(h.vx, h.vy, h.vz);
      px = h.x;
      py = Math.max(h.y, py);
      pz = h.z;
      if (sp > 0.25) {
        c.collisions++;
        L!.damage = Math.min(100, L!.damage + sp * 15);
        c.events.push('loadHit');
        say(c, `Beban menabrak ${hit ? nameOf(hit.id) : 'beban lain'}! Gerakkan pelan dan pakai tag line.`);
      }
      h.vx *= -0.2;
      h.vz *= -0.2;
    }
  }
  // velocities from the positions (bounded: a teleported crane must not fling the hook)
  const cap = (v: number) => clamp(v, -12, 12);
  const nvx = cap((px - h.x) / dt);
  const nvy = cap((py - h.y) / dt);
  const nvz = cap((pz - h.z) / dt);
  h.x = px;
  h.y = py;
  h.z = pz;
  h.vx = nvx;
  h.vy = landed ? 0 : nvy;
  h.vz = nvz;
  if (landed) {
    h.vx *= 0.5;
    h.vz *= 0.5;
  }

  // rope tension: weight component along the rope, centripetal, and the hoist's acceleration
  dx = tip.x - h.x;
  dy = tip.y - h.y;
  dz = tip.z - h.z;
  d = Math.max(0.1, Math.hypot(dx, dy, dz));
  const taut = d > ropeLen - 0.02 && !landed;
  const uy = dy / d;
  const vr = (h.vx * dx + h.vy * dy + h.vz * dz) / d;
  const v2 = h.vx * h.vx + h.vy * h.vy + h.vz * h.vz - vr * vr;
  const dynamic = taut ? massKg * clamp(G * uy + v2 / d, 0, 3 * G) : 0;
  const staticBlock = blk.mass * G;

  // a load still resting while the rigging takes up its weight
  if (L && L.state === 'rest' && c.rigPlan) {
    const lp = liftPoint(L, c.rigPlan);
    const reach = hangLen(c) + 0.6 + c.rigPlan.height; // head to the lifting point with everything taut
    const dist = Math.hypot(tip.x - lp.x, tip.y - lp.y, tip.z - lp.z);
    const stretch = reach - dist; // < 0: taut and pulling
    const wantTake = L.def.bolt && L.placed ? 0 : clamp(-stretch / 0.15, 0, 1.2); // a bolted blade hangs on the hub
    c.take += (wantTake - c.take) * Math.min(1, dt * 6);
    if (c.take > 1.0) {
      // lift-off: the load starts hanging where it is, swinging if the hook was not right over it
      L.state = 'air';
      c.take = 1;
      const cgW = loadCg(L);
      h.x = cgW.x;
      h.y = cgW.y + 0.02;
      h.z = cgW.z;
      h.vx = h.vy = h.vz = 0;
      L.y += 0.02;
      liftAt = c.time;
      // rope exactly taut from the head to the load's centre of mass
      const d0 = Math.hypot(tip.x - h.x, tip.y - h.y, tip.z - h.z);
      const hang = d0 - 0.6 - c.rigPlan.height - (c.rigPlan.centre[1] - L.def.cg[1]);
      c.drum = ropeAlong(c) + Math.max(0.3, hang) * parts;
      c.ropeLen = d0;
      const off = Math.hypot(tip.x - lp.x, tip.z - lp.z);
      c.events.push('liftoff');
      if (off > 0.6) say(c, `Tarikan samping! Hook tidak tegak di atas beban (${off.toFixed(1)} m), beban terayun.`);
      if (!c.rigPlan.ok) {
        // unsafe rigging gives way
        c.failed = 'sling';
        L.state = 'fallen';
        c.attached = -1;
        c.events.push('crash');
        say(c, `Rigging gagal: ${c.rigPlan.problem}`);
      }
    }
    c.tension = staticBlock + G * (rigKg + c.take * L.def.kg) + dynamic * 0;
    // the hook rests on the rigging: keep it hanging over the lifting point
  } else {
    c.tension += ((air ? dynamic : Math.max(dynamic, taut ? staticBlock : 0) + G * rigKg * (c.rig ? 1 : 0)) - c.tension) * Math.min(1, dt * 12);
  }

  // a hanging load follows the mass point; landing sets it down
  if (L && air) {
    const yaw = L.yaw + c.tagLever * 0.25 * dt + Math.sin(c.time * 0.3) * 0.002 * c.wind * dt;
    L.yaw = yaw;
    L.x = h.x - rotX(L, L.def.cg);
    L.z = h.z - rotZ(L, L.def.cg);
    L.y = h.y - L.def.cg[1];
    L.tilt = c.rigPlan?.tilt ?? 0;
    if (landed) {
      const vy = -nvy;
      L.state = 'rest';
      L.tilt = 0;
      c.take = 0.95;
      c.events.push('setdown');
      if (vy > 0.5) {
        L.damage = Math.min(100, L.damage + vy * 20);
        say(c, 'Beban mendarat terlalu keras!');
      }
      settle(c, L);
    } else if (L.def.bolt) tryBolt(c, L);
  }
  turnRotor(c, dt);
}

// ---------- wind turbine rotor ----------
/** Rotor on the nacelle (its frame): hub centre ahead of the main shaft flange, blade roots on a circle. */
export const HUB = { x: 9.6, y: 2.55, r: 1.8 };
const THIRD = (2 * Math.PI) / 3;

export function nacelleUp(c: Crane) {
  return c.loads.find((l) => l.def.look === 'nacelle' && l.placed) ?? null;
}

/** Pose a blade must hang in to meet the free flange: level at three o'clock, root on the hub (null: no nacelle yet). */
export function bladeTarget(c: Crane, L: LoadState) {
  const N = nacelleUp(c);
  if (!N) return null;
  const [x, z] = toWorld(N.x, N.z, N.yaw, HUB.x, HUB.r + L.def.size[0] / 2);
  return { x, z, y: N.y + HUB.y - L.def.cg[1], yaw: N.yaw - Math.PI / 2 };
}

/** How far a hanging blade's root is from the free flange (m) and its heading error (rad); null while the hub cannot take it. */
export function bladeError(c: Crane, L: LoadState) {
  const T = bladeTarget(c, L);
  const bolted = c.loads.filter((l) => l.def.bolt && l.placed).length;
  if (!T || Math.abs(c.rotor - bolted * THIRD) > 0.01) return null;
  const half = L.def.size[0] / 2;
  const [rx, rz] = toWorld(L.x, L.z, L.yaw, -half, 0);
  const [tx, tz] = toWorld(T.x, T.z, T.yaw, -half, 0);
  return { off: Math.hypot(rx - tx, rz - tz, L.y - T.y), yaw: Math.abs(Math.atan2(Math.sin(L.yaw - T.yaw), Math.cos(L.yaw - T.yaw))), T, bolted };
}

/** The fitters bolt the root on once it is in the flange and lined up. */
function tryBolt(c: Crane, L: LoadState) {
  const e = bladeError(c, L);
  if (!e || e.off > 0.6 || e.yaw > (5 * Math.PI) / 180) return;
  Object.assign(L, { ...e.T, tilt: 0, state: 'rest', placed: true, slot: e.bolted });
  c.take = 0;
  c.hook.vx = c.hook.vy = c.hook.vz = 0;
  c.events.push('placed');
  const n = c.loads.filter((l) => l.def.bolt).length;
  say(c, `${L.def.name} terbaut ke hub (meleset ${Math.round(e.off * 100)} cm). Lepas blade yoke, lalu hub diputar 120°${e.bolted + 1 < n ? ' untuk bilah berikutnya' : ''}.`);
}

/** The rotor brake stays on while the boom head or the hook is inside the swept disc (within 8 m of the rotor plane). */
export function boomInRotor(c: Crane) {
  const N = nacelleUp(c);
  if (!N) return false;
  const [hx, hz] = toWorld(N.x, N.z, N.yaw, HUB.x, 0);
  const hy = N.y + HUB.y;
  const R = Math.max(...c.loads.filter((l) => l.def.bolt).map((l) => l.def.size[0])) + HUB.r + 5;
  const ax = Math.cos(N.yaw);
  const az = -Math.sin(N.yaw);
  const inside = (p: { x: number; y: number; z: number }) => {
    const along = (p.x - hx) * ax + (p.z - hz) * az;
    return Math.abs(along) < 8 && Math.hypot(p.x - hx - along * ax, p.y - hy, p.z - hz - along * az) < R;
  };
  return inside(tipWorld(c)) || inside(c.hook);
}

/** Turning gear brings the next free flange to three o'clock once the yoke is off; all blades on, the wind takes over. */
function turnRotor(c: Crane, dt: number) {
  const blades = c.loads.filter((l) => l.def.bolt);
  if (!blades.length) return;
  const free = blades.filter((l) => l.placed && c.loads[c.attached] !== l).length;
  if (free === blades.length) {
    if (!c.turbine) {
      if (boomInRotor(c)) return;
      c.turbine = true;
      c.events.push('turbine');
      say(c, 'Rotor lengkap! Rem rotor dilepas dan angin memutar bilah: WTG-07 6 MW mulai menyuplai listrik.');
    }
    c.rotorV += (clamp(0.25 + c.wind * 0.08, 0.3, 1.2) - c.rotorV) * Math.min(1, dt * 0.15);
    c.rotor += c.rotorV * dt;
  } else c.rotor += clamp(free * THIRD - c.rotor, -0.4 * dt, 0.4 * dt);
}

const rotX = (L: LoadState, p: number[]) => toWorld(0, 0, L.yaw, p[0], p[2])[0];
const rotZ = (L: LoadState, p: number[]) => toWorld(0, 0, L.yaw, p[0], p[2])[1];

/** A load's frame: x along its length → world via yaw like the genset (local x ↔ heading-frame lateral). */
function loadCg(L: LoadState) {
  return { x: L.x + rotX(L, L.def.cg), y: L.y + L.def.cg[1], z: L.z + rotZ(L, L.def.cg) };
}

export function loadBox(L: LoadState, x: number, y: number, z: number): Obb {
  return { id: L.def.id, x, z, hx: L.def.size[0] / 2, hz: L.def.size[2] / 2, yaw: L.yaw, y0: y, y1: y + L.def.size[1] };
}

/** Highest surface under a hanging load's footprint at (x, z of its centre of mass). */
function landingHeight(L: LoadState, cx: number, cz: number) {
  const bx = cx - rotX(L, L.def.cg);
  const bz = cz - rotZ(L, L.def.cg);
  let h = -99;
  const [sx, , sz] = L.def.size;
  for (const fx of [-0.45, 0, 0.45])
    for (const fz of [-0.45, 0, 0.45]) {
      const [wx, wz] = toWorld(bx, bz, L.yaw, fx * sx, fz * sz);
      h = Math.max(h, surfaceAt(wx, wz));
    }
  return h;
}

/** After landing: is it level and supported, and is it at its destination? */
function settle(c: Crane, L: LoadState) {
  const [sx, , sz] = L.def.size;
  const hs: number[] = [];
  for (const fx of [-0.5, 0.5]) for (const fz of [-0.5, 0.5]) hs.push(surfaceAt(...toWorld(L.x, L.z, L.yaw, fx * sx * 0.9, fz * sz * 0.9)));
  const uneven = L.def.mount ? surfaceAt(L.x, L.z) < L.y - 0.3 : Math.max(...hs) - Math.min(...hs) > 0.3;
  if (uneven) {
    L.state = 'fallen';
    L.damage = 100;
    c.attached = -1;
    c.rig = null;
    c.rigPlan = null;
    c.events.push('crash');
    say(c, 'Beban diletakkan di permukaan yang tidak rata dan terguling!');
    return;
  }
  const dsx = L.def.dest;
  const dist = Math.hypot(L.x - dsx.x, L.z - dsx.z);
  const dyaw = Math.abs(Math.atan2(Math.sin(2 * (L.yaw - dsx.yaw)), Math.cos(2 * (L.yaw - dsx.yaw)))) / 2;
  if (dist < 0.6 && (dyaw < (8 * Math.PI) / 180 || L.def.mount) && Math.abs(L.y - dsx.y) < 0.25) {
    L.placed = true;
    c.events.push('placed');
    say(c, `${L.def.name} terpasang di ${dsx.label}. Meleset ${Math.round(dist * 100)} cm, ${((dyaw * 180) / Math.PI).toFixed(1)}°.`);
  }
}

function rcl(c: Crane) {
  const support: Support = c.onTyres ? 'tires' : c.beam > SPEC.outrigger.full.x - 0.05 ? 'full' : c.beam > SPEC.outrigger.mid.x - 0.05 ? 'mid' : 'retracted';
  const r = radius(c);
  const chart = rated({ cw: c.cw, support, length: c.length, radius: r, fly: c.fly, offset: c.flyOffset, slew: c.slew, creep: Math.abs(c.v) > 0.05 });
  // the rope reeving and the block also limit the rating
  const blk = blockOf(c);
  const ropeKg = SPEC.ropeLimit * partsOf(c);
  let kg = Math.min(chart.kg, ropeKg, blk.rating);
  let note = chart.note;
  if (kg < chart.kg) note += kg === ropeKg ? ` · dibatasi tali ${partsOf(c)} jalur` : ' · dibatasi hook block';
  // estimated chart: never above 80 % of the load that would tip the crane now (a real chart is built that way)
  if (chart.estimated && SPEC.model === 'zoomlion' && c.tipLoadKg > 0 && c.tipLoadKg < 999999 && 0.8 * c.tipLoadKg < kg) {
    kg = Math.round(0.8 * c.tipLoadKg);
    note += ' · dibatasi stabilitas';
  }
  // out of level by more than 1 %: the chart no longer applies
  const level = Math.hypot(Math.tan(c.pitch), Math.tan(c.roll)) * 100;
  if (!c.onTyres && level > 1) {
    note += ` · TIDAK RATA ${level.toFixed(1)}%`;
    kg *= 0.7;
  }
  if (c.fly > 0 && c.jibUp < 1) note = 'Boom wind belum di posisi kerja: tidak boleh mengangkat';
  c.rating = { kg, note, estimated: chart.estimated };
  c.hookKg = c.tension / G;
  c.pct = kg > 0 ? c.hookKg / kg : c.hookKg > blk.mass * 1.6 ? 9 : 0;
  const was = c.lockout;
  c.lockout = c.pct >= 1 || (kg <= 0 && c.attached >= 0 && c.take > 0.1);
  if (c.lockout && !was) {
    c.lockouts++;
    c.events.push('rclLock');
  }
  if (!c.failed) c.maxPct = Math.max(c.maxPct, Math.min(c.pct, 2));
}

/** Support polygon (carrier frame): the four pads on outriggers, the tyre patches on tyres. */
export function supports(c: Crane): [number, number][] {
  if (!c.onTyres) {
    const P = pads(c);
    return [P[0], P[2], P[3], P[1]]; // FL, RL, RR, FR around
  }
  const x = SPEC.track / 2 + SPEC.tyreW / 2;
  const zr = SPEC.axles[SPEC.axles.length - 1];
  return [
    [x, SPEC.axles[0]],
    [x, zr],
    [-x, zr],
    [-x, SPEC.axles[0]],
  ];
}

/** Masses (kg) and their positions in the carrier frame, with the hanging load where it really is. */
function masses(c: Crane) {
  const m: { kg: number; x: number; y: number; z: number }[] = [];
  m.push({ kg: SPEC.mass.carrier * 1000, x: 0, y: 1.3, z: 0.4 });
  const up = (kg: number, x: number, y: number, z: number) => {
    const p = upperToCarrier(c, x, z);
    m.push({ kg, x: p.x, y, z: p.z });
  };
  up(SPEC.mass.upper * 1000, 0, 2.4, -0.8);
  const cwShare = c.cwTarget !== c.cw ? c.cw + (c.cwTarget - c.cw) * c.cwT : c.cw;
  up(cwShare * 1000, 0, 2.6, SPEC.cwArm);
  const t = tipUpper(c);
  const bm = boomMass(c);
  if (c.fly > 0 && SPEC.model === 'zoomlion') {
    // boom at its own centre, the wind boom at its middle (half of it on the ground while its tip rests there)
    const flyKg = SPEC.mass.fly[FLY.lengths.indexOf(c.fly)] * 1000;
    const L = c.length + SPEC.headLen;
    const hy = SPEC.pin.y + L * Math.sin(c.angle);
    const hz = SPEC.pin.z + L * Math.cos(c.angle);
    up(bm * 1000 - flyKg, 0, SPEC.pin.y + (hy - SPEC.pin.y) * 0.42, SPEC.pin.z + (hz - SPEC.pin.z) * 0.42);
    if (jibResting(c)) up(flyKg / 2, 0, hy, hz);
    else up(flyKg, 0, (hy + t.y) / 2, (hz + t.z) / 2);
  } else up(bm * 1000, 0, SPEC.pin.y + (t.y - SPEC.pin.y) * 0.42, SPEC.pin.z + (t.z - SPEC.pin.z) * 0.42);
  // the hook load at the hanging mass (or under the head while it still rests)
  const [lx, lz] = toLocal(c.x, c.z, c.heading, c.hook.x, c.hook.z);
  m.push({ kg: c.hookKg, x: lx, y: c.hook.y, z: lz });
  return m;
}

function stability(c: Crane, dt: number) {
  const S = supports(c);
  const M = masses(c);
  const total = M.reduce((a, p) => a + p.kg, 0);
  // the moment of every mass about each edge; the worst edge decides
  let worst = -Infinity;
  let edge = 0;
  let restore = 0;
  let loadArm = 0;
  const edgeInfo: { nx: number; nz: number; x0: number; z0: number }[] = [];
  for (let i = 0; i < S.length; i++) {
    const [x0, z0] = S[i];
    const [x1, z1] = S[(i + 1) % S.length];
    const l = Math.hypot(x1 - x0, z1 - z0);
    let nx = (z1 - z0) / l;
    let nz = -(x1 - x0) / l;
    // outward
    if (nx * (0 - x0) + nz * (0 - z0) > 0) {
      nx = -nx;
      nz = -nz;
    }
    edgeInfo.push({ nx, nz, x0, z0 });
    let mom = 0;
    let rest = 0;
    let arm = 0;
    for (const p of M) {
      const o = (p.x - x0) * nx + (p.z - z0) * nz; // > 0 beyond the edge
      mom += p.kg * o;
      if (p === M[M.length - 1]) arm = o;
      else rest -= p.kg * o;
    }
    if (mom > worst) {
      worst = mom;
      edge = i;
      restore = rest;
      loadArm = arm;
    }
  }
  // the load that would tip the crane now, hanging under the boom head (for the RCL panel: stability vs strength)
  const tipU = tipUpper(c);
  const tipC = upperToCarrier(c, 0, tipU.z);
  c.tipLoadKg = 999999;
  for (const ei of edgeInfo) {
    const tipArm = (tipC.x - ei.x0) * ei.nx + (tipC.z - ei.z0) * ei.nz;
    if (tipArm < 0.2) continue;
    let rest = 0;
    for (let k = 0; k < M.length - 1; k++) rest -= M[k].kg * ((M[k].x - ei.x0) * ei.nx + (M[k].z - ei.z0) * ei.nz);
    c.tipLoadKg = Math.min(c.tipLoadKg, rest / tipArm);
  }
  void restore;
  void loadArm;
  const blk = blockOf(c);
  c.limitBy = c.rating.kg <= 0 ? '-' : c.rating.kg < 0.85 * (c.tipLoadKg - 0) * 0.9 ? 'struktur' : 'stabilitas';
  void blk;
  // pad reactions and ground pressure (four pads, plane distribution)
  if (!c.onTyres) {
    const P = pads(c);
    const sx = P.reduce((a, p) => a + p[0] * p[0], 0);
    const sz = P.reduce((a, p) => a + p[1] * p[1], 0);
    const cgx = M.reduce((a, p) => a + p.kg * p.x, 0);
    const cgz = M.reduce((a, p) => a + p.kg * p.z, 0);
    const padArea = Math.PI * (SPEC.outrigger.pad / 2) ** 2;
    const area = c.mats ? Math.max(2.25, padArea * 2.5) : padArea;
    for (let i = 0; i < 4; i++) {
      const R = Math.max(0, total / 4 + (cgx * P[i][0]) / sx + (cgz * P[i][1]) / sz);
      c.padLoad[i] = R;
      const kpa = (R * G) / area / 1000;
      c.padKpa[i] = kpa;
      const [wx, wz] = toWorld(c.x, c.z, c.heading, P[i][0], P[i][1]);
      const cap = BEARING[groundAt(wx, wz)];
      if (kpa > cap && c.jacks[i] > PAD_CLEAR) {
        const before = c.sink[i];
        c.sink[i] = Math.min(0.6, c.sink[i] + 0.02 * (kpa / cap - 1) * dt);
        if (before < 0.02 && c.sink[i] >= 0.02) {
          c.events.push('sink');
          say(c, `Pontoon ${['kiri depan', 'kanan depan', 'kiri belakang', 'kanan belakang'][i]} amblas! Tekanan ${Math.round(kpa)} kPa melebihi daya dukung tanah ${cap} kPa. Pakai matras.`);
        }
      }
    }
  } else c.padKpa = [0, 0, 0, 0];

  // tipping about the worst edge
  const e = edgeInfo[edge];
  const cgH = M.reduce((a, p) => a + p.kg * p.y, 0) / total;
  const tq = (th: number) => {
    let t = 0;
    for (const p of M) {
      const o = (p.x - e.x0) * e.nx + (p.z - e.z0) * e.nz;
      t += p.kg * (o * Math.cos(th) + p.y * Math.sin(th));
    }
    return t * G;
  };
  if (c.tipEdge < 0 && worst > 0) {
    c.tipEdge = edge;
    c.tip = 0;
    c.tipV = 0;
  }
  if (c.tipEdge >= 0) {
    const I = total * (cgH * cgH + 9);
    c.tipV += (tq(c.tip) / I) * dt - c.tipV * Math.min(1, dt * 0.6);
    c.tip += c.tipV * dt;
    if (c.tip <= 0) {
      if (c.tipV < -0.08) c.events.push('thump');
      c.tip = 0;
      c.tipV = 0;
      c.tipEdge = -1;
    } else if (c.tip > 0.12 && c.failed !== 'tipped') {
      c.failed = 'tipped';
      c.events.push('tipover');
      say(c, 'CRANE TERGULING! Beban melebihi momen penahan. Patuhi RCL dan load chart.');
    }
    if (c.failed === 'tipped') c.tip = Math.min(c.tip, 0.9);
  }
  // strength: where the chart is limited by the structure, going well past it buckles the boom
  if (!c.failed && c.limitBy === 'struktur' && c.rating.kg > 0 && c.hookKg > c.rating.kg / 0.72) {
    c.failed = 'boom';
    c.events.push('boomFail');
    say(c, 'BOOM PATAH! Kapasitas di radius ini dibatasi kekuatan struktur, bukan stabilitas.');
    if (c.attached >= 0) {
      c.loads[c.attached].state = 'fallen';
      c.attached = -1;
    }
  }
  if (c.failed === 'boom') c.boomBend = Math.min(1, c.boomBend + dt * 0.7);
}

/** Closest distance from a point to the conductors. */
function lineDistance(p: { x: number; y: number; z: number }) {
  let d = Infinity;
  for (const off of [-0.8, 0, 0.8]) d = Math.min(d, Math.hypot(p.x - (POWERLINE.x + off), p.y - POWERLINE.y));
  return d;
}

function hazards(c: Crane) {
  let d = Infinity;
  for (const p of boomPoints(c)) d = Math.min(d, lineDistance(p));
  const tip = tipWorld(c);
  for (let k = 0; k <= 1; k += 0.25) d = Math.min(d, lineDistance({ x: tip.x + (c.hook.x - tip.x) * k, y: tip.y + (c.hook.y - tip.y) * k, z: tip.z + (c.hook.z - tip.z) * k }));
  const before = c.lineDist;
  c.lineDist = d;
  if (d < MIN_APPROACH && before >= MIN_APPROACH) {
    c.events.push('lineWarn');
    say(c, `AWAS SUTM 20 kV! Jarak ${d.toFixed(1)} m, minimum ${MIN_APPROACH} m.`);
  }
  if (d < 0.6 && !c.failed) {
    c.failed = 'line';
    c.events.push('zap');
    say(c, 'Boom/tali menyentuh jaringan listrik 20 kV! Tetap di kabin, jangan ada yang menyentuh crane.');
  }
}

export { stopIndex };
