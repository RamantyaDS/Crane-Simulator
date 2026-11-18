// Keyboard, gamepad and touch for the two jobs of the one cab: driving the carrier and working the crane.
// Crane levers follow the usual two-joystick layout: left swing / telescope, right boom / hoist.
import { lockBoom, setDir, startEngine, stopEngine, toggleSwingLock } from './sim/crane';
import { ensureAudio } from './sound';
import { cr, toast, useUI, type CamMode } from './store';

const held = new Set<string>();
/** Touch joysticks and pedals write here (phone layout). */
export const touch = { lx: 0, ly: 0, rx: 0, ry: 0, gas: 0, brake: 0, steer: 0 };
if (import.meta.env.DEV) (globalThis as unknown as { touch: typeof touch }).touch = touch;
export const padLook = { x: 0, y: 0 };

export const KEYS_DRIVE: [string, string][] = [
  ['W / S', 'Gas / rem'],
  ['A / D', 'Setir'],
  ['Q / E', 'Maju / mundur'],
  ['N', 'Netral'],
  ['1 2 3 4', 'Mode setir: depan, belakang, semua roda, crab'],
  ['H', 'Gigi tinggi / rendah'],
  ['P', 'Rem parkir'],
];
export const KEYS_CRANE: [string, string][] = [
  ['A / D', 'Swing kiri / kanan'],
  ['W / S', 'Boom naik / turun (luffing)'],
  ['E / Q', 'Telescope keluar / masuk'],
  ['R / F', 'Hoist naik / turun'],
  ['Spasi', 'Rem swing (pedal)'],
  ['L', 'Swing lock'],
  ['K', 'Kunci boom di posisi pin terdekat'],
  ['] / [', 'Telescope otomatis ke pin berikutnya keluar / masuk'],
  ['Z / X', 'Tag line: putar beban'],
  ['Shift', 'Hoist kecepatan tinggi (tahan)'],
  ['T / G', 'Gas tangan naik / turun'],
];
export const KEYS_COMMON: [string, string][] = [
  ['Tab', 'Ganti mode: jalan ↔ crane'],
  ['I', 'Kunci kontak: hidup / mati mesin'],
  ['B', 'Klakson'],
  ['V', 'Ganti kamera'],
  ['Mouse', 'Seret untuk memutar kamera, roda mouse untuk zoom'],
];
export const PAD_KEYS: [string, string][] = [
  ['Mode crane', 'Stik kiri: swing (←→) & telescope (↑↓) · stik kanan: boom (↑↓) · RT/LT: hoist naik/turun · LB/RB: tag line · X: rem swing'],
  ['Mode jalan', 'Stik kiri: setir · RT/LT: gas/rem · RB/LB: maju/mundur'],
  ['Umum', 'Y: ganti mode · B: kamera · A: klakson · Start: mesin · D-pad: putar kamera'],
];

export function toggleEngine() {
  void ensureAudio();
  if (cr.engine === 'off') startEngine(cr);
  else stopEngine(cr);
}

export const CAMS: CamMode[] = ['orbit', 'cab', 'hook', 'rigger', 'top'];
export function nextCam() {
  const ui = useUI.getState();
  ui.set({ cam: CAMS[(CAMS.indexOf(ui.cam) + 1) % CAMS.length] });
}
export function toggleMode() {
  const ui = useUI.getState();
  ui.set({ mode: ui.mode === 'drive' ? 'crane' : 'drive' });
}

export let horn = false;

function onKey(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  if (e.type === 'keyup') {
    held.delete(k);
    if (k === 'b') horn = false;
    return;
  }
  if (['w', 'a', 's', 'd', ' ', 'tab', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (held.has(k)) return;
  held.add(k);
  const drive = useUI.getState().mode === 'drive';
  if (k === 'tab') toggleMode();
  else if (k === 'i') toggleEngine();
  else if (k === 'b') horn = true;
  else if (k === 'v') nextCam();
  else if (drive && ['r', 'f', 'z', 'x', 'l'].includes(k)) toast('Masih di mode jalan: tekan Tab untuk mode crane. Di mode crane W/S = boom naik/turun, A/D swing, E/Q telescope, R/F hoist.');
  else if (drive) {
    if (k === 'q') setDir(cr, 'F');
    else if (k === 'e') setDir(cr, 'R');
    else if (k === 'n') setDir(cr, 'N');
    else if (k === 'p') cr.park = !cr.park;
    else if (k === 'h') cr.range = cr.range === 'high' ? 'low' : 'high';
    else if ('1234'.includes(k)) cr.steerMode = (['front', 'rear', 'all', 'crab'] as const)[+k - 1];
  } else if (k === 'l') toggleSwingLock(cr);
  else if (k === 'k') lockBoom(cr);
  else if (k === ']') lockBoom(cr, 1);
  else if (k === '[') lockBoom(cr, -1);
}

export function bindKeys() {
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  addEventListener('blur', () => held.clear());
}

const prev: boolean[] = [];
const dz = (v: number, d = 0.12) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));
const ease = (cur: number, want: number, dt: number, rate = 3) => cur + Math.sign(want - cur) * Math.min(Math.abs(want - cur), dt * rate);

/** Continuous controls, called every frame. */
export function applyHeld(dt: number) {
  let gp: Gamepad | null = null;
  for (const g of navigator.getGamepads?.() ?? []) if (g && g.connected) gp = gp ?? g;
  const btn = (i: number) => !!gp?.buttons[i]?.pressed;
  const val = (i: number) => gp?.buttons[i]?.value ?? 0;
  const ax = (i: number) => dz(gp?.axes[i] ?? 0);
  const drive = useUI.getState().mode === 'drive';
  if (gp) {
    const press = (i: number) => btn(i) && !prev[i];
    if (press(3)) toggleMode();
    if (press(1)) nextCam();
    if (press(9)) toggleEngine();
    if (drive && press(5)) setDir(cr, 'F');
    if (drive && press(4)) setDir(cr, 'R');
    horn = btn(0) || held.has('b');
    gp.buttons.forEach((b, i) => (prev[i] = b.pressed));
    padLook.x = (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0);
    padLook.y = (btn(13) ? 1 : 0) - (btn(12) ? 1 : 0);
  }
  const key = (a: string, b: string) => (held.has(a) ? 1 : 0) - (held.has(b) ? 1 : 0);

  if (drive) {
    const steer = gp && ax(0) !== 0 ? -ax(0) : touch.steer || key('a', 'd') || key('arrowleft', 'arrowright');
    cr.steerInput = gp && ax(0) !== 0 ? steer : ease(cr.steerInput, steer, dt, steer === 0 ? 2 : 1.2);
    cr.pedal = ease(cr.pedal, Math.max(held.has('w') || held.has('arrowup') ? 1 : 0, val(7), touch.gas), dt, 4);
    cr.brake = Math.max(held.has('s') || held.has('arrowdown') ? 1 : 0, val(6), touch.brake);
    cr.swingLever = cr.luffLever = cr.teleLever = cr.hoistLever = cr.tagLever = 0;
    cr.swingBrake = 0;
  } else {
    cr.pedal = 0;
    cr.brake = 0;
    // keyboard levers ease in like real proportional joysticks
    const sw = gp ? -ax(0) : touch.lx ? -touch.lx : key('a', 'd');
    const tl = gp ? -ax(1) : touch.ly ? -touch.ly : key('e', 'q');
    const lf = gp ? -ax(3) : touch.ry ? -touch.ry : key('w', 's');
    const ho = gp ? val(7) - val(6) : touch.rx ? touch.rx : key('r', 'f');
    cr.swingLever = gp || touch.lx ? sw : ease(cr.swingLever, sw, dt, 1.5);
    cr.teleLever = tl;
    cr.luffLever = gp || touch.ry ? lf : ease(cr.luffLever, lf, dt, 2);
    cr.hoistLever = gp || touch.rx ? ho : ease(cr.hoistLever, ho, dt, 2.5);
    cr.tagLever = (btn(4) ? 1 : 0) - (btn(5) ? 1 : 0) || key('z', 'x');
    cr.swingBrake = held.has(' ') || btn(2) ? 1 : 0;
    cr.highSpeed = held.has('shift');
  }
  if (held.has('t')) cr.hand = Math.min(1, cr.hand + dt * 0.4);
  if (held.has('g')) cr.hand = Math.max(0, cr.hand - dt * 0.4);
}
