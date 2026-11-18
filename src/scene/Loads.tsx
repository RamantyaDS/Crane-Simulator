// The loads (the genset is the detailed Genset Simulator model) at their poses, their destination markings, and the
// rigging drawn between the hook and the lifting points: wire or chain legs, the spreader bar, shackles.
import { RoundedBox, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { type LoadState } from '../sim/crane';
import { RIGGING, type LoadDef } from '../sim/site';
import { cr, useUI } from '../store';
import { Bake } from './Bake';
import { blockWorld } from './Crane';
import { Genset } from './genset/Genset';
import { Box, Cyl, M, useCanvasTexture } from './parts';

const C = {
  tank: new THREE.MeshStandardMaterial({ color: '#d9dcd6', metalness: 0.35, roughness: 0.45 }),
  trafo: new THREE.MeshStandardMaterial({ color: '#6f7d80', metalness: 0.4, roughness: 0.5 }),
  porcelain: new THREE.MeshStandardMaterial({ color: '#7a3b2a', metalness: 0.1, roughness: 0.4 }),
  chiller: new THREE.MeshStandardMaterial({ color: '#e3e6e8', metalness: 0.3, roughness: 0.45 }),
  chillerDark: new THREE.MeshStandardMaterial({ color: '#2f4f6f', metalness: 0.35, roughness: 0.5 }),
  concrete: new THREE.MeshStandardMaterial({ color: '#a7a59e', metalness: 0, roughness: 0.92 }),
  steel: new THREE.MeshStandardMaterial({ color: '#5d6166', metalness: 0.6, roughness: 0.55 }),
  bigTank: new THREE.MeshStandardMaterial({ color: '#7f8c8f', metalness: 0.45, roughness: 0.42 }),
  bigDark: new THREE.MeshStandardMaterial({ color: '#3d4649', metalness: 0.5, roughness: 0.5 }),
  fin: new THREE.MeshStandardMaterial({ color: '#8d999c', metalness: 0.5, roughness: 0.4 }),
};

function Transformer({ d }: { d: LoadDef }) {
  const [sx, sy, sz] = d.size;
  return (
    <group>
      <Box s={[sx * 0.7, sy * 0.78, sz * 0.75]} m={C.trafo} position={[0, sy * 0.39, 0]} />
      {/* radiator banks along both sides */}
      {[-1, 1].map((s) =>
        Array.from({ length: 10 }, (_, i) => <Box key={`${s}${i}`} s={[0.06, sy * 0.6, 0.35]} m={C.trafo} position={[-sx * 0.32 + i * (sx * 0.07), sy * 0.42, s * sz * 0.45]} />),
      )}
      {/* conservator, bushings, lifting lugs */}
      <Cyl r={0.28} l={sx * 0.5} axis="x" m={C.trafo} position={[0, sy * 0.88, -sz * 0.2]} />
      {[-0.6, 0, 0.6].map((x) => (
        <group key={x} position={[x, sy * 0.78, sz * 0.15]}>
          <Cyl r={0.09} l={0.7} m={C.porcelain} position={[0, 0.35, 0]} />
          <Cyl r={0.03} l={0.15} m={M.steel} position={[0, 0.75, 0]} />
        </group>
      ))}
      {d.points.map((p, i) => (
        <mesh key={i} position={[p[0], p[1] - 0.05, p[2]]} rotation={[0, Math.PI / 2, 0]} material={M.hookYellow}>
          <torusGeometry args={[0.08, 0.025, 8, 14]} />
        </mesh>
      ))}
      <Box s={[sx, 0.15, sz]} m={C.steel} position={[0, 0.075, 0]} />
    </group>
  );
}

function Chiller({ d }: { d: LoadDef }) {
  const [sx, sy, sz] = d.size;
  const fan = useCanvasTexture(128, 128, (g) => {
    g.fillStyle = '#20262c';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#6c7680';
    g.lineWidth = 3;
    for (let r = 12; r < 62; r += 8) {
      g.beginPath();
      g.arc(64, 64, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(0, 64);
    g.lineTo(128, 64);
    g.moveTo(64, 0);
    g.lineTo(64, 128);
    g.stroke();
  });
  return (
    <group>
      <Box s={[sx, 0.25, sz]} m={C.steel} position={[0, 0.125, 0]} />
      <Box s={[sx * 0.98, sy * 0.72, sz * 0.96]} m={C.chiller} position={[0, sy * 0.45, 0]} />
      {/* V-coil sides and the fan deck on top */}
      {[-1, 1].map((s) => (
        <Box key={s} s={[sx * 0.9, sy * 0.5, 0.04]} m={C.chillerDark} position={[0, sy * 0.5, s * sz * 0.49]} />
      ))}
      {Array.from({ length: 6 }, (_, i) =>
        [-1, 1].map((s) => (
          <group key={`${i}${s}`} position={[-sx * 0.42 + i * (sx * 0.168), sy * 0.82, s * sz * 0.24]}>
            <Cyl r={0.5} l={0.12} m={C.chiller} />
            <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.46, 24]} />
              <meshStandardMaterial map={fan} roughness={0.6} />
            </mesh>
          </group>
        )),
      )}
      <Box s={[sx * 0.3, sy * 0.4, sz * 0.8]} m={C.chillerDark} position={[sx * 0.33, sy * 0.35, 0]} />
    </group>
  );
}

function Slab({ d }: { d: LoadDef }) {
  const [sx, sy, sz] = d.size;
  return (
    <group>
      <Box s={[sx, sy, sz]} m={C.concrete} position={[0, sy / 2, 0]} />
      {/* hollow cores at the ends */}
      {[-1, 1].map((e) =>
        Array.from({ length: 6 }, (_, i) => (
          <mesh key={`${e}${i}`} position={[(e * sx) / 2 + e * 0.001, sy / 2, -sz / 2 + 0.25 + i * 0.38]} rotation={[0, (e * Math.PI) / 2, 0]}>
            <circleGeometry args={[0.13, 16]} />
            <meshBasicMaterial color="#3a3935" />
          </mesh>
        )),
      )}
      {d.points.map((p, i) => (
        <mesh key={i} position={[p[0], p[1] + 0.05, p[2]]} rotation={[0, 0, 0]} material={M.steel}>
          <torusGeometry args={[0.06, 0.02, 8, 12]} />
        </mesh>
      ))}
    </group>
  );
}

function Beams({ d }: { d: LoadDef }) {
  const [sx, , sz] = d.size;
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    const w = 0.3;
    const h = 0.4;
    const tf = 0.03;
    const tw = 0.018;
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, tf);
    s.lineTo(tw / 2, tf);
    s.lineTo(tw / 2, h - tf);
    s.lineTo(w / 2, h - tf);
    s.lineTo(w / 2, h);
    s.lineTo(-w / 2, h);
    s.lineTo(-w / 2, h - tf);
    s.lineTo(-tw / 2, h - tf);
    s.lineTo(-tw / 2, tf);
    s.lineTo(-w / 2, tf);
    const g = new THREE.ExtrudeGeometry(s, { depth: sx, bevelEnabled: false });
    g.translate(0, 0, -sx / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }, [sx]);
  return (
    <group>
      {[0, 1].map((row) =>
        [-1, 0, 1].map((col) => <mesh key={`${row}${col}`} geometry={geo} material={C.steel} position={[0, row * 0.42 + 0.06, col * (sz / 3.2)]} castShadow />),
      )}
      {[-3.5, 3.5].map((x) => (
        <Box key={x} s={[0.08, 0.92, sz + 0.06]} m={M.hookYellow} position={[x, 0.45, 0]} />
      ))}
    </group>
  );
}

function Tank({ d }: { d: LoadDef }) {
  const [sx, sy, sz] = d.size;
  const r = Math.min(sy, sz) / 2;
  return (
    <group>
      <Cyl r={r * 0.97} l={sx - 1} axis="x" m={C.tank} position={[0, r, 0]} seg={36} />
      {[-1, 1].map((e) => (
        <mesh key={e} position={[(e * (sx - 1)) / 2, r, 0]} scale={[0.5 * e, 1, 1]} material={C.tank}>
          <sphereGeometry args={[r * 0.97, 32, 16, 0, Math.PI]} />
        </mesh>
      ))}
      {[-3, 3].map((x) => (
        <group key={x}>
          <Box s={[0.3, r * 1.1, sz * 0.8]} m={C.steel} position={[x, r * 0.5, 0]} />
          <Box s={[0.12, 0.35, 0.12]} m={M.hookYellow} position={[x, sy - 0.15, 0]} />
        </group>
      ))}
      <Cyl r={0.3} l={0.5} m={C.tank} position={[0, sy, 0]} />
    </group>
  );
}

/** Main power transformer, shipped without oil: tank with stiffener ribs, radiator banks with fans on both long
 *  sides, conservator on brackets, three tall HV bushings and the LV bushings, tap changer, nameplate, skids. */
function BigTrafo({ d }: { d: LoadDef }) {
  const [sx, sy, sz] = d.size;
  const tankH = 2.95;
  return (
    <group>
      {/* skid base and the tank with its stiffener ribs */}
      <Box s={[sx * 0.92, 0.3, sz * 0.62]} m={C.bigDark} position={[0, 0.15, 0]} />
      <Box s={[sx * 0.88, tankH, sz * 0.58]} m={C.bigTank} position={[0, 0.3 + tankH / 2, 0]} />
      {Array.from({ length: 7 }, (_, i) =>
        [-1, 1].map((s) => <Box key={`${i}${s}`} s={[0.08, tankH - 0.1, 0.06]} m={C.bigTank} position={[-sx * 0.38 + i * (sx * 0.127), 0.3 + tankH / 2, s * sz * 0.3]} />),
      )}
      <Box s={[sx * 0.92, 0.12, sz * 0.62]} m={C.bigDark} position={[0, 0.3 + tankH + 0.06, 0]} />
      {/* radiator banks: many thin fins on headers, cooling fans underneath */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * sz * 0.42]}>
          {Array.from({ length: 16 }, (_, i) => (
            <Box key={i} s={[0.05, 2.0, 0.5]} m={C.fin} position={[-sx * 0.36 + i * (sx * 0.048), 1.75, 0]} />
          ))}
          <Cyl r={0.07} l={sx * 0.78} axis="x" m={C.bigDark} position={[0, 2.8, -s * 0.12]} />
          <Cyl r={0.07} l={sx * 0.78} axis="x" m={C.bigDark} position={[0, 0.72, -s * 0.12]} />
          {[-1.2, 0, 1.2].map((x) => (
            <group key={x} position={[x, 0.45, 0]}>
              <Cyl r={0.3} l={0.16} m={C.bigDark} />
              <Cyl r={0.26} l={0.17} m={M.black} />
            </group>
          ))}
        </group>
      ))}
      {/* conservator on brackets, Buchholz pipe */}
      <group position={[-0.3, 0.3 + tankH + 0.75, -sz * 0.18]}>
        <Cyl r={0.38} l={sx * 0.62} axis="x" m={C.bigTank} />
        {[-1, 1].map((k) => (
          <Box key={k} s={[0.1, 0.6, 0.1]} m={C.bigDark} position={[k * sx * 0.22, -0.4, 0]} />
        ))}
        <Cyl r={0.06} l={0.7} m={C.bigDark} position={[sx * 0.15, -0.45, 0.25]} />
      </group>
      {/* HV bushings (150 kV): tall brown porcelain with sheds and terminal caps */}
      {[-1.1, 0, 1.1].map((x) => (
        <group key={x} position={[x * 0.9 + 0.2, 0.3 + tankH + 0.12, sz * 0.12]}>
          <Cyl r={0.2} l={0.25} m={C.bigDark} position={[0, 0.12, 0]} />
          <Cyl r={0.12} r2={0.08} l={1.9} m={C.porcelain} position={[0, 1.2, 0]} />
          {Array.from({ length: 9 }, (_, i) => (
            <Cyl key={i} r={0.17 - i * 0.008} l={0.04} m={C.porcelain} position={[0, 0.4 + i * 0.18, 0]} />
          ))}
          <Cyl r={0.09} l={0.15} m={M.steel} position={[0, 2.22, 0]} />
        </group>
      ))}
      {/* LV bushings (20 kV) and the on-load tap changer */}
      {[-0.35, 0, 0.35].map((x) => (
        <group key={x} position={[x - 1.4, 0.3 + tankH + 0.12, sz * 0.18]}>
          <Cyl r={0.07} l={0.6} m={C.porcelain} position={[0, 0.3, 0]} />
        </group>
      ))}
      <Box s={[0.7, 1.2, 0.5]} m={C.bigDark} position={[sx * 0.33, 0.3 + tankH + 0.6, -sz * 0.05]} />
      {/* lifting lugs and the nameplate */}
      {d.points.map((p, i) => (
        <group key={i} position={[p[0], p[1], p[2] * 0.25]}>
          <Box s={[0.12, 0.3, 0.12]} m={M.hookYellow} />
        </group>
      ))}
      <Box s={[0.9, 0.55, 0.01]} m={M.white} position={[-0.6, 1.6, sz * 0.295]} />
      <Text position={[-0.6, 1.68, sz * 0.302]} fontSize={0.09} color="#1b1b1b" maxWidth={0.85} textAlign="center">
        {'TRAFO DAYA\n150/20 kV · 80 MVA\nONAN/ONAF · 100 t'}
      </Text>
    </group>
  );
}

/** Wind turbine nacelle on its transport frame: rounded white housing, hub flange at the front, cooler and met mast
 *  on the roof, yaw bearing under the bedplate, four lifting lugs on the roof. */
function Nacelle({ d }: { d: LoadDef }) {
  const [sx, sy, sz] = d.size;
  const h = sy - 0.5;
  return (
    <group>
      {/* transport frame and yaw bearing */}
      {[-1, 1].map((k) => (
        <Box key={k} s={[0.5, 0.5, sz * 0.9]} m={M.greyLight} position={[k * sx * 0.3, 0.25, 0]} />
      ))}
      <Cyl r={1.8} l={0.3} m={M.steel} position={[0, 0.45, 0]} seg={32} />
      {/* housing: main body and the tapered rear */}
      <RoundedBox args={[sx * 0.82, h, sz]} radius={0.6} smoothness={3} position={[-sx * 0.05, 0.5 + h / 2, 0]} material={M.white} castShadow receiveShadow />
      <RoundedBox args={[sx * 0.2, h * 0.86, sz * 0.86]} radius={0.5} smoothness={3} position={[sx * 0.4 - 0.4, 0.5 + h * 0.47, 0]} material={M.white} castShadow />
      <Box s={[sx * 0.82, 0.12, 0.02]} m={M.greyLight} position={[-sx * 0.05, 0.5 + h * 0.35, sz / 2 + 0.01]} />
      {/* main shaft flange at the front (rotor side) */}
      <Cyl r={1.5} l={0.5} axis="x" m={M.greyLight} position={[sx * 0.5 + 0.1, 0.5 + h * 0.55, 0]} seg={32} />
      <Cyl r={0.9} l={0.4} axis="x" m={M.steel} position={[sx * 0.5 + 0.4, 0.5 + h * 0.55, 0]} seg={24} />
      {/* roof: cooler and the met mast */}
      <Box s={[2.6, 0.9, sz * 0.8]} m={M.greyLight} position={[-sx * 0.36, 0.5 + h + 0.45, 0]} />
      <Cyl r={0.06} l={2.2} m={M.greyLight} position={[-sx * 0.42, 0.5 + h + 1.1, 1.2]} />
      <Cyl r={0.1} l={0.15} m={M.redLamp} position={[-sx * 0.42, 0.5 + h + 2.2, 1.2]} />
      {d.points.map((p, i) => (
        <Box key={i} s={[0.3, 0.35, 0.3]} m={M.hookYellow} position={[p[0], p[1] + 0.1, p[2]]} />
      ))}
      <Text position={[-sx * 0.05, 0.5 + h * 0.62, sz / 2 + 0.02]} fontSize={0.7} color="#2a5d8f" fontWeight={700}>
        WTG 6 MW
      </Text>
    </group>
  );
}

function LoadMesh({ d }: { d: LoadDef }) {
  if (d.look === 'nacelle') return <Nacelle d={d} />;
  if (d.look === 'genset') return <Genset />;
  if (d.look === 'transformer') return <Transformer d={d} />;
  if (d.look === 'chiller') return <Chiller d={d} />;
  if (d.look === 'slab') return <Slab d={d} />;
  if (d.look === 'beams') return <Beams d={d} />;
  if (d.look === 'tank') return <Tank d={d} />;
  return <BigTrafo d={d} />;
}

function OneLoad({ L }: { L: LoadState }) {
  const ref = useRef<THREE.Group>(null);
  const e = useMemo(() => new THREE.Euler(), []);
  useFrame(() => {
    const g = ref.current!;
    g.position.set(L.x, L.y, L.z);
    if (L.state === 'fallen') g.rotation.copy(e.set(0.3, L.yaw, 0.5, 'YXZ'));
    else g.rotation.copy(e.set(L.state === 'air' ? L.tilt : 0, L.yaw, 0, 'YXZ'));
  });
  return (
    <group ref={ref}>
      <Bake>
        <LoadMesh d={L.def} />
      </Bake>
    </group>
  );
}

/** Destination outline and label for the selected load. */
function Destination() {
  const target = useUI((s) => s.tick && cr.target);
  const L = cr.loads[target];
  const d = L.def.dest;
  const [sx, , sz] = L.def.size;
  const yellow = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd21a', transparent: true, opacity: 0.85, depthWrite: false }), []);
  const lines: [number, number, number, number][] = [
    [0, sz / 2 + 0.15, sx + 0.3, 0.1],
    [0, -sz / 2 - 0.15, sx + 0.3, 0.1],
    [sx / 2 + 0.15, 0, 0.1, sz + 0.3],
    [-sx / 2 - 0.15, 0, 0.1, sz + 0.3],
  ];
  if (L.placed) return null;
  return (
    <group position={[d.x, d.y + 0.03, d.z]} rotation={[0, d.yaw, 0]}>
      {lines.map(([x, z, w, h], i) => (
        <mesh key={i} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]} material={yellow}>
          <planeGeometry args={[w, h]} />
        </mesh>
      ))}
      <Text position={[0, d.y > 50 ? 6 : 2.2, 0]} fontSize={d.y > 50 ? 2.5 : 0.6} color="#ffd21a" outlineWidth={0.03} outlineColor="#222" anchorY="bottom">
        {`▼ ${d.label}`}
      </Text>
    </group>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

function Leg({ get }: { get: (a: THREE.Vector3, b: THREE.Vector3) => boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const m = ref.current!;
    m.visible = get(a, b);
    if (!m.visible) return;
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.scale.set(1, a.distanceTo(b), 1);
    m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  });
  return (
    <mesh ref={ref} material={M.sling}>
      <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
    </mesh>
  );
}

/** World position of a lifting point of a load. */
function pointWorld(L: LoadState, p: [number, number, number], out: THREE.Vector3) {
  const s = Math.sin(L.yaw);
  const c = Math.cos(L.yaw);
  return out.set(L.x + p[0] * c + p[2] * s, L.y + p[1], L.z - p[0] * s + p[2] * c);
}

function Rigging() {
  const hook = useMemo(() => new THREE.Vector3(), []);
  const bar = useRef<THREE.Mesh>(null);
  const tmp = useMemo(() => ({ e0: new THREE.Vector3(), e1: new THREE.Vector3(), p: new THREE.Vector3() }), []);
  /** Ends of the spreader (world), from the hook and the load. */
  const spreaderEnds = () => {
    const rig = RIGGING.find((r) => r.id === cr.rig);
    if (!rig || rig.kind !== 'spreader' || cr.attached < 0) return false;
    const L = cr.loads[cr.attached];
    const half = (rig.span ?? 4) / 2;
    const plan = cr.rigPlan!;
    const ctr = pointWorld(L, plan.centre, tmp.p);
    const y = ctr.y + 1.2;
    const s = Math.sin(L.yaw);
    const c = Math.cos(L.yaw);
    tmp.e0.set(ctr.x - half * c, y, ctr.z + half * s);
    tmp.e1.set(ctr.x + half * c, y, ctr.z - half * s);
    return true;
  };
  useFrame(() => {
    const b = bar.current!;
    b.visible = spreaderEnds();
    if (!b.visible) return;
    b.position.copy(tmp.e0).add(tmp.e1).multiplyScalar(0.5);
    b.scale.set(1, tmp.e0.distanceTo(tmp.e1), 1);
    b.quaternion.setFromUnitVectors(UP, tmp.e1.clone().sub(tmp.e0).normalize());
  });
  const legs = Array.from({ length: 4 }, (_, i) => i);
  return (
    <group>
      <mesh ref={bar} material={M.hookYellow}>
        <cylinderGeometry args={[0.12, 0.12, 1, 10]} />
      </mesh>
      {/* top legs: hook to the points (bridle) or to the spreader ends */}
      {legs.map((i) => (
        <Leg
          key={`t${i}`}
          get={(a, b) => {
            if (cr.attached < 0 || !cr.rigPlan) return false;
            const L = cr.loads[cr.attached];
            blockWorld(hook);
            a.set(hook.x, hook.y - 1.1, hook.z);
            if (spreaderEnds()) {
              if (i > 1) return false;
              b.copy(i ? tmp.e1 : tmp.e0);
              return true;
            }
            const pts = cr.rigPlan.points;
            const rig = RIGGING.find((r) => r.id === cr.rig)!;
            const use = rig.kind === 'bridle2' && pts.length >= 4 ? [pts[0], pts[2]] : pts;
            if (i >= use.length) return false;
            pointWorld(L, L.def.points[use[i]], b);
            return true;
          }}
        />
      ))}
      {/* bottom legs: spreader ends down to the points */}
      {legs.map((i) => (
        <Leg
          key={`b${i}`}
          get={(a, b) => {
            if (!spreaderEnds() || !cr.rigPlan) return false;
            const L = cr.loads[cr.attached];
            const pts = cr.rigPlan.points;
            if (i >= pts.length) return false;
            const p = L.def.points[pts[i]];
            pointWorld(L, p, b);
            const local = p[0] - cr.rigPlan.centre[0];
            a.copy(local < 0 ? tmp.e0 : tmp.e1);
            return true;
          }}
        />
      ))}
    </group>
  );
}

export function Loads() {
  return (
    <group>
      {cr.loads.map((L) => (
        <OneLoad key={L.def.id} L={L} />
      ))}
      <Destination />
      <Rigging />
    </group>
  );
}
