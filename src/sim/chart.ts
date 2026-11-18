// Rated capacities straight from the Link-Belt RTC-80160 Series II charts (85%, metric, kg), extracted from the
// technical data 5825 into charts.json. Like the in-cab chart: a radius between rows takes the next larger row (no
// interpolation upward), lengths must be a pinned length, and a rating exists only for the configuration the chart
// covers. Intermediate and retracted outriggers are not in that document: they use the full-outrigger chart reduced
// by the ratio of the tipping lines (est.), and the panel says so.
import data from './charts.json';
import { FLY, SPEC } from './spec';

type Row = [number, (number | null)[]];
interface MainChart {
  lengths: number[];
  rows: Row[];
  front: Row[];
}
const MAIN = data.main as unknown as Record<string, MainChart>;
const FLYC = data.fly as unknown as Record<string, Row[]>;
const TIRES = data.tires as unknown as Record<'stationary' | 'creep', { lengths: number[]; rows: Row[] }>;

export type Support = 'full' | 'mid' | 'retracted' | 'tires';

export interface ChartQuery {
  cw: number; // t
  support: Support;
  length: number; // m main boom
  radius: number; // m from the swing centre
  fly: number; // 0, 9.4, 16.8
  offset: number; // fly offset, degrees
  slew: number; // rad, upper relative to the carrier (0 = boom over the front)
  creep?: boolean; // moving on tires (pick & carry)
}

export interface Rating {
  kg: number;
  note: string; // which chart, or why there is none
  estimated?: boolean;
}

/** Index of the pinned length the boom is at, or −1 when it is between pin positions. */
export function stopIndex(length: number) {
  return SPEC.stops.findIndex((s) => Math.abs(s - length) < 0.12);
}

function lookup(rows: Row[], col: number, radius: number) {
  // next larger radius row that has a value in this column
  let best: number | null = null;
  for (const [r, vals] of rows) {
    const v = vals[col];
    if (v == null) continue;
    if (r >= radius - 1e-6) return v;
    best = v; // radius beyond the rows above: keep looking
  }
  void best;
  return null;
}

/** Smallest and largest radius the chart lists for a column (the boom's working range). */
export function rangeOf(cw: number, col: number) {
  const ch = MAIN[cw === 26.7 ? '26.7' : '15.9'];
  const rs = ch.rows.filter(([, v]) => v[col] != null).map(([r]) => r);
  return { min: Math.min(...rs), max: Math.max(...rs) };
}

const overFront = (slew: number) => Math.abs(Math.atan2(Math.sin(slew), Math.cos(slew))) < (10 * Math.PI) / 180;
const overRear = (slew: number) => Math.abs(Math.atan2(Math.sin(slew - Math.PI), Math.cos(slew - Math.PI))) < (10 * Math.PI) / 180;

/** Zoomlion ZAT40000H763 estimate (kg): the published maximum load moments over the radius, with a strength cap that
 * falls with boom length. 8 000 t·m basic boom, 6 300 t·m long main boom + long wind boom; no public chart exists. */
export function zoomlionKg(cw: number, length: number, radius: number, fly: number) {
  const R = Math.max(radius, 3);
  const M = fly > 0 ? 6300 * Math.sqrt(206 / (length + fly)) : 8000 * Math.pow(19.8 / length, 0.6);
  const cap = fly > 0 ? 300 : 4000 * Math.pow(19.8 / length, 1.3);
  return Math.round((Math.min(cap, M / R) * 1000 * (cw >= 300 ? 1 : 0.6)) / 100) * 100;
}

function ratedZoomlion(q: ChartQuery): Rating {
  if (q.cw < 100) return { kg: 0, note: 'Tanpa counterweight: tidak ada chart. Pasang counterweight dulu.' };
  if (q.support === 'tires') return { kg: 0, note: 'Crane 4 000 t tidak boleh mengangkat di atas ban. Pasang outrigger.' };
  const col = stopIndex(q.length);
  if (col < 0) return { kg: 0, note: 'Boom belum terkunci pin (di antara posisi pin). Telescope ke panjang terkunci.' };
  if (q.fly > 0 && col !== SPEC.stops.length - 1) return { kg: 0, note: `Boom wind hanya dipasang di boom utama penuh ${fmtM(SPEC.boomMax)} m.` };
  let kg = zoomlionKg(q.cw, SPEC.stops[col], q.radius, q.fly);
  let note = q.fly > 0 ? `Boom ${fmtM(SPEC.stops[col])} m + boom wind ${q.fly} m · CW ${q.cw} t · superlift` : `Boom ${fmtM(SPEC.stops[col])} m · CW ${q.cw} t · superlift`;
  if (q.support !== 'full') {
    const k = (q.support === 'mid' ? SPEC.outrigger.mid.x : SPEC.outrigger.retracted.x) / SPEC.outrigger.full.x;
    kg = Math.round(kg * k * k);
    note += q.support === 'mid' ? ' · outrigger setengah' : ' · outrigger masuk';
  } else note += ' · outrigger 16 × 16 m';
  return { kg, note: note + ' (chart perkiraan)', estimated: true };
}

const fmtM = (m: number) => m.toString().replace('.', ',');

export function rated(q: ChartQuery): Rating {
  if (SPEC.model === 'zoomlion') return ratedZoomlion(q);
  if (q.cw < 15) return { kg: 0, note: 'Tanpa counterweight: tidak ada chart. Pasang counterweight dulu.' };
  const key = q.cw > 20 ? '26.7' : '15.9';
  const col = stopIndex(q.length);
  if (col < 0) return { kg: 0, note: 'Boom belum terkunci pin (di antara posisi pin). Telescope ke panjang terkunci.' };

  if (q.support === 'tires') {
    if (!overRear(q.slew)) return { kg: 0, note: 'On tires: chart hanya untuk boom lurus di atas belakang (di antara jejak ban).' };
    if (q.fly > 0) return { kg: 0, note: 'On tires: fly tidak diizinkan.' };
    const t = TIRES[q.creep ? 'creep' : 'stationary'];
    const c = t.lengths.findIndex((l) => Math.abs(l - SPEC.stops[col]) < 0.5);
    if (c < 0) return { kg: 0, note: 'On tires: boom maksimal 39,6 m.' };
    const v = lookup(t.rows, c, q.radius);
    return v == null ? { kg: 0, note: 'On tires: di luar radius chart.' } : { kg: v, note: q.creep ? 'On tires · pick & carry (creep)' : 'On tires · stationary' };
  }

  let kg: number | null;
  let note: string;
  if (q.fly > 0) {
    if (col !== SPEC.stops.length - 1) return { kg: 0, note: 'Fly hanya dipasang di boom penuh 59,5 m.' };
    const fi = FLY.lengths.indexOf(q.fly) - 1;
    const oi = FLY.offsets.indexOf(q.offset);
    kg = lookup(FLYC[key], fi * 4 + oi, q.radius);
    note = `Boom 59,5 m + fly ${q.fly.toString().replace('.', ',')} m offset ${q.offset}° · CW ${key.replace('.', ',')} t`;
  } else {
    const ch = MAIN[key];
    kg = lookup(ch.rows, col, q.radius);
    // "over front only" ratings (145 t at 2.1 m)
    if (overFront(q.slew) && q.support === 'full') {
      const f = lookup(ch.front, col, q.radius);
      if (f != null && (kg == null || f > kg)) kg = f;
    }
    note = `Boom ${SPEC.stops[col].toString().replace('.', ',')} m · CW ${key.replace('.', ',')} t · outrigger penuh 360°`;
  }
  if (kg == null) return { kg: 0, note: 'Di luar radius chart untuk konfigurasi ini.' };
  if (q.support === 'full') return { kg, note };
  // tipping-line ratio: intermediate and retracted outriggers (estimate, not in the document)
  const k = q.support === 'mid' ? SPEC.outrigger.mid.x / SPEC.outrigger.full.x : SPEC.outrigger.retracted.x / SPEC.outrigger.full.x;
  return { kg: Math.round(kg * k * k), note: note.replace('outrigger penuh', q.support === 'mid' ? 'outrigger setengah' : 'outrigger masuk') + ' (perkiraan)', estimated: true };
}

/** The full chart for the panel's table: rows of radius with the ratings per pinned length. */
export function chartTable(cw: number) {
  if (SPEC.model === 'zoomlion') {
    const radii = [3, 5, 8, 10, 12, 15, 18, 22, 26, 30, 35, 40, 46, 52, 60, 70, 80, 90];
    const rows: Row[] = radii.map((r) => [r, SPEC.stops.map((L) => (r < L * 0.08 || r > L * 0.97 - 2 ? null : zoomlionKg(cw, L, r, 0)))]);
    return { lengths: SPEC.stops, rows, front: [] as Row[] };
  }
  const ch = MAIN[cw > 20 ? '26.7' : '15.9'];
  return { lengths: ch.lengths, rows: ch.rows, front: ch.front };
}
