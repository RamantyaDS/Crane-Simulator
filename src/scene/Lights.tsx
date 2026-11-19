// Warning and work lights on the crane: amber rotating beacons, white xenon strobes, red aviation (obstruction)
// lights on the boom head and the high points, amber travel flashers while the crane walks or swings, the RCL's
// external green / amber / red lamps on the cab roof, and white flood lights. Every lamp of one kind shares one
// material, animated once a frame; an additive glow sprite makes it read from far off (bloom only in full mode).
// At night two spot lights from the boom head and the front of the house really light the hook and the ground.
import { createPortal, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { tipWorld } from '../sim/crane';
import { SPEC } from '../sim/spec';
import { cr } from '../store';
import { NIGHT } from './Adaptive';
import { craneObj } from './Crane';
import { mastTop } from './Sany';

type Kind = 'beacon' | 'strobe' | 'avi' | 'travel' | 'flood' | 'green' | 'amber' | 'red';
type Lamp = [Kind, number, number, number];

const COL: Record<Kind, string> = {
  beacon: '#ffa01a',
  strobe: '#f4f8ff',
  avi: '#ff2a14',
  travel: '#ffa01a',
  flood: '#fff2d8',
  green: '#28ff64',
  amber: '#ffc21a',
  red: '#ff2a14',
};

/** Brightness 0…1 of each kind at time t (s). */
function level(k: Kind, t: number) {
  const on = cr.engine === 'running' && !cr.failed;
  switch (k) {
    case 'avi': {
      // obstruction light: steady red with a brighter flash every 2 s, on whenever the crane is up (battery backed)
      const f = (t % 2) / 2;
      return 0.45 + (f < 0.3 ? 0.55 * Math.sin((f / 0.3) * Math.PI) : 0);
    }
    case 'beacon':
      return on ? Math.pow(Math.max(0, Math.cos(t * Math.PI * 2 * 1.4)), 6) : 0;
    case 'strobe': {
      const f = t % 1.3;
      return on && (f < 0.05 || (f > 0.14 && f < 0.19)) ? 1 : 0;
    }
    case 'travel':
      return on && (Math.abs(cr.v) > 0.05 || Math.abs(cr.slewV) > 0.004) && t % 0.7 < 0.35 ? 1 : 0;
    case 'flood':
      return on ? 1 : 0;
    case 'green':
      return on && cr.pct < 0.9 ? 1 : 0;
    case 'amber':
      return on && cr.pct >= 0.9 && cr.pct < 1 ? 1 : 0;
    case 'red':
      return on && cr.pct >= 1 && t % 0.5 < 0.25 ? 1 : 0;
  }
}

const S = SPEC.crawler ? 2.2 : SPEC.bigView ? 1.6 : 1; // lamp size by crane size

// lamp positions: upper (revolving) frame and carrier frame, x right… +z towards the boom
const SANY_CAB = SPEC.twin ? 9.2 : 5.2;
const UPPER: Record<string, Lamp[]> = {
  sany: [
    ['beacon', SANY_CAB + 0.7, 9.1, 2.4],
    ['beacon', -5.0, 10.6, -3.3],
    ['beacon', 3.4, 10.6, -3.3],
    ['strobe', -0.8, 10.6, -13.8],
    ['green', SANY_CAB - 0.8, 8.95, 4.9],
    ['amber', SANY_CAB - 0.4, 8.95, 4.9],
    ['red', SANY_CAB, 8.95, 4.9],
    ['flood', -5.5, 6.3, 4.7],
    ['flood', 5.5, 6.3, 4.7],
    ['travel', -8.5, 10.2, SPEC.cwArm],
    ['travel', 8.5, 10.2, SPEC.cwArm],
    ['strobe', 0, 10.2, SPEC.cwArm - 0.8],
  ],
  zoomlion: [
    ['beacon', 2.15, 5.15, 1.2],
    ['green', 1.85, 5.05, 2.4],
    ['amber', 2.15, 5.05, 2.4],
    ['red', 2.45, 5.05, 2.4],
    ['beacon', -1.6, 5.4, -4.2],
    ['strobe', 0, 5.4, -6.0],
    ['flood', 2.15, 4.6, 2.7],
  ],
  linkbelt: [
    ['beacon', 1.15, 4.55, 1.0],
    ['green', 0.95, 4.45, 2.0],
    ['amber', 1.15, 4.45, 2.0],
    ['red', 1.35, 4.45, 2.0],
    ['strobe', -0.9, 3.75, -3.6],
    ['flood', 1.15, 4.2, 2.3],
  ],
};
UPPER.sany1 = UPPER.sany;
const CARRIER: Record<string, Lamp[]> = {
  sany: [-1, 1].flatMap((x) => [-1, 1].map((z): Lamp => ['travel', x * 9.0, 3.2, z * 9.3])),
  zoomlion: [
    ['beacon', -0.9, 3.85, 10.6],
    ['beacon', 0.9, 3.85, 10.6],
    ...[-1, 1].flatMap((x) => [-1, 1].map((z): Lamp => ['travel', x * 1.35, 1.7, z * 11.2])),
  ],
  linkbelt: [-1, 1].flatMap((x) => [-1, 1].map((z): Lamp => ['travel', x * 1.35, 1.65, z * 5.5])),
};
CARRIER.sany1 = CARRIER.sany;

function useGlow() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.15, 'rgba(255,255,255,0.8)');
    r.addColorStop(0.4, 'rgba(255,255,255,0.18)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

type Mats = Record<Kind, { lens: THREE.MeshBasicMaterial; glow: THREE.SpriteMaterial; base: THREE.Color }>;

function useMats(): Mats {
  const glow = useGlow();
  const mats = useMemo(() => {
    const o = {} as Mats;
    for (const k of Object.keys(COL) as Kind[]) {
      const base = new THREE.Color(COL[k]);
      o[k] = {
        base,
        lens: new THREE.MeshBasicMaterial({ color: base.clone(), toneMapped: false }),
        glow: new THREE.SpriteMaterial({ map: glow, color: base.clone(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false }),
      };
    }
    return o;
  }, [glow]);
  useFrame(() => {
    for (const k of Object.keys(mats) as Kind[]) {
      const v = level(k, cr.time);
      const m = mats[k];
      m.lens.color.copy(m.base).multiplyScalar(0.1 + v * 2.4); // above the bloom threshold when lit
      m.glow.opacity = v * (NIGHT ? 1 : 0.8);
    }
  });
  return mats;
}

const LENS = new THREE.SphereGeometry(1, 12, 8);
const GLOW_SIZE: Record<Kind, number> = { beacon: 2.2, strobe: 3.6, avi: 3.0, travel: 1.4, flood: 2.6, green: 0.9, amber: 0.9, red: 1.1 };

function LampMesh({ k, p, mats, size = 1 }: { k: Kind; p: [number, number, number]; mats: Mats; size?: number }) {
  const r = 0.09 * S * size;
  return (
    <group position={p}>
      <mesh geometry={LENS} material={mats[k].lens} scale={k === 'flood' ? [r * 2.4, r * 1.8, r * 0.6] : r} />
      <sprite material={mats[k].glow} scale={GLOW_SIZE[k] * S * size} />
    </group>
  );
}

/** Red obstruction lights at the boom head (or jib tip), half way up the boom and on the superlift mast top. */
function Aviation({ mats }: { mats: Mats }) {
  const tip = useRef<THREE.Group>(null);
  const mid = useRef<THREE.Group[]>([]);
  const sides = SPEC.twin ? [-1, 1] : [0];
  useFrame(() => {
    const t = tipWorld(cr);
    tip.current!.position.set(t.x, t.y + 1.2 * S, t.z);
    tip.current!.visible = !cr.failed;
    // half way along the main boom, on its top chords (upper frame → world via the revolving frame)
    const u = craneObj.upper;
    const L = cr.length + SPEC.headLen;
    const a = cr.angle;
    const off = SPEC.crawler ? 2.4 : 1.0;
    sides.forEach((s, i) => {
      const g = mid.current[i];
      if (!g || !u) return;
      g.position.set(s * 4.5, SPEC.pin.y + 0.5 * L * Math.sin(a) + off * Math.cos(a), SPEC.pin.z + 0.5 * L * Math.cos(a) - off * Math.sin(a));
      u.updateWorldMatrix(true, false);
      g.position.applyMatrix4(u.matrixWorld);
      g.visible = L > 40 && !cr.failed;
    });
  });
  return (
    <>
      <group ref={tip}>
        <LampMesh k="avi" p={[0, 0, 0]} mats={mats} size={1.3} />
      </group>
      {sides.map((s, i) => (
        <group key={s} ref={(g) => g && (mid.current[i] = g)}>
          <LampMesh k="avi" p={[0, 0, 0]} mats={mats} />
        </group>
      ))}
    </>
  );
}

/** Night: real spot lights. One from the boom head down onto the hook, one from the house front over the work area. */
function Floods() {
  const hook = useRef<THREE.SpotLight>(null);
  const work = useRef<THREE.SpotLight>(null);
  const tgt = useMemo(() => [new THREE.Object3D(), new THREE.Object3D()], []);
  useFrame(() => {
    const on = cr.engine === 'running' && !cr.failed;
    const t = tipWorld(cr);
    const h = hook.current!;
    h.visible = on;
    h.position.set(t.x, t.y - 1, t.z);
    tgt[0].position.set(cr.hook.x, Math.max(0, cr.hook.y - 30), cr.hook.z);
    tgt[0].updateMatrixWorld();
    const u = craneObj.upper;
    const w = work.current!;
    w.visible = on && !!u;
    if (u) {
      u.updateWorldMatrix(true, false);
      w.position.set(0, SPEC.crawler ? 11 : 5, SPEC.crawler ? 5 : 2).applyMatrix4(u.matrixWorld);
      tgt[1].position.set(0, 0, SPEC.crawler ? 40 : 18).applyMatrix4(u.matrixWorld);
      tgt[1].position.y = 0;
      tgt[1].updateMatrixWorld();
    }
  });
  const reach = SPEC.crawler || SPEC.bigView ? 260 : 90;
  return (
    <>
      <primitive object={tgt[0]} />
      <primitive object={tgt[1]} />
      <spotLight ref={hook} target={tgt[0]} color="#fff1dc" intensity={SPEC.crawler || SPEC.bigView ? 60000 : 9000} distance={reach} angle={0.32} penumbra={0.6} decay={2} />
      <spotLight ref={work} target={tgt[1]} color="#fff1dc" intensity={SPEC.crawler || SPEC.bigView ? 30000 : 3500} distance={reach * 0.6} angle={0.85} penumbra={0.7} decay={2} />
    </>
  );
}

export function CraneLights() {
  const mats = useMats();
  // the lamps ride on the revolving frame and the carrier: portal them in once the model has registered its groups
  const [objs, setObjs] = useState<{ upper: THREE.Object3D | null; carrier: THREE.Object3D | null }>({ upper: null, carrier: null });
  useFrame(() => {
    if (craneObj.upper !== objs.upper || craneObj.carrier !== objs.carrier) setObjs({ upper: craneObj.upper, carrier: craneObj.carrier });
  });
  const up = UPPER[SPEC.model] ?? [];
  const ca = CARRIER[SPEC.model] ?? [];
  const extra: Lamp[] = SPEC.crawler ? [['avi', mastTop(0).x, mastTop(0).y + 1.6, mastTop(0).z]] : [];
  return (
    <>
      {objs.upper &&
        createPortal(
          <group userData={{ noBake: true }}>
            {[...up, ...extra].map(([k, x, y, z], i) => (
              <LampMesh key={i} k={k} p={[x, y, z]} mats={mats} />
            ))}
          </group>,
          objs.upper,
        )}
      {objs.carrier &&
        createPortal(
          <group userData={{ noBake: true }}>
            {ca.map(([k, x, y, z], i) => (
              <LampMesh key={i} k={k} p={[x, y, z]} mats={mats} />
            ))}
          </group>,
          objs.carrier,
        )}
      <Aviation mats={mats} />
      {NIGHT && <Floods />}
    </>
  );
}
