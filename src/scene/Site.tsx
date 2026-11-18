// The factory construction site drawn from sim/site.ts: hard compacted yard with the excavation, the
// half-built steel frame with its mezzanine and part of the roof, the annex, genset house, transformer bay, the
// foundations and timbers, the main transformer lift plan marking, the 20 kV line, site cabins, fence and a tree line.
import { Text } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { ANNEX, COLUMNS, EXCAVATION, FACTORY, FOUNDATIONS, GATE_W, GENHOUSE, JIB_LAYDOWN, LOADS, POWERLINE, PRESS_SPOT, SANY_SPOT, TOWER, TOWER_SPOT, forModel } from '../sim/site';
import { SPEC } from '../sim/spec';
import { Bake } from './Bake';
import { bladeSection } from './Loads';
import { Lat } from './Sany';
import { Box, Cyl, M, useCanvasTexture } from './parts';

const S = {
  steel: new THREE.MeshStandardMaterial({ color: '#4d5a66', metalness: 0.55, roughness: 0.5 }),
  primer: new THREE.MeshStandardMaterial({ color: '#8a3b2b', metalness: 0.4, roughness: 0.6 }),
  slab: new THREE.MeshStandardMaterial({ color: '#b7b4ac', metalness: 0, roughness: 0.9 }),
  found: new THREE.MeshStandardMaterial({ color: '#a19e95', metalness: 0, roughness: 0.92 }),
  clad: new THREE.MeshStandardMaterial({ color: '#c9ced2', metalness: 0.45, roughness: 0.45 }),
  block: new THREE.MeshStandardMaterial({ color: '#b9b3a6', metalness: 0, roughness: 0.95 }),
  soil: new THREE.MeshStandardMaterial({ color: '#6b5236', metalness: 0, roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a5634', metalness: 0, roughness: 0.85 }),
  pole: new THREE.MeshStandardMaterial({ color: '#9a9a94', metalness: 0.1, roughness: 0.8 }),
  cabin: new THREE.MeshStandardMaterial({ color: '#e7e2d6', metalness: 0.2, roughness: 0.6 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#3d6b35', metalness: 0, roughness: 0.9 }),
  wire: new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.6, roughness: 0.5 }),
};

function Ground() {
  const gravel = useCanvasTexture(
    512,
    512,
    (g) => {
      g.fillStyle = '#9b9384';
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 16000; i++) {
        const v = 110 + Math.random() * 70;
        g.fillStyle = `rgba(${v},${v - 6},${v - 18},0.5)`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 2, 2);
      }
      // tyre tracks
      g.strokeStyle = 'rgba(80,72,60,0.25)';
      g.lineWidth = 18;
      for (const x of [150, 190, 330, 370]) {
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + 40, 170, x - 30, 340, x + 10, 512);
        g.stroke();
      }
    },
    [14, 14],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[420, 420]} />
        <meshStandardMaterial map={gravel} roughness={0.95} />
      </mesh>
      {/* fields beyond the yard: the 4 000 t crane's camera sees much farther */}
      {SPEC.bigView && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
          <planeGeometry args={[2400, 2400]} />
          <meshStandardMaterial color="#8a8f6a" roughness={1} />
        </mesh>
      )}
      {/* the slab inside the factory */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(FACTORY.x0 + FACTORY.x1) / 2, 0.02, (FACTORY.z0 + FACTORY.z1) / 2]} receiveShadow material={S.slab}>
        <planeGeometry args={[FACTORY.x1 - FACTORY.x0, FACTORY.z1 - FACTORY.z0]} />
      </mesh>
    </group>
  );
}

function Excavation() {
  const { x0, x1, z0, z1, depth } = EXCAVATION;
  const w = x1 - x0;
  const d = z1 - z0;
  return (
    <group>
      {/* pit walls and floor (drawn below the ground plane, which has a hole only visually: dark floor) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.015, (z0 + z1) / 2]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#3d2f20" roughness={1} />
      </mesh>
      <Box s={[w, 0.6, 0.4]} m={S.soil} position={[(x0 + x1) / 2, 0.3, z1 + 0.5]} />
      {/* barricade */}
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i} position={[x0 + (i * w) / 6, 0, z1 + 1.2]}>
          <Cyl r={0.04} l={1.1} m={M.hookYellow} position={[0, 0.55, 0]} />
        </group>
      ))}
      <Box s={[w, 0.12, 0.05]} m={M.lbRed} position={[(x0 + x1) / 2, 0.9, z1 + 1.2]} />
      <Box s={[w, 0.12, 0.05]} m={M.white} position={[(x0 + x1) / 2, 0.7, z1 + 1.2]} />
      <Text position={[(x0 + x1) / 2, 1.5, z1 + 1.25]} fontSize={0.45} color="#c3161c" outlineWidth={0.02} outlineColor="#fff">
        {`GALIAN ${depth} m - JAGA JARAK`}
      </Text>
    </group>
  );
}

function Factory() {
  const { x0, x1, z0, z1, eave, mezz } = FACTORY;
  const rafters: number[] = [];
  for (let x = x0; x <= x1; x += 8) rafters.push(x);
  return (
    <group>
      {COLUMNS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box s={[0.45, eave, 0.3]} m={S.steel} position={[0, eave / 2, 0]} />
          <Box s={[0.7, 0.1, 0.7]} m={S.found} position={[0, 0.05, 0]} />
        </group>
      ))}
      {/* eave beams and the rafters with a ridge (pitched roof) */}
      {[z0, z1].map((z) => (
        <Box key={z} s={[x1 - x0, 0.6, 0.25]} m={S.steel} position={[(x0 + x1) / 2, eave - 0.3, z]} />
      ))}
      {rafters.map((x) => (
        <group key={x}>
          {[-1, 1].map((s) => {
            const half = (z1 - z0) / 2;
            const len = Math.hypot(half, 2.5);
            return <Box key={s} s={[0.22, 0.55, len]} m={S.steel} position={[x, eave + 1.25, (z0 + z1) / 2 + (s * half) / 2]} rotation={[s * Math.atan2(2.5, half), 0, 0]} />;
          })}
        </group>
      ))}
      {/* roof sheeting over the east bays only (the west is open for lifting in) */}
      {[-1, 1].map((s) => {
        const half = (z1 - z0) / 2;
        const len = Math.hypot(half, 2.5);
        return (
          <mesh key={s} position={[26, eave + 1.32, (z0 + z1) / 2 + (s * half) / 2]} rotation={[-Math.PI / 2 + s * Math.atan2(2.5, half), 0, 0]} material={S.clad} receiveShadow castShadow>
            <planeGeometry args={[16, len]} />
          </mesh>
        );
      })}
      {/* cladding on the north wall, east end */}
      <mesh position={[26, eave / 2, z1 + 0.2]} rotation={[0, Math.PI, 0]} material={S.clad}>
        <planeGeometry args={[16, eave]} />
      </mesh>
      {/* mezzanine deck */}
      <Box s={[mezz.x1 - mezz.x0, 0.4, mezz.z1 - mezz.z0]} m={S.slab} position={[(mezz.x0 + mezz.x1) / 2, mezz.y - 0.2, (mezz.z0 + mezz.z1) / 2]} />
      {[mezz.x0 + 0.2, (mezz.x0 + mezz.x1) / 2, mezz.x1 - 0.2].map((x) =>
        [mezz.z0 + 0.2, mezz.z1 - 0.2].map((z) => <Box key={`${x}${z}`} s={[0.3, mezz.y - 0.4, 0.3]} m={S.steel} position={[x, (mezz.y - 0.4) / 2, z]} />),
      )}
      <Box s={[mezz.x1 - mezz.x0, 1.0, 0.05]} m={M.hookYellow} position={[(mezz.x0 + mezz.x1) / 2, mezz.y + 0.5, mezz.z0]} />
      <Text position={[(x0 + x1) / 2, eave + 3.5, z0 - 0.2]} rotation={[0, Math.PI, 0]} fontSize={1.1} color="#1f3550" fontWeight={700}>
        PABRIK BARU - TAHAP 2
      </Text>
    </group>
  );
}

function Annex() {
  const { x0, x1, z0, z1, h } = ANNEX;
  return (
    <group>
      <Box s={[x1 - x0, h, z1 - z0]} m={S.block} position={[(x0 + x1) / 2, h / 2, (z0 + z1) / 2]} />
      <Box s={[x1 - x0 + 0.3, 0.6, z1 - z0 + 0.3]} m={S.slab} position={[(x0 + x1) / 2, h + 0.0, (z0 + z1) / 2]} />
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} s={[1.6, 1.2, 0.05]} m={M.glassDark} position={[x0 + 2 + i * 3.2, h * 0.55, z0 - 0.03]} />
      ))}
      <Text position={[(x0 + x1) / 2, h - 1, z0 - 0.05]} rotation={[0, Math.PI, 0]} fontSize={0.7} color="#1f3550">
        GEDUNG UTILITAS
      </Text>
    </group>
  );
}

function GensetHouse() {
  const { x, z, w, d, h } = GENHOUSE;
  return (
    <group>
      <Box s={[0.25, h, d]} m={S.block} position={[x - w / 2, h / 2, z]} />
      <Box s={[0.25, h, d]} m={S.block} position={[x + w / 2, h / 2, z]} />
      <Box s={[w, h, 0.25]} m={S.block} position={[x, h / 2, z + d / 2]} />
      <Box s={[1.4, 1.6, 0.05]} m={S.steel} position={[x, h - 1.3, z + d / 2 + 0.14]} />
      <Text position={[x, h + 0.6, z + d / 2]} rotation={[0, Math.PI, 0]} fontSize={0.5} color="#1f3550">
        RUMAH GENSET
      </Text>
    </group>
  );
}

function TrafoBay() {
  return (
    <group>
      {[-38, -30].map((x) => (
        <Box key={x} s={[0.3, 5, 6]} m={S.block} position={[x, 2.5, -2]} />
      ))}
      <Box s={[8, 0.1, 6]} m={S.found} position={[-34, 0.05, -2]} />
      <Text position={[-34, 5.5, -2]} rotation={[0, Math.PI / 2, 0]} fontSize={0.5} color="#1f3550">
        BAY TRAFO 150/20 kV
      </Text>
    </group>
  );
}

function Foundations() {
  return (
    <group>
      {FOUNDATIONS.map((f) => (
        <mesh key={f.id} position={[f.b.x, f.y / 2, f.b.z]} rotation={[0, f.b.yaw, 0]} castShadow receiveShadow material={S.found}>
          <boxGeometry args={[f.b.hx * 2, f.y, f.b.hz * 2]} />
        </mesh>
      ))}
      {/* timbers under the loads waiting in the laydown yard */}
      {LOADS.filter((l) => l.start.y > 0.05 && !l.bolt && !l.upend && forModel(l)).map((l) => {
        const [sx, , sz] = l.size;
        return [-0.4, 0, 0.4].map((k) => {
          const c = Math.cos(l.start.yaw);
          const s = Math.sin(l.start.yaw);
          const lx = k * sx;
          return (
            <mesh key={`${l.id}${k}`} position={[l.start.x + lx * c, l.start.y / 2, l.start.z - lx * s]} rotation={[0, l.start.yaw, 0]} material={S.wood} castShadow receiveShadow>
              <boxGeometry args={[0.25, l.start.y, sz + 0.4]} />
            </mesh>
          );
        });
      })}
    </group>
  );
}

function LiftPlan() {
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff6a00', transparent: true, opacity: 0.85, depthWrite: false }), []);
  return (
    <group position={[PRESS_SPOT.x, 0.04, PRESS_SPOT.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ring}>
        <ringGeometry args={[0.55, 0.7, 32]} />
      </mesh>
      {[0, Math.PI / 2].map((a) => (
        <mesh key={a} rotation={[-Math.PI / 2, 0, a]} material={ring}>
          <planeGeometry args={[2.4, 0.1]} />
        </mesh>
      ))}
      {/* the 3.5 m radius the transformer lift must stay inside */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ring}>
        <ringGeometry args={[3.45, 3.55, 64]} />
      </mesh>
      <Text position={[0, 0.02, -4.4]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.45} color="#ff6a00">
        LIFT PLAN TRAFO 100 t: PUSAT SWING DI SINI · R MAKS 3,5 m
      </Text>
    </group>
  );
}

/** Wind turbine tower: four tapered steel sections with flanges, door, foundation, aviation light on the top flange. */
function WindTower() {
  const n = 4;
  const seg = TOWER.h / n;
  const r = (y: number) => TOWER.rBase + ((TOWER.rTop - TOWER.rBase) * y) / TOWER.h;
  return (
    <group position={[TOWER.x, 0, TOWER.z]}>
      <Cyl r={7} l={0.6} m={S.found} position={[0, 0.3, 0]} seg={40} />
      {Array.from({ length: n }, (_, i) => (
        <group key={i}>
          <Cyl r={r((i + 1) * seg)} r2={r(i * seg)} l={seg} m={M.white} position={[0, i * seg + seg / 2, 0]} seg={32} />
          <Cyl r={r((i + 1) * seg) + 0.06} l={0.25} m={M.greyLight} position={[0, (i + 1) * seg, 0]} seg={32} />
        </group>
      ))}
      <Box s={[0.9, 2.2, 0.2]} m={M.greyLight} position={[0, 1.7, -TOWER.rBase]} />
      <Box s={[1.4, 0.15, 1.2]} m={M.checker} position={[0, 0.65, -TOWER.rBase - 0.6]} />
      <Cyl r={0.12} l={0.25} m={M.redLamp} position={[1.2, TOWER.h + 0.13, 0]} />
      <Text position={[0, 22, -r(22) - 0.05]} rotation={[0, Math.PI, 0]} fontSize={1.2} color="#2a5d8f">
        WTG-07 · HUB 150 m
      </Text>
    </group>
  );
}

const SRED = new THREE.MeshStandardMaterial({ color: '#d0142c', metalness: 0.3, roughness: 0.4 });

/** The red set at the lower left of the user's first SANY photo: a luffing jib lying on its assembly stands, the red
 *  A-frame stand at its root with a jib hook block parked on top, hung on red tension bars. West of the lift spot,
 *  beyond the reach of the superlift tray. */
function JibStand() {
  const x0 = SANY_SPOT.x - 52;
  const z = SANY_SPOT.z - 6;
  const y = 6.5; // lattice centre line on the stands
  const len = 42;
  const leg = (a: [number, number, number], b: [number, number, number], r = 0.35) => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    return (
      <mesh key={a.join() + b.join()} position={A.clone().add(B).multiplyScalar(0.5)} quaternion={q} material={SRED} castShadow>
        <cylinderGeometry args={[r, r, A.distanceTo(B), 10]} />
      </mesh>
    );
  };
  return (
    <group position={[x0, 0, z]}>
      {/* the jib, lying west from the A-frame, tapering to its head */}
      <Lat len={len} w0={3.4} w1={2.4} position={[0, y, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <RBox s={[3.2, 2.4, 2.6]} position={[-len - 1, y, 0]} />
      {/* A-frame stand at the root: two posts, raking legs, top beam, base */}
      {[-2.2, 2.2].map((dz) => (
        <group key={dz}>
          {leg([0, 0, dz], [0, 18, dz * 0.6], 0.4)}
          {leg([7, 0, dz], [0, 18, dz * 0.6], 0.35)}
          {leg([0, y - 1.7, dz], [7 * (1 - (y - 1.7) / 18), y - 1.7, dz], 0.25)}
        </group>
      ))}
      <Box s={[2.4, 1.2, 5.2]} m={SRED} position={[0.6, 18.4, 0]} />
      <Box s={[9, 0.6, 6]} m={SRED} position={[3.5, 0.3, 0]} />
      {/* jib hook block parked on top, the red tension bars down to the jib root */}
      <group position={[0.6, 21.2, 0]}>
        <Box s={[1.6, 3.2, 2.2]} m={SRED} />
        <Box s={[1.7, 0.4, 2.3]} m={M.black} position={[0, -1.0, 0]} />
        <Cyl r={0.8} l={0.25} axis="z" m={M.steel} position={[0, 1.3, 0]} seg={18} />
      </group>
      {leg([0.1, 18.8, -0.8], [-0.2, y + 1.7, -1.2], 0.18)}
      {leg([0.1, 18.8, 0.8], [-0.2, y + 1.7, 1.2], 0.18)}
      {/* trestles under the jib */}
      {[-16, -32].map((x) => (
        <group key={x}>
          {leg([x - 2, 0, -2], [x, y - 1.7, -1.4], 0.25)}
          {leg([x + 2, 0, -2], [x, y - 1.7, -1.4], 0.25)}
          {leg([x - 2, 0, 2], [x, y - 1.7, 1.4], 0.25)}
          {leg([x + 2, 0, 2], [x, y - 1.7, 1.4], 0.25)}
          <Box s={[1.2, 0.4, 3.4]} m={SRED} position={[x, y - 1.8, 0]} />
        </group>
      ))}
    </group>
  );
}

function RBox({ s, position }: { s: [number, number, number]; position: [number, number, number] }) {
  return <Box s={s} m={SRED} position={position} />;
}

/** Refinery plot for the SANY: SPMT transporters with saddles under the lying vessels, the lift-plan spot. */
function Refinery() {
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff6a00', transparent: true, opacity: 0.85, depthWrite: false }), []);
  return (
    <group>
      {LOADS.filter((l) => l.upend && forModel(l)).map((l) => {
        const len = l.size[1];
        const r = l.size[0] / 2;
        const dx = Math.sin(l.start.yaw);
        const dz = Math.cos(l.start.yaw);
        const deck = l.start.y - r - 0.9; // saddles 0.9 m
        const at = (k: number): [number, number, number] => [l.start.x + dx * len * k, 0, l.start.z + dz * len * k];
        return (
          <group key={l.id}>
            {[0.15, 0.78].map((k) => (
              <group key={k} position={at(k)} rotation={[0, l.start.yaw, 0]}>
                {/* SPMT: low platform on rows of small wheels, saddle on top */}
                <Box s={[6, 0.9, 14]} m={M.hookYellow} position={[0, deck - 0.45, 0]} />
                {Array.from({ length: 6 }, (_, i) =>
                  [-2.2, 2.2].map((x) => <Cyl key={`${i}${x}`} r={0.55} l={0.5} axis="x" m={M.rubber} position={[x, 0.55, -5.5 + i * 2.2]} seg={12} />),
                )}
                <Box s={[r * 2.2, 0.9, 1.6]} m={M.steel} position={[0, deck + 0.45, 0]} />
              </group>
            ))}
          </group>
        );
      })}
      <JibStand />
      <group position={[SANY_SPOT.x, 0.05, SANY_SPOT.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={ring}>
          <ringGeometry args={[1.2, 1.5, 32]} />
        </mesh>
        <Text position={[0, 0.02, -3]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.4} color="#ff6a00">
          LIFT PLAN SCC45000A · PUSAT SWING DI SINI
        </Text>
      </group>
    </group>
  );
}

/** Marked strip where the wind boom is laid out on cribbing and assembled in line with the boom. */
function JibStrip() {
  const J = JIB_LAYDOWN;
  const line = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff6a00', transparent: true, opacity: 0.8, depthWrite: false }), []);
  const yaw = Math.atan2(J.dx, J.dz);
  const mid = J.from + J.len / 2;
  return (
    <group position={[J.x + J.dx * mid, 0.05, J.z + J.dz * mid]} rotation={[0, yaw, 0]}>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[(k * J.w) / 2, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} material={line}>
          <planeGeometry args={[0.2, J.len]} />
        </mesh>
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <Box key={i} s={[2.4, 0.3, 0.3]} m={S.wood} position={[0, 0.15, -J.len / 2 + 6 + i * 10]} />
      ))}
      <Text position={[0, 0.03, -J.len / 2 + 3]} rotation={[-Math.PI / 2, 0, Math.PI]} fontSize={1.1} color="#ff6a00">
        AREA RAKIT BOOM WIND · 111 m
      </Text>
    </group>
  );
}

/** Steel root stands and padded tip cradles the blades arrive on. */
function BladeStands() {
  return (
    <group>
      {LOADS.filter((l) => l.bolt).map((l) => {
        const [len] = l.size;
        const { x, z, y, yaw } = l.start;
        const at = (t: number) => [x + (-len / 2 + t * len) * Math.cos(yaw), z - (-len / 2 + t * len) * Math.sin(yaw)];
        const [rx, rz] = at(0.02);
        const t = 0.62;
        const [cx, cz] = at(t);
        const top = y + l.cg[1] - bladeSection(t)[1] / 2;
        return (
          <group key={l.id}>
            <group position={[rx, 0, rz]} rotation={[0, yaw, 0]}>
              <Box s={[1.2, 0.2, 4.4]} m={M.greyLight} position={[0, 0.1, 0]} />
              {[-1.6, 1.6].map((k) => (
                <Box key={k} s={[0.9, y + 0.4, 0.3]} m={M.hookYellow} position={[0, (y + 0.4) / 2, k]} />
              ))}
            </group>
            <group position={[cx, 0, cz]} rotation={[0, yaw, 0]}>
              {[-0.9, 0.9].map((k) => (
                <Box key={k} s={[0.25, top, 0.25]} m={M.hookYellow} position={[0, top / 2, k]} />
              ))}
              <Box s={[0.8, 0.25, 2.4]} m={M.rubber} position={[0, top - 0.12, 0]} />
            </group>
          </group>
        );
      })}
    </group>
  );
}

/** Where the lift plan puts the Zoomlion for the nacelle, and the radius to the tower. */
function TowerPlan() {
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff6a00', transparent: true, opacity: 0.85, depthWrite: false }), []);
  const R = Math.hypot(TOWER.x - TOWER_SPOT.x, TOWER.z - TOWER_SPOT.z);
  return (
    <group position={[TOWER_SPOT.x, 0.04, TOWER_SPOT.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ring}>
        <ringGeometry args={[0.9, 1.1, 32]} />
      </mesh>
      {[0, Math.PI / 2].map((a) => (
        <mesh key={a} rotation={[-Math.PI / 2, 0, a]} material={ring}>
          <planeGeometry args={[4, 0.15]} />
        </mesh>
      ))}
      {/* outrigger base 16 × 16 m */}
      {[
        [8, 8],
        [-8, 8],
        [8, -8],
        [-8, -8],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]} material={ring}>
          <ringGeometry args={[1.1, 1.3, 24]} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ring}>
        <ringGeometry args={[R - 0.1, R + 0.1, 128]} />
      </mesh>
      <Text position={[4, 0.02, 10.5]} rotation={[-Math.PI / 2, 0, Math.PI]} fontSize={0.9} color="#ff6a00">
        LIFT PLAN NACELLE 150 t · PUSAT SWING DI SINI · R {R.toFixed(0)} m
      </Text>
    </group>
  );
}

function PowerLine() {
  const zs = [-50, -25, 0, 25, 50];
  const sag = (k: number) => 4 * 0.8 * k * (1 - k); // catenary-ish 0.8 m sag
  return (
    <group>
      {zs.map((z) => (
        <group key={z} position={[POWERLINE.x, 0, z]}>
          <Cyl r={0.2} r2={0.14} l={POWERLINE.y + 1.2} m={S.pole} position={[0, (POWERLINE.y + 1.2) / 2, 0]} />
          <Box s={[2.2, 0.12, 0.12]} m={S.steel} position={[0, POWERLINE.y + 0.1, 0]} />
          {[-0.8, 0, 0.8].map((x) => (
            <Cyl key={x} r={0.05} l={0.25} m={M.white} position={[x, POWERLINE.y + 0.25, 0]} />
          ))}
        </group>
      ))}
      {zs.slice(0, -1).map((z, i) =>
        [-0.8, 0, 0.8].map((x) => {
          const pts = Array.from({ length: 13 }, (_, k) => new THREE.Vector3(POWERLINE.x + x, POWERLINE.y + 0.4 - sag(k / 12), z + (k / 12) * (zs[i + 1] - z)));
          const curve = new THREE.CatmullRomCurve3(pts);
          return (
            <mesh key={`${z}${x}`} material={S.wire}>
              <tubeGeometry args={[curve, 24, 0.02, 4, false]} />
            </mesh>
          );
        }),
      )}
      <Text position={[POWERLINE.x - 1, 3, -12]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.6} color="#c3161c" outlineWidth={0.03} outlineColor="#fff">
        AWAS! SUTM 20 kV - JARAK AMAN 3 m
      </Text>
    </group>
  );
}

function Surroundings() {
  const trees: [number, number, number][] = [];
  const J = JIB_LAYDOWN;
  // keep the wind boom's assembly strip clear of trees
  const inStrip = (x: number, z: number) => {
    const t = (x - J.x) * J.dx + (z - J.z) * J.dz;
    const off = Math.abs((x - J.x) * J.dz - (z - J.z) * J.dx);
    return t > 0 && t < J.from + J.len + 6 && off < J.w + 5;
  };
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const t: [number, number, number] = [Math.cos(a) * (85 + (i % 3) * 6), 4 + (i % 4), Math.sin(a) * (80 + (i % 5) * 5)];
    if (!inStrip(t[0], t[2])) trees.push(t);
  }
  const westPosts = Array.from({ length: 32 }, (_, i) => -62 + i * 4).filter((z) => z <= GATE_W.z0 || z >= GATE_W.z1);
  return (
    <group>
      {[30, 37].map((x) => (
        <group key={x} position={[x, 0, -40]}>
          <Box s={[6, 2.6, 2.5]} m={S.cabin} position={[0, 1.4, 0]} />
          <Box s={[1.2, 0.8, 0.05]} m={M.glassDark} position={[1.5, 1.6, -1.27]} />
        </group>
      ))}
      <Text position={[33.5, 3.2, -41.3]} rotation={[0, Math.PI, 0]} fontSize={0.45} color="#1f3550">
        KANTOR PROYEK · K3 NOMOR 1
      </Text>
      {/* fence: posts on the south, west (with the gate) and north sides */}
      {Array.from({ length: 36 }, (_, i) => (
        <Cyl key={`f${i}`} r={0.04} l={2.2} m={M.steel} seg={6} position={[-70 + i * 4, 1.1, -62]} />
      ))}
      {Array.from({ length: 36 }, (_, i) => (
        <Cyl key={`n${i}`} r={0.04} l={2.2} m={M.steel} seg={6} position={[-70 + i * 4, 1.1, 62]} />
      ))}
      {westPosts.map((z) => (
        <Cyl key={`w${z}`} r={0.04} l={2.2} m={M.steel} seg={6} position={[-70, 1.1, z]} />
      ))}
      {[GATE_W.z0, GATE_W.z1].map((z) => (
        <Cyl key={`g${z}`} r={0.12} l={2.6} m={M.hookYellow} seg={10} position={[-70, 1.3, z]} />
      ))}
      {trees.map(([x, h, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cyl r={0.3} l={h} m={S.wood} position={[0, h / 2, 0]} seg={6} />
          <mesh position={[0, h + 1.5, 0]} material={S.leaf}>
            <icosahedronGeometry args={[2.6, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Site() {
  return (
    <group>
      <Ground />
      <Bake>
        <Excavation />
        <Factory />
        <Annex />
        <GensetHouse />
        <TrafoBay />
        <Foundations />
        <LiftPlan />
        <WindTower />
        {SPEC.model === 'zoomlion' && <TowerPlan />}
        {SPEC.model === 'zoomlion' && <BladeStands />}
        {SPEC.model === 'zoomlion' && <JibStrip />}
        {SPEC.crawler && <Refinery />}
        <PowerLine />
        <Surroundings />
      </Bake>
    </group>
  );
}
