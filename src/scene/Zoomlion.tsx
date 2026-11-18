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
import { craneObj, Head, HookBlock, Lattice, RB, Ropes, sectionGeo } from './Crane';
import { Box, Cyl, M } from './parts';
import { Wheel, type TyreSpec } from './tyre';

const DECK = SPEC.deckY;
const ZL_TYRE: TyreSpec = { R: SPEC.tyreR, W: SPEC.tyreW, rimR: 0.33, tread: 'lug', lugs: 18, label: '16.00R25  CRANE' };
const OUT_Z = SPEC.outrigger.full.z;
const BEAM = 7.2; // outrigger beam length

// ---------- carrier ----------

function Carrier() {
  const L = SPEC.carrierLen;
  return (
    <group>
      {/* frame, side skirts with the green line, deck */}
      <RB s={[1.3, 0.8, L - 1.5]} r={0.05} m={M.lbGrey} position={[0, 1.15, 0]} />
      <RB s={[2.96, 0.62, L - 1.2]} r={0.08} m={M.lbWhite} position={[0, DECK - 0.31, -0.3]} />
      {[1, -1].map((s) => (
        <group key={s}>
          <Box s={[0.03, 0.09, L - 4]} m={M.zlGreen} position={[s * 1.495, DECK - 0.42, -0.6]} />
          <Text position={[s * 1.5, DECK - 0.2, -2]} rotation={[0, (s * Math.PI) / 2, 0]} fontSize={0.34} color="#0f9d58" fontWeight={700}>
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
        <Box s={[1.52, 0.1, 2.32]} m={M.zlGreen} position={[0, 1.7, 0]} />
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
        <RB key={e} s={[2.98, 0.9, 1.1]} r={0.05} m={M.lbWhite} position={[0, 1.4, e * OUT_Z]} />
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
            <RB s={[BEAM, 0.6, 0.5]} r={0.04} m={M.lbWhite} />
            <group position={[(sx * BEAM) / 2, 0, 0]}>
              <Cyl r={0.36} l={1.1} m={M.lbWhite} position={[0, 0.1, 0]} />
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

// ---------- upper ----------

function Upper() {
  const P = SPEC.pin;
  return (
    <group>
      <Cyl r={2.0} l={0.3} m={M.lbBlack} position={[0, DECK + 0.15, 0]} seg={48} />
      <RB s={[3.4, 1.3, 11.5]} r={0.08} m={M.lbWhite} position={[0, DECK + 0.95, -3.2]} />
      {/* boom foot brackets and pin */}
      {[-1, 1].map((s) => (
        <RB key={s} s={[0.3, 2.4, 2.6]} r={0.05} m={M.lbWhite} position={[s * 1.35, P.y - 0.9, P.z]} />
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
      <Box s={[1.52, 0.12, 4.02]} m={M.zlGreen} position={[-2.3, DECK + 1.1, -4.2]} />
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
        <Box s={[1.17, 0.1, 2.52]} m={M.zlGreen} position={[0, 0.35, 0]} />
        <Cyl r={0.08} l={0.14} m={M.amberLight} position={[0, 2.2, -0.9]} />
      </group>
      <Box s={[0.9, 0.08, 1.4]} m={M.checker} position={[1.75, DECK + 0.62, 2.9]} />
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
          <RB s={[5.8, 0.74, 4.2]} r={0.06} m={i % 2 ? M.lbWhite : M.lbGrey} />
          {i === 1 && (
            <Text position={[0, 0, -2.11]} rotation={[0, Math.PI, 0]} fontSize={0.45} color="#0f9d58" fontWeight={700}>
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
      <mesh geometry={geo} material={M.lbWhite} castShadow receiveShadow />
      {i < SEC.length - 1 && <mesh geometry={collar} material={M.lbGrey} position={[0, 0, s.len - 0.3]} castShadow />}
      {i === 0 &&
        [1, -1].map((side) => (
          <group key={side}>
            <Box s={[0.02, 0.22, s.len * 0.8]} m={M.zlGreen} position={[(side * (s.w + 0.04)) / 2, -s.h * 0.1, s.len * 0.5]} />
            <Text position={[(side * (s.w + 0.05)) / 2, s.h * 0.18, s.len * 0.55]} rotation={[0, (side * Math.PI) / 2, 0]} fontSize={0.95} color="#0f9d58" fontWeight={700}>
              ZOOMLION
            </Text>
          </group>
        ))}
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
  const tips = useMemo(() => [1, -1].map((s) => new THREE.Vector3(s * Math.sin(MAST.splay) * MAST.len, SEC[0].h / 2 + Math.cos(MAST.splay) * MAST.len, MAST.z)), []);
  useFrame(() => {
    const sag = deflection(cr) / Math.max(20, cr.length);
    const ang = cr.angle - sag * 0.6 - cr.boomBend * 0.9;
    pivot.current!.rotation.x = -ang;
    const ext = (cr.length - SPEC.boomMin) / 6;
    secs.current.forEach((g, i) => g && (g.position.z = i === 0 ? 0 : 0.6 + Math.min(EXT, ext) * i));
    const headZ = cr.length + SPEC.headLen - 0.8;
    head.current!.position.z = headZ;
    craneObj.head = head.current;
    // superlift guys: mast tips to the boom head (front) and to the boom foot (back)
    tmp.c.set(0, 1.0, headZ);
    tmp.b.set(0, SEC[0].h / 2, -0.3);
    tips.forEach((t, k) => {
      if (guys.current[k * 2]) placeRope(guys.current[k * 2], t, tmp.c);
      if (guys.current[k * 2 + 1]) placeRope(guys.current[k * 2 + 1], t, tmp.b);
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
        <mesh position={[0, 0, 3.7]} rotation={[Math.PI / 2, 0, 0]} material={M.lbWhite} castShadow>
          <cylinderGeometry args={[0.62, 0.62, 7.4, 28]} />
        </mesh>
        <Cyl r={0.35} l={1.8} axis="x" m={M.steel} />
        <mesh ref={rod} rotation={[Math.PI / 2, 0, 0]} material={M.chrome} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 1, 22]} />
        </mesh>
      </group>
      <group ref={pivot}>
        {SEC.map((_, i) => (
          <group key={i} ref={(el) => el && (secs.current[i] = el)}>
            <Section i={i} />
          </group>
        ))}
        {/* Y superlift: two lattice masts splayed sideways, their guy ropes */}
        {tips.map((t, k) => (
          <group key={k} position={[0, SEC[0].h / 2, MAST.z]} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), t.clone().sub(new THREE.Vector3(0, SEC[0].h / 2, MAST.z)).normalize())}>
            <Lattice len={MAST.len} w={1.1} m={M.lbWhite} />
            <Cyl r={0.35} l={0.3} axis="x" m={M.steel} position={[0, 0, MAST.len]} />
          </group>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} ref={(el) => el && (guys.current[i] = el)} material={M.rope}>
            <cylinderGeometry args={[0.05, 0.05, 1, 5]} />
          </mesh>
        ))}
        <group ref={head}>
          <group scale={3.2}>
            <Head />
          </group>
          {/* lattice wind boom: 51 m, + 30 m, + 30 m */}
          <group ref={wind} position={[0, 1.2, 1.4]}>
            {windLen.map((len, i) => (
              <group key={i} ref={(el) => el && (parts.current[i] = el)} position={[0, 0, windLen.slice(0, i).reduce((a, b) => a + b, 0)]}>
                <Lattice len={len} w={2.4} m={M.lbWhite} />
                {i === 0 && <Box s={[2.6, 0.2, 0.6]} m={M.zlGreen} position={[0, -0.6, 0.5]} />}
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
