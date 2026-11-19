// SANY SCC45000A model (upper frame: x left, z forward, y up; origin at the slewing centre on the ground), from the
// user's photos: two crawlers of individual track shoes with sprockets, idlers and rollers under a cross carbody; the
// orange-yellow house with louvred panels, winches, cab, walkways and the tall yellow counterweight stacks; red square
// lattice boom(s) with grey lacing (two booms converging to a joined head for the 4 500 t double boom), tapered foot
// and head, section joints and lattice cross frames; twin superlift masts converging to a spreader, pendants to the
// boom head and to the hanging A-frame counterweight tray; the red equalizer yoke under two hook blocks. Dims est.
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hangLen, jibElevation, tipUpper, upperToWorld } from '../sim/crane';
import { FLY, SPEC } from '../sim/spec';
import { cr } from '../store';
import { Bake } from './Bake';
import { RB, blockWorld, craneObj } from './Crane';
import { Box, Cyl, M, useCanvasTexture } from './parts';

const RED = new THREE.MeshStandardMaterial({ color: '#d0142c', metalness: 0.3, roughness: 0.4 });
const LACE = new THREE.MeshStandardMaterial({ color: '#b9bec2', metalness: 0.45, roughness: 0.4 });
const YEL = new THREE.MeshStandardMaterial({ color: '#f2a516', metalness: 0.25, roughness: 0.45 });
const ORA = new THREE.MeshStandardMaterial({ color: '#e07b10', metalness: 0.3, roughness: 0.5 });
const DARK = new THREE.MeshStandardMaterial({ color: '#2e3134', metalness: 0.45, roughness: 0.55 });
const SHOE = new THREE.MeshStandardMaterial({ color: '#1f2123', metalness: 0.55, roughness: 0.65 });
const GREY = new THREE.MeshStandardMaterial({ color: '#7d8287', metalness: 0.6, roughness: 0.4 });
// galvanised wire rope, light as on the photos
const ROPE = new THREE.MeshStandardMaterial({ color: '#b4b9be', metalness: 0.7, roughness: 0.35 });

const DECK = SPEC.deckY;
const CAB_X = SPEC.twin ? 9.2 : 5.2; // the cab clears the right boom foot on the double boom
const BOOM = SPEC.boomMax;
const TWIN = SPEC.twin;
const BW = 4.2; // boom lattice section
const FOOT_X = TWIN ? 6.0 : 0; // boom centre lines at the foot pins …
const HEAD_X = TWIN ? 3.0 : 0; // … converging to the joined head
const SIDES = TWIN ? [-1, 1] : [0];
const MAST = { z: -1.6, len: 72, elev: (100 * Math.PI) / 180, footX: TWIN ? 5.0 : 0, topX: TWIN ? 2.2 : 0, w: 3.0 };
// jib struts at the boom head (boom frame): the rear one leans back, the front one forward over the jib
const STRUT_R = new THREE.Vector3(0, 15 * Math.sin(1.95), 15 * Math.cos(1.95));
const STRUT_F = new THREE.Vector3(0, 15 * Math.sin(1.15), 15 * Math.cos(1.15));
export const mastTop = (s: number) => new THREE.Vector3(s * MAST.topX, SPEC.pin.y + MAST.len * Math.sin(MAST.elev), MAST.z + MAST.len * Math.cos(MAST.elev));
const TRAY = { z: SPEC.cwArm, y: 2.2, w: 16, d: 10, hang: 7 };

// ---------- geometry helpers ----------
const UP = new THREE.Vector3(0, 1, 0);
const ROPE_GEO = new THREE.CylinderGeometry(0.055, 0.055, 1, 6);
function barGeo(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 6) {
  const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), seg, 1, true);
  return g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()), new THREE.Vector3(1, 1, 1)));
}
const merged = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
  g.computeVertexNormals();
  return g;
};

/** Square lattice along +z from width w0 to w1: red chords and grey lacing (two merged meshes). */
function lattice(len: number, w0: number, w1: number, chord = 0.24, lace = 0.1) {
  const chords: THREE.BufferGeometry[] = [];
  const laces: THREE.BufferGeometry[] = [];
  const corner = (k: number, z: number) => {
    const h = (w0 + ((w1 - w0) * z) / len) / 2;
    const [x, y] = [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ][k];
    return new THREE.Vector3(x, y, z);
  };
  for (let k = 0; k < 4; k++) chords.push(barGeo(corner(k, 0), corner(k, len), chord));
  const n = Math.max(2, Math.round(len / ((w0 + w1) / 2)));
  const step = len / n;
  for (let i = 0; i <= n; i++)
    for (let k = 0; k < 4; k++) {
      const z = i * step;
      laces.push(barGeo(corner(k, z), corner((k + 1) % 4, z), lace));
      if (i < n) {
        const f = (i + k) % 2;
        laces.push(barGeo(corner(f ? k : (k + 1) % 4, z), corner(f ? (k + 1) % 4 : k, z + step), lace));
      }
    }
  return { chords: merged(chords), laces: merged(laces) };
}

export function Lat({ len, w0, w1 = w0, chord, lace, ...p }: { len: number; w0: number; w1?: number; chord?: number; lace?: number } & JSX.IntrinsicElements['group']) {
  const g = useMemo(() => lattice(len, w0, w1, chord, lace), [len, w0, w1, chord, lace]);
  return (
    <group {...p}>
      <mesh geometry={g.chords} material={RED} castShadow />
      <mesh geometry={g.laces} material={LACE} castShadow />
    </group>
  );
}

// ---------- crawlers and carbody ----------
/** A point on the track loop, by arc length from the rear of the top run: position and the tilt of the shoe. */
function onLoop(s: number, ls: number, R: number): [THREE.Vector3, number] {
  if (s < ls) return [new THREE.Vector3(0, 2 * R, -ls / 2 + s), 0];
  if ((s -= ls) < Math.PI * R) return [new THREE.Vector3(0, R + R * Math.cos(s / R), ls / 2 + R * Math.sin(s / R)), s / R];
  if ((s -= Math.PI * R) < ls) return [new THREE.Vector3(0, 0, ls / 2 - s), Math.PI];
  s -= ls;
  return [new THREE.Vector3(0, R + R * Math.cos(Math.PI + s / R), -ls / 2 + R * Math.sin(Math.PI + s / R)), Math.PI + s / R];
}

/** How far each track has run (m), left (+x) and right (−x): from the crawler's speed and its turn rate. */
export const trackRun = { l: 0, r: 0 };

function Crawler({ s }: { s: number }) {
  const L = SPEC.carrierLen;
  const W = SPEC.tyreW;
  const R = 1.55;
  const ls = L - 2 * R;
  const per = 2 * ls + 2 * Math.PI * R;
  const n = Math.round(per / 0.62);
  const shoe = useMemo(() => merged([new THREE.BoxGeometry(W, 0.26, 0.56), new THREE.BoxGeometry(W, 0.14, 0.09).translate(0, 0.17, 0)]), [W]);
  const inst = useRef<THREE.InstancedMesh>(null);
  const ends = useRef<THREE.Group[]>([]);
  const out = s * (W / 2 + 0.02);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const ax = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const last = useRef(NaN);
  useFrame(() => {
    // the shoes run round the loop (each the next one's place: shift by the run, modulo the pitch is enough)
    const run = s > 0 ? trackRun.l : trackRun.r;
    if (run === last.current) return;
    last.current = run;
    const off = ((run % per) + per) % per;
    for (let i = 0; i < n; i++) {
      const [p, a] = onLoop(((i / n) * per + off) % per, ls, R);
      inst.current!.setMatrixAt(i, m4.compose(p, q.setFromAxisAngle(ax, a), one));
    }
    inst.current!.instanceMatrix.needsUpdate = true;
    for (const g of ends.current) g.rotation.x = run / (R - 0.05);
  });
  return (
    <group position={[s * (SPEC.track / 2), 0.13, 0]}>
      <instancedMesh ref={inst} args={[shoe, SHOE, n]} castShadow receiveShadow frustumCulled={false} />
      {/* side frame between the runs, rollers under it, carrier rollers on top */}
      <RB s={[W - 0.5, 1.9, ls]} r={0.12} m={DARK} position={[0, R, 0]} />
      {Array.from({ length: 9 }, (_, i) => (
        <Cyl key={`b${i}`} r={0.42} l={W - 0.7} axis="x" m={GREY} position={[0, 0.55, -ls / 2 + 0.6 + (i * (ls - 1.2)) / 8]} seg={14} />
      ))}
      {[-ls / 4, 0, ls / 4].map((z) => (
        <Cyl key={`t${z}`} r={0.32} l={W - 0.7} axis="x" m={GREY} position={[0, 2 * R - 0.3, z]} seg={12} />
      ))}
      {/* sprocket (rear) with its teeth and the idler (front), round covers outboard */}
      {[-1, 1].map((e) => (
        <group key={e} position={[0, R, (e * ls) / 2]} ref={(el) => el && (ends.current[e < 0 ? 0 : 1] = el)} userData={{ noBake: true }}>
          <Cyl r={R - 0.2} l={W - 0.3} axis="x" m={DARK} seg={28} />
          <Cyl r={R * 0.7} l={0.25} axis="x" m={GREY} position={[s * (W / 2 - 0.05), 0, 0]} seg={28} />
          <Cyl r={0.35} l={0.35} axis="x" m={DARK} position={[s * (W / 2 + 0.05), 0, 0]} seg={16} />
          {e < 0 &&
            Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2;
              return <Box key={i} s={[W - 0.6, 0.35, 0.3]} m={DARK} position={[0, Math.cos(a) * (R - 0.15), Math.sin(a) * (R - 0.15)]} rotation={[a, 0, 0]} />;
            })}
        </group>
      ))}
      <Box s={[0.08, 0.5, ls * 0.75]} m={RED} position={[out, R + 0.55, 0]} />
      <Text position={[out + s * 0.01, R - 0.1, 0]} rotation={[0, (s * Math.PI) / 2, 0]} fontSize={1.1} color="#e9ebed" fontWeight={700}>
        SANY
      </Text>
    </group>
  );
}

function Carbody() {
  const gap = SPEC.track - SPEC.tyreW;
  return (
    <group>
      <RB s={[7.5, 2.4, 7.5]} r={0.2} m={DARK} position={[0, 2.95, 0]} />
      {/* the cross: beams out to the crawlers, front and rear */}
      {[-2.6, 2.6].map((z) => (
        <RB key={z} s={[gap, 1.7, 2.4]} r={0.12} m={DARK} position={[0, 2.6, z]} />
      ))}
      {[-1, 1].map((s) => (
        <RB key={s} s={[1.0, 2.2, 7.2]} r={0.1} m={DARK} position={[(s * gap) / 2, 2.9, 0]} />
      ))}
      <Cyl r={4.7} l={0.35} m={GREY} position={[0, DECK - 0.45, 0]} seg={56} />
      <Cyl r={4.4} l={0.5} m={M.lbBlack} position={[0, DECK - 0.15, 0]} seg={56} />
    </group>
  );
}

// ---------- the house ----------
function useLouvre() {
  return useCanvasTexture(256, 128, (g) => {
    g.fillStyle = '#f2a516';
    g.fillRect(0, 0, 256, 128);
    // panel seams and louvre grilles
    g.fillStyle = 'rgba(80,45,0,0.55)';
    for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 2, 128);
    g.fillRect(0, 0, 256, 3);
    g.fillRect(0, 125, 256, 3);
    for (let p = 0; p < 4; p++)
      for (let i = 0; i < 9; i++) {
        g.fillStyle = 'rgba(40,25,0,0.6)';
        g.fillRect(p * 64 + 10 + i * 5, 26, 2, 70);
      }
  }, [3, 1]);
}

function House() {
  const louvre = useLouvre();
  const houseMat = useMemo(() => new THREE.MeshStandardMaterial({ map: louvre, metalness: 0.25, roughness: 0.5 }), [louvre]);
  const BASE = DECK + 0.8;
  return (
    <group>
      {/* revolving frame: orange, with walkways and rails all round */}
      <RB s={[12, 1.6, 19]} r={0.12} m={ORA} position={[0, DECK + 0.8, -5.0]} />
      <Box s={[12.4, 0.06, 19.4]} m={M.checker} position={[0, DECK + 1.63, -5.0]} />
      {[-6.1, 6.1].map((x) => (
        <group key={x}>
          <Cyl r={0.04} l={18} axis="z" m={M.hookYellow} position={[x, BASE + 1.9, -5]} seg={6} />
          <Cyl r={0.04} l={18} axis="z" m={M.hookYellow} position={[x, BASE + 1.35, -5]} seg={6} />
          {Array.from({ length: 7 }, (_, i) => (
            <Cyl key={i} r={0.04} l={1.1} m={M.hookYellow} position={[x, BASE + 1.35, -14 + i * 3]} seg={6} />
          ))}
        </group>
      ))}
      {/* machinery house: louvred panels, roof with fan grilles and exhausts */}
      <mesh position={[-0.8, BASE + 3.0, -8.5]} material={houseMat} castShadow receiveShadow>
        <boxGeometry args={[9, 4.4, 11]} />
      </mesh>
      <Box s={[9.2, 0.25, 11.2]} m={ORA} position={[-0.8, BASE + 5.3, -8.5]} />
      {[-11, -6].map((z) => (
        <group key={z}>
          <Cyl r={1.1} l={0.3} m={DARK} position={[-0.8, BASE + 5.5, z]} seg={24} />
          <Cyl r={1.0} l={0.32} m={M.steelDark} position={[-0.8, BASE + 5.55, z]} seg={24} open />
        </group>
      ))}
      {[-2.6, -1.6].map((x) => (
        <Cyl key={x} r={0.22} l={2} m={M.chrome} position={[x, BASE + 6.3, -4.4]} seg={12} />
      ))}
      <Text position={[-5.32, BASE + 4.2, -8.5]} rotation={[0, -Math.PI / 2, 0]} fontSize={1.3} color="#d0142c" fontWeight={700}>
        SANY
      </Text>
      <Text position={[-5.32, BASE + 2.9, -8.5]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.6} color="#3a2a10" fontWeight={700}>
        SCC45000A
      </Text>
      {/* winches in front of the house, between the boom feet */}
      {[-0.4, -2.6].map((z) => (
        <group key={z} position={[0, BASE + 1.4, z]}>
          <Cyl r={1.05} l={6.4} axis="x" m={M.rope} seg={24} />
          {[-3.3, 3.3].map((x) => (
            <Cyl key={x} r={1.35} l={0.18} axis="x" m={ORA} position={[x, 0, 0]} seg={24} />
          ))}
          {[-3.6, 3.6].map((x) => (
            <Box key={x} s={[0.3, 2.4, 1.8]} m={ORA} position={[x, -0.3, 0]} />
          ))}
        </group>
      ))}
      {/* operator's cab, front right, on its platform with steps */}
      <group position={[CAB_X, BASE, 3.6]}>
        {/* bracket out from the revolving frame (outboard of the boom foot on the double boom) */}
        {TWIN && <Box s={[CAB_X - 5.6, 0.7, 2.4]} m={ORA} position={[-(CAB_X - 5.6) / 2, 0.45, 0]} />}
        <Box s={[2.8, 0.2, 4.2]} m={M.checker} position={[0, 0.9, 0]} />
        <RB s={[2.4, 2.8, 3.4]} r={0.12} m={M.greyLight} position={[0, 2.4, 0]} />
        <mesh position={[0, 2.6, 1.71]} rotation={[-0.12, 0, 0]} material={M.glass}>
          <boxGeometry args={[2.1, 2.0, 0.03]} />
        </mesh>
        {[-1, 1].map((k) => (
          <mesh key={k} position={[k * 1.21, 2.6, 0.2]} material={M.glass}>
            <boxGeometry args={[0.03, 1.6, 2.6]} />
          </mesh>
        ))}
        <mesh position={[0, 3.81, 0.5]} material={M.glass}>
          <boxGeometry args={[1.8, 0.03, 1.8]} />
        </mesh>
        <Box s={[0.04, 1.0, 0.03]} m={M.black} position={[0.3, 2.3, 1.74]} rotation={[-0.12, 0, 0.4]} />
        <Cyl r={0.12} l={0.2} m={M.amberLight} position={[0.7, 3.95, -1.2]} />
        {[0.2, 0.55].map((y) => (
          <Box key={y} s={[0.8, 0.06, 0.5]} m={M.checker} position={[1.6, y, -1.5]} />
        ))}
      </group>
      {/* house counterweight: two tall yellow stacks of slabs at the rear, lifting lugs on top */}
      {[-3.1, 3.1].map((x) => (
        <group key={x} position={[x, BASE, SPEC.houseArm]}>
          {Array.from({ length: 6 }, (_, i) => (
            <RB key={i} s={[5.4, 1.32, 5.2]} r={0.05} m={YEL} position={[0, 0.7 + i * 1.36, 0]} />
          ))}
          {[-1.6, 1.6].map((z) => (
            <Box key={z} s={[0.4, 0.5, 0.3]} m={DARK} position={[0, 8.6, z]} />
          ))}
          <Box s={[0.05, 7, 0.4]} m={DARK} position={[x > 0 ? 2.73 : -2.73, 4.2, 2.0]} />
        </group>
      ))}
      {/* ladder up the side of the house */}
      {[-0.25, 0.25].map((dz) => (
        <Cyl key={dz} r={0.04} l={4.6} m={M.steel} position={[3.75, BASE + 3.0, -3.2 + dz]} seg={6} />
      ))}
      {/* boom foot lugs and pins */}
      {SIDES.map((s) => (
        <group key={s}>
          {[-1, 1].map((k) => (
            <RB key={k} s={[0.5, SPEC.pin.y - DECK, 3.2]} r={0.05} m={ORA} position={[s * FOOT_X + k * 1.4, (SPEC.pin.y + DECK) / 2, SPEC.pin.z]} />
          ))}
          <Cyl r={0.4} l={3.6} axis="x" m={GREY} position={[s * FOOT_X, SPEC.pin.y, SPEC.pin.z]} />
        </group>
      ))}
    </group>
  );
}

// ---------- superlift ----------
/** Twin masts converging to a spreader at the top, the hanging A-frame tray and the ropes from mast top to tray. */
function Superlift() {
  const masts = useMemo(
    () =>
      SIDES.map((s) => {
        const foot = new THREE.Vector3(s * MAST.footX, SPEC.pin.y, MAST.z);
        const top = mastTop(s);
        return { foot, top, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), top.clone().sub(foot).normalize()) };
      }),
    [],
  );
  const hangers = useMemo(() => {
    const out: [THREE.Vector3, THREE.Vector3][] = [];
    for (const s of TWIN ? [-1, 1] : [-1, 1]) {
      const top = mastTop(TWIN ? s : 0).add(new THREE.Vector3(0, 1.2, -1));
      for (const d of [-0.5, -0.25, 0, 0.25, 0.5]) out.push([top.clone().add(new THREE.Vector3(d, 0, 0)), new THREE.Vector3((s * TRAY.w) / 2 - s * 1.0 + d, TRAY.y + TRAY.hang, TRAY.z)]);
    }
    return out;
  }, []);
  return (
    <Bake>
      {masts.map(({ foot, top, q }, i) => (
        <group key={i} position={foot} quaternion={q}>
          <Lat len={foot.distanceTo(top)} w0={MAST.w} w1={MAST.w * 0.8} chord={0.2} lace={0.09} />
        </group>
      ))}
      {/* mast-top spreader with the pendant sheaves */}
      <group position={mastTop(0)}>
        <RB s={[TWIN ? 2 * MAST.topX + 3 : 3, 2.0, 2.6]} r={0.1} m={RED} />
        {[-1.2, 0, 1.2].map((x) => (
          <Cyl key={x} r={0.9} l={0.25} axis="x" m={GREY} position={[x, 1.1, 0.4]} seg={20} />
        ))}
      </group>
      {/* ropes down to the tray */}
      {hangers.map(([a, b], i) => (
        <mesh key={i} geometry={barGeo(a, b, 0.08)} material={ROPE} />
      ))}
      {/* mast backstays down to the anchor frame at the rear of the house */}
      {SIDES.flatMap((s) =>
        [-0.4, 0, 0.4].map((d) => (
          <mesh key={`bs${s}${d}`} geometry={barGeo(mastTop(s).add(new THREE.Vector3(d, 0.8, -0.6)), new THREE.Vector3((TWIN ? s : 1) * 3.2 + d, DECK + 11.2, SPEC.houseArm - 3.2), 0.08)} material={ROPE} />
        )),
      )}
      {!TWIN &&
        [-0.4, 0, 0.4].map((d) => (
          <mesh key={`bs2${d}`} geometry={barGeo(mastTop(0).add(new THREE.Vector3(d, 0.8, -0.6)), new THREE.Vector3(-3.2 + d, DECK + 11.2, SPEC.houseArm - 3.2), 0.08)} material={ROPE} />
        ))}
      {/* the anchor frame they pull on, over the house counterweight */}
      <group position={[0, DECK + 0.8, SPEC.houseArm - 3.2]}>
        {[-3.2, 3.2].map((x) => (
          <group key={x}>
            <mesh geometry={barGeo(new THREE.Vector3(x, 0.8, 2.5), new THREE.Vector3(x, 10.4, 0), 0.35, 10)} material={RED} />
            <mesh geometry={barGeo(new THREE.Vector3(x, 0.8, -1.5), new THREE.Vector3(x, 10.4, 0), 0.3, 10)} material={RED} />
          </group>
        ))}
        <Box s={[7.2, 0.8, 0.8]} m={RED} position={[0, 10.4, 0]} />
      </group>
      {/* the hanging tray: A-frame hanger beam, posts, platform */}
      <group position={[0, 0, TRAY.z]}>
        <RB s={[TRAY.w + 1, 1.2, 1.4]} r={0.1} m={ORA} position={[0, TRAY.y + TRAY.hang, 0]} />
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={barGeo(new THREE.Vector3((s * TRAY.w) / 2, TRAY.y + TRAY.hang, 0), new THREE.Vector3((s * TRAY.w) / 2, TRAY.y + 0.5, TRAY.d / 2 - 0.5), 0.3, 10)} material={ORA} />
            <mesh geometry={barGeo(new THREE.Vector3((s * TRAY.w) / 2, TRAY.y + TRAY.hang, 0), new THREE.Vector3((s * TRAY.w) / 2, TRAY.y + 0.5, -TRAY.d / 2 + 0.5), 0.3, 10)} material={ORA} />
            <Box s={[0.6, 0.6, TRAY.d]} m={ORA} position={[(s * TRAY.w) / 2, TRAY.y + 0.3, 0]} />
          </group>
        ))}
        <RB s={[TRAY.w, 0.9, TRAY.d]} r={0.08} m={ORA} position={[0, TRAY.y, 0]} />
      </group>
    </Bake>
  );
}

/** Counterweight slabs on the tray, shown as the selected superlift counterweight is loaded. */
function TrayWeights() {
  const slabs = useRef<THREE.Group[]>([]);
  const n = 6;
  const per = SPEC.counterweights[SPEC.counterweights.length - 1] / n;
  useFrame(() => {
    const share = cr.cwTarget !== cr.cw ? cr.cw + (cr.cwTarget - cr.cw) * cr.cwT : cr.cw;
    slabs.current.forEach((g, i) => g && (g.visible = share > per * (i + 0.5)));
  });
  return (
    <group position={[0, TRAY.y + 0.45, TRAY.z]}>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} ref={(el) => el && (slabs.current[i] = el)} position={[0, 0.5 + i * 0.95, 0]}>
          <Bake>
            {[-3.6, 3.6].map((x) =>
              [-2.2, 2.2].map((z) => <RB key={`${x}${z}`} s={[6.8, 0.9, 4.2]} r={0.05} m={GREY} position={[x, 0, z]} />),
            )}
          </Bake>
        </group>
      ))}
    </group>
  );
}

// ---------- boom ----------
function OneBoom({ s }: { s: number }) {
  // each boom of the pair leans in so the two meet at the head
  const yaw = Math.atan2(s * (FOOT_X - HEAD_X), BOOM);
  const main = BOOM - 14;
  return (
    <group position={[s * FOOT_X, 0, 0]} rotation={[0, -yaw, 0]}>
      <Lat len={8} w0={2.4} w1={BW} />
      <Lat len={main} w0={BW} position={[0, 0, 8]} />
      <Lat len={6} w0={BW} w1={2.8} position={[0, 0, 8 + main]} />
      {/* section joints */}
      {Array.from({ length: Math.floor(main / 12) }, (_, i) => (
        <group key={i} position={[0, 0, 8 + 12 * (i + 1)]}>
          {[
            [0, BW / 2, BW + 0.3, 0.3],
            [0, -BW / 2, BW + 0.3, 0.3],
            [BW / 2, 0, 0.3, BW + 0.3],
            [-BW / 2, 0, 0.3, BW + 0.3],
          ].map(([x, y, w, h], k) => (
            <Box key={k} s={[w, h, 0.45]} m={DARK} position={[x, y, 0]} />
          ))}
        </group>
      ))}
    </group>
  );
}

function Boom() {
  const pivot = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const pend = useRef<THREE.Group[]>([]);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);
  const jib = useRef<THREE.Group>(null);
  const jp = useRef<THREE.Group[]>([]);
  const leads = useRef<THREE.Mesh[]>([]);
  const cross = useMemo(() => (TWIN ? [16, 36, 56, 76].map((z) => ({ z, gap: 2 * (FOOT_X - ((FOOT_X - HEAD_X) * z) / BOOM) - BW })) : []), []);
  useFrame(() => {
    const ang = cr.angle - cr.boomBend * 0.9;
    pivot.current!.rotation.x = -ang;
    craneObj.head = head.current;
    // luffing jib (single boom): its angle, and the pendants from the struts (boom-head frame)
    if (jib.current) {
      const th = ang - jibElevation(cr);
      jib.current.rotation.x = th;
      const L = FLY.lengths[0];
      const jt = new THREE.Vector3(0, -L * Math.sin(th), L * Math.cos(th)); // jib tip in the head frame
      const pairs: [THREE.Vector3, THREE.Vector3][] = [
        [STRUT_F.clone(), jt.clone().add(new THREE.Vector3(0, 1.2, 0))],
        [STRUT_R.clone(), STRUT_F.clone()],
        [STRUT_R.clone(), new THREE.Vector3(0, BW / 2, -BOOM + 14)],
      ];
      pairs.forEach(([a, b], i) => {
        const g = jp.current[i];
        if (!g) return;
        g.position.copy(a).add(b).multiplyScalar(0.5);
        g.scale.set(1, a.distanceTo(b), 1);
        g.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
      });
    }
    // pendants: mast top to the boom head, per side (upper frame)
    SIDES.forEach((s, i) => {
      const g = pend.current[i];
      if (!g) return;
      tmp.a.copy(mastTop(s));
      const hx = s * HEAD_X;
      tmp.b.set(hx, SPEC.pin.y + BOOM * Math.sin(ang) + 2 * Math.cos(ang), SPEC.pin.z + BOOM * Math.cos(ang) - 2 * Math.sin(ang));
      g.position.copy(tmp.a).add(tmp.b).multiplyScalar(0.5);
      g.scale.set(1, tmp.a.distanceTo(tmp.b), 1);
      g.quaternion.setFromUnitVectors(UP, tmp.b.clone().sub(tmp.a).normalize());
      // hoist lead ropes: off the winch drums up inside the lattice to the head sheaves
      [-0.4, -2.6].forEach((wz, k) => {
        const m = leads.current[i * 2 + k];
        if (!m) return;
        tmp.a.set(hx * 0.5 + (k ? -0.6 : 0.6), DECK + 3.3, wz);
        tmp.b.set(hx + (k ? -0.6 : 0.6), SPEC.pin.y + BOOM * Math.sin(ang) - 0.5 * Math.cos(ang), SPEC.pin.z + BOOM * Math.cos(ang) + 0.5 * Math.sin(ang));
        m.position.copy(tmp.a).add(tmp.b).multiplyScalar(0.5);
        m.scale.set(1, tmp.a.distanceTo(tmp.b), 1);
        m.quaternion.setFromUnitVectors(UP, tmp.b.clone().sub(tmp.a).normalize());
      });
    });
  });
  return (
    <group>
      {SIDES.map((s, i) => (
        <group key={s} ref={(el) => el && (pend.current[i] = el)}>
          {[-0.6, -0.2, 0.2, 0.6].flatMap((dx) =>
            [-0.25, 0.25].map((dz) => (
              <mesh key={`${dx}${dz}`} position={[dx, 0, dz]} material={ROPE}>
                <cylinderGeometry args={[0.08, 0.08, 1, 6]} />
              </mesh>
            )),
          )}
        </group>
      ))}
      {SIDES.flatMap((s, i) =>
        [0, 1].map((k) => (
          <mesh key={`l${s}${k}`} ref={(el) => el && (leads.current[i * 2 + k] = el)} material={ROPE}>
            <cylinderGeometry args={[0.07, 0.07, 1, 6]} />
          </mesh>
        )),
      )}
      <group position={[0, SPEC.pin.y, SPEC.pin.z]}>
        <group ref={pivot}>
          <Bake>
            {SIDES.map((s) => (
              <OneBoom key={s} s={s} />
            ))}
            {/* lattice cross frames between the two booms */}
            {cross.map(({ z, gap }) => (
              <group key={z} position={[-gap / 2, 0, z]} rotation={[0, Math.PI / 2, 0]}>
                <Lat len={gap} w0={1.4} chord={0.14} lace={0.07} position={[0, BW / 2 - 0.7, 0]} />
                <Lat len={gap} w0={1.4} chord={0.14} lace={0.07} position={[0, -BW / 2 + 0.7, 0]} />
              </group>
            ))}
          </Bake>
          <group ref={head} position={[0, 0, BOOM]}>
            <Bake>
              {/* joined head: red box frame, the sheave nests under it, aviation light */}
              <RB s={[TWIN ? 2 * HEAD_X + 3.2 : 3.2, 3.0, 2.8]} r={0.15} m={RED} position={[0, 0.2, 0.3]} />
              {SIDES.map((s) => (
                <group key={s} position={[s * HEAD_X, -1.6, 1.6]}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <Cyl key={i} r={1.5} l={0.2} axis="x" m={GREY} position={[-1.4 + i * 0.4, 0, 0]} seg={24} />
                  ))}
                  <Cyl r={0.25} l={3.4} axis="x" m={M.chrome} />
                  {[-1.8, 1.8].map((x) => (
                    <Box key={x} s={[0.25, 3.4, 2.2]} m={RED} position={[x, 0.3, -0.2]} />
                  ))}
                </group>
              ))}
              <Cyl r={0.12} l={0.2} m={M.redLamp} position={[0, 1.85, 0.3]} />
              {/* single boom: the two jib struts in a V at the head */}
              {!TWIN &&
                [STRUT_R, STRUT_F].map((t, i) => {
                  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), t.clone().normalize());
                  return (
                    <group key={i} quaternion={q}>
                      <Lat len={t.length()} w0={2.6} w1={1.4} chord={0.16} lace={0.07} />
                    </group>
                  );
                })}
            </Bake>
            {!TWIN && (
              <>
                <group ref={jib}>
                  <Bake>
                    <Lat len={FLY.lengths[0]} w0={3.4} w1={2.4} chord={0.18} lace={0.08} />
                    <RB s={[2.8, 2.2, 2.0]} r={0.1} m={RED} position={[0, 0, FLY.lengths[0]]} />
                    {Array.from({ length: 5 }, (_, i) => (
                      <Cyl key={i} r={1.1} l={0.18} axis="x" m={GREY} position={[-0.9 + i * 0.45, -1.1, FLY.lengths[0] + 0.9]} seg={20} />
                    ))}
                  </Bake>
                </group>
                {[0, 1, 2].map((i) => (
                  <group key={i} ref={(el) => el && (jp.current[i] = el)}>
                    {[-0.3, 0.3].map((dx) => (
                      <mesh key={dx} position={[dx, 0, 0]} material={ROPE}>
                        <cylinderGeometry args={[0.08, 0.08, 1, 6]} />
                      </mesh>
                    ))}
                  </group>
                ))}
              </>
            )}
          </group>
        </group>
      </group>
    </group>
  );
}

// ---------- hook ----------
/** Red equalizer yoke (photo): wide top carrying the two blocks, tapering to a round lug, with lightening holes. */
function yokeGeo() {
  const s = new THREE.Shape();
  const W = HEAD_X * 2 + 3.4;
  s.moveTo(-W / 2, 1.2);
  s.lineTo(W / 2, 1.2);
  s.lineTo(W / 2, 0.2);
  s.lineTo(2.4, -1.4);
  s.lineTo(2.4, -2.4);
  s.lineTo(-2.4, -2.4);
  s.lineTo(-2.4, -1.4);
  s.lineTo(-W / 2, 0.2);
  s.lineTo(-W / 2, 1.2);
  for (const x of [-HEAD_X - 0.4, HEAD_X + 0.4]) {
    const h = new THREE.Path();
    h.absarc(x, 0.5, 0.35, 0, Math.PI * 2, false);
    s.holes.push(h);
  }
  const win = new THREE.Path();
  win.moveTo(-1.4, 0.7);
  win.lineTo(1.4, 0.7);
  win.lineTo(1.4, 0.2);
  win.lineTo(-1.4, 0.2);
  win.lineTo(-1.4, 0.7);
  s.holes.push(win);
  const c = new THREE.Path();
  c.absarc(0, -1.3, 0.45, 0, Math.PI * 2, false);
  s.holes.push(c);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.8, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1, curveSegments: 18 });
  g.translate(0, 0, -0.9);
  g.computeVertexNormals();
  return g;
}

function useHazard() {
  return useCanvasTexture(128, 32, (g) => {
    g.fillStyle = '#f2c21c';
    g.fillRect(0, 0, 128, 32);
    g.fillStyle = '#151515';
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

function HookBlockS({ x }: { x: number }) {
  const hz = useHazard();
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: hz, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }), [hz]);
  return (
    <group position={[x, TWIN ? 3.2 : 0.4, 0]}>
      <RB s={[3.4, 2.6, 1.9]} r={0.12} m={SHOE} />
      {/* sheave ends showing along the top, hazard plates on both faces, side plates */}
      {Array.from({ length: 7 }, (_, i) => (
        <Cyl key={i} r={0.75} l={0.18} axis="x" m={GREY} position={[-1.35 + i * 0.45, 1.0, 0]} seg={18} />
      ))}
      {[-1, 1].map((k) => (
        <mesh key={k} position={[0, -0.7, k * 0.97]} rotation={[0, k > 0 ? 0 : Math.PI, 0]} material={mat}>
          <planeGeometry args={[3.2, 0.7]} />
        </mesh>
      ))}
      <Box s={[0.25, 2.8, 2.1]} m={DARK} position={[-1.75, 0, 0]} />
      <Box s={[0.25, 2.8, 2.1]} m={DARK} position={[1.75, 0, 0]} />
    </group>
  );
}

/** Equalizer (double boom) or single block, at the hanging block position, and the rope falls from each boom head. */
function Hook() {
  const ref = useRef<THREE.Group>(null);
  const falls = useRef<THREE.InstancedMesh>(null);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const yoke = useMemo(() => yokeGeo(), []);
  const blk = useMemo(() => new THREE.Vector3(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const per = 20; // rope falls drawn per block (two rows across the sheave nest)
  useFrame(() => {
    blockWorld(blk);
    const g = ref.current!;
    g.position.copy(blk);
    const yaw = cr.heading + cr.slew;
    g.rotation.y = yaw;
    const t = tipUpper(cr);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const f = falls.current!;
    f.visible = hangLen(cr) > 0.5;
    for (let i = 0; i < per * SIDES.length; i++) {
      const x = SIDES[Math.floor(i / per)] * HEAD_X;
      const j = i % per;
      const off = (Math.floor(j / 2) - (per / 2 - 1) / 2) * 0.3;
      const dz = j % 2 ? 0.35 : -0.35;
      const h = upperToWorld(cr, x + off, t.y - 1.6, t.z + 1.6 + dz);
      a.set(h.x, h.y, h.z);
      const lx = x + off * 0.85;
      b.set(blk.x + lx * c + dz * s, blk.y + (TWIN ? 4.4 : 1.6), blk.z - lx * s + dz * c);
      mid.copy(a).add(b).multiplyScalar(0.5);
      sc.set(1, a.distanceTo(b), 1);
      q.setFromUnitVectors(UP, b.clone().sub(a).normalize());
      f.setMatrixAt(i, m4.compose(mid, q, sc));
    }
    f.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <group ref={ref}>
        {SIDES.map((s) => (
          <HookBlockS key={s} x={s * HEAD_X} />
        ))}
        {TWIN ? (
          <group>
            <mesh geometry={yoke} material={RED} castShadow />
            {/* pins into the blocks, the lower lifting lug */}
            {SIDES.map((s) => (
              <Cyl key={s} r={0.34} l={2.3} axis="z" m={M.chrome} position={[s * (HEAD_X + 0.4), 0.5, 0]} />
            ))}
            <Cyl r={1.5} l={1.2} axis="z" m={RED} position={[0, -3.3, 0]} seg={28} />
            <Cyl r={0.45} l={1.5} axis="z" m={M.chrome} position={[0, -3.3, 0]} />
          </group>
        ) : (
          <group position={[0, -1.4, 0]}>
            <Box s={[1.2, 1.2, 1.0]} m={DARK} position={[0, 0.3, 0]} />
            <mesh position={[0, -1.0, 0.05]} rotation={[0, Math.PI / 2, Math.PI]} material={M.lbBlack}>
              <torusGeometry args={[0.8, 0.28, 12, 28, Math.PI * 1.4]} />
            </mesh>
          </group>
        )}
      </group>
      <instancedMesh ref={falls} args={[ROPE_GEO, ROPE, per * SIDES.length]} frustumCulled={false} castShadow />
    </>
  );
}

export function SanyModel() {
  const pose = useRef<THREE.Group>(null);
  const prev = useRef({ t: cr.time, h: cr.heading });
  const upper = useRef<THREE.Group>(null);
  useFrame(() => {
    pose.current!.position.set(cr.x, 0, cr.z);
    pose.current!.rotation.y = cr.heading;
    const t = cr.tipEdge >= 0 ? cr.tip : 0;
    pose.current!.rotation.x = Math.cos(cr.slew) * t;
    pose.current!.rotation.z = -Math.sin(cr.slew) * t;
    upper.current!.rotation.y = cr.slew;
    craneObj.upper = upper.current;
    craneObj.carrier = pose.current;
    // each track runs at the speed plus or minus the turn: on the spot they run opposite ways
    const dt = Math.min(0.1, Math.max(0, cr.time - prev.current.t));
    let dh = cr.heading - prev.current.h;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const X = SPEC.track / 2;
    trackRun.l += cr.v * dt - dh * X;
    trackRun.r += cr.v * dt + dh * X;
    prev.current = { t: cr.time, h: cr.heading };
  });
  return (
    <>
      <group ref={pose}>
        <Bake>
          <Crawler s={-1} />
          <Crawler s={1} />
          <Carbody />
        </Bake>
        <group ref={upper}>
          <Bake>
            <House />
          </Bake>
          <Superlift />
          <TrayWeights />
          <Boom />
        </group>
      </group>
      <Hook />
    </>
  );
}
