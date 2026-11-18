import { describe, expect, it } from 'vitest';
import { rated } from './chart';
import { attachRig, create, radius, resetHook, startEngine, step, tipWorld, type Crane } from './crane';
import { SANY_SPOT } from './site';
import { SPEC, setModel } from './spec';

setModel('sany');

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

/** Move slew and radius to a target over time (as the operator would), the hook following. */
function moveTo(c: Crane, slew: number, r: number, s = 60) {
  const s0 = c.slew;
  const a0 = c.angle;
  setRadius(c, r);
  const a1 = c.angle;
  c.angle = a0;
  const n = Math.round(s / 0.01);
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    c.slew = s0 + (slew - s0) * k;
    c.angle = a0 + (a1 - a0) * k;
    step(c, 0.01);
    c.msg = '';
  }
  run(c, 20); // let the swing settle
}

describe('SANY SCC45000A', () => {
  it('estimated chart: 4 500 t double boom at short radius, falling with radius; walking with a load a third', () => {
    const q = { cw: 3000, support: 'full' as const, length: 96, fly: 0, offset: 0, slew: 0 };
    expect(rated({ ...q, radius: 20 }).kg).toBe(4500000);
    expect(rated({ ...q, radius: 30 }).kg).toBeGreaterThan(3500000);
    expect(rated({ ...q, radius: 60 }).kg).toBeLessThan(2000000);
    expect(rated({ ...q, radius: 30, creep: true }).kg).toBeLessThan(rated({ ...q, radius: 30 }).kg * 0.4);
    expect(rated({ ...q, radius: 30 }).estimated).toBe(true);
  });

  it('stands on its crawlers, does not tip back empty, walks and turns on the spot', () => {
    const c = create();
    startEngine(c);
    run(c, 3);
    expect(c.onTyres).toBe(false);
    expect(c.failed).toBe('');
    c.park = false;
    c.dir = 'F';
    const z0 = c.z;
    run(c, 20, (c) => (c.pedal = 1));
    expect(c.z - z0).toBeGreaterThan(5);
    const h0 = c.heading;
    run(c, 10, (c) => {
      c.pedal = 0;
      c.steerInput = 1;
    });
    expect(Math.abs(c.heading - h0)).toBeGreaterThan(0.2);
    expect(c.failed).toBe('');
  });

  it('upends the 3 000 t reactor, lifts it off the tailing trolley and sets it on its foundation', () => {
    const c = create();
    Object.assign(c, SANY_SPOT);
    startEngine(c);
    run(c, 3);
    const n = c.loads.findIndex((l) => l.def.id === 'reactor');
    const R = c.loads[n];
    c.target = n;
    // over the lying top trunnions
    const top = { x: R.x + Math.sin(R.yaw) * 39, z: R.z + Math.cos(R.yaw) * 39 };
    c.slew = Math.atan2(top.x - c.x, top.z - c.z) - c.heading;
    setRadius(c, Math.hypot(top.x - c.x, top.z - c.z));
    run(c, 1);
    const tip = tipWorld(c);
    c.drum = c.length + SPEC.headLen + 2 + (tip.y - (R.y + 10.5) - 2) * c.parts;
    resetHook(c);
    run(c, 3);
    attachRig(c, 'lbeam7');
    expect(c.rigPlan?.ok).toBe(true);
    expect(c.attached).toBe(n);
    // hoist: it stands up
    run(c, 400, (c) => (c.hoistLever = (R.up ?? 1) < 1 || R.state !== 'air' ? 1 : 0));
    expect(c.failed).toBe('');
    expect(R.up).toBe(1);
    expect(R.state).toBe('air');
    expect(c.pct).toBeLessThan(1);
    // raise it clear, swing to the foundation and set it down
    run(c, 30, (c) => (c.hoistLever = R.y < 3.5 ? 1 : 0));
    c.hoistLever = 0;
    const d = R.def.dest;
    moveTo(c, Math.atan2(d.x - c.x, d.z - c.z) - c.heading, Math.hypot(d.x - c.x, d.z - c.z), 90);
    expect(c.failed).toBe('');
    run(c, 200, (c) => (c.hoistLever = R.state === 'air' ? -0.3 : 0));
    expect(R.placed).toBe(true);
    expect(c.failed).toBe('');
  });
});
