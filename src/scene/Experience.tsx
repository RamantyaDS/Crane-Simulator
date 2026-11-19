import { Environment, Lightformer, Sky, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { applyHeld, padLook } from '../input';
import { radius, tipWorld } from '../sim/crane';
import { SPEC } from '../sim/spec';
import { playEvent, updateSound } from '../sound';
import { advance, cr, onEvent, useUI } from '../store';
import { FULL, MAX_DPR, NIGHT, SHADOW } from './Adaptive';
import { CraneModel, craneObj } from './Crane';
import { Fx } from './Fx';
import { CraneLights } from './Lights';
import { Loads } from './Loads';
import { Site } from './Site';
import { SanyModel } from './Sany';
import { ZoomlionModel } from './Zoomlion';

const BIG = SPEC.bigView; // the 4 000 t cranes work up to 200 m: wider camera, shadow and fog ranges

/** Camera look offsets, changed by mouse drags, the wheel and the gamepad's D-pad. */
const look = { yaw: 0.6, pitch: 0.42, dist: BIG ? 75 : 32, cabYaw: 0, cabPitch: -0.05 };
if (import.meta.env.DEV) (globalThis as unknown as { look: typeof look }).look = look;

function Driver() {
  useEffect(() => onEvent(playEvent), []);
  useEffect(() => {
    const id = setInterval(() => useUI.getState().bump(), 120);
    return () => clearInterval(id);
  }, []);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(globalThis, { gl, scene });
  }, [gl, scene]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    applyHeld(Math.min(dt, 0.05));
    advance(dt);
    updateSound(camera.position.distanceTo(tmp.set(cr.x, 3, cr.z)), useUI.getState().cam === 'cab');
  });
  return null;
}

function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    // the shadow camera follows whatever matters: the crane, or the hook when it is far out
    const l = light.current!;
    const fx = (cr.x + cr.hook.x) / 2;
    const fz = (cr.z + cr.hook.z) / 2;
    l.position.set(fx + (BIG ? 120 : 40), BIG ? 180 : 60, fz + (BIG ? 75 : 25));
    l.target.position.set(fx, 0, fz);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      intensity={NIGHT ? 0.5 : 3.0}
      color={NIGHT ? '#9db4e0' : '#fff1da'}
      castShadow
      shadow-mapSize={[SHADOW, SHADOW]}
      shadow-camera-left={BIG ? -80 : -40}
      shadow-camera-right={BIG ? 80 : 40}
      shadow-camera-top={BIG ? 80 : 40}
      shadow-camera-bottom={BIG ? -80 : -40}
      shadow-camera-far={BIG ? 500 : 200}
      shadow-bias={-0.0004}
      shadow-normalBias={0.04}
    />
  );
}

/** Radius circle on the ground around the swing centre, coloured by the RCL load. */
function RadiusRing() {
  const mode = useUI((s) => s.mode);
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#2fd27a', transparent: true, opacity: 0.7, depthWrite: false }), []);
  useFrame(() => {
    const m = ref.current!;
    m.visible = mode === 'crane' && !cr.failed;
    const r = radius(cr);
    m.position.set(cr.x, 0.06, cr.z);
    m.scale.setScalar(Math.max(0.5, r));
    mat.color.set(cr.pct >= 1 ? '#ff3b2f' : cr.pct > 0.9 ? '#ffc21a' : '#2fd27a');
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
      <ringGeometry args={[0.985, 1.0, 96]} />
    </mesh>
  );
}

function CameraRig() {
  const cam = useUI((s) => s.cam);
  const mode = useUI((s) => s.mode);
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const gl = useThree((s) => s.gl);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), t: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler() }), []);

  useEffect(() => {
    const el = gl.domElement;
    let down = false;
    const dn = (e: PointerEvent) => {
      down = true;
      el.setPointerCapture?.(e.pointerId);
    };
    const up = () => (down = false);
    const mv = (e: PointerEvent) => {
      if (!down) return;
      if (cam === 'cab' || cam === 'hook') {
        look.cabYaw = Math.max(-2.6, Math.min(2.6, look.cabYaw - e.movementX * 0.004));
        look.cabPitch = Math.max(-1.3, Math.min(0.9, look.cabPitch - e.movementY * 0.004));
      } else {
        look.yaw -= e.movementX * 0.005;
        look.pitch = Math.max(0.03, Math.min(1.45, look.pitch + e.movementY * 0.004));
      }
    };
    const wheel = (e: WheelEvent) => (look.dist = Math.max(8, Math.min(BIG ? 360 : 140, look.dist * (1 + Math.sign(e.deltaY) * 0.1))));
    el.addEventListener('pointerdown', dn);
    addEventListener('pointerup', up);
    el.addEventListener('pointermove', mv);
    el.addEventListener('wheel', wheel, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', dn);
      removeEventListener('pointerup', up);
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('wheel', wheel);
    };
  }, [cam, gl]);

  useEffect(() => {
    camera.fov = cam === 'cab' ? 70 : cam === 'hook' ? 65 : 50;
    camera.updateProjectionMatrix();
    look.cabYaw = 0;
    look.cabPitch = cam === 'hook' ? -1.2 : -0.05;
  }, [cam, camera]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    look.yaw -= padLook.x * dt * 1.5;
    look.pitch = Math.max(0.03, Math.min(1.45, look.pitch + padLook.y * dt));
    if (cam === 'cab' && craneObj.upper) {
      craneObj.upper.updateWorldMatrix(true, false);
      tmp.v.set(...(SPEC.cabEye as [number, number, number]));
      craneObj.upper.localToWorld(tmp.v);
      camera.position.copy(tmp.v);
      craneObj.upper.getWorldQuaternion(tmp.q);
      // operators look up at the hook: aim the base view at the boom head's height
      const tip = tipWorld(cr);
      const up = Math.atan2(tip.y - tmp.v.y, Math.max(3, radius(cr)));
      camera.quaternion.copy(tmp.q).multiply(new THREE.Quaternion().setFromEuler(tmp.e.set(look.cabPitch + up * 0.7, look.cabYaw + Math.PI, 0, 'YXZ')));
      return;
    }
    if (cam === 'hook' && craneObj.head) {
      const tip = tipWorld(cr);
      camera.position.set(tip.x, tip.y - 0.8, tip.z);
      tmp.q.setFromEuler(tmp.e.set(look.cabPitch, cr.heading + cr.slew + Math.PI + look.cabYaw, 0, 'YXZ'));
      camera.quaternion.copy(tmp.q);
      return;
    }
    // orbiting views look at the crane, or between the crane and the hook when working
    const focus = tmp.t;
    if (mode === 'crane') focus.set((cr.x * 2 + cr.hook.x) / 3, Math.min(BIG ? 90 : 12, cr.hook.y * 0.5 + 3), (cr.z * 2 + cr.hook.z) / 3);
    else focus.set(cr.x, 3, cr.z);
    let want: THREE.Vector3;
    if (cam === 'top') want = tmp.v.set(focus.x + 0.01, focus.y + look.dist * 1.8 + 20, focus.z + 0.01);
    else if (cam === 'rigger') {
      // a rigger standing by the load, 14 m off, looking at the hook
      const L = cr.loads[cr.attached >= 0 ? cr.attached : cr.target];
      focus.set(cr.hook.x, Math.max(1.5, cr.hook.y - 1), cr.hook.z);
      const a = look.yaw;
      want = tmp.v.set(L.x + Math.sin(a) * 14, 1.7, L.z + Math.cos(a) * 14);
    } else {
      const a = cr.heading + Math.PI + look.yaw;
      const h = Math.cos(look.pitch) * look.dist;
      want = tmp.v.set(focus.x + Math.sin(a) * h, focus.y + Math.sin(look.pitch) * look.dist, focus.z + Math.cos(a) * h);
    }
    camera.position.lerp(want, cam === 'rigger' ? 1 : 1 - Math.exp(-dt * 4));
    if (camera.position.y < 1.2) camera.position.y = 1.2;
    camera.lookAt(focus);
  });
  return null;
}

export function Experience() {
  return (
    <Canvas shadows dpr={[1, MAX_DPR]} camera={{ position: [50, 30, -80], fov: 50, near: 0.2, far: 1200 }} gl={{ antialias: true }}>
      <color attach="background" args={[NIGHT ? '#070c16' : '#bcd3e6']} />
      <fog attach="fog" args={[NIGHT ? '#0a111d' : '#c7d4dd', BIG ? 220 : 120, BIG ? 900 : 520]} />
      {NIGHT ? (
        <Stars radius={700} depth={80} count={2500} factor={5} saturation={0} fade speed={0.3} />
      ) : (
        <Sky sunPosition={[40, 26, 25]} turbidity={3.5} rayleigh={0.9} mieCoefficient={0.004} mieDirectionalG={0.8} />
      )}
      <hemisphereLight args={NIGHT ? ['#4a5f8c', '#1c1914', 0.6] : ['#dbe9ff', '#6b5f4c', 0.85]} />
      <Sun />
      <Environment resolution={128} frames={1} environmentIntensity={NIGHT ? 0.12 : 0.7}>
        <Lightformer form="rect" intensity={1.6} color="#dceaf7" scale={[80, 30, 1]} position={[0, 25, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={1.0} color="#bfd3e6" scale={[60, 8, 1]} position={[0, 5, -40]} />
        <Lightformer form="circle" intensity={6} color="#fff0d6" scale={8} position={[40, 26, 25]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.35} color="#6b6458" scale={[120, 120, 1]} position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      </Environment>
      <Site />
      <Loads />
      {SPEC.crawler ? <SanyModel /> : BIG ? <ZoomlionModel /> : <CraneModel />}
      <CraneLights />
      <RadiusRing />
      <Fx />
      <CameraRig />
      <Driver />
      {FULL ? (
        <EffectComposer>
          <N8AO aoRadius={1.4} intensity={2} distanceFalloff={0.6} halfRes quality="performance" aoSamples={10} denoiseSamples={4} />
          <Bloom mipmapBlur luminanceThreshold={1.15} intensity={0.35} />
        </EffectComposer>
      ) : (
        <></>
      )}
    </Canvas>
  );
}
