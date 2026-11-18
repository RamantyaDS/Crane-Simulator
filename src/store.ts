import { create as createStore } from 'zustand';
import * as sim from './sim/crane';
import { create as createCrane, step, type Crane } from './sim/crane';

// Simulation state, mutated in place every frame; `tick` bumps so React panels refresh at a modest rate.
export const cr: Crane = createCrane();
if (import.meta.env.DEV) Object.assign(globalThis, { cr, sim });

export type CamMode = 'orbit' | 'cab' | 'hook' | 'rigger' | 'top';
export type Mode = 'drive' | 'crane';

interface UI {
  tick: number;
  cam: CamMode;
  mode: Mode;
  help: boolean;
  started: boolean;
  panel: boolean;
  chart: boolean;
  toast: string;
  toastUntil: number;
  bump: () => void;
  set: (p: Partial<Omit<UI, 'bump' | 'set'>>) => void;
}

const narrow = typeof innerWidth === 'number' && innerWidth < 760;

export const useUI = createStore<UI>((set) => ({
  tick: 0,
  cam: 'orbit',
  mode: 'drive',
  help: false,
  started: false,
  panel: !narrow,
  chart: false,
  toast: '',
  toastUntil: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),
  set: (p) => set(p),
}));

export function toast(msg: string, ms = 5000) {
  useUI.getState().set({ toast: msg, toastUntil: performance.now() + ms });
}

const listeners = new Set<(e: string) => void>();
export function onEvent(f: (e: string) => void) {
  listeners.add(f);
  return () => void listeners.delete(f);
}

/** Advances the simulation with fixed 10 ms steps. */
export function advance(dt: number) {
  const total = Math.min(dt, 0.1);
  if (!(total > 0)) return; // a zero frame time would divide by zero in the hook velocities
  const n = Math.max(1, Math.ceil(total / 0.01));
  for (let i = 0; i < n; i++) step(cr, total / n);
  if (cr.events.length) for (const e of cr.events.splice(0)) for (const f of listeners) f(e);
  if (cr.msg) {
    toast(cr.msg);
    cr.msg = '';
  }
}

export function resetAll() {
  // keep the load objects (the scene holds them) and refresh their state
  const keep = cr.loads;
  const fresh = createCrane();
  fresh.loads.forEach((l, i) => Object.assign(keep[i], l));
  Object.assign(cr, fresh, { loads: keep });
  useUI.getState().set({ mode: 'drive' });
  useUI.getState().bump();
}
