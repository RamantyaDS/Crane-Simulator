// The loads (the genset is the detailed Genset Simulator model) at their poses, their destination markings, and the
// rigging drawn between the hook and the lifting points: wire or chain legs, the spreader bar, shackles.
import { RoundedBox, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HUB, bladeTarget, nacelleUp, type LoadState } from '../sim/crane';
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

/** Blade planform (fraction of the length from the root): chord and thickness, m. Round root, widest at a sixth. */
const PROFILE: [number, number, number][] = [
  [0, 3.4, 3.4],
  [0.04, 3.4, 3.4],
  [0.09, 3.8, 2.7],
  [0.17, 4.2, 1.9],
  [0.3, 3.6, 1.2],
  [0.5, 2.7, 0.7],
  [0.7, 1.9, 0.45],
  [0.85, 1.3, 0.3],
  [0.95, 0.8, 0.18],
  [1, 0.3, 0.08],
];
export function bladeSection(t: number): [number, number] {
  let i = 1;
  while (i < PROFILE.length - 1 && PROFILE[i][0] < t) i++;
  const [t0, c0, h0] = PROFILE[i - 1];
  const [t1, c1, h1] = PROFILE[i];
  const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  return [c0 + (c1 - c0) * k, h0 + (h1 - h0) * k];
}

/** Lofted blade between two fractions of its length: airfoil-like sections (blunt leading edge, thin trailing edge),
 *  chord level, along local x from the root at -L/2, axis at the height of the root's centre. */
function bladeGeo(len: number, axisY: number, from: number, to: number) {
  const ring = 16;
  const ts: number[] = [from];
  for (const [t] of PROFILE) if (t > from && t < to) ts.push(t);
  ts.push(to);
  const pos: number[] = [];
  const idx: number[] = [];
  ts.forEach((t, j) => {
    const [c, h] = bladeSection(t);
    const round = Math.max(0, 1 - t / 0.06); // the root is a plain tube
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2;
      const ca = Math.cos(a);
      const lead = ca > 0 ? 0.38 : 0.62; // leading edge forward of the axis
      const z = c * (round * 0.5 + (1 - round) * lead) * ca;
      const y = (h / 2) * Math.sin(a) * (1 + (1 - round) * 0.25 * ca);
      pos.push(-len / 2 + t * len, axisY + y, z);
      if (j > 0) {
        const p = (j - 1) * ring;
        const q = j * ring;
        const n = (i + 1) % ring;
        idx.push(p + i, p + n, q + i, p + n, q + n, q + i);
      }
    }
  });
  // close the far end
  const last = (ts.length - 1) * ring;
  pos.push(-len / 2 + to * len, axisY, 0);
  const cap = pos.length / 3 - 1;
  for (let i = 0; i < ring; i++) idx.push(last + i, last + ((i + 1) % ring), cap);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rotor blade: white glass-fibre shell, grey root flange, red tip for aviation marking, yellow yoke marks. */
function Blade({ d }: { d: LoadDef }) {
  const [len] = d.size;
  const y = d.cg[1];
  const geo = useMemo(() => [bladeGeo(len, y, 0, 0.93), bladeGeo(len, y, 0.93, 1)], [len, y]);
  return (
    <group>
      <mesh geometry={geo[0]} material={M.white} castShadow receiveShadow />
      <mesh geometry={geo[1]} material={M.red} castShadow />
      <Cyl r={1.78} l={0.25} axis="x" m={M.greyLight} position={[-len / 2 + 0.12, y, 0]} seg={28} />
      {d.points.map((p, i) => (
        <Box key={i} s={[0.25, 0.08, 4.4]} m={M.hookYellow} position={[p[0], p[1] - 0.25, 0]} />
      ))}
    </group>
  );
}

/** Hub and spinner on the nacelle's main shaft: turns with the rotor; three pitch-bearing flanges for the blades. */
function Hub() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    ref.current!.rotation.x = cr.rotor;
  });
  return (
    <group ref={ref} position={[HUB.x, HUB.y, 0]} userData={{ noBake: true }}>
      <mesh material={M.white} scale={[1.25, 1, 1]} castShadow>
        <sphereGeometry args={[2.3, 24, 16]} />
      </mesh>
      <Cyl r={0.15} r2={2.2} l={2.2} axis="x" m={M.white} position={[3.2, 0, 0]} seg={24} />
      {[0, 1, 2].map((k) => (
        // flange k reaches three o'clock (+z) when the rotor has turned k thirds
        <group key={k} rotation={[(-k * 2 * Math.PI) / 3, 0, 0]}>
          <Cyl r={1.75} l={0.3} axis="z" m={M.greyLight} position={[0, 0, HUB.r - 0.1]} seg={28} />
        </group>
      ))}
    </group>
  );
}

/** Pressure vessel standing on its skirt: shell, heads, trunnions near the top, platform rings, nozzles. */
function Vessel({ d }: { d: LoadDef }) {
  const [dia, h] = d.size;
  const r = dia / 2;
  const shell = d.look === 'reactor' ? C.tank : M.white;
  const top = d.points[0][1];
  return (
    <group>
      <Cyl r={r * 0.92} l={2.5} m={C.steel} position={[0, 1.25, 0]} seg={28} />
      <Cyl r={r} l={h - 2.5 - r * 0.6} m={shell} position={[0, 2.5 + (h - 2.5 - r * 0.6) / 2, 0]} seg={32} />
      <mesh position={[0, h - r * 0.6, 0]} scale={[1, 0.6, 1]} material={shell} castShadow>
        <sphereGeometry args={[r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* trunnions for the lifting beam */}
      {[-1, 1].map((k) => (
        <Cyl key={k} r={0.5} l={0.9} axis="x" m={C.steel} position={[k * (r + 0.4), top, 0]} seg={16} />
      ))}
      {/* platform rings and the ladder */}
      {[0.3, 0.55, 0.8].map((k) => (
        <Cyl key={k} r={r + 0.9} l={0.15} m={M.hookYellow} position={[0, h * k, 0]} seg={32} open />
      ))}
      <Box s={[0.5, h * 0.75, 0.1]} m={M.hookYellow} position={[0, 2.5 + h * 0.375, r + 0.5]} />
      {[0.2, 0.45, 0.7].map((k) => (
        <Cyl key={k} r={0.45} l={1.2} axis="z" m={C.steel} position={[r * 0.4, h * k, -r - 0.4]} seg={12} />
      ))}
      <Text position={[0, h * 0.62, r + 0.05]} fontSize={1.6} color="#1f3550" fontWeight={700}>
        {d.look === 'reactor' ? 'R-101' : 'C-201'}
      </Text>
    </group>
  );
}

/** The trolley that carries the vessel's foot in towards the crane while it is upended. */
function Tailing({ L }: { L: LoadState }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current!;
    const up = L.up ?? 1;
    g.visible = up > 0.002 && !L.placed && L.state !== 'air' && !(up === 1 && L.state === 'rest' && cr.attached < 0);
    g.position.set(L.x, 0, L.z);
    g.rotation.y = L.yaw;
  });
  return (
    <group ref={ref}>
      <Box s={[7, 1.0, 6]} m={M.hookYellow} position={[0, 0.5, 0]} />
      <Box s={[L.def.size[0] + 1, 0.6, 1.2]} m={C.steel} position={[0, 1.2, 0]} />
      {[-2.4, 2.4].map((x) => [-2, 0, 2].map((z) => <Cyl key={`${x}${z}`} r={0.4} l={0.4} axis="x" m={M.rubber} position={[x, 0.3, z]} seg={10} />))}
    </group>
  );
}

function LoadMesh({ d }: { d: LoadDef }) {
  if (d.upend) return <Vessel d={d} />;
  if (d.look === 'blade') return <Blade d={d} />;
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
  const hub = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const e = useMemo(() => new THREE.Euler(), []);
  useFrame(() => {
    const g = ref.current!;
    const N = L.def.bolt && L.placed ? nacelleUp(cr) : null;
    if (N) {
      // a bolted blade turns with the hub: nacelle frame, hub centre, rotor angle, then out along its flange
      g.position.set(N.x, N.y, N.z);
      g.rotation.set(0, N.yaw, 0);
      hub.current!.position.set(HUB.x, HUB.y, 0);
      hub.current!.rotation.x = cr.rotor - ((L.slot ?? 0) * 2 * Math.PI) / 3;
      root.current!.position.set(0, -L.def.cg[1], HUB.r + L.def.size[0] / 2);
      root.current!.rotation.y = -Math.PI / 2;
      return;
    }
    hub.current!.position.set(0, 0, 0);
    hub.current!.rotation.x = 0;
    root.current!.position.set(0, 0, 0);
    root.current!.rotation.y = 0;
    g.position.set(L.x, L.y, L.z);
    if (L.def.upend && (L.up ?? 1) < 1) {
      // lying / being upended about its foot: the axis tips from +z (towards the top) up to +y
      g.rotation.copy(e.set(((1 - (L.up ?? 1)) * Math.PI) / 2, L.yaw, 0, 'YXZ'));
      return;
    }
    if (L.state === 'fallen') g.rotation.copy(e.set(0.3, L.yaw, 0.5, 'YXZ'));
    else g.rotation.copy(e.set(L.state === 'air' ? L.tilt : 0, L.yaw, 0, 'YXZ'));
  });
  return (
    <group ref={ref}>
      <group ref={hub}>
        <group ref={root}>
          <Bake>
            <LoadMesh d={L.def} />
          </Bake>
        </group>
      </group>
      {L.def.look === 'nacelle' && <Hub />}
    </group>
  );
}

function OneLoadWithTail({ L }: { L: LoadState }) {
  return (
    <>
      <OneLoad L={L} />
      {L.def.upend && <Tailing L={L} />}
    </>
  );
}

/** Where the blade must go: a ghost of its root at the free flange and its axis at three o'clock. */
function BladeGoal({ L }: { L: LoadState }) {
  const ref = useRef<THREE.Group>(null);
  const yellow = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd21a', transparent: true, opacity: 0.35, depthWrite: false }), []);
  const [len, h, w] = L.def.size;
  useFrame(() => {
    const T = bladeTarget(cr, L);
    const g = ref.current!;
    g.visible = !!T && !L.placed;
    if (T) {
      g.position.set(T.x, T.y, T.z);
      g.rotation.set(0, T.yaw, 0);
    }
  });
  return (
    <group ref={ref}>
      <mesh position={[-len / 2 + 1, h / 2, 0]} material={yellow}>
        <boxGeometry args={[2, h + 0.4, w + 0.4]} />
      </mesh>
      <mesh position={[0, h / 2, 0]} material={yellow}>
        <boxGeometry args={[len, 0.12, 0.12]} />
      </mesh>
      <Text position={[-len / 2 + 6, h + 3, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={2.2} color="#ffd21a" outlineWidth={0.04} outlineColor="#222" anchorY="bottom">
        ▼ akar bilah ke flange hub
      </Text>
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
  if (L.def.bolt) return <BladeGoal L={L} />;
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

/** Thickness of a sling leg for the fitted rigging (wire rope or chain grows with its working load limit). */
function legRadius() {
  const rig = RIGGING.find((r) => r.id === cr.rig);
  return rig ? Math.min(0.05, 0.012 + (rig.wll / 100000) * 0.03) : 0.025;
}
const isChain = () => !!RIGGING.find((r) => r.id === cr.rig)?.name.includes('rantai');

/** One sling leg: the rope (or chain) with a hard eye at the top and a bow shackle on the lifting point below. */
function Leg({ get, shackle = true }: { get: (a: THREE.Vector3, b: THREE.Vector3) => boolean; shackle?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const rope = useRef<THREE.Mesh>(null);
  const chain = useRef<THREE.Mesh>(null);
  const eye = useRef<THREE.Group>(null);
  const shk = useRef<THREE.Group>(null);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const d = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const g = ref.current!;
    g.visible = get(a, b);
    if (!g.visible) return;
    const r = legRadius();
    const k = r / 0.025;
    const len = a.distanceTo(b);
    d.copy(a).sub(b).normalize(); // up the leg
    g.position.copy(b);
    g.quaternion.setFromUnitVectors(UP, d);
    const ch = isChain();
    for (const [m, on] of [
      [rope.current!, !ch],
      [chain.current!, ch],
    ] as const) {
      m.visible = on;
      m.position.y = len / 2;
      m.scale.set(k, Math.max(0.05, len - 0.25 * k), k);
    }
    eye.current!.position.y = len - 0.1 * k;
    eye.current!.scale.setScalar(k);
    shk.current!.visible = shackle;
    shk.current!.scale.setScalar(k);
  });
  return (
    <group ref={ref}>
      <mesh ref={rope} material={M.sling}>
        <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
      </mesh>
      <mesh ref={chain} material={M.chain}>
        <cylinderGeometry args={[0.03, 0.03, 1, 4]} />
      </mesh>
      {/* hard eye (thimble) at the top */}
      <group ref={eye}>
        <mesh material={M.sling}>
          <torusGeometry args={[0.1, 0.025, 6, 12]} />
        </mesh>
      </group>
      {/* bow shackle: bow round the sling eye, pin through the load's lug */}
      <group ref={shk}>
        <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI]} material={M.hookYellow}>
          <torusGeometry args={[0.07, 0.022, 6, 12, Math.PI]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.07, 0.03, 0]} material={M.hookYellow}>
            <cylinderGeometry args={[0.022, 0.022, 0.07, 6]} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.chrome}>
          <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
        </mesh>
      </group>
    </group>
  );
}

/** Master link on the hook and the lugs at the spreader ends. */
function Hardware({ hook, ends }: { hook: () => THREE.Vector3 | null; ends: () => [THREE.Vector3, THREE.Vector3] | null }) {
  const link = useRef<THREE.Group>(null);
  const lugs = useRef<THREE.Group[]>([]);
  useFrame(() => {
    const h = hook();
    const l = link.current!;
    l.visible = !!h;
    if (h) {
      l.position.copy(h);
      l.rotation.y = cr.heading + cr.slew;
      l.scale.setScalar(legRadius() / 0.025);
    }
    const e = ends();
    lugs.current.forEach((g, i) => {
      g.visible = !!e;
      if (e) {
        g.position.copy(e[i]);
        g.rotation.y = cr.attached >= 0 ? cr.loads[cr.attached].yaw : 0;
      }
    });
  });
  return (
    <group>
      <group ref={link}>
        <mesh position={[0, 0.12, 0]} material={M.hookYellow} scale={[1, 1.5, 1]}>
          <torusGeometry args={[0.12, 0.03, 8, 16]} />
        </mesh>
      </group>
      {[0, 1].map((i) => (
        <group key={i} ref={(el) => el && (lugs.current[i] = el)}>
          <mesh position={[0, 0.16, 0]} material={M.hookYellow}>
            <boxGeometry args={[0.04, 0.3, 0.25]} />
          </mesh>
          <mesh position={[0, -0.14, 0]} material={M.hookYellow}>
            <boxGeometry args={[0.04, 0.25, 0.25]} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} material={M.steelDark}>
            <boxGeometry args={[0.36, 0.36, 0.08]} />
          </mesh>
        </group>
      ))}
    </group>
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
        <cylinderGeometry args={[0.14, 0.14, 1, 12]} />
      </mesh>
      <Hardware
        hook={() => {
          if (cr.attached < 0 || !cr.rigPlan) return null;
          blockWorld(hook);
          return hook.set(hook.x, hook.y - 1.1, hook.z);
        }}
        ends={() => (spreaderEnds() ? [tmp.e0, tmp.e1] : null)}
      />
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
        <OneLoadWithTail key={L.def.id} L={L} />
      ))}
      <Destination />
      <Rigging />
    </group>
  );
}
