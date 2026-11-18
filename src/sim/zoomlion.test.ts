import { describe, expect, it } from 'vitest';
import { rated, zoomlionKg } from './chart';
import { attachRig, create, radius, resetHook, setBlock, startEngine, step, tipWorld, type Crane } from './crane';
import { LOADS, TOWER, TOWER_SPOT } from './site';
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
});
