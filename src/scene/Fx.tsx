// Particles: the exhaust stack (black when the engine works hard), dust off the tyres, dust when a load lands or
// something heavy falls, dirt where a pad sinks. One point cloud, fixed size, a soft round sprite.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { pads } from '../sim/crane';
import { SPEC } from '../sim/spec';
import { cr, onEvent } from '../store';
import { craneObj } from './Crane';

const vert = /* glsl */ `
  attribute float size; attribute float alpha; attribute vec3 tint;
  uniform float scale;
  varying float vA; varying vec3 vC;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(220.0, size * scale / -mv.z);
    gl_Position = projectionMatrix * mv;
    vA = alpha; vC = tint;
  }`;
const frag = /* glsl */ `
  varying float vA; varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vC, a);
  }`;

interface P {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  life: number;
  s0: number;
  s1: number;
  a: number;
  c: THREE.Color;
  rise: number;
}

const N = 500;
const rnd = (a: number) => (Math.random() - 0.5) * a;

export function Fx() {
  const { geo, mat, parts } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    for (const [k, w] of [
      ['position', 3],
      ['size', 1],
      ['alpha', 1],
      ['tint', 3],
    ] as const)
      geo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(N * w), w));
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, uniforms: { scale: { value: 800 } } });
    const parts: P[] = Array.from({ length: N }, () => ({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), age: 9, life: 1, s0: 0.2, s1: 1, a: 0, c: new THREE.Color(), rise: 0 }));
    return { geo, mat, parts };
  }, []);
  const st = useMemo(() => ({ next: 0, ex: 0, dust: 0, lastRpm: 0, soot: 0, a: new THREE.Vector3(), v: new THREE.Vector3() }), []);
  const emit = (at: THREE.Vector3, v: THREE.Vector3, o: { life: number; s0: number; s1: number; a: number; color: string; rise?: number }) => {
    const p = parts[st.next];
    st.next = (st.next + 1) % N;
    p.p.copy(at);
    p.v.copy(v);
    p.age = 0;
    p.life = o.life;
    p.s0 = o.s0;
    p.s1 = o.s1;
    p.a = o.a;
    p.c.set(o.color);
    p.rise = o.rise ?? 0;
  };

  useEffect(
    () =>
      onEvent((e) => {
        const { a, v } = st;
        if (e === 'running') st.soot = 1;
        if (e === 'setdown' || e === 'liftoff') {
          const L = cr.loads[cr.attached >= 0 ? cr.attached : cr.target];
          for (let i = 0; i < 36; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r = Math.max(L.def.size[0], L.def.size[2]) * 0.55;
            a.set(L.x + Math.cos(ang) * r, L.y + 0.05, L.z + Math.sin(ang) * r);
            emit(a, v.set(Math.cos(ang) * 1.2, 0.2, Math.sin(ang) * 1.2), { life: 1.8, s0: 0.4, s1: 1.8, a: e === 'setdown' ? 0.25 : 0.12, color: '#b4a68d' });
          }
        } else if (e === 'crash' || e === 'tipover' || e === 'boomFail') {
          const src = cr.attached >= 0 ? cr.loads[cr.attached] : null;
          for (let i = 0; i < 120; i++) {
            a.set((src ? src.x : cr.hook.x) + rnd(8), 0.3, (src ? src.z : cr.hook.z) + rnd(8));
            emit(a, v.set(rnd(5), 0.8 + Math.random() * 3, rnd(5)), { life: 4, s0: 0.8, s1: 6, a: 0.4, color: '#a5977f' });
          }
        } else if (e === 'sink') {
          const P = pads(cr);
          for (let i = 0; i < 4; i++) {
            a.set(P[i][0], 0.1, P[i][1]);
            craneObj.carrier?.parent?.localToWorld(a);
            for (let k = 0; k < 10; k++) emit(a, v.set(rnd(1), 0.3, rnd(1)), { life: 1.4, s0: 0.3, s1: 1.2, a: 0.3, color: '#6b5236' });
          }
        }
      }),
    [st],
  );

  useFrame(({ camera, size }, raw) => {
    const dt = Math.min(raw, 0.05);
    mat.uniforms.scale.value = (size.height / 2) * (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5];
    const { a, v } = st;
    // exhaust: a puff when the engine is revved, soot when it works hard, light haze at idle
    if (cr.engine === 'running' && craneObj.carrier) {
      const rise = (cr.rpm - st.lastRpm) / Math.max(dt, 1e-3);
      if (rise > 700) st.soot = Math.min(1, st.soot + dt * 4);
      st.soot = Math.max(0, st.soot - dt * 0.7);
      st.ex += (20 + 40 * cr.load + 50 * st.soot) * dt;
      while (st.ex > 1) {
        st.ex -= 1;
        a.set(-1.1, SPEC.deckY + 2.05, -SPEC.carrierLen / 2 + 1.6);
        craneObj.carrier.localToWorld(a);
        const dark = Math.min(1, st.soot + Math.max(0, cr.load - 0.6) * 2);
        emit(a, v.set(rnd(0.5), 1.6 + 1.6 * (cr.rpm / 2100), rnd(0.5)), { life: 3, s0: 0.25, s1: 2.2, a: 0.07 + 0.38 * dark, color: dark > 0.3 ? '#3a3632' : '#b9b7b2', rise: 0.3 });
      }
    }
    st.lastRpm = cr.rpm;
    // tyre dust
    const sp = Math.abs(cr.v);
    st.dust += (sp > 1 ? sp * 2 : 0) * dt;
    while (st.dust > 1 && craneObj.carrier) {
      st.dust -= 1;
      a.set((Math.random() < 0.5 ? -1 : 1) * 1.2, 0.1, SPEC.axles[Math.floor(Math.random() * 3)]);
      craneObj.carrier.localToWorld(a);
      a.y = 0.1;
      emit(a, v.set(rnd(0.8) - Math.sin(cr.heading) * sp * 0.2, 0.3 + Math.random() * 0.4, rnd(0.8) - Math.cos(cr.heading) * sp * 0.2), { life: 2, s0: 0.5, s1: 2.4, a: 0.14, color: '#b9ab92' });
    }
    // integrate
    const pos = geo.attributes.position.array as Float32Array;
    const sz = geo.attributes.size.array as Float32Array;
    const al = geo.attributes.alpha.array as Float32Array;
    const ti = geo.attributes.tint.array as Float32Array;
    parts.forEach((p, i) => {
      if (p.age < p.life) {
        p.age += dt;
        p.v.multiplyScalar(1 - dt * 1.3);
        p.v.y += p.rise * dt;
        p.v.x += 0.4 * dt; // drift with the breeze
        p.p.addScaledVector(p.v, dt);
      }
      const t = Math.min(1, p.age / p.life);
      pos[i * 3] = p.p.x;
      pos[i * 3 + 1] = p.p.y;
      pos[i * 3 + 2] = p.p.z;
      sz[i] = p.s0 + (p.s1 - p.s0) * t;
      al[i] = t >= 1 ? 0 : p.a * (1 - t) * Math.min(1, p.age * 12);
      ti[i * 3] = p.c.r;
      ti[i * 3 + 1] = p.c.g;
      ti[i * 3 + 2] = p.c.b;
    });
    for (const k of ['position', 'size', 'alpha', 'tint']) geo.attributes[k].needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
