import { describe, expect, it } from 'vitest';
import { rated } from './chart';
import { EMBED } from '../embed';
import { attachRig, create, detachRig, hangLen, lockBoom, radius, resetHook, setBlock, setDir, startEngine, step, tipWorld, type Crane } from './crane';
import { plan } from './rigging';
import { LOADS, PRESS_SPOT, RIGGING, surfaceAt } from './site';
import { SPEC } from './spec';

const run = (c: Crane, s: number, each?: (c: Crane) => void) => {
  for (let t = 0; t < s; t += 0.01) {
    each?.(c);
    step(c, 0.01);
    c.msg = '';
  }
};

function ready(at = { x: 0, z: -50, heading: 0 }) {
  const c = create();
  Object.assign(c, at);
  startEngine(c);
  run(c, 2);
  c.park = false;
  resetHook(c);
  return c;
}

function onOutriggers(c: Crane, cw = 26.7) {
  c.cw = c.cwTarget = cw;
  c.beam = SPEC.outrigger.full.x;
  c.beamSet = 'full';
  c.autoLevel = true;
  run(c, 25);
  c.swingLock = false;
  c.swingPark = false;
}

function setRadius(c: Crane, len: number, r: number) {
  c.length = len;
  let lo = SPEC.angleMin;
  let hi = SPEC.angleMax;
  for (let i = 0; i < 40; i++) {
    c.angle = (lo + hi) / 2;
    if (radius(c) > r) lo = c.angle;
    else hi = c.angle;
  }
}

describe('Link-Belt chart', () => {
  it('reads the 85% metric charts', () => {
    const q = { cw: 26.7, support: 'full' as const, fly: 0, offset: 2, slew: Math.PI / 2 };
    expect(rated({ ...q, length: 12.88, radius: 2.5 }).kg).toBe(127000);
    expect(rated({ ...q, length: 12.88, radius: 2.1, slew: 0 }).kg).toBe(145000); // over front only
    expect(rated({ ...q, length: 12.88, radius: 3.4 }).kg).toBe(106650); // next larger row: 3.5 m
    expect(rated({ ...q, length: 59.5, radius: 20 }).kg).toBe(7700);
    expect(rated({ ...q, length: 59.5, radius: 40 }).kg).toBe(3600);
    expect(rated({ ...q, cw: 15.9, length: 59.5, radius: 40 }).kg).toBe(2400);
    expect(rated({ ...q, length: 30, radius: 10 }).kg).toBe(0); // between pin positions
    expect(rated({ ...q, length: 59.5, radius: 32, fly: 16.8, offset: 2 }).kg).toBe(3750);
    expect(rated({ ...q, support: 'tires', length: 12.88, radius: 3, slew: Math.PI }).kg).toBe(41700);
    expect(rated({ ...q, support: 'tires', length: 12.88, radius: 3, slew: Math.PI / 2 }).kg).toBe(0);
  });
});

describe('RTC-80160 crane', () => {
  it('sets up on outriggers level with the tyres clear', () => {
    const c = ready();
    onOutriggers(c);
    expect(c.onTyres).toBe(false);
    expect(Math.abs(c.pitch) + Math.abs(c.roll)).toBeLessThan(0.002);
  });

  it('tipping load is 1.05–1.6 × the chart where stability governs (chart = 85 % of tipping)', () => {
    const c = ready();
    onOutriggers(c, 15.9);
    c.slew = Math.PI / 2;
    for (const [len, r, chart] of [
      [59.5, 40, 2400],
      [48.8, 32, 4400],
      [39.49, 28, 5450],
    ] as const) {
      setRadius(c, len, r);
      resetHook(c);
      run(c, 0.05);
      const k = c.tipLoadKg / chart;
      expect(k).toBeGreaterThan(1.05);
      expect(k).toBeLessThan(1.6);
    }
  });

  it('the hook load swings as a pendulum of the rope length', () => {
    const c = ready();
    onOutriggers(c);
    setRadius(c, 25.9, 10);
    c.drum = c.length + SPEC.headLen + 2 + 8 * c.parts; // hook 8 m under the head
    resetHook(c);
    const L = c.ropeLen;
    c.hook.vx = 0.6; // nudge it
    const rest = tipWorld(c).x;
    let last = c.hook.x;
    let crossings = 0;
    let t0 = 0;
    let t1 = 0;
    for (let t = 0; t < 30; t += 0.005) {
      step(c, 0.005);
      const x = c.hook.x;
      if (t > 0.05 && Math.sign(x - rest) !== Math.sign(last - rest)) {
        crossings++;
        if (crossings === 1) t0 = t;
        if (crossings === 5) t1 = t;
      }
      last = x;
    }
    const period = (t1 - t0) / 2;
    expect(period).toBeGreaterThan(2 * Math.PI * Math.sqrt(L / 9.81) * 0.9);
    expect(period).toBeLessThan(2 * Math.PI * Math.sqrt(L / 9.81) * 1.1);
  });

  it('lock boom: telescopes to a pin position and latches (the chart applies again)', () => {
    const c = ready();
    onOutriggers(c);
    c.angle = 0.35; // clear of the loads in the laydown yard ahead (the boom cannot pass through them)
    c.length = 29.2; // between pins: no rating
    c.drum += 20 * c.parts;
    lockBoom(c);
    run(c, 15);
    expect(c.length).toBe(30.5);
    lockBoom(c, 1);
    run(c, 30);
    expect(c.length).toBe(35.1);
  });

  it('two-block switch stops the hook short of the boom head', () => {
    const c = ready();
    onOutriggers(c);
    setRadius(c, 25.9, 10);
    c.drum = c.length + SPEC.headLen + 2 + 6 * c.parts; // hook 6 m under the head
    resetHook(c);
    run(c, 60, (c) => (c.hoistLever = 1));
    expect(c.twoBlock).toBe(true);
    expect(hangLen(c)).toBeGreaterThan(0.9);
  });

  it('lifts the 100 t main transformer at 3.4 m radius at about 98 % of the chart, and the RCL locks boom-down', () => {
    const c = ready({ ...PRESS_SPOT });
    c.mats = true; // 104 t on the hook: pontoons alone would sink into the gravel
    onOutriggers(c);
    const press = LOADS.findIndex((l) => l.id === 'bigtrafo');
    c.target = press;
    // reeve the 7-sheave block with 12 parts and swing over the press
    c.hook.y = 0.5;
    setBlock(c, 'b7', 12);
    expect(c.block).toBe('b7');
    c.slew = Math.PI / 2; // the transformer waits on the east side (carrier left), its pad on the west
    setRadius(c, 12.88, 3.4);
    // hook over the lifting point and low
    const L = c.loads[press];
    // hook lowered to just above the press with the rigging slack
    const tip = tipWorld(c);
    const rigH = 4.5 * Math.cos(Math.asin(2 / 4.5)) + 1.55;
    c.drum = c.length + SPEC.headLen + 2 + (tip.y - (L.y + 3.3) - rigH - 0.6 - 0.1) * c.parts;
    resetHook(c);
    attachRig(c, 'sp4h');
    expect(c.rig).toBe('sp4h');
    expect(c.rigPlan?.ok).toBe(true);
    run(c, 60, (c) => (c.hoistLever = c.loads[press].state === 'air' ? 0 : 1));
    expect(c.loads[press].state).toBe('air');
    expect(c.pct).toBeGreaterThan(0.9);
    expect(c.pct).toBeLessThan(1.0);
    expect(c.failed).toBe('');
    // boom down would add radius: past 3.5 m the rating drops to 98 t, so the RCL must stop it
    run(c, 20, (c) => (c.luffLever = -1));
    expect(radius(c)).toBeLessThan(4.0);
    expect(c.failed).toBe('');
  });

  it('drives at up to 25 km/h; crab steer moves sideways without turning', () => {
    const c = ready({ x: 0, z: -55, heading: Math.PI / 2 });
    setDir(c, 'F');
    run(c, 25, (c) => (c.pedal = 1));
    expect(c.v * 3.6).toBeGreaterThan(22);
    expect(c.v * 3.6).toBeLessThan(26);
    const d = ready({ x: -40, z: -50, heading: 0 });
    d.steerMode = 'crab';
    setDir(d, 'F');
    run(d, 6, (c) => {
      c.pedal = 0.3;
      c.steerInput = 1;
    });
    expect(Math.abs(d.heading)).toBeLessThan(1e-6);
    expect(d.x).toBeGreaterThan(-40.5);
  });

  it('the yard is hard everywhere: pads do not sink, the crane stays level', () => {
    const c = ready({ x: -6, z: -29, heading: Math.PI / 2 });
    onOutriggers(c);
    c.slew = Math.PI / 2;
    setRadius(c, 12.88, 3.5);
    run(c, 30);
    expect(Math.max(...c.sink)).toBe(0);
    expect(Math.abs(c.pitch) + Math.abs(c.roll)).toBeLessThan(0.002);
  });

  it('rigging plans: spreader for the genset, a steep short sling refused, the tank on 35 t legs', () => {
    const load = (id: string) => LOADS.find((l) => l.id === id)!;
    const rig = (id: string) => RIGGING.find((r) => r.id === id)!;
    expect(plan(load('genset'), rig('s4-6-22')).ok).toBe(false);
    expect(plan(load('genset'), rig('sp6')).ok).toBe(true);
    expect(plan(load('beams'), rig('s2-4-10')).ok).toBe(false);
    expect(plan(load('beams'), rig('s2-6-20')).ok).toBe(true);
    expect(plan(load('tank'), rig('s2-6-35')).ok).toBe(true);
    expect(plan(load('bigtrafo'), rig('sp4h')).ok).toBe(true);
  });
});


describe('Traknus World truck deck', () => {
  it('lifts the genset off a truck deck (a world support) and sets it back level on the deck timbers', () => {
    const c = ready();
    onOutriggers(c);
    c.slew = Math.PI / 2;
    setRadius(c, 12.88, 7);
    resetHook(c);
    run(c, 3);
    const g = c.loads.findIndex((l) => l.def.id === 'genset');
    c.target = g;
    const L = c.loads[g];
    const p = plan(L.def, RIGGING.find((r) => r.id === 'sp6')!);
    // the truck's deck and two timbers under the ends of the set, the set on them, its lifting centre under the hook
    Object.assign(L, { x: c.hook.x - p.centre[0], z: c.hook.z - p.centre[2], y: 1.58, yaw: 0, state: 'rest' });
    const s = (x: number, hx: number, y0: number, y1: number) => ({ id: 'truk', x, z: L.z, hx, hz: 1.2, yaw: 0, y0, y1 });
    EMBED.supports.push(s(L.x, 3.15, 1.18, 1.38), s(L.x - 2.6, 0.15, 1.38, 1.58), s(L.x + 2.6, 0.15, 1.38, 1.58));
    try {
      expect(surfaceAt(L.x + 2.6, L.z)).toBeCloseTo(1.58);
      expect(surfaceAt(L.x, L.z)).toBeCloseTo(1.38);
      // lower the hook to the rigger, sling it, hoist clear of the deck
      run(c, 40, (c) => (c.hoistLever = c.hook.y - (L.y + p.centre[1]) > p.height + 1 ? -1 : 0));
      attachRig(c, 'sp6');
      expect(c.rig).toBe('sp6');
      run(c, 40, (c) => (c.hoistLever = L.y < 3.2 ? 1 : 0));
      expect(L.state).toBe('air');
      expect(L.y).toBeGreaterThan(3);
      // and back down onto the timbers: it lands level, nothing falls
      run(c, 60, (c) => (c.hoistLever = L.state === 'air' || c.take > 0.05 ? -1 : 0));
      expect(L.state).toBe('rest');
      expect(L.y).toBeCloseTo(1.58, 1);
      expect(L.damage).toBe(0);
      expect(c.failed).toBe('');
      detachRig(c);
      expect(c.attached).toBe(-1);
    } finally {
      EMBED.supports.length = 0;
    }
  });
});
