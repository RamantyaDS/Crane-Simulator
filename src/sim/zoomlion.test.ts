import { describe, expect, it } from 'vitest';
import { rated, zoomlionKg } from './chart';
import { attachRig, bladeTarget, boomInRotor, create, detachRig, radius, resetHook, setBlock, startEngine, step, tipWorld, type Crane, type LoadState } from './crane';
import { toWorld } from './geom';
import { plan } from './rigging';
import { LOADS, RIGGING, TOWER, TOWER_SPOT } from './site';
import { BLOCKS, SPEC, maxParts, setModel } from './spec';

setModel('zoomlion');

const run = (c: Crane, s: number, each?: (c: Crane) => void) => {
  for (let t = 0; t < s; t += 0.01) {
    each?.(c);
    step(c, 0.01);
    c.msg = '';
  }
};

function setRadius(c: Crane, r: number) {
  let lo = SPEC.angleMin;
  let hi = SPEC.angleMax;
  for (let i = 0; i < 40; i++) {
    c.angle = (lo + hi) / 2;
    if (radius(c) > r) lo = c.angle;
    else hi = c.angle;
  }
}

describe('Zoomlion ZAT40000H763', () => {
  it('estimated chart: from the published load moments, labelled as an estimate', () => {
    const q = { cw: 360, support: 'full' as const, fly: 0, offset: 0, slew: Math.PI / 2 };
    expect(rated({ ...q, length: 19.8, radius: 4 }).kg).toBe(2000000); // 8 000 t·m / 4 m
    expect(rated({ ...q, length: 19.8, radius: 4 }).estimated).toBe(true);
    expect(rated({ ...q, length: 19.8, radius: 4 }).note).toContain('perkiraan');
    expect(rated({ ...q, support: 'tires', length: 19.8, radius: 4 }).kg).toBe(0);
    expect(rated({ ...q, length: 95.4, radius: 32, fly: 111 }).kg).toBe(zoomlionKg(360, 95.4, 32, 111));
    expect(zoomlionKg(360, 95.4, 32, 111)).toBeGreaterThan(180000);
    expect(zoomlionKg(360, 95.4, 32, 111)).toBeLessThan(220000);
  });

  it('lifts the 150 t nacelle with the wind boom and reaches over the 148.5 m tower', () => {
    const c = create();
    expect(c.loads.some((l) => l.def.id === 'nacelle')).toBe(true);
    expect(c.loads.some((l) => l.def.id === 'bigtrafo')).toBe(true);
    Object.assign(c, TOWER_SPOT);
    startEngine(c);
    run(c, 2);
    c.beam = SPEC.outrigger.full.x;
    c.beamSet = 'full';
    c.autoLevel = true;
    run(c, 40);
    c.swingLock = c.swingPark = false;
    c.hook.y = 0.5;
    setBlock(c, 'b5', 8);
    c.length = SPEC.boomMax;
    c.fly = c.flyTarget = 111;
    const n = c.loads.findIndex((l) => l.def.id === 'nacelle');
    c.target = n;
    const L = c.loads[n];
    c.slew = Math.atan2(L.x - c.x, L.z - c.z);
    setRadius(c, Math.hypot(L.x - c.x, L.z - c.z));
    const tip = tipWorld(c);
    const rigH = 8 * Math.cos(Math.asin(4.5 / 8)) + 1.55;
    c.drum = c.length + SPEC.headLen + c.fly + 2 + (tip.y - (L.y + 4.2) - rigH - 0.6 - 0.1) * c.parts;
    resetHook(c);
    attachRig(c, 'sp9h');
    expect(c.rigPlan?.ok).toBe(true);
    run(c, 60, (c) => (c.hoistLever = c.loads[n].state === 'air' ? 0 : 1));
    expect(c.loads[n].state).toBe('air');
    expect(c.failed).toBe('');
    expect(c.pct).toBeGreaterThan(0.6);
    expect(c.pct).toBeLessThan(1);
    // at the tower's radius the estimated chart still holds the nacelle, block and spreader, and the head is high enough
    const rTower = Math.hypot(TOWER.x - c.x, TOWER.z - c.z);
    const atTower = rated({ cw: c.cw, support: 'full', length: c.length, radius: rTower, fly: c.fly, offset: c.flyOffset, slew: -Math.PI / 2 });
    expect(c.hookKg / atTower.kg).toBeGreaterThan(0.8);
    expect(c.hookKg / atTower.kg).toBeLessThan(1);
    c.slew = -Math.PI / 2;
    setRadius(c, rTower);
    expect(tipWorld(c).y).toBeGreaterThan(TOWER.h + 4.2 + rigH + 3);
    expect(LOADS.find((l) => l.id === 'nacelle')!.kg).toBe(150000);
  });

  it('the heaviest block, fully reeved, still lowers the hook from the head of the full boom to the ground', () => {
    const c = create();
    startEngine(c);
    run(c, 3);
    c.hook.y = 0.5;
    const b7 = BLOCKS.find((b) => b.id === 'b7')!;
    setBlock(c, 'b7', maxParts(b7.sheaves));
    expect(c.parts).toBe(maxParts(b7.sheaves));
    c.length = SPEC.boomMax;
    c.angle = 1.3;
    const top = tipWorld(c).y;
    expect((SPEC.ropeTotal - (c.length + SPEC.headLen + 2)) / c.parts).toBeGreaterThan(top);
    c.drum = c.length + SPEC.headLen + 2 + 2 * c.parts;
    run(c, 0.5);
    const y0 = c.hook.y;
    run(c, 30, (c) => {
      c.hoistLever = -1;
      c.highSpeed = true;
    });
    expect(y0 - c.hook.y).toBeGreaterThan(4); // about 12 m/min with 81 parts
  });

  it('bolts the three blades to the hub one at a time, turns the hub between them, then the rotor spins', () => {
    const c = create();
    Object.assign(c, TOWER_SPOT);
    startEngine(c);
    run(c, 2);
    c.beam = SPEC.outrigger.full.x;
    c.beamSet = 'full';
    c.autoLevel = true;
    run(c, 40);
    c.swingLock = c.swingPark = false;
    c.length = SPEC.boomMax;
    c.fly = c.flyTarget = 111;
    const N = c.loads.find((l) => l.def.id === 'nacelle')!;
    Object.assign(N, { x: TOWER.x, z: TOWER.z, y: TOWER.h, yaw: 0, placed: true });
    const yoke = RIGGING.find((r) => r.id === 'yoke')!;
    const blades = c.loads.filter((l) => l.def.bolt);
    expect(blades).toHaveLength(3);
    const hang = (L: LoadState, p: { x: number; y: number; z: number; yaw: number }) => {
      Object.assign(L, p, { state: 'air' });
      const [x, z] = toWorld(p.x, p.z, p.yaw, L.def.cg[0], L.def.cg[2]);
      c.slew = Math.atan2(x - c.x, z - c.z);
      setRadius(c, Math.hypot(x - c.x, z - c.z));
      Object.assign(c.hook, { x, y: p.y + L.def.cg[1], z, vx: 0, vy: 0, vz: 0 });
      c.drum = 9000;
    };
    for (const [k, L] of blades.entries()) {
      expect(plan(L.def, yoke).ok).toBe(true);
      expect(plan(L.def, RIGGING.find((r) => r.id === 'sp4')!).ok).toBe(false);
      const T = bladeTarget(c, L)!;
      c.target = c.attached = c.loads.indexOf(L);
      c.rig = 'yoke';
      c.rigPlan = plan(L.def, yoke);
      // the chart holds blade, yoke and block at the hub with room to spare, and the head is high enough
      const [cx, cz] = toWorld(T.x, T.z, T.yaw, L.def.cg[0], 0);
      const r = Math.hypot(cx - c.x, cz - c.z);
      const kg = rated({ cw: c.cw, support: 'full', length: c.length, radius: r, fly: c.fly, offset: c.flyOffset, slew: c.slew }).kg;
      expect((L.def.kg + yoke.kg + 22000) / kg).toBeLessThan(0.6);
      hang(L, { ...T, x: T.x + 1, yaw: T.yaw + 0.17 });
      expect(tipWorld(c).y).toBeGreaterThan(T.y + 15);
      step(c, 0.01);
      expect(L.placed).toBe(false);
      hang(L, T);
      step(c, 0.01);
      expect(L.placed).toBe(true);
      expect(L.slot).toBe(k);
      // the hub holds it: hoisting up does not lift it off
      run(c, 2, (c) => (c.hoistLever = 1));
      c.hoistLever = 0;
      expect(L.state).toBe('rest');
      detachRig(c);
      expect(c.attached).toBe(-1);
      run(c, 8);
      if (k < 2) expect(c.rotor).toBeCloseTo(((k + 1) * 2 * Math.PI) / 3, 3);
    }
    // the brake stays on while the boom head is in the rotor disc; swing clear and the wind takes it
    expect(boomInRotor(c)).toBe(true);
    expect(c.turbine).toBe(false);
    c.slew += 0.7;
    run(c, 1);
    expect(c.turbine).toBe(true);
    const a = c.rotor;
    run(c, 10);
    expect(c.rotor - a).toBeGreaterThan(1);
    expect(c.failed).toBe('');
  });
});
