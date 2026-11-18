// Zoomlion ZAT40000H763 model (carrier frame: x left, z forward, y up; origin at the carrier centre on the ground).
// 22.5 m 10-axle carrier with the driver's cab at the front, four long outrigger beams for the 16 × 16 m base, the
// upper with its cab, twin winches and a counterweight stack that grows with the selected counterweight, the 7-section
// telescopic boom with its luffing cylinder, the Y-type superlift masts guying the boom, and the lattice wind boom.
// Shapes are from the product photos; dimensions are estimated where not published. Static parts are baked.
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { deflection, pads } from '../sim/crane';
import { SPEC } from '../sim/spec';
import { cr } from '../store';
import { Bake } from './Bake';
import { craneObj, HookBlock, Lattice, RB, Ropes, sectionGeo } from './Crane';
import { Box, Cyl, M, useCanvasTexture } from './parts';
import { Wheel, type TyreSpec } from './tyre';

const DECK = SPEC.deckY;
const ZL_TYRE: TyreSpec = { R: SPEC.tyreR, W: SPEC.tyreW, rimR: 0.33, tread: 'lug', lugs: 18, label: '16.00R25  CRANE' };
const OUT_Z = SPEC.outrigger.full.z;
const BEAM = 7.2; // outrigger beam length

// ---------- carrier ----------

/** Red and white diagonal warning stripes (bumpers, outrigger beams). */
function useStripes() {
  return useCanvasTexture(128, 32, (g) => {
    g.fillStyle = '#f2f2f2';
    g.fillRect(0, 0, 128, 32);
    g.fillStyle = '#c3161c';
    for (let x = -32; x < 160; x += 32) {
      g.beginPath();
      g.moveTo(x, 32);
      g.lineTo(x + 16, 32);
      g.lineTo(x + 32, 0);
      g.lineTo(x + 16, 0);
      g.fill();
    }
  });
}

function StripePlate({ w, h, ...p }: { w: number; h: number } & JSX.IntrinsicElements['group']) {
  const tex = useStripes();
  return (
    <group {...p}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.5} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  );
}

/** Ladder: two rails and rungs, standing on the ground of its group, facing ±x. */
function Ladder({ h, w = 0.45, m = M.steel, ...p }: { h: number; w?: number; m?: THREE.Material } & JSX.IntrinsicElements['group']) {
  const n = Math.max(2, Math.round(h / 0.3));
  return (
    <group {...p}>
      {[-1, 1].map((k) => (
        <Cyl key={k} r={0.025} l={h} m={m} position={[0, h / 2, (k * w) / 2]} seg={8} />
      ))}
      {Array.from({ length: n }, (_, i) => (
        <Cyl key={i} r={0.018} l={w} axis="z" m={m} position={[0, ((i + 0.6) * h) / n, 0]} seg={6} />
      ))}
    </group>
  );
}

/** Handrail along z: posts and two rails. */
function Rail({ z0, z1, h = 1.0, ...p }: { z0: number; z1: number; h?: number } & JSX.IntrinsicElements['group']) {
  const n = Math.max(2, Math.round((z1 - z0) / 1.5) + 1);
  return (
    <group {...p}>
      {Array.from({ length: n }, (_, i) => (
        <Cyl key={i} r={0.03} l={h} m={M.hookYellow} position={[0, h / 2, z0 + ((z1 - z0) * i) / (n - 1)]} seg={8} />
      ))}
      {[h, h * 0.5].map((y) => (
        <Cyl key={y} r={0.03} l={z1 - z0} axis="z" m={M.hookYellow} position={[0, y, (z0 + z1) / 2]} seg={8} />
      ))}
    </group>
  );
}

function Carrier() {
  const L = SPEC.carrierLen;
  return (
    <group>
      <CarrierDetail />
      {/* frame, side skirts with the green line, deck */}
      <RB s={[1.3, 0.8, L - 1.5]} r={0.05} m={M.zlNavy} position={[0, 1.15, 0]} />
      <RB s={[2.96, 0.62, L - 1.2]} r={0.08} m={M.lbWhite} position={[0, DECK - 0.31, -0.3]} />
      {[1, -1].map((s) => (
        <group key={s}>
          <Box s={[0.03, 0.09, L - 4]} m={M.lbRed} position={[s * 1.495, DECK - 0.42, -0.6]} />
          <Box s={[0.03, 0.3, L - 1.4]} m={M.zlNavy} position={[s * 1.49, DECK - 0.75, -0.3]} />
          <Text position={[s * 1.5, DECK - 0.2, -2]} rotation={[0, (s * Math.PI) / 2, 0]} fontSize={0.34} color="#1e3560" fontWeight={700}>
            ZOOMLION
          </Text>
        </group>
      ))}
      {/* mudguards over each axle */}
      {SPEC.axles.map((z) =>
        [1, -1].map((s) => <Box key={`${z}${s}`} s={[0.62, 0.06, 1.8]} m={M.lbBlack} position={[s * (SPEC.track / 2), SPEC.tyreR * 2 + 0.08, z]} />),
      )}
      {/* driver's cab on the front left, engine and radiator front right */}
      <group position={[0.68, 0, L / 2 - 1.25]}>
        <RB s={[1.5, 2.1, 2.3]} r={0.12} m={M.lbWhite} position={[0, 2.25, 0]} />
        <mesh position={[0, 2.6, 1.16]} material={M.glass}>
          <boxGeometry args={[1.3, 1.0, 0.02]} />
        </mesh>
        <mesh position={[0.76, 2.6, 0.2]} material={M.glass}>
          <boxGeometry args={[0.02, 0.9, 1.5]} />
        </mesh>
        <Box s={[1.52, 0.1, 2.32]} m={M.lbGrey} position={[0, 1.7, 0]} />
        <Cyl r={0.08} l={0.12} m={M.amberLight} position={[0.4, 3.36, -0.6]} />
      </group>
      <RB s={[1.35, 1.1, 2.3]} r={0.1} m={M.lbWhite} position={[-0.78, 2.3, L / 2 - 1.25]} />
      <Box s={[2.9, 0.4, 0.3]} m={M.lbBlack} position={[0, 0.95, L / 2 - 0.1]} />
      {[0.95, -0.95].map((x) => (
        <Cyl key={x} r={0.1} l={0.04} axis="z" m={M.lens} position={[x, 1.25, L / 2 + 0.02]} />
      ))}
      {/* rear power pack and bumper */}
      <RB s={[2.8, 1.1, 2.2]} r={0.1} m={M.lbWhite} position={[0, DECK + 0.45, -L / 2 + 1.3]} />
      <Box s={[2.9, 0.4, 0.3]} m={M.lbBlack} position={[0, 0.95, -L / 2 + 0.1]} />
      {/* outrigger boxes front and rear */}
      {[1, -1].map((e) => (
        <RB key={e} s={[2.98, 0.9, 1.1]} r={0.05} m={M.zlNavy} position={[0, 1.4, e * OUT_Z]} />
      ))}
    </group>
  );
}

function Outriggers() {
  const beams = useRef<THREE.Group[]>([]);
  const jacks = useRef<THREE.Group[]>([]);
  const mats = useRef<THREE.Group[]>([]);
  useFrame(() => {
    pads(cr).forEach(([x], i) => {
      const s = Math.sign(x);
      if (beams.current[i]) beams.current[i].position.x = s * (Math.abs(x) - BEAM / 2);
      if (jacks.current[i]) jacks.current[i].position.y = -cr.jacks[i] - 0.1;
      const m = mats.current[i];
      if (m) {
        m.visible = cr.mats && !cr.onTyres;
        m.position.y = -(cr.lift + 1.4) + 0.1 - cr.sink[i];
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
        <group key={i} position={[0, 1.4, sz * OUT_Z + (sx > 0 ? 0.25 : -0.25)]}>
          <group ref={(el) => el && (beams.current[i] = el)}>
            <RB s={[BEAM, 0.6, 0.5]} r={0.04} m={M.zlNavy} />
            {[1, -1].map((k) => (
              <StripePlate key={k} w={1.4} h={0.4} position={[sx * (BEAM / 2 - 1.1), 0, k * 0.255]} rotation={[0, k > 0 ? 0 : Math.PI, 0]} />
            ))}
            <group position={[(sx * BEAM) / 2, 0, 0]}>
              <Cyl r={0.36} l={1.1} m={M.zlNavy} position={[0, 0.1, 0]} />
              <group ref={(el) => el && (jacks.current[i] = el)}>
                <Cyl r={0.24} l={1.2} m={M.chrome} position={[0, -0.1, 0]} />
                <Cyl r={SPEC.outrigger.pad / 2} l={0.14} m={M.lbBlack} position={[0, -0.72, 0]} seg={28} />
              </group>
              <group ref={(el) => el && (mats.current[i] = el)}>
                <Box s={[3.6, 0.2, 3.6]} m={M.matWood} />
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
  const steer = useRef<THREE.Group[]>([]);
  const zf = SPEC.axles[0];
  const zl = SPEC.axles[SPEC.axles.length - 1];
  useFrame((_, dt) => {
    roll.current += (cr.v / SPEC.tyreR) * Math.min(dt, 0.05);
    for (const g of spin.current) g.rotation.x = roll.current;
    const d = cr.steer;
    for (const g of steer.current) {
      const z = g.userData.z as number;
      // every axle steers on an all-terrain crane, by its distance from the turning centre
      g.rotation.y =
        cr.steerMode === 'front' ? (d * (z - zl * 0.66)) / (zf - zl * 0.66) : cr.steerMode === 'rear' ? (-d * (zf * 0.66 - z)) / (zf * 0.66 - zl) : cr.steerMode === 'all' ? (d * z) / zf : d;
    }
  });
  const keep = (list: THREE.Group[]) => (el: THREE.Group | null) => {
    if (el && !list.includes(el)) list.push(el);
  };
  return (
    <group>
      {SPEC.axles.map((z, ai) =>
        [-1, 1].map((s) => (
          <group key={`${ai}${s}`} position={[(s * SPEC.track) / 2, SPEC.tyreR, z]} ref={keep(steer.current)} userData={{ z }}>
            <group ref={keep(spin.current)}>
              <Wheel spec={ZL_TYRE} side={s as 1 | -1} />
            </group>
          </group>
        )),
      )}
    </group>
  );
}

/** Small parts that make the carrier read as a truck: cab glazing frames, wipers, mirrors, steps, grilles, lamps,
 *  fenders with lips, deck plates and air tanks, the rear ladder and warning plates. */
function CarrierDetail() {
  const L = SPEC.carrierLen;
  const F = L / 2;
  const tyreTop = SPEC.tyreR * 2 + 0.08;
  return (
    <group>
      {/* driver's cab (front left) */}
      <group position={[0.68, 0, F - 1.25]}>
        {[3.12, 2.08].map((y) => (
          <Box key={y} s={[1.36, 0.06, 0.03]} m={M.black} position={[0, y, 1.17]} />
        ))}
        {[-0.68, 0.68].map((x) => (
          <Box key={x} s={[0.06, 1.1, 0.03]} m={M.black} position={[x, 2.6, 1.17]} />
        ))}
        {[-0.3, 0.3].map((x) => (
          <Box key={x} s={[0.03, 0.62, 0.02]} m={M.black} position={[x, 2.32, 1.19]} rotation={[0, 0, x > 0 ? 0.5 : -0.5]} />
        ))}
        <Box s={[1.52, 0.06, 0.35]} m={M.zlNavy} position={[0, 3.3, 1.25]} />
        {[-0.45, 0.45].map((x) => (
          <Box key={x} s={[0.22, 0.12, 0.08]} m={M.lens} position={[x, 3.38, 1.0]} />
        ))}
        {/* mirror on its arm, door seam and handle, steps and grab handle */}
        <Cyl r={0.025} l={0.55} axis="x" m={M.black} position={[0.98, 2.95, 1.0]} seg={6} />
        <Box s={[0.08, 0.5, 0.26]} m={M.black} position={[1.26, 2.65, 1.0]} />
        <Box s={[0.01, 1.8, 0.03]} m={M.black} position={[0.755, 2.25, -0.85]} />
        <Box s={[0.03, 0.04, 0.25]} m={M.chrome} position={[0.77, 2.35, -0.55]} />
        <Cyl r={0.025} l={1.0} m={M.chrome} position={[0.79, 2.45, -1.05]} seg={8} />
        {[0.7, 1.2].map((y) => (
          <Box key={y} s={[0.45, 0.06, 0.7]} m={M.checker} position={[0.95, y, -0.3]} />
        ))}
        {[0.72, 1.22].map((y) => (
          <Box key={y} s={[0.04, 0.5, 0.04]} m={M.black} position={[0.95 + 0.2, y - 0.2, -0.3 + 0.33]} />
        ))}
      </group>
      {/* engine box grille, mirror on the right */}
      {Array.from({ length: 6 }, (_, i) => (
        <Box key={i} s={[1.1, 0.05, 0.04]} m={M.black} position={[-0.78, 1.95 + i * 0.13, F - 0.08]} />
      ))}
      <Cyl r={0.025} l={0.5} axis="x" m={M.black} position={[-1.6, 2.95, F - 0.3]} seg={6} />
      <Box s={[0.08, 0.5, 0.26]} m={M.black} position={[-1.85, 2.65, F - 0.3]} />
      {/* front lamps and warning plate on the bumper */}
      {[1.25, -1.25].map((x) => (
        <Box key={x} s={[0.16, 0.1, 0.04]} m={M.amberLight} position={[x, 1.25, F + 0.02]} />
      ))}
      <StripePlate w={1.6} h={0.3} position={[0, 0.95, F + 0.06]} />
      {/* fenders: top plate already, add the outer lips */}
      {SPEC.axles.map((z) =>
        [1, -1].map((sd) => <Box key={`${z}${sd}`} s={[0.04, 0.28, 1.8]} m={M.black} position={[sd * (SPEC.track / 2 + 0.31), tyreTop - 0.12, z]} />),
      )}
      {/* deck plating and air tanks on the front deck (under the boom rest) */}
      <Box s={[2.9, 0.04, 5.0]} m={M.checker} position={[0, DECK + 0.02, 5.7]} />
      {[1.15, -1.15].map((x) => (
        <group key={x}>
          <Cyl r={0.22} l={2.2} axis="z" m={M.greyLight} position={[x, DECK + 0.26, 5.6]} seg={16} />
          {[4.7, 6.5].map((z) => (
            <Box key={z} s={[0.5, 0.06, 0.08]} m={M.black} position={[x, DECK + 0.03, z]} />
          ))}
        </group>
      ))}
      {/* boom rest over the front deck */}
      <group position={[0, DECK, 7.6]}>
        {[-0.9, 0.9].map((x) => (
          <Box key={x} s={[0.2, 1.1, 0.2]} m={M.zlNavy} position={[x, 0.55, 0]} />
        ))}
        <Box s={[2.0, 0.18, 0.4]} m={M.zlNavy} position={[0, 1.1, 0]} />
        <Box s={[1.4, 0.06, 0.42]} m={M.rubber} position={[0, 1.22, 0]} />
      </group>
      {/* rear: lamps, ladder up the power pack, warning plate, grille */}
      {[1.1, -1.1].map((x) => (
        <group key={x}>
          <Box s={[0.32, 0.15, 0.04]} m={M.redLamp} position={[x, 1.25, -F - 0.02]} />
          <Box s={[0.16, 0.15, 0.04]} m={M.amberLight} position={[x * 0.62, 1.25, -F - 0.02]} />
        </group>
      ))}
      <StripePlate w={1.6} h={0.3} position={[0, 0.95, -F - 0.06]} rotation={[0, Math.PI, 0]} />
      <Ladder h={2.3} w={0.45} position={[0, 1.15, -F - 0.12]} rotation={[0, Math.PI / 2, 0]} />
      {Array.from({ length: 5 }, (_, i) => (
        <Box key={i} s={[2.2, 0.05, 0.04]} m={M.black} position={[0, DECK + 0.2 + i * 0.15, -F + 0.18]} />
      ))}
    </group>
  );
}

// ---------- upper ----------

function Upper() {
  const P = SPEC.pin;
  return (
    <group>
      <Cyl r={2.0} l={0.3} m={M.lbBlack} position={[0, DECK + 0.15, 0]} seg={48} />
      <RB s={[3.4, 1.3, 11.5]} r={0.08} m={M.zlNavy} position={[0, DECK + 0.95, -3.2]} />
      {/* boom foot brackets and pin */}
      {[-1, 1].map((s) => (
        <RB key={s} s={[0.3, 2.4, 2.6]} r={0.05} m={M.zlGreen} position={[s * 1.35, P.y - 0.9, P.z]} />
      ))}
      <Cyl r={0.3} l={3.1} axis="x" m={M.steel} position={[0, P.y, P.z]} />
      {/* twin main winches behind the boom foot */}
      {[-5.9, -7.5].map((z) => (
        <group key={z} position={[0, DECK + 2.0, z]}>
          <Cyl r={0.75} l={2.3} axis="x" m={M.rope} />
          {[-1.2, 1.2].map((x) => (
            <Cyl key={x} r={0.95} l={0.1} axis="x" m={M.zlGreen} position={[x, 0, 0]} />
          ))}
        </group>
      ))}
      {/* power pack on the right, the operator's cab on the left front */}
      <RB s={[1.5, 1.8, 4.0]} r={0.1} m={M.lbWhite} position={[-2.3, DECK + 1.5, -4.2]} />
      <Box s={[1.52, 0.12, 4.02]} m={M.zlNavy} position={[-2.3, DECK + 1.1, -4.2]} />
      <group position={[2.15, DECK + 0.6, 1.0]}>
        <RB s={[1.15, 2.1, 2.5]} r={0.1} m={M.lbWhite} position={[0, 1.05, 0]} />
        <mesh position={[0, 1.35, 1.26]} rotation={[-0.2, 0, 0]} material={M.glass}>
          <boxGeometry args={[1.0, 1.5, 0.02]} />
        </mesh>
        <mesh position={[0.58, 1.4, 0.2]} material={M.glass}>
          <boxGeometry args={[0.02, 1.0, 1.7]} />
        </mesh>
        <mesh position={[0, 2.11, 0.4]} material={M.glass}>
          <boxGeometry args={[0.9, 0.02, 1.3]} />
        </mesh>
        <Box s={[1.17, 0.1, 2.52]} m={M.zlNavy} position={[0, 0.35, 0]} />
        <Cyl r={0.08} l={0.14} m={M.amberLight} position={[0, 2.2, -0.9]} />
      </group>
      <Box s={[0.9, 0.08, 1.4]} m={M.checker} position={[1.75, DECK + 0.62, 2.9]} />
      <UpperDetail />
    </group>
  );
}

/** Upper details: cab glazing frames, wiper, roof rail and work lights, power-pack louvres and exhausts, walkway
 *  plating with its handrail, the access ladder and the slewing ring gear. */
function UpperDetail() {
  const top = DECK + 1.6;
  return (
    <group>
      <group position={[2.15, DECK + 0.6, 1.0]}>
        {[2.08, 0.62].map((y) => (
          <Box key={y} s={[1.1, 0.05, 0.05]} m={M.black} position={[0, y, 1.24 + (2.08 - y) * 0.2]} />
        ))}
        {[-0.53, 0.53].map((x) => (
          <Box key={x} s={[0.05, 1.55, 0.05]} m={M.black} position={[x, 1.35, 1.4]} rotation={[-0.2, 0, 0]} />
        ))}
        <Box s={[0.03, 0.75, 0.02]} m={M.black} position={[0.1, 1.0, 1.42]} rotation={[-0.2, 0, 0.4]} />
        {[-0.45, 0.45].map((x) => (
          <group key={x}>
            <Box s={[0.04, 0.04, 2.3]} m={M.hookYellow} position={[x, 2.38, 0]} />
            {[-1.0, 1.0].map((z) => (
              <Box key={z} s={[0.04, 0.28, 0.04]} m={M.hookYellow} position={[x, 2.24, z]} />
            ))}
          </group>
        ))}
        {[-0.3, 0.3].map((x) => (
          <Box key={x} s={[0.2, 0.13, 0.1]} m={M.lens} position={[x, 2.22, 1.2]} />
        ))}
        <Box s={[0.03, 0.04, 0.25]} m={M.chrome} position={[0.59, 1.1, -0.5]} />
        <Box s={[0.01, 1.9, 0.03]} m={M.black} position={[0.58, 1.05, -0.95]} />
        <Box s={[0.5, 0.05, 0.6]} m={M.checker} position={[0.8, -0.25, -0.5]} />
      </group>
      {/* power pack: louvres, door seams, exhausts, name */}
      {[-3.2, -5.2].map((z) =>
        Array.from({ length: 7 }, (_, i) => <Box key={`${z}${i}`} s={[0.04, 0.05, 1.5]} m={M.black} position={[-3.06, DECK + 1.0 + i * 0.13, z]} />),
      )}
      {[-2.4, -4.2, -6.0].map((z) => (
        <Box key={z} s={[0.01, 1.5, 0.03]} m={M.black} position={[-3.055, DECK + 1.5, z]} />
      ))}
      {[-2.65, -2.0].map((x) => (
        <group key={x}>
          <Cyl r={0.1} l={0.9} m={M.chrome} position={[x, DECK + 2.75, -5.6]} seg={12} />
          <Cyl r={0.12} l={0.06} m={M.black} position={[x, DECK + 3.2, -5.6]} seg={12} />
        </group>
      ))}
      <Text position={[-3.07, DECK + 2.05, -4.2]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.34} color="#1e3560" fontWeight={700}>
        ZOOMLION
      </Text>
      {/* walkway plating and handrail along the right side, ladder from the carrier deck */}
      <Box s={[1.2, 0.04, 4.8]} m={M.checker} position={[1.05, top + 0.02, -3.7]} />
      <Rail z0={-6.0} z1={-1.4} position={[1.62, top, 0]} />
      <Ladder h={1.6} position={[1.76, DECK, -6.4]} />
      {/* slewing ring gear */}
      <Cyl r={2.08} l={0.12} m={M.steel} position={[0, DECK + 0.06, 0]} seg={48} />
    </group>
  );
}

/** Counterweight tray and slabs: one 60 t slab per step, shown as the selected counterweight is fitted. */
function Counterweight() {
  const slabs = useRef<THREE.Group[]>([]);
  const n = 6;
  const per = SPEC.counterweights[SPEC.counterweights.length - 1] / n;
  useFrame(() => {
    const share = cr.cwTarget !== cr.cw ? cr.cw + (cr.cwTarget - cr.cw) * cr.cwT : cr.cw;
    slabs.current.forEach((g, i) => g && (g.visible = share > per * (i + 0.5)));
  });
  return (
    <group position={[0, DECK + 1.6, SPEC.cwArm]}>
      <RB s={[6.0, 0.5, 4.4]} r={0.06} m={M.lbGrey} position={[0, 0, 0]} />
      {Array.from({ length: n }, (_, i) => (
        <group key={i} ref={(el) => el && (slabs.current[i] = el)} position={[0, 0.65 + i * 0.78, 0]}>
          <RB s={[5.8, 0.74, 4.2]} r={0.06} m={i === n - 1 ? M.zlGreen : M.zlNavy} />
          {i === 1 && (
            <Text position={[0, 0, -2.11]} rotation={[0, Math.PI, 0]} fontSize={0.45} color="#ffffff" fontWeight={700}>
              ZAT40000H
            </Text>
          )}
        </group>
      ))}
    </group>
  );
}

// ---------- boom ----------

// base + 6 telescopic sections; at full extension the last one ends at the head
const SEC = Array.from({ length: 7 }, (_, i) => ({ w: 2.3 - i * 0.17, h: 2.9 - i * 0.21, len: i === 0 ? 20.5 : 19.2 }));
const EXT = (SPEC.boomMax - SPEC.boomMin) / 6;
const MAST = { z: 7, len: 16, splay: 0.52 }; // superlift masts on the base section

function Section({ i }: { i: number }) {
  const s = SEC[i];
  const geo = useMemo(() => sectionGeo(s.w, s.h, s.len), [s]);
  const collar = useMemo(() => sectionGeo(s.w + 0.12, s.h + 0.12, 0.5), [s]);
  return (
    <group position={[0, -0.08 - i * 0.05, i === 0 ? -0.7 : 0]}>
      <Bake>
      <mesh geometry={geo} material={M.zlGreen} castShadow receiveShadow />
      {i < SEC.length - 1 && <mesh geometry={collar} material={M.zlGreenDark} position={[0, 0, s.len - 0.3]} castShadow />}
      {/* slide pads at the collar, where the next section runs */}
      {i < SEC.length - 1 &&
        [-1, 1].map((k) => <Box key={k} s={[0.3, 0.1, 0.45]} m={M.black} position={[k * s.w * 0.28, s.h / 2 + 0.11, s.len - 0.05]} />)}
      {i === 0 && (
        <group>
          {/* hose and cable tray along the side, rope guide rollers on top near the foot */}
          {[1, -1].map((k) => (
            <Box key={k} s={[0.12, 0.18, s.len * 0.62]} m={M.black} position={[k * (s.w / 2 + 0.07), s.h * 0.36, s.len * 0.45]} />
          ))}
          <group position={[0, s.h / 2, 3.2]}>
            {[-0.55, 0.55].map((x) => (
              <Box key={x} s={[0.1, 0.45, 0.5]} m={M.zlGreenDark} position={[x, 0.2, 0]} />
            ))}
            <Cyl r={0.17} l={1.0} axis="x" m={M.steel} position={[0, 0.3, 0]} seg={14} />
          </group>
        </group>
      )}
      </Bake>
      {i === 0 &&
        [1, -1].map((side) => (
          <group key={side}>
            <Box s={[0.02, 0.5, s.len * 0.75]} m={M.zlNavy} position={[(side * (s.w + 0.04)) / 2, -s.h * 0.28, s.len * 0.42]} />
            <Text position={[(side * (s.w + 0.05)) / 2, s.h * 0.15, s.len * 0.55]} rotation={[0, (side * Math.PI) / 2, 0]} fontSize={1.0} color="#111111" fontWeight={700}>
              ZAT40000H7
            </Text>
          </group>
        ))}
    </group>
  );
}

/** Boom head: a lime box around the sheave stack with the yellow and black chevrons on its nose (as on the photos). */
function ZlHead() {
  const chevron = useCanvasTexture(128, 128, (g) => {
    g.fillStyle = '#f2c21c';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#151515';
    for (let i = -1; i < 5; i++) {
      g.beginPath();
      g.moveTo(0, i * 32);
      g.lineTo(64, i * 32 + 32);
      g.lineTo(128, i * 32);
      g.lineTo(128, i * 32 + 14);
      g.lineTo(64, i * 32 + 46);
      g.lineTo(0, i * 32 + 14);
      g.fill();
    }
  });
  return (
    <group>
      <RB s={[2.1, 2.4, 2.4]} r={0.12} m={M.zlGreen} position={[0, 0.1, 0.4]} />
      {[-1, 1].map((k) => (
        <Box key={k} s={[0.12, 2.8, 1.4]} m={M.zlGreenDark} position={[k * 1.1, -0.6, 1.4]} />
      ))}
      {/* sheave stack between the side plates */}
      {Array.from({ length: 7 }, (_, i) => (
        <Cyl key={i} r={1.1} l={0.16} axis="x" m={M.steel} position={[-0.75 + i * 0.25, -0.8, 1.7]} seg={28} />
      ))}
      <Cyl r={0.18} l={2.3} axis="x" m={M.chrome} position={[0, -0.8, 1.7]} />
      <mesh position={[0, 0.3, 1.61]}>
        <planeGeometry args={[1.8, 1.6]} />
        <meshStandardMaterial map={chevron} roughness={0.5} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <Cyl r={0.08} l={0.15} m={M.amberLight} position={[0.7, 1.4, 0.2]} />
      {/* top sheave for the lead rope, anemometer and red aviation light, flood light under the head */}
      <Cyl r={0.42} l={0.25} axis="x" m={M.steel} position={[0, 1.35, -0.5]} seg={20} />
      <Cyl r={0.04} l={1.4} m={M.greyLight} position={[-0.75, 2.0, 0.6]} seg={6} />
      <Cyl r={0.1} l={0.16} m={M.redLamp} position={[-0.75, 2.75, 0.6]} seg={10} />
      <Cyl r={0.03} l={1.0} m={M.greyLight} position={[0.6, 1.8, -0.2]} seg={6} />
      {[0, 2.09, 4.19].map((a) => (
        <mesh key={a} position={[0.6 + Math.cos(a) * 0.18, 2.3, -0.2 + Math.sin(a) * 0.18]} material={M.black}>
          <sphereGeometry args={[0.06, 8, 6]} />
        </mesh>
      ))}
      <Box s={[0.4, 0.12, 0.25]} m={M.lens} position={[0, -1.15, 0.0]} />
    </group>
  );
}

const UP = new THREE.Vector3(0, 1, 0);
function placeRope(m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.scale.set(1, a.distanceTo(b), 1);
  m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
}

function Boom() {
  const pivot = useRef<THREE.Group>(null);
  const secs = useRef<THREE.Group[]>([]);
  const head = useRef<THREE.Group>(null);
  const wind = useRef<THREE.Group>(null);
  const parts = useRef<THREE.Group[]>([]);
  const luff = useRef<THREE.Group>(null);
  const rod = useRef<THREE.Mesh>(null);
  const guys = useRef<THREE.Mesh[]>([]);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }), []);
  const masts = useRef<THREE.Group[]>([]);
  const tips = useMemo(() => [new THREE.Vector3(), new THREE.Vector3()], []);
  const leads = useRef<THREE.Mesh[]>([]);
  const roller = useMemo(() => new THREE.Vector3(), []);
  const drum = useMemo(() => new THREE.Vector3(), []);
  const top = useMemo(() => new THREE.Vector3(), []);
  const base = useMemo(() => new THREE.Vector3(0, SEC[0].h / 2, MAST.z), []);
  const fwd = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const sag = deflection(cr) / Math.max(20, cr.length);
    const ang = cr.angle - sag * 0.6 - cr.boomBend * 0.9;
    pivot.current!.rotation.x = -ang;
    const ext = (cr.length - SPEC.boomMin) / 6;
    secs.current.forEach((g, i) => g && (g.position.z = i === 0 ? 0 : 0.6 + Math.min(EXT, ext) * i));
    const headZ = cr.length + SPEC.headLen - 0.8;
    head.current!.position.z = headZ;
    craneObj.head = head.current;
    // superlift masts: folded forward on top of the boom for travel, raised into the Y once the boom lifts
    const up = THREE.MathUtils.smoothstep(cr.angle, 0.04, 0.2);
    tmp.c.set(0, 1.0, headZ);
    tmp.b.set(0, SEC[0].h / 2, -0.3);
    tips.forEach((t, k) => {
      const s = k ? -1 : 1;
      dir.set(s * (0.07 + (Math.sin(MAST.splay) - 0.07) * up), 0.03 + (Math.cos(MAST.splay) - 0.03) * up, 1 - up).normalize();
      masts.current[k]?.quaternion.setFromUnitVectors(fwd, dir);
      t.copy(base).addScaledVector(dir, MAST.len);
      for (const [g, to] of [
        [guys.current[k * 2], tmp.c],
        [guys.current[k * 2 + 1], tmp.b],
      ] as const) {
        if (!g) continue;
        g.visible = up > 0.6;
        if (g.visible) placeRope(g, t, to);
      }
    });
    // lead ropes: off the two winch drums, over the guide roller on the base section, along the top to the head sheave
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const rz = 3.2 - 0.7;
    const ry = SEC[0].h / 2 - 0.08 + 0.48;
    roller.set(0, ry * ca + rz * sa, -ry * sa + rz * ca);
    [-5.9, -7.5].forEach((z, k) => {
      const x = k ? 0.35 : -0.35;
      drum.set(x, DECK + 2.0 + 0.78 - SPEC.pin.y, z - SPEC.pin.z);
      const r0 = roller.clone().setX(x * 0.4);
      if (leads.current[k]) placeRope(leads.current[k], drum, r0);
      top.set(x * 0.4, ry, rz);
      tmp.a.set(x * 0.4, 1.35 + 0.42, headZ - 0.5);
      if (leads.current[k + 2]) placeRope(leads.current[k + 2], top, tmp.a);
    });
    // wind boom: grows out of the head while it is fitted
    const showLen = cr.flyTarget > 0 ? cr.flyTarget : cr.fly;
    const erect = cr.flyTarget !== cr.fly ? (cr.flyTarget > 0 ? cr.flyT : 1 - cr.flyT) : cr.fly > 0 ? 1 : 0;
    const w = wind.current!;
    w.visible = erect > 0.01 && showLen > 0;
    w.scale.z = Math.max(0.01, erect);
    w.rotation.x = (cr.flyOffset * Math.PI) / 180;
    parts.current.forEach((g, i) => g && (g.visible = showLen > [0, 60, 90][i]));
    // luffing cylinder from the upper to the base section
    tmp.a.set(0, DECK + 1.5 - SPEC.pin.y, 2.6 - SPEC.pin.z);
    tmp.b.set(0, -1.9 * Math.cos(ang) + 14 * Math.sin(ang), 14 * Math.cos(ang) + 1.9 * Math.sin(ang));
    const l = luff.current!;
    l.position.copy(tmp.a);
    const d = tmp.a.distanceTo(tmp.b);
    l.lookAt(l.parent!.localToWorld(tmp.b.clone()));
    rod.current!.scale.y = Math.max(0.1, d - 7.4);
    rod.current!.position.z = 7.4 + (d - 7.4) / 2;
  });
  const windLen = [51, 30, 30];
  return (
    <group position={[0, SPEC.pin.y, SPEC.pin.z]}>
      <group ref={luff}>
        <mesh position={[0, 0, 3.7]} rotation={[Math.PI / 2, 0, 0]} material={M.steel} castShadow>
          <cylinderGeometry args={[0.62, 0.62, 7.4, 28]} />
        </mesh>
        <Cyl r={0.35} l={1.8} axis="x" m={M.steel} />
        <mesh ref={rod} rotation={[Math.PI / 2, 0, 0]} material={M.chrome} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 1, 22]} />
        </mesh>
      </group>
      {[0, 1].map((i) => (
        <mesh key={i} ref={(el) => el && (leads.current[i] = el)} material={M.rope}>
          <cylinderGeometry args={[0.022, 0.022, 1, 6]} />
        </mesh>
      ))}
      <group ref={pivot}>
        {[2, 3].map((i) => (
          <mesh key={i} ref={(el) => el && (leads.current[i] = el)} material={M.rope}>
            <cylinderGeometry args={[0.022, 0.022, 1, 6]} />
          </mesh>
        ))}
        {SEC.map((_, i) => (
          <group key={i} ref={(el) => el && (secs.current[i] = el)}>
            <Section i={i} />
          </group>
        ))}
        {/* Y superlift: two lattice masts splayed sideways, their guy ropes */}
        {tips.map((_, k) => (
          <group key={k} position={[0, SEC[0].h / 2, MAST.z]} ref={(el) => el && (masts.current[k] = el)}>
            <Lattice len={MAST.len} w={1.1} m={M.zlGreen} />
            <Cyl r={0.35} l={0.3} axis="x" m={M.steel} position={[0, 0, MAST.len]} />
          </group>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} ref={(el) => el && (guys.current[i] = el)} material={M.rope}>
            <cylinderGeometry args={[0.05, 0.05, 1, 5]} />
          </mesh>
        ))}
        <group ref={head}>
          <Bake>
            <ZlHead />
          </Bake>
          {/* lattice wind boom: 51 m, + 30 m, + 30 m */}
          <group ref={wind} position={[0, 1.2, 1.4]}>
            {windLen.map((len, i) => (
              <group key={i} ref={(el) => el && (parts.current[i] = el)} position={[0, 0, windLen.slice(0, i).reduce((a, b) => a + b, 0)]}>
                <Lattice len={len} w={2.4} m={M.zlGreen} />
                {i === 0 && <Box s={[2.6, 0.2, 0.6]} m={M.zlNavy} position={[0, -0.6, 0.5]} />}
              </group>
            ))}
          </group>
        </group>
      </group>
      {/* the wind boom's head sheave sits at the end of the last fitted piece */}
    </group>
  );
}

export function ZoomlionModel() {
  const pose = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  useFrame(() => {
    pose.current!.position.set(cr.x, 0, cr.z);
    pose.current!.rotation.y = cr.heading;
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
            <Carrier />
          </Bake>
          <Outriggers />
          <group ref={upper}>
            <Bake>
              <Upper />
            </Bake>
            <Counterweight />
            <Boom />
          </group>
        </group>
      </group>
      <HookBlock />
      <Ropes />
    </>
  );
}
