// SANY SCC45000A model (upper frame: x left, z forward, y up; origin at the slewing centre on the ground). Two crawlers
// under a carbody, the yellow house with its counterweight, red square lattice boom(s) (two side by side, braced and
// joined at the head, for the 4 500 t double boom), the superlift mast(s) behind with pendants to the boom head and the
// hanging counterweight tray, and the equalizer joining two hook blocks. Shapes from the user's photos; dimensions est.
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hangLen, tipUpper, upperToWorld } from '../sim/crane';
import { SPEC } from '../sim/spec';
import { cr } from '../store';
import { Bake } from './Bake';
import { RB, blockWorld, craneObj } from './Crane';
import { Box, Cyl, M } from './parts';

const RED = new THREE.MeshStandardMaterial({ color: '#c8102e', metalness: 0.3, roughness: 0.42 });
const YEL = new THREE.MeshStandardMaterial({ color: '#f0a81c', metalness: 0.25, roughness: 0.45 });
const DARK = new THREE.MeshStandardMaterial({ color: '#2b2e31', metalness: 0.4, roughness: 0.6 });
const SHOE = new THREE.MeshStandardMaterial({ color: '#1c1d1f', metalness: 0.5, roughness: 0.7 });

const DECK = SPEC.deckY;
const BOOM = SPEC.boomMax;
const XS = SPEC.twin ? [-4.4, 4.4] : [0]; // boom (and mast) centre lines
const BW = 4.2; // lattice section width / depth
const MAST = { z: -1.5, len: 72, elev: (100 * Math.PI) / 180 };
const mastTop = (x: number) => new THREE.Vector3(x, SPEC.pin.y + MAST.len * Math.sin(MAST.elev), MAST.z + MAST.len * Math.cos(MAST.elev));
const TRAY = { z: SPEC.cwArm, y: 1.2, w: 16, d: 10 };

/** Square lattice section along +z: four chords, battens and zig-zag lacing on all four faces, one merged mesh. */
function squareLattice(len: number, w: number, chord = 0.22, lace = 0.1) {
  const parts: THREE.BufferGeometry[] = [];
  const bar = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6, 1, true);
    const m = new THREE.Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()),
      new THREE.Vector3(1, 1, 1),
    );
    parts.push(g.applyMatrix4(m));
  };
  const h = w / 2;
  const C = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  for (const [x, y] of C) bar(new THREE.Vector3(x, y, 0), new THREE.Vector3(x, y, len), chord);
  const n = Math.max(2, Math.round(len / w));
  const step = len / n;
  for (let i = 0; i <= n; i++) {
    const z = i * step;
    for (let k = 0; k < 4; k++) {
      const [x0, y0] = C[k];
      const [x1, y1] = C[(k + 1) % 4];
      bar(new THREE.Vector3(x0, y0, z), new THREE.Vector3(x1, y1, z), lace);
      if (i < n) {
        const flip = (i + k) % 2;
        bar(new THREE.Vector3(flip ? x0 : x1, flip ? y0 : y1, z), new THREE.Vector3(flip ? x1 : x0, flip ? y1 : y0, z + step), lace);
      }
    }
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
  g.computeVertexNormals();
  return g;
}

function Crawlers() {
  const L = SPEC.carrierLen;
  const X = SPEC.track / 2;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * X, 0, 0]}>
          <RB s={[SPEC.tyreW, 2.6, L - 2.6]} r={0.2} m={SHOE} position={[0, 1.3, 0]} />
          {[1, -1].map((e) => (
            <Cyl key={e} r={1.3} l={SPEC.tyreW} axis="x" m={SHOE} position={[0, 1.3, (e * (L - 2.6)) / 2]} seg={20} />
          ))}
          {/* side frame with rollers and the SANY name */}
          <Box s={[0.2, 1.1, L - 4]} m={DARK} position={[s * (SPEC.tyreW / 2 + 0.1), 1.45, 0]} />
          {Array.from({ length: 7 }, (_, i) => (
            <Cyl key={i} r={0.35} l={0.25} axis="x" m={M.steel} position={[s * (SPEC.tyreW / 2 + 0.22), 0.7, -L / 2 + 3 + (i * (L - 6)) / 6]} seg={12} />
          ))}
          <Text position={[s * (SPEC.tyreW / 2 + 0.22), 1.6, 0]} rotation={[0, (s * Math.PI) / 2, 0]} fontSize={0.7} color="#e8eaec" fontWeight={700}>
            SANY
          </Text>
        </group>
      ))}
      {/* carbody between the crawlers, slewing ring on top */}
      <RB s={[SPEC.track - SPEC.tyreW, 2.2, 9]} r={0.15} m={DARK} position={[0, 2.6, 0]} />
      <Cyl r={4.6} l={0.6} m={M.lbBlack} position={[0, DECK - 0.3, 0]} seg={48} />
    </group>
  );
}

function House() {
  return (
    <group>
      <RB s={[11, 1.2, 17]} r={0.1} m={YEL} position={[0, DECK + 0.6, -5.5]} />
      {/* machinery house, cab on the left front, walkways and rails */}
      <RB s={[8.5, 4.0, 11]} r={0.15} m={YEL} position={[-0.8, DECK + 3.2, -8]} />
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} s={[0.04, 0.08, 9]} m={M.black} position={[-5.06, DECK + 2.0 + i * 0.3, -8]} />
      ))}
      <group position={[5.6, DECK + 1.2, 2.4]}>
        <RB s={[2.4, 3.0, 3.6]} r={0.15} m={M.greyLight} position={[0, 1.5, 0]} />
        <mesh position={[0, 1.9, 1.81]} material={M.glass}>
          <boxGeometry args={[2.1, 1.6, 0.02]} />
        </mesh>
        <mesh position={[1.21, 1.9, 0.3]} material={M.glass}>
          <boxGeometry args={[0.02, 1.4, 2.6]} />
        </mesh>
      </group>
      {[-5.4, 5.4].map((x) => (
        <group key={x}>
          <Cyl r={0.04} l={15} axis="z" m={M.hookYellow} position={[x, DECK + 2.3, -5.5]} seg={6} />
          {[-12, -7, -2, 2].map((z) => (
            <Cyl key={z} r={0.04} l={1.1} m={M.hookYellow} position={[x, DECK + 1.75, z]} seg={6} />
          ))}
        </group>
      ))}
      <Text position={[-5.09, DECK + 4.4, -8]} rotation={[0, -Math.PI / 2, 0]} fontSize={1.0} color="#c8102e" fontWeight={700}>
        SANY SCC45000A
      </Text>
      {/* house counterweight: yellow stacks at the rear */}
      {[-2.7, 2.7].map((x) => (
        <RB key={x} s={[5, 6, 4.5]} r={0.1} m={YEL} position={[x, DECK + 4.2, SPEC.houseArm]} />
      ))}
      {/* boom foot brackets and pins */}
      {XS.map((x) => (
        <group key={x}>
          {[-1, 1].map((k) => (
            <RB key={k} s={[0.4, SPEC.pin.y - DECK, 3]} r={0.05} m={RED} position={[x + (k * BW) / 2, (SPEC.pin.y + DECK) / 2, SPEC.pin.z]} />
          ))}
          <Cyl r={0.35} l={BW + 1} axis="x" m={M.steel} position={[x, SPEC.pin.y, SPEC.pin.z]} />
        </group>
      ))}
      {/* winches */}
      {[-3, -5.5].map((z) => (
        <Cyl key={z} r={1.1} l={8} axis="x" m={M.rope} position={[0, DECK + 2.0, z]} seg={20} />
      ))}
    </group>
  );
}

/** Superlift mast(s), the hanging tray and its tension bars: fixed in the upper frame. */
function Superlift() {
  const geo = useMemo(() => squareLattice(MAST.len, BW * 0.85), []);
  const bars = useMemo(() => {
    const out: [THREE.Vector3, THREE.Vector3][] = [];
    for (const x of XS) for (const k of [-1, 1]) out.push([mastTop(x), new THREE.Vector3(x + (k * TRAY.w) / 4, TRAY.y + 1, TRAY.z)]);
    return out;
  }, []);
  return (
    <Bake>
      {XS.map((x) => (
        <group key={x} position={[x, SPEC.pin.y, MAST.z]} rotation={[-MAST.elev, 0, 0]}>
          <mesh geometry={geo} material={RED} castShadow />
          <RB s={[BW + 0.6, 2.2, 2.6]} r={0.08} m={RED} position={[0, 0, MAST.len]} />
        </group>
      ))}
      {bars.map(([a, b], i) => {
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        return (
          <mesh key={i} position={mid} quaternion={q} material={RED} castShadow>
            <cylinderGeometry args={[0.28, 0.28, a.distanceTo(b), 10]} />
          </mesh>
        );
      })}
      {/* the tray */}
      <RB s={[TRAY.w, 1.4, TRAY.d]} r={0.1} m={YEL} position={[0, TRAY.y, TRAY.z]} />
      <Box s={[TRAY.w + 0.4, 0.3, 0.6]} m={DARK} position={[0, TRAY.y + 0.85, TRAY.z - TRAY.d / 2]} />
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
    <group position={[0, TRAY.y + 0.7, TRAY.z]}>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} ref={(el) => el && (slabs.current[i] = el)} position={[0, 0.65 + i * 1.25, 0]}>
          <Bake>
            {[-3.9, 3.9].map((x) => (
              <RB key={x} s={[7.2, 1.2, 9]} r={0.06} m={DARK} position={[x, 0, 0]} />
            ))}
          </Bake>
        </group>
      ))}
    </group>
  );
}

function Boom() {
  const pivot = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const pend = useRef<THREE.Group[]>([]);
  const geo = useMemo(() => squareLattice(BOOM, BW), []);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);
  useFrame(() => {
    const ang = cr.angle - cr.boomBend * 0.9;
    pivot.current!.rotation.x = -ang;
    craneObj.head = head.current;
    // pendants: superlift mast top to the boom head, per boom (upper frame)
    XS.forEach((x, i) => {
      const g = pend.current[i];
      if (!g) return;
      tmp.a.copy(mastTop(x));
      tmp.b.set(x, SPEC.pin.y + BOOM * Math.sin(ang) + 1.5 * Math.cos(ang), SPEC.pin.z + BOOM * Math.cos(ang) - 1.5 * Math.sin(ang));
      g.position.copy(tmp.a).add(tmp.b).multiplyScalar(0.5);
      g.scale.set(1, tmp.a.distanceTo(tmp.b), 1);
      g.quaternion.setFromUnitVectors(UP, tmp.b.clone().sub(tmp.a).normalize());
    });
  });
  return (
    <group>
      {XS.map((x, i) => (
        <group key={x} ref={(el) => el && (pend.current[i] = el)}>
          {[-0.5, -0.17, 0.17, 0.5].map((dx) => (
            <mesh key={dx} position={[dx, 0, 0]} material={M.rope}>
              <cylinderGeometry args={[0.06, 0.06, 1, 6]} />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[0, SPEC.pin.y, SPEC.pin.z]}>
        <group ref={pivot}>
          <Bake>
            {XS.map((x) => (
              <mesh key={x} geometry={geo} material={RED} position={[x, 0, 0]} castShadow />
            ))}
            {/* double boom: cross frames between the two booms */}
            {SPEC.twin &&
              [18, 40, 62, 84].map((z) => (
                <group key={z} position={[0, 0, z]}>
                  <Box s={[XS[1] - XS[0], 0.6, 0.6]} m={RED} position={[0, BW / 2 - 0.3, 0]} />
                  <Box s={[XS[1] - XS[0], 0.6, 0.6]} m={RED} position={[0, -BW / 2 + 0.3, 0]} />
                </group>
              ))}
            {/* boom foot sections widen to the pins */}
            {XS.map((x) => (
              <RB key={`f${x}`} s={[BW + 0.3, BW + 0.3, 3]} r={0.1} m={RED} position={[x, 0, 1.5]} />
            ))}
          </Bake>
          <group ref={head} position={[0, 0, BOOM]}>
            <Bake>
              <RB s={[SPEC.twin ? XS[1] - XS[0] + BW + 0.6 : BW + 0.6, BW, 3]} r={0.15} m={RED} position={[0, 0, 0.5]} />
              {XS.map((x) =>
                Array.from({ length: 6 }, (_, i) => <Cyl key={`${x}${i}`} r={1.6} l={0.22} axis="x" m={M.steel} position={[x - 1.4 + i * 0.56, -1.4, 2.2]} seg={24} />),
              )}
              <Cyl r={0.12} l={0.2} m={M.redLamp} position={[0, BW / 2 + 0.1, 0.5]} />
            </Bake>
          </group>
        </group>
      </group>
    </group>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

/** Equalizer (double boom) or single block, at the hanging block position, and the rope falls from each boom head. */
function Hook() {
  const ref = useRef<THREE.Group>(null);
  const falls = useRef<THREE.Mesh[]>([]);
  const blk = useMemo(() => new THREE.Vector3(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const per = 8; // ropes drawn per boom
  useFrame(() => {
    blockWorld(blk);
    const g = ref.current!;
    g.position.copy(blk);
    const yaw = cr.heading + cr.slew;
    g.rotation.y = yaw;
    const t = tipUpper(cr);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    falls.current.forEach((m, i) => {
      const x = XS[Math.floor(i / per)];
      const off = ((i % per) - (per - 1) / 2) * 0.32;
      const h = upperToWorld(cr, x + off, t.y - 1.4, t.z + 2.2);
      a.set(h.x, h.y, h.z);
      // to the top of the block under that boom
      b.set(blk.x + (x + off * 0.6) * c, blk.y + (SPEC.twin ? 3.6 : 1.2), blk.z - (x + off * 0.6) * s);
      m.visible = hangLen(cr) > 0.5;
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.scale.set(1, a.distanceTo(b), 1);
      m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    });
  });
  return (
    <>
      <group ref={ref}>
        <Bake>
          {XS.map((x) => (
            <group key={x} position={[x, SPEC.twin ? 2.6 : 0, 0]}>
              <RB s={[2.8, 2.2, 1.6]} r={0.1} m={DARK} />
              <Box s={[2.85, 0.35, 1.65]} m={M.hookYellow} position={[0, -0.6, 0]} />
            </group>
          ))}
          {SPEC.twin ? (
            // the red equalizer beam with its hook
            <group>
              <RB s={[XS[1] - XS[0] + 3, 2.4, 2.2]} r={0.2} m={RED} position={[0, 0.4, 0]} />
              <RB s={[3.2, 2.0, 2.0]} r={0.3} m={RED} position={[0, -1.6, 0]} />
              <Cyl r={0.5} l={2.4} axis="z" m={M.steel} position={[0, -1.6, 0]} />
            </group>
          ) : (
            <mesh position={[0, -1.8, 0]} rotation={[0, Math.PI / 2, Math.PI]} material={M.lbBlack}>
              <torusGeometry args={[0.6, 0.2, 10, 24, Math.PI * 1.4]} />
            </mesh>
          )}
        </Bake>
      </group>
      {Array.from({ length: per * XS.length }, (_, i) => (
        <mesh key={i} ref={(el) => el && (falls.current[i] = el)} material={M.rope}>
          <cylinderGeometry args={[0.03, 0.03, 1, 5]} />
        </mesh>
      ))}
    </>
  );
}

export function SanyModel() {
  const pose = useRef<THREE.Group>(null);
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
  });
  return (
    <>
      <group ref={pose}>
        <Bake>
          <Crawlers />
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
