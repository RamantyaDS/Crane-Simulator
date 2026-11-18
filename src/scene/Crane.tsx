// Link-Belt RTC-80160 Series II model (carrier frame: x left, z forward, y up; origin at the carrier centre on the
// ground). White carrier with red diamond-plate decks, four outrigger beams with jacks and pontoons, six 23.5R25
// tyres, the upper with its cab on the left, counterweight, winches and luffing cylinder, the 6-section boom with the
// black head, the lattice offset fly, the hook block with its parts of line. Static parts are baked.
import { RoundedBox, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { deflection, hangLen, pads, tipWorld } from '../sim/crane';
import { BLOCKS, SPEC } from '../sim/spec';
import { cr } from '../store';
import { Bake } from './Bake';
import { Box, Cyl, M, useCanvasTexture } from './parts';
import { OTR_TYRE, Wheel } from './tyre';

const DECK = SPEC.deckY;
export const craneObj: { upper: THREE.Object3D | null; carrier: THREE.Object3D | null; head: THREE.Object3D | null } = { upper: null, carrier: null, head: null };

export function RB({ s, r = 0.04, m, ...p }: { s: [number, number, number]; r?: number; m: THREE.Material } & JSX.IntrinsicElements['group']) {
  return (
    <group {...p}>
      <RoundedBox args={s} radius={Math.min(r, ...s.map((v) => v / 2 - 0.001))} smoothness={3} material={m} castShadow receiveShadow />
    </group>
  );
}

function useDiamond() {
  return useCanvasTexture(
    128,
    128,
    (g) => {
      g.fillStyle = '#b3141a';
      g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          g.save();
          g.translate(x * 16 + 8 + (y % 2) * 8, y * 16 + 8);
          g.rotate(y % 2 ? 0.8 : -0.8);
          g.fillStyle = 'rgba(255,170,170,0.35)';
          g.fillRect(-5, -1.2, 10, 2.4);
          g.restore();
        }
    },
    [6, 2],
  );
}

// ---------- carrier ----------

function CarrierBody() {
  const diamond = useDiamond();
  const L = SPEC.carrierLen;
  const R = 0.98; // arch radius
  const hull = useMemo(() => {
    const s = new THREE.Shape();
    const f = SPEC.axles[0];
    const r1 = SPEC.axles[1];
    const r2 = SPEC.axles[2];
    const top = DECK - 0.02;
    const bot = 0.62;
    s.moveTo(-L / 2, top);
    s.lineTo(L / 2, top);
    s.lineTo(L / 2, 1.15);
    s.lineTo(L / 2 - 0.9, bot);
    s.lineTo(f + R, bot);
    s.absarc(f, 0.81, R, 0, Math.PI, false);
    s.lineTo(r1 + R, bot);
    s.absarc(r1, 0.81, R, 0, Math.PI * 0.62, false);
    s.lineTo((r1 + r2) / 2, 1.6);
    s.absarc(r2, 0.81, R, Math.PI * 0.38, Math.PI, false);
    s.lineTo(-L / 2 + 0.9, bot);
    s.lineTo(-L / 2, 1.15);
    s.lineTo(-L / 2, top);
    const g = new THREE.ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 20 });
    g.translate(0, 0, -1.25);
    g.rotateY(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [L]);
  return (
    <group>
      {/* carrier hull: sloped nose and tail for the approach angles, arches over the front axle and the rear tandem */}
      <mesh geometry={hull} material={M.lbWhite} castShadow receiveShadow />
      {/* red diamond-plate side decks */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.15, DECK + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.7, L - 1.2]} />
          <meshStandardMaterial map={diamond} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <RB s={[3.0, 0.12, L - 1.2]} r={0.03} m={M.lbWhite} position={[0, DECK - 0.06, 0]} />
      {/* wheel housings: front axle and the rear tandem */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <RB s={[0.72, 0.5, 2.0]} r={0.08} m={M.lbWhite} position={[s * 1.15, DECK + 0.2, SPEC.axles[0]]} />
          <RB s={[0.72, 0.5, 3.4]} r={0.08} m={M.lbWhite} position={[s * 1.15, DECK + 0.2, (SPEC.axles[1] + SPEC.axles[2]) / 2]} />
          {/* side tool boxes, fuel tank (left) and hydraulic tank (right) between the axles */}
          <RB s={[0.4, 0.7, 1.6]} r={0.05} m={M.lbGrey} position={[s * 1.3, 1.15, 0.6]} />
          <Box s={[0.42, 0.06, 0.4]} m={M.checker} position={[s * 1.4, 0.75, -0.6]} />
          <Box s={[0.42, 0.06, 0.4]} m={M.checker} position={[s * 1.4, 1.25, -0.6]} />
        </group>
      ))}
      {/* engine compartment at the rear with grille and the exhaust stack */}
      <RB s={[2.6, 0.9, 1.6]} r={0.06} m={M.lbWhite} position={[0, DECK + 0.45, -L / 2 + 1.2]} />
      <Box s={[1.6, 0.6, 0.02]} m={M.lbBlack} position={[0, DECK + 0.45, -L / 2 + 0.39]} />
      <Cyl r={0.08} l={1.4} m={M.pipe} position={[-1.1, DECK + 1.3, -L / 2 + 1.6]} />
      {/* front and rear bumpers, lamps, tie-down lugs, logo */}
      {[1, -1].map((e) => (
        <group key={e} position={[0, 0.95, (e * L) / 2]}>
          <RB s={[2.9, 0.42, 0.3]} r={0.05} m={M.lbBlack} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Box s={[0.22, 0.12, 0.04]} m={e > 0 ? M.lens : M.redLamp} position={[s * 1.1, 0.35, e * 0.16]} />
              <Box s={[0.1, 0.12, 0.04]} m={M.amber} position={[s * 0.85, 0.35, e * 0.16]} />
              <mesh position={[s * 0.6, -0.1, e * 0.18]} rotation={[0, Math.PI / 2, 0]} material={M.steel}>
                <torusGeometry args={[0.06, 0.02, 8, 14]} />
              </mesh>
            </group>
          ))}
          <Text position={[0, 0.02, e * 0.16]} rotation={[0, e > 0 ? 0 : Math.PI, 0]} fontSize={0.2} color="#ffffff" fontWeight={700}>
            Link-Belt
          </Text>
        </group>
      ))}
      {/* outrigger boxes, front and rear */}
      {[1, -1].map((e) => (
        <RB key={e} s={[2.9, 0.55, 0.6]} r={0.04} m={M.lbWhite} position={[0, 1.05, e * SPEC.outrigger.full.z]} />
      ))}
    </group>
  );
}

function Outriggers() {
  const beams = useRef<THREE.Group[]>([]);
  const jacks = useRef<THREE.Group[]>([]);
  const mats = useRef<THREE.Group[]>([]);
  useFrame(() => {
    const P = pads(cr);
    P.forEach(([x], i) => {
      const s = Math.sign(x);
      const b = beams.current[i];
      // the beam slides out of its box: its outer end at the pad
      if (b) b.position.x = s * (Math.abs(x) - 1.2);
      const j = jacks.current[i];
      // jack rod extends down; the pad meets the ground at the ride height + sink
      if (j) j.position.y = -cr.jacks[i] - 0.07;
      const m = mats.current[i];
      if (m) {
        m.visible = cr.mats && !cr.onTyres;
        m.position.y = -(cr.lift + 1.05) + 0.06 - cr.sink[i];
      }
    });
  });
  const P: [number, number][] = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  return (
    <group>
      {P.map(([sx, sz], i) => (
        <group key={i} position={[0, 1.05, sz * SPEC.outrigger.full.z]}>
          <group ref={(el) => el && (beams.current[i] = el)}>
            <RB s={[2.6, 0.4, 0.42]} r={0.03} m={M.lbWhite} />
            {/* jack housing at the beam end */}
            <group position={[sx * 1.2, 0, 0]}>
              <Cyl r={0.17} l={0.75} m={M.lbWhite} position={[0, 0.05, 0]} />
              <group ref={(el) => el && (jacks.current[i] = el)}>
                <Cyl r={0.11} l={0.9} m={M.chrome} position={[0, -0.05, 0]} />
                <Cyl r={0.33} l={0.08} m={M.lbBlack} position={[0, -0.52, 0]} />
                <Box s={[0.08, 0.1, 0.5]} m={M.hookYellow} position={[0, -0.45, 0]} />
              </group>
              <group ref={(el) => el && (mats.current[i] = el)}>
                <Box s={[1.5, 0.12, 1.5]} m={M.matWood} />
              </group>
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}

function Wheels() {
  const roll = useRef(0);
  const spin = useRef<THREE.Group[]>([]);
  const steerF = useRef<THREE.Group[]>([]);
  const steerR = useRef<THREE.Group[]>([]);
  useFrame((_, dt) => {
    roll.current += (cr.v / OTR_TYRE.R) * Math.min(dt, 0.05);
    for (const g of spin.current) g.rotation.x = roll.current;
    const d = cr.steer;
    const front = cr.steerMode === 'rear' ? 0 : d;
    const rear = cr.steerMode === 'front' ? 0 : cr.steerMode === 'rear' ? -d : cr.steerMode === 'all' ? -d : d;
    for (const g of steerF.current) g.rotation.y = front;
    for (const g of steerR.current) g.rotation.y = rear * (g.userData.mid ? 0.55 : 1);
  });
  const keep = (list: THREE.Group[]) => (el: THREE.Group | null) => {
    if (el && !list.includes(el)) list.push(el);
  };
  return (
    <group>
      {SPEC.axles.map((z, ai) =>
        [-1, 1].map((s) => (
          <group key={`${ai}${s}`} position={[s * SPEC.track / 2, OTR_TYRE.R, z]} ref={keep(ai === 0 ? steerF.current : steerR.current)} userData={{ mid: ai === 1 }}>
            <group ref={keep(spin.current)}>
              <Wheel spec={OTR_TYRE} side={s as 1 | -1} />
            </group>
          </group>
        )),
      )}
    </group>
  );
}

// ---------- upper ----------

/** A side profile (points in z, y) extruded across x, centred, with a small bevel. */
function useProfile(pts: [number, number][], width: number, bevel = 0.03) {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(...pts[0]);
    for (const p of pts.slice(1)) s.lineTo(...p);
    const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
    g.translate(0, 0, -(width - bevel * 2) / 2);
    g.rotateY(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, bevel]);
}

function Cab() {
  // Link-Belt RT cab on the left of the boom: a tall shell with a raked windscreen that runs down to the floor, a
  // skylight for watching the load, red stripe, step and handrail. Glass set into a white frame.
  const shell = useProfile(
    [
      [-1.15, 0],
      [0.95, 0],
      [1.2, 0.55],
      [0.98, 1.95],
      [-1.0, 1.95],
      [-1.15, 1.8],
    ],
    0.98,
    0.05,
  );
  const glassSide = useProfile(
    [
      [-0.55, 0.75],
      [0.92, 0.75],
      [0.88, 1.75],
      [-0.55, 1.75],
    ],
    1.0,
    0,
  );
  return (
    <group position={[1.15, DECK + 0.35, 1.0]}>
      <mesh geometry={shell} material={M.lbWhite} castShadow receiveShadow />
      <mesh geometry={glassSide} material={M.glass} />
      {/* windscreen down the raked front, skylight, wiper */}
      <mesh position={[0, 1.2, 1.1]} rotation={[-0.16, 0, 0]} material={M.glass}>
        <boxGeometry args={[0.86, 1.45, 0.02]} />
      </mesh>
      <mesh position={[0, 1.97, 0.35]} material={M.glass}>
        <boxGeometry args={[0.8, 0.02, 1.1]} />
      </mesh>
      <Box s={[0.02, 0.7, 0.015]} m={M.lbBlack} position={[0.12, 1.2, 1.13]} rotation={[-0.16, 0, 0.45]} />
      <Box s={[1.0, 0.1, 2.2]} m={M.lbRed} position={[0, 0.48, -0.1]} />
      {/* door frame on the left, step and handrail */}
      <Box s={[0.02, 1.3, 0.04]} m={M.lbGrey} position={[0.51, 1.15, -0.6]} />
      <Box s={[0.3, 0.04, 0.5]} m={M.checker} position={[0.6, -0.15, -0.2]} />
      <Cyl r={0.018} l={1.0} m={M.steel} position={[0.53, 1.0, -0.7]} />
      {/* seat and joysticks seen through the glass */}
      <RB s={[0.5, 0.5, 0.5]} r={0.06} m={M.seat} position={[0, 0.7, -0.15]} />
      <RB s={[0.5, 0.7, 0.12]} r={0.05} m={M.seat} position={[0, 1.1, -0.42]} />
      {[-0.32, 0.32].map((x) => (
        <Cyl key={x} r={0.02} l={0.25} m={M.lbBlack} position={[x, 0.9, 0.1]} />
      ))}
      {/* beacon and work lights on the roof */}
      <Cyl r={0.07} l={0.12} m={M.amberLight} position={[0, 2.04, -0.75]} />
      {[-0.25, 0.25].map((x) => (
        <group key={x} position={[x, 1.86, 1.0]}>
          <RB s={[0.16, 0.12, 0.1]} r={0.03} m={M.lbBlack} />
          <Cyl r={0.045} l={0.02} axis="z" m={M.lens} position={[0, 0, 0.06]} />
        </group>
      ))}
    </group>
  );
}

function UpperBody() {
  const stripes = useCanvasTexture(256, 64, (g) => {
    g.fillStyle = '#f2c21c';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#151515';
    for (let i = -2; i < 12; i++) {
      g.beginPath();
      g.moveTo(i * 32, 64);
      g.lineTo(i * 32 + 16, 64);
      g.lineTo(i * 32 + 48, 0);
      g.lineTo(i * 32 + 32, 0);
      g.fill();
    }
  });
  return (
    <group>
      {/* turntable bearing and upper frame */}
      <Cyl r={1.25} l={0.18} m={M.lbBlack} position={[0, DECK + 0.1, 0]} seg={40} />
      <RB s={[2.2, 0.45, 5.6]} r={0.06} m={M.lbWhite} position={[0, DECK + 0.42, -0.9]} />
      {/* boom foot brackets */}
      {[-1, 1].map((s) => (
        <RB key={s} s={[0.14, 1.0, 1.0]} r={0.04} m={M.lbWhite} position={[s * 0.62, SPEC.pin.y - 0.3, SPEC.pin.z]} />
      ))}
      <Cyl r={0.12} l={1.5} axis="x" m={M.steel} position={[0, SPEC.pin.y, SPEC.pin.z]} />
      {/* main and auxiliary winches behind the boom foot */}
      {[-1.6, -2.45].map((z, i) => (
        <group key={z} position={[0, DECK + 1.0, z]}>
          <Cyl r={0.42} l={1.1} axis="x" m={M.lbBlack} />
          <Cyl r={0.38} l={1.0} axis="x" m={M.rope} />
          {[-0.6, 0.6].map((x) => (
            <Cyl key={x} r={0.5} l={0.06} axis="x" m={i ? M.lbGrey : M.lbRed} position={[x, 0, 0]} />
          ))}
        </group>
      ))}
      {/* engine-side cover on the right */}
      <RB s={[0.8, 1.0, 2.6]} r={0.08} m={M.lbWhite} position={[-1.0, DECK + 1.05, -1.6]} />
      <Cab />
    </group>
  );
}

/** The counterweight slab hides while it is removed (hydraulic removal system: it lowers onto the carrier deck). */
function CounterweightShow() {
  const ref = useRef<THREE.Group>(null);
  const stripes = useCanvasTexture(256, 64, (g) => {
    g.fillStyle = '#f2c21c';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#151515';
    for (let i = -2; i < 12; i++) {
      g.beginPath();
      g.moveTo(i * 32, 64);
      g.lineTo(i * 32 + 16, 64);
      g.lineTo(i * 32 + 48, 0);
      g.lineTo(i * 32 + 32, 0);
      g.fill();
    }
  });
  useFrame(() => {
    const share = cr.cwTarget !== cr.cw ? cr.cw + (cr.cwTarget - cr.cw) * cr.cwT : cr.cw;
    const g = ref.current!;
    g.visible = share > 0.3;
    // the big counterweight is a taller slab; while it is being changed it rides down to the deck
    g.scale.y = share > 20 ? 1.35 : 1;
    g.position.y = DECK + 0.25 - (cr.cwTarget !== cr.cw ? Math.sin(cr.cwT * Math.PI) * 0.6 : 0);
  });
  return (
    <group ref={ref} position={[0, DECK + 0.25, SPEC.cwArm]}>
      <RB s={[2.9, 1.4, 1.4]} r={0.1} m={M.lbGrey} position={[0, 0.7, 0]} />
      <mesh position={[0, 0.25, -0.71]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.6, 0.28]} />
        <meshStandardMaterial map={stripes} roughness={0.6} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <Text position={[0, 0.9, -0.715]} rotation={[0, Math.PI, 0]} fontSize={0.3} color="#c3161c" fontWeight={700}>
        RTC-80160
      </Text>
    </group>
  );
}

// ---------- boom ----------

const SECTIONS = [
  { w: 1.05, h: 1.3, len: 12.4 },
  { w: 0.95, h: 1.17, len: 11.9 },
  { w: 0.86, h: 1.05, len: 11.9 },
  { w: 0.77, h: 0.94, len: 11.9 },
  { w: 0.69, h: 0.84, len: 11.9 },
  { w: 0.61, h: 0.75, len: 11.9 },
];

/** Link-Belt boom section: flat top with chamfered corners, straight sides, a round "U" bottom; extruded along +z. */
export function sectionGeo(w: number, h: number, len: number) {
  const s = new THREE.Shape();
  const c = w * 0.12; // top chamfer
  const r = w / 2; // bottom radius
  const top = h / 2;
  const side = top - (h - r); // where the round bottom starts
  s.moveTo(-w / 2 + c, top);
  s.lineTo(w / 2 - c, top);
  s.lineTo(w / 2, top - c);
  s.lineTo(w / 2, side);
  s.absarc(0, side, r, 0, -Math.PI, true);
  s.lineTo(-w / 2, top - c);
  s.lineTo(-w / 2 + c, top);
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 14 });
  g.computeVertexNormals();
  return g;
}

/** Triangular lattice (fly): two bottom chords and one top chord with zig-zag lacing, along +z. */
function latticeGeo(len: number, w: number) {
  const parts: THREE.BufferGeometry[] = [];
  const h = w * 0.85;
  const P = [new THREE.Vector2(-w / 2, -h / 2), new THREE.Vector2(w / 2, -h / 2), new THREE.Vector2(0, h / 2)];
  const tube = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const d = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r * 0.85, d, 6);
    g.translate(0, d / 2, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())));
    g.translate(a.x, a.y, a.z);
    parts.push(g);
  };
  const k = Math.max(1, w / 0.62); // heavier members on a big lattice
  for (const p of P) tube(new THREE.Vector3(p.x, p.y, 0), new THREE.Vector3(p.x, p.y, len), 0.04 * k);
  const n = Math.max(3, Math.round(len / (w * 1.1)));
  for (let i = 0; i < n; i++) {
    const z0 = (i * len) / n;
    const z1 = ((i + 1) * len) / n;
    for (let k = 0; k < 3; k++) {
      const a = P[k];
      const b = P[(k + 1) % 3];
      const up = i % 2 === 0;
      tube(new THREE.Vector3(a.x, a.y, up ? z0 : z1), new THREE.Vector3(b.x, b.y, up ? z1 : z0), 0.018 * k);
    }
  }
  // end frames
  for (const z of [0, len]) for (let j = 0; j < 3; j++) tube(new THREE.Vector3(P[j].x, P[j].y, z), new THREE.Vector3(P[(j + 1) % 3].x, P[(j + 1) % 3].y, z), 0.03 * k);
  return mergeAll(parts);
}

export function Lattice({ len, w = 0.62, m = M.lbBlack }: { len: number; w?: number; m?: THREE.Material }) {
  const geo = useMemo(() => latticeGeo(len, w), [len, w]);
  return <mesh geometry={geo} material={m} castShadow />;
}

function mergeAll(parts: THREE.BufferGeometry[]) {
  // tiny local merge: positions and normals only
  let n = 0;
  const flat = parts.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    n += ng.attributes.position.count;
    return ng;
  });
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

/** One telescopic section: the formed tube, wear pads at its mouth, the section number. */
function Section({ i }: { i: number }) {
  const s = SECTIONS[i];
  const geo = useMemo(() => sectionGeo(s.w, s.h, s.len), [s]);
  const collar = useMemo(() => sectionGeo(s.w + 0.07, s.h + 0.07, 0.3), [s]);
  const y = -0.05 - i * 0.03;
  const z0 = i === 0 ? -0.5 : 0;
  return (
    <group position={[0, y, z0]}>
      <mesh geometry={geo} material={M.lbWhite} castShadow receiveShadow />
      {/* collar with wear pads at the mouth of every section that has another inside */}
      {i < SECTIONS.length - 1 && (
        <group position={[0, 0, s.len - 0.18]}>
          <mesh geometry={collar} material={M.lbGrey} castShadow />
          {[-1, 1].map((k) => (
            <Box key={k} s={[0.03, 0.22, 0.24]} m={M.lbBlack} position={[k * (s.w / 2 + 0.05), s.h * 0.2, 0.15]} />
          ))}
          <Box s={[s.w * 0.5, 0.03, 0.24]} m={M.lbBlack} position={[0, s.h / 2 + 0.05, 0.15]} />
        </group>
      )}
      {i === 0 && (
        <>
          {/* red swoosh band and the Link-Belt name on both sides */}
          {[1, -1].map((side) => (
            <group key={side}>
              <Box s={[0.01, 0.12, s.len * 0.82]} m={M.lbRed} position={[(side * (s.w + 0.035)) / 2, -s.h * 0.05, s.len * 0.47]} />
              <Box s={[0.01, 0.05, s.len * 0.82]} m={M.lbRed} position={[(side * (s.w + 0.035)) / 2, -s.h * 0.05 - 0.13, s.len * 0.47]} />
              <Text position={[(side * (s.w + 0.04)) / 2, s.h * 0.2, s.len * 0.55]} rotation={[0, (side * Math.PI) / 2, 0]} fontSize={0.5} color="#c3161c" fontWeight={700} letterSpacing={0.02}>
                Link-Belt
              </Text>
            </group>
          ))}
          {/* luffing cylinder lug under the base and the foot pin bosses */}
          <Box s={[0.5, 0.45, 0.8]} m={M.lbWhite} position={[0, -s.h / 2 - 0.2, 5.1]} />
          {[-1, 1].map((k) => (
            <Cyl key={k} r={0.28} l={0.08} axis="x" m={M.lbGrey} position={[k * (s.w / 2 + 0.04), -0.1, 0.5]} />
          ))}
          {/* rope guide rollers on top */}
          {[1.5, 6, 10.5].map((z) => (
            <Cyl key={z} r={0.08} l={0.5} axis="x" m={M.steel} position={[0, s.h / 2 + 0.08, z]} />
          ))}
        </>
      )}
    </group>
  );
}

/** Boom head: two side plates with a rounded nose, the sheave stack between them, the aux sheave and anemometer. */
export function Head() {
  const plate = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.9, -0.45);
    s.lineTo(0.2, -0.5);
    s.absarc(0.35, -0.15, 0.42, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-0.9, 0.45);
    s.lineTo(-0.9, -0.45);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false, curveSegments: 16 });
    g.rotateY(-Math.PI / 2); // shape x → z, extrusion → x
    g.translate(0.03, 0, 0);
    return g;
  }, []);
  return (
    <group>
      {[-0.31, 0.31].map((x) => (
        <mesh key={x} geometry={plate} material={M.lbBlack} position={[x, 0, 0]} castShadow />
      ))}
      <Box s={[0.6, 0.12, 1.0]} m={M.lbBlack} position={[0, 0.39, -0.4]} />
      {/* sheave stack: grooved wheels inside the plates */}
      {[-0.2, -0.1, 0, 0.1, 0.2].map((x) => (
        <group key={x} position={[x, -0.15, 0.35]}>
          <Cyl r={0.4} l={0.07} axis="x" m={M.steel} seg={28} />
          <Cyl r={0.3} l={0.08} axis="x" m={M.lbGrey} seg={20} />
        </group>
      ))}
      <Cyl r={0.07} l={0.7} axis="x" m={M.chrome} position={[0, -0.15, 0.35]} />
      {/* auxiliary (rooster) sheave and the anemometer with its beacon */}
      <group position={[0, 0.35, 0.65]}>
        <Box s={[0.1, 0.25, 0.4]} m={M.lbBlack} position={[0, 0, 0]} />
        <Cyl r={0.18} l={0.08} axis="x" m={M.steel} position={[0, 0.05, 0.15]} />
      </group>
      <Cyl r={0.015} l={0.6} m={M.lbBlack} position={[0.25, 0.75, -0.6]} />
      <Cyl r={0.05} l={0.08} m={M.amberLight} position={[0.25, 1.08, -0.6]} />
      {[0, 2.1, 4.2].map((a) => (
        <Box key={a} s={[0.16, 0.012, 0.03]} m={M.lbBlack} position={[0.25 + Math.cos(a) * 0.08, 0.98, -0.6 + Math.sin(a) * 0.08]} rotation={[0, -a, 0]} />
      ))}
    </group>
  );
}

function Boom() {
  const pivot = useRef<THREE.Group>(null);
  const secs = useRef<THREE.Group[]>([]);
  const head = useRef<THREE.Group>(null);
  const flyRef = useRef<THREE.Group>(null);
  const flyStow = useRef<THREE.Group>(null);
  const fly94 = useRef<THREE.Group>(null);
  const fly168 = useRef<THREE.Group>(null);
  const luff = useRef<THREE.Group>(null);
  const luffRod = useRef<THREE.Mesh>(null);
  const rope = useRef<THREE.Mesh>(null);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);
  useFrame(() => {
    // angle, with the sag of the boom under load, and the collapse when it fails
    const sag = deflection(cr) / Math.max(10, cr.length);
    pivot.current!.rotation.x = -(cr.angle - sag * 0.6) + cr.boomBend * 0.9;
    // pin & latch: the five telescopic sections share the extension
    const ext = (cr.length - SPEC.boomMin) / 5;
    secs.current.forEach((g, i) => g && (g.position.z = i === 0 ? 0 : 0.25 + ext * i));
    const headZ = cr.length + SPEC.headLen - 0.25;
    head.current!.position.z = headZ;
    craneObj.head = head.current;
    // the hoist rope runs from the winch along the top of the boom to the head sheaves
    const r = rope.current!;
    r.scale.y = headZ + 1.6;
    r.position.z = (headZ - 1.6) / 2;
    // fly: erected in front of the head with its offset, or folded along the base section
    const erect = cr.flyTarget > 0 ? cr.flyT : 1 - cr.flyT;
    const showLen = cr.flyTarget > 0 ? cr.flyTarget : cr.fly;
    const isErect = cr.fly > 0 || (cr.flyTarget > 0 && cr.flyT > 0);
    flyRef.current!.visible = isErect && showLen > 0;
    flyRef.current!.rotation.y = (1 - (cr.flyTarget > 0 ? erect : cr.fly > 0 ? 1 - cr.flyT : 0)) * Math.PI * 0.95;
    flyRef.current!.rotation.x = (cr.flyOffset * Math.PI) / 180;
    flyStow.current!.visible = !flyRef.current!.visible;
    fly94.current!.visible = showLen >= 9;
    fly168.current!.visible = showLen > 10;
    // luffing cylinder from the upper to the boom (both points in the pin frame, before the boom's rotation)
    tmp.a.set(0, DECK + 0.7 - SPEC.pin.y, 1.9 - SPEC.pin.z);
    const ang = cr.angle - sag * 0.6 - cr.boomBend * 0.9;
    tmp.b.set(0, -0.85 * Math.cos(ang) + 4.6 * Math.sin(ang), 4.6 * Math.cos(ang) + 0.85 * Math.sin(ang));
    const l = luff.current!;
    l.position.copy(tmp.a);
    const d = tmp.a.distanceTo(tmp.b);
    l.lookAt(l.parent!.localToWorld(tmp.b.clone()));
    luffRod.current!.scale.y = Math.max(0.1, d - 2.6);
    luffRod.current!.position.z = 2.6 + (d - 2.6) / 2;
  });
  return (
    <group position={[0, SPEC.pin.y, SPEC.pin.z]}>
      {/* luffing cylinder: white barrel, chrome rod, trunnion at the base */}
      <group ref={luff}>
        <mesh position={[0, 0, 1.3]} rotation={[Math.PI / 2, 0, 0]} material={M.lbWhite} castShadow>
          <cylinderGeometry args={[0.27, 0.27, 2.6, 24]} />
        </mesh>
        <mesh position={[0, 0, 2.62]} rotation={[Math.PI / 2, 0, 0]} material={M.lbGrey}>
          <cylinderGeometry args={[0.3, 0.3, 0.12, 24]} />
        </mesh>
        <Cyl r={0.14} l={0.8} axis="x" m={M.steel} />
        <mesh ref={luffRod} rotation={[Math.PI / 2, 0, 0]} material={M.chrome} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 1, 18]} />
        </mesh>
      </group>
      <group ref={pivot}>
        {SECTIONS.map((_, i) => (
          <group key={i} ref={(el) => el && (secs.current[i] = el)}>
            <Section i={i} />
          </group>
        ))}
        <mesh ref={rope} position={[0, SECTIONS[0].h / 2 + 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.rope}>
          <cylinderGeometry args={[0.014, 0.014, 1, 5]} />
        </mesh>
        {/* stowed fly folded along the right of the base section on two brackets */}
        <group ref={flyStow} position={[-0.92, -0.05, 1.4]}>
          <Lattice len={9.4} w={0.5} />
          {[0.6, 8.6].map((z) => (
            <Box key={z} s={[0.4, 0.12, 0.18]} m={M.lbGrey} position={[0.25, -0.1, z]} />
          ))}
        </group>
        {/* boom head */}
        <group ref={head}>
          <Head />
          <group ref={flyRef} position={[0, 0.25, 0.3]}>
            <group ref={fly94}>
              <Lattice len={9.4} />
              <Cyl r={0.22} l={0.1} axis="x" m={M.steel} position={[0, -0.2, 9.4]} />
            </group>
            <group ref={fly168} position={[0, 0, 9.4]}>
              <Lattice len={7.4} />
              <Cyl r={0.22} l={0.1} axis="x" m={M.steel} position={[0, -0.2, 7.4]} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

// ---------- hook block and ropes ----------

const ROPE_UP = new THREE.Vector3(0, 1, 0);

function Rope({ get }: { get: (a: THREE.Vector3, b: THREE.Vector3) => boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const m = ref.current!;
    m.visible = get(a, b);
    if (!m.visible) return;
    const d = a.distanceTo(b);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.scale.set(1, d, 1);
    m.quaternion.setFromUnitVectors(ROPE_UP, b.clone().sub(a).normalize());
  });
  return (
    <mesh ref={ref} material={M.rope}>
      <cylinderGeometry args={[0.013, 0.013, 1, 5]} />
    </mesh>
  );
}

/** Where the hook block hangs (world): along the rope from the head, at the hanging length. */
export function blockWorld(out: THREE.Vector3) {
  const t = tipWorld(cr);
  const dx = cr.hook.x - t.x;
  const dy = cr.hook.y - t.y;
  const dz = cr.hook.z - t.z;
  const d = Math.max(0.1, Math.hypot(dx, dy, dz));
  const k = Math.min(1, (hangLen(cr) + 0.3) / d);
  return out.set(t.x + dx * k, t.y + dy * k, t.z + dz * k);
}

export function HookBlock() {
  const ref = useRef<THREE.Group>(null);
  const kinds = useRef<THREE.Group[]>([]);
  const p = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    blockWorld(p);
    const g = ref.current!;
    g.position.copy(p);
    g.rotation.y = cr.heading + cr.slew;
    const blk = cr.fly > 0 && SPEC.flyBall ? 'ball' : cr.block;
    kinds.current.forEach((k) => k && (k.visible = k.userData.id === blk || (k.userData.id === 'block' && blk !== 'ball')));
    const b = BLOCKS.find((x) => x.id === blk)!;
    const big = kinds.current.find((k) => k?.userData.id === 'block');
    if (big) big.scale.setScalar(SPEC.flyBall ? 0.6 + 0.08 * b.sheaves : 1.4 + 0.03 * b.sheaves);
  });
  return (
    <group ref={ref}>
      <group ref={(el) => el && (kinds.current[0] = el)} userData={{ id: 'block' }}>
        <RB s={[0.75, 1.0, 0.45]} r={0.06} m={M.hookYellow} position={[0, 0, 0]} />
        <Box s={[0.77, 0.12, 0.47]} m={M.lbBlack} position={[0, 0.3, 0]} />
        <Cyl r={0.12} l={0.3} m={M.steel} position={[0, -0.6, 0]} />
        <mesh position={[0, -0.95, 0.04]} rotation={[0, Math.PI / 2, Math.PI]} material={M.lbBlack}>
          <torusGeometry args={[0.18, 0.06, 10, 24, Math.PI * 1.4]} />
        </mesh>
      </group>
      <group ref={(el) => el && (kinds.current[1] = el)} userData={{ id: 'ball' }} scale={SPEC.flyBall ? 1 : 2.2}>
        <mesh material={M.hookYellow} position={[0, 0, 0]}>
          <sphereGeometry args={[0.32, 20, 14]} />
        </mesh>
        <mesh position={[0, -0.5, 0.03]} rotation={[0, Math.PI / 2, Math.PI]} material={M.lbBlack}>
          <torusGeometry args={[0.13, 0.045, 10, 22, Math.PI * 1.4]} />
        </mesh>
      </group>
    </group>
  );
}

export function Ropes() {
  const tip = useMemo(() => new THREE.Vector3(), []);
  const blk = useMemo(() => new THREE.Vector3(), []);
  const parts = Array.from({ length: 15 }, (_, i) => i);
  return (
    <>
      {parts.map((i) => (
        <Rope
          key={i}
          get={(a, b) => {
            const n = Math.min(15, cr.fly > 0 && SPEC.flyBall ? 1 : cr.parts);
            if (i >= n) return false;
            const t = tipWorld(cr);
            tip.set(t.x, t.y, t.z);
            blockWorld(blk);
            // spread the parts across the sheave width, across the boom
            const off = (i - (n - 1) / 2) * (SPEC.flyBall ? 0.07 : 0.16);
            const s = Math.cos(cr.heading + cr.slew);
            const k = -Math.sin(cr.heading + cr.slew);
            a.set(tip.x + s * off, tip.y - 0.15, tip.z + k * off);
            b.set(blk.x + s * off * 0.8, blk.y + 0.4, blk.z + k * off * 0.8);
            return true;
          }}
        />
      ))}
    </>
  );
}

// ---------- assembly ----------

export function CraneModel({ children }: { children?: ReactNode }) {
  const pose = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  useFrame(() => {
    pose.current!.position.set(cr.x, 0, cr.z);
    pose.current!.rotation.y = cr.heading;
    // attitude on the supports, and tipping (approximate: about the carrier centre line)
    const t = tilt.current!;
    t.position.y = cr.lift;
    t.rotation.x = -cr.pitch + (cr.tipEdge >= 0 ? Math.cos(cr.slew) * cr.tip : 0);
    t.rotation.z = cr.roll + (cr.tipEdge >= 0 ? -Math.sin(cr.slew) * cr.tip : 0);
    upper.current!.rotation.y = cr.slew;
    craneObj.upper = upper.current;
    craneObj.carrier = t;
  });
  return (
    <>
      <group ref={pose}>
        <Wheels />
        <group ref={tilt}>
          <Bake>
            <CarrierBody />
          </Bake>
          <Outriggers />
          <group ref={upper}>
            <Bake>
              <UpperBody />
            </Bake>
            <CounterweightShow />
            <Boom />
          </group>
          {children}
        </group>
      </group>
      <HookBlock />
      <Ropes />
    </>
  );
}
