import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { CAMS, KEYS_COMMON, KEYS_CRANE, KEYS_DRIVE, PAD_KEYS, bindKeys, toggleEngine, toggleMode, touch } from '../input';
import { FULL, setQuality } from '../scene/Adaptive';
import { Experience } from '../scene/Experience';
import { chartTable, stopIndex } from '../sim/chart';
import { LOWER_BOOST, attachRig, detachRig, hangLen, lockBoom, radius, setBeams, setBlock, setCounterweight, setDir, setFly, tipWorld, toggleSwingLock } from '../sim/crane';
import { plan } from '../sim/rigging';
import { RIGGING } from '../sim/site';
import { BLOCKS, FLY, MODELS, SPEC, chooseModel, maxParts } from '../sim/spec';
import { ensureAudio, setSound, soundOn, soundStatus } from '../sound';
import { cr, resetAll, useUI, type CamMode } from '../store';

const CAM_LABEL: Record<CamMode, string> = { orbit: 'Orbit', cab: 'Kabin', hook: 'Kamera hook', rigger: 'Rigger', top: 'Atas' };
const fmt = (n: number, d = 1) => n.toFixed(d).replace('.', ',');
const t = (kg: number) => `${fmt(kg / 1000)} t`;
const ZL = SPEC.model === 'zoomlion';

/** Crane choice: the page reloads with the other model (the run restarts). */
function ModelPicker() {
  return (
    <div className="models">
      {MODELS.map((m) => (
        <button key={m.id} className={SPEC.model === m.id ? 'on' : ''} onClick={() => SPEC.model !== m.id && chooseModel(m.id)}>
          <b>{m.name}</b>
          <span>{m.note}</span>
        </button>
      ))}
    </div>
  );
}

function Tabs({ tab, set }: { tab: string; set: (t: string) => void }) {
  const items: [string, string][] = [
    ['jalan', 'Mesin'],
    ['setup', 'Setup'],
    ['beban', 'Beban'],
    ['tampil', 'Tampilan'],
  ];
  return (
    <div className="tabs" role="tablist">
      {items.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => set(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Hold-to-run crane lever for mouse users: switches to crane mode and drives one joystick axis. */
function Lever({ label, k, v }: { label: string; k: 'lx' | 'ly' | 'rx' | 'ry'; v: number }) {
  const on = () => {
    useUI.getState().set({ mode: 'crane' });
    touch[k] = v;
  };
  const off = () => (touch[k] = 0);
  return (
    <button
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        on();
      }}
      onPointerUp={off}
      onPointerCancel={off}
      onLostPointerCapture={off}
    >
      {label}
    </button>
  );
}

function CraneLevers() {
  return (
    <>
      <h3>Kontrol crane (tahan tombol, atau Tab lalu W/S A/D E/Q R/F)</h3>
      <div className="levers">
        <Lever label="▲ Boom naik (W)" k="ry" v={-1} />
        <Lever label="▼ Boom turun (S)" k="ry" v={1} />
        <Lever label="⟲ Swing kiri (A)" k="lx" v={-1} />
        <Lever label="⟳ Swing kanan (D)" k="lx" v={1} />
        <Lever label="⇥ Telescope keluar (E)" k="ly" v={-1} />
        <Lever label="⇤ Telescope masuk (Q)" k="ly" v={1} />
        <button onClick={() => lockBoom(cr, -1)}>🔒 Pin masuk ([)</button>
        <button onClick={() => lockBoom(cr, 1)}>🔒 Pin keluar (])</button>
        <button onClick={() => lockBoom(cr)}>🔒 Kunci pin terdekat (K)</button>
        <span className="pinhint">{stopIndex(cr.length) >= 0 ? `Terkunci ${fmt(cr.length, 2)} m` : `Belum terkunci (${fmt(cr.length, 2)} m)`}</span>
        <Lever label="⤒ Hoist naik (R)" k="rx" v={1} />
        <Lever label="⤓ Hoist turun (F)" k="rx" v={-1} />
      </div>
    </>
  );
}

function EnginePanel() {
  const ui = useUI();
  const running = cr.engine === 'running';
  return (
    <>
      <button className={`big ${running ? 'warn' : 'ok'}`} onClick={toggleEngine}>
        {cr.engine === 'off' ? '🔑 Hidupkan mesin' : cr.engine === 'starting' ? 'Starter…' : 'Matikan mesin'}
      </button>
      <div className="row">
        <button className={ui.mode === 'drive' ? 'on' : ''} onClick={() => ui.set({ mode: 'drive' })}>
          🚚 Mode jalan
        </button>
        <button className={ui.mode === 'crane' ? 'on' : ''} onClick={() => ui.set({ mode: 'crane' })}>
          🏗 Mode crane
        </button>
      </div>
      <CraneLevers />
      <h3>Jalan</h3>
      <div className="row">
        {(['F', 'N', 'R'] as const).map((d) => (
          <button key={d} className={cr.dir === d ? 'on' : ''} onClick={() => setDir(cr, d)}>
            {d === 'F' ? 'Maju' : d === 'R' ? 'Mundur' : 'N'}
          </button>
        ))}
        <button className={cr.park ? 'on danger' : ''} onClick={() => (cr.park = !cr.park)}>
          P
        </button>
      </div>
      <div className="row wrap">
        {(
          [
            ['front', 'Setir depan'],
            ['rear', 'Setir belakang'],
            ['all', 'Semua roda'],
            ['crab', 'Crab'],
          ] as const
        ).map(([m, l]) => (
          <button key={m} className={cr.steerMode === m ? 'on' : ''} onClick={() => (cr.steerMode = m)}>
            {l}
          </button>
        ))}
      </div>
      <div className="row">
        <button className={cr.range === 'high' ? 'on' : ''} onClick={() => (cr.range = 'high')}>
          Tinggi 25 km/j
        </button>
        <button className={cr.range === 'low' ? 'on' : ''} onClick={() => (cr.range = 'low')}>
          Rendah 8 km/j
        </button>
      </div>
      <label className="slider">
        <span>
          Gas tangan <b>{Math.round(SPEC.idleRpm + cr.hand * (SPEC.maxRpm - SPEC.idleRpm))} rpm</b>
        </span>
        <input type="range" min={0} max={1} step={0.01} value={cr.hand} onChange={(e) => (cr.hand = +e.target.value)} />
      </label>
    </>
  );
}

function SetupPanel() {
  const blk = BLOCKS.find((b) => b.id === cr.block)!;
  return (
    <>
      <h3>Outrigger</h3>
      <div className="row">
        {(
          [
            ['retracted', 'Masuk'],
            ['mid', 'Setengah'],
            ['full', 'Penuh'],
          ] as const
        ).map(([b, l]) => (
          <button key={b} className={cr.beamSet === b ? 'on' : ''} onClick={() => setBeams(cr, b)}>
            {l}
          </button>
        ))}
      </div>
      <div className="row">
        <button onPointerDown={() => (cr.jackCmd = 1)} onPointerUp={() => (cr.jackCmd = 0)} onPointerLeave={() => (cr.jackCmd = 0)}>
          ▼ Jack turun
        </button>
        <button onPointerDown={() => (cr.jackCmd = -1)} onPointerUp={() => (cr.jackCmd = 0)} onPointerLeave={() => (cr.jackCmd = 0)}>
          ▲ Jack naik
        </button>
        <button className={cr.autoLevel ? 'on' : ''} onClick={() => (cr.autoLevel = !cr.autoLevel)}>
          Auto-level
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={cr.mats} disabled={cr.jacks.some((j) => j > 0.3)} onChange={(e) => (cr.mats = e.target.checked)} />
        <span>Matras di bawah pontoon (1,5 × 1,5 m)</span>
      </label>
      <h3>Counterweight</h3>
      <div className="row">
        {SPEC.counterweights.map((w) => (
          <button key={w} className={cr.cwTarget === w ? 'on' : ''} onClick={() => setCounterweight(cr, w)}>
            {w === 0 ? 'Lepas' : `${fmt(w)} t`}
          </button>
        ))}
      </div>
      {cr.cwTarget !== cr.cw && <p className="dim">Sistem hidraulik memindahkan counterweight… {Math.round(cr.cwT * 100)}%</p>}
      <h3>Swing</h3>
      <div className="row">
        <button className={cr.swingLock ? 'on danger' : ''} onClick={() => toggleSwingLock(cr)}>
          Swing lock {cr.swingLock ? 'ON' : 'off'}
        </button>
        <button className={cr.swingPark ? 'on danger' : ''} onClick={() => (cr.swingPark = !cr.swingPark)}>
          Rem parkir swing {cr.swingPark ? 'ON' : 'off'}
        </button>
      </div>
      <h3>{FLY.label}</h3>
      <div className="row">
        {FLY.lengths.map((l) => (
          <button key={l} className={cr.flyTarget === l ? 'on' : ''} onClick={() => setFly(cr, l)}>
            {l === 0 ? (ZL ? 'Tanpa' : 'Disimpan') : `${fmt(l, 0)} m`}
          </button>
        ))}
      </div>
      <div className="row">
        {FLY.offsets.map((o) => (
          <button key={o} className={cr.flyOffset === o ? 'on' : ''} disabled={cr.fly === 0} onClick={() => (cr.angle < 0.2 ? (cr.flyOffset = o) : (cr.msg = 'Offset fly diubah dengan boom diturunkan (di bawah 11°).'))}>
            {o}°
          </button>
        ))}
      </div>
      {cr.flyTarget !== cr.fly && <p className="dim">Memasang/melepas {FLY.label.toLowerCase()}… {Math.round(cr.flyT * 100)}%</p>}
      {ZL && <p className="dim">Boom wind dirakit dengan boom utama ditarik penuh dan rendah, lalu boom utama di-telescope penuh {fmt(SPEC.boomMax)} m untuk bekerja.</p>}
      <h3>Hook block & reeving</h3>
      <select value={cr.block} onChange={(e) => setBlock(cr, e.target.value as typeof cr.block, Math.min(cr.parts, maxParts(BLOCKS.find((b) => b.id === e.target.value)!.sheaves)))}>
        {BLOCKS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} · {b.mass} kg
          </option>
        ))}
      </select>
      <label className="slider">
        <span>
          Jalur tali (parts of line) <b>{cr.parts}</b> · kapasitas tali {t(cr.parts * SPEC.ropeLimit)} · hook naik {fmt((SPEC.lineSpeed[0] * 60) / cr.parts)} / turun {fmt((SPEC.lineSpeed[0] * 60 * LOWER_BOOST) / cr.parts)} m/menit (Shift 2×)
        </span>
        <input type="range" min={1} max={maxParts(blk.sheaves)} step={1} value={cr.parts} onChange={(e) => setBlock(cr, cr.block, +e.target.value)} />
      </label>
      <h3>Angin & RCL</h3>
      <div className="row">
        {[
          [2, 'Tenang'],
          [7, 'Sedang'],
          [12, 'Kencang'],
        ].map(([w, l]) => (
          <button key={w} className={cr.windSet === w ? 'on' : ''} onClick={() => (cr.windSet = w as number)}>
            {l}
          </button>
        ))}
      </div>
      <label className="check danger">
        <input type="checkbox" checked={cr.bypass} onChange={(e) => (cr.bypass = e.target.checked)} />
        <span>RCL bypass (darurat saja, semua penguncian mati)</span>
      </label>
    </>
  );
}

function LoadPanel() {
  const L = cr.loads[cr.target];
  return (
    <>
      <h3>Pilih beban</h3>
      <div className="loads">
        {cr.loads.map((l, i) => (
          <button key={l.def.id} className={`${cr.target === i ? 'on' : ''} ${l.placed ? 'done' : ''}`} disabled={cr.attached >= 0 && cr.attached !== i} onClick={() => (cr.target = i)}>
            <b>{l.def.name}</b>
            <span>
              {t(l.def.kg)} → {l.def.dest.label} {l.placed ? '✓' : l.state === 'fallen' ? '✗' : ''}
            </span>
          </button>
        ))}
      </div>
      <p className="note">{L.def.note}</p>
      <h3>Rigging</h3>
      {cr.attached < 0 ? (
        <div className="rigs">
          {RIGGING.map((r) => {
            const p = plan(L.def, r);
            return (
              <button key={r.id} className={p.ok ? '' : 'bad'} onClick={() => attachRig(cr, r.id)} title={p.ok ? '' : p.problem}>
                <b>{r.name}</b>
                <span>
                  {p.ok ? `✓ ${fmt(p.legTension / 1000)} t/kaki · ${Math.round((p.legAngle * 180) / Math.PI)}° · tinggi ${fmt(p.height)} m` : `✗ ${p.problem}`}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="stats">
          <span>
            Terpasang: <b>{RIGGING.find((r) => r.id === cr.rig)?.name}</b>
          </span>
          {cr.rigPlan && (
            <span>
              Tegangan per kaki {fmt(cr.rigPlan.legTension / 1000)} t / WLL {fmt(cr.rigPlan.legWll / 1000)} t · sudut {Math.round((cr.rigPlan.legAngle * 180) / Math.PI)}° · beban miring {fmt((cr.rigPlan.tilt * 180) / Math.PI)}°
            </span>
          )}
          <span>Beban diambil: {Math.round(Math.min(1, cr.take) * 100)}%</span>
          <button onClick={() => detachRig(cr)}>Lepas rigging</button>
        </div>
      )}
    </>
  );
}

function ViewPanel() {
  const ui = useUI();
  return (
    <>
      <h3>Kamera</h3>
      <div className="row wrap">
        {CAMS.map((c) => (
          <button key={c} className={ui.cam === c ? 'on' : ''} onClick={() => ui.set({ cam: c })}>
            {CAM_LABEL[c]}
          </button>
        ))}
      </div>
      <h3>Model crane</h3>
      <ModelPicker />
      <p className="dim">Ganti model memuat ulang halaman dan memulai dari awal.</p>
      {SPEC.fastNote && <p className="dim">{SPEC.fastNote}</p>}
      <h3>Grafis</h3>
      <div className="row">
        <button className={!FULL ? 'on' : ''} onClick={() => FULL && setQuality(false)}>
          Mode ringan
        </button>
        <button className={FULL ? 'on' : ''} onClick={() => !FULL && setQuality(true)}>
          Mode penuh
        </button>
      </div>
      <p className="dim">Mode ringan: resolusi 1×, tanpa ambient occlusion. Model tetap detail. Ganti mode memuat ulang halaman.</p>
      <div className="row">
        <button
          onClick={() => {
            setSound(!soundOn());
            ui.bump();
          }}
        >
          {soundOn() ? '🔊 Suara' : '🔇 Bisu'}
        </button>
        <button onClick={() => ui.set({ chart: !ui.chart })}>📋 Load chart</button>
        <button onClick={() => ui.set({ help: !ui.help })}>⌨ Tombol</button>
      </div>
      <button className="small" onClick={resetAll}>
        ↺ Mulai ulang
      </button>
      {ui.started && !soundStatus.ok && soundStatus.text.startsWith('gagal') && <p className="snd bad">Suara: {soundStatus.text}</p>}
    </>
  );
}

function Panel() {
  const ui = useUI();
  const [tab, setTab] = useState('jalan');
  if (!ui.panel) return null;
  return (
    <aside className="panel">
      <Tabs tab={tab} set={setTab} />
      {tab === 'jalan' && <EnginePanel />}
      {tab === 'setup' && <SetupPanel />}
      {tab === 'beban' && <LoadPanel />}
      {tab === 'tampil' && <ViewPanel />}
    </aside>
  );
}

/** The RCL display, like the cab's: rated vs actual, radius, length and angle, configuration, alarms. */
function Rcl() {
  useUI((s) => s.tick);
  const r = radius(cr);
  const tip = tipWorld(cr);
  const pinned = stopIndex(cr.length) >= 0;
  const pct = Math.min(1.3, cr.pct);
  const col = cr.pct >= 1 ? '#ff3b2f' : cr.pct > 0.9 ? '#ffc21a' : '#2fd27a';
  const level = Math.hypot(Math.tan(cr.pitch), Math.tan(cr.roll)) * 100;
  const alarms: string[] = [];
  if (cr.lockout) alarms.push('RCL LOCKOUT');
  if (cr.twoBlock) alarms.push('ANTI TWO-BLOCK');
  if (!cr.onTyres && level > 1) alarms.push(`TIDAK RATA ${fmt(level)}%`);
  if (cr.lineDist < 3.05) alarms.push(`SUTM ${fmt(cr.lineDist)} m`);
  if (cr.wind > 9) alarms.push(`ANGIN ${fmt(cr.wind)} m/s`);
  if (cr.bypass) alarms.push('BYPASS');
  if (!pinned) alarms.push('BOOM BELUM TERKUNCI · tekan K');
  return (
    <section className="rcl" aria-label="RCL">
      <header>
        <b>{ZL ? 'RCL · chart perkiraan' : 'RCL · Link-Belt Pulse'}</b>
        <span className={cr.engine === 'running' ? 'ok' : ''}>{cr.engine === 'running' ? `${Math.round(cr.rpm)} rpm` : 'mesin mati'}</span>
      </header>
      <div className="big">
        <div>
          <small>Beban di hook</small>
          <b style={{ color: col }}>{t(cr.hookKg)}</b>
        </div>
        <div>
          <small>Kapasitas</small>
          <b>{cr.rating.kg > 0 ? t(cr.rating.kg) : '—'}</b>
        </div>
        <div>
          <small>Momen</small>
          <b style={{ color: col }}>{Math.round(cr.pct * 100)}%</b>
        </div>
      </div>
      <div className="meter">
        <i style={{ width: `${(pct / 1.3) * 100}%`, background: col }} />
        <em style={{ left: `${(0.9 / 1.3) * 100}%` }} />
        <em style={{ left: `${(1 / 1.3) * 100}%` }} className="red" />
      </div>
      <div className="grid">
        <span>
          Radius <b>{fmt(r)} m</b>
        </span>
        <span>
          Boom <b>{fmt(cr.length)} m</b> {pinned ? '🔒' : '…'}
        </span>
        <span>
          Sudut <b>{fmt((cr.angle * 180) / Math.PI)}°</b>
        </span>
        <span>
          Tinggi ujung <b>{fmt(tip.y)} m</b>
        </span>
        <span>
          Tali {cr.fly > 0 && SPEC.flyBall ? 1 : cr.parts} jalur · <b>{fmt(hangLen(cr))} m</b>
        </span>
        <span>
          Angin <b>{fmt(cr.wind)} m/s</b>
        </span>
        <span>
          Swing <b>{Math.round((((cr.slew * 180) / Math.PI) % 360 + 360) % 360)}°</b>
        </span>
        <span>
          Batas <b>{cr.limitBy}</b>
        </span>
      </div>
      <p className="cfg">{cr.rating.note}</p>
      {alarms.length > 0 && (
        <div className="alarms">
          {alarms.map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>
      )}
      {!cr.onTyres && (
        <div className="pads">
          {['KD', 'KaD', 'KB', 'KaB'].map((n, i) => (
            <span key={n} className={cr.sink[i] > 0.02 ? 'bad' : ''}>
              {n} {Math.round(cr.padKpa[i])} kPa
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function hint() {
  const L = cr.loads[cr.target];
  if (cr.failed) return 'Kecelakaan. Tekan Mulai ulang (tab Tampilan).';
  if (cr.engine === 'off') return 'Hidupkan mesin (arah di N).';
  if (L.placed) return 'Beban terpasang. Lepas rigging, lalu pilih beban berikutnya.';
  if (cr.onTyres && cr.attached < 0 && cr.angle < 0.05 && useUI.getState().mode === 'drive' && Math.abs(cr.v) < 0.1 && cr.time > 20)
    return 'Boom bisa dinaikkan kapan saja: Tab → mode crane, tahan W. Tapi angkat beban hanya di atas outrigger (tab Setup).';
  if (cr.onTyres && cr.attached < 0) return `Bawa crane ke dekat "${L.def.dest.label}" dan beban, lalu: outrigger penuh, matras bila tanah lunak, jack turun / auto-level.`;
  if (useUI.getState().mode === 'drive') return 'Siap mengangkat: tekan Tab (mode crane), lalu W/S untuk menaikkan/menurunkan boom, E/Q telescope, R/F hoist. Atau tahan tombol "Kontrol crane" di tab Mesin.';
  if (cr.swingLock) return 'Untuk swing: lepas swing lock (L) dan rem parkir swing di tab Setup. Boom sudah bisa dinaikkan dengan W.';
  if (cr.attached < 0) return 'Ayunkan hook tepat di atas beban, turunkan dekat, lalu pilih rigging di tab Beban.';
  if (L.state === 'rest' && !L.placed) return 'Hoist naik pelan (R) sampai beban terangkat. Pantau persentase RCL.';
  if (L.state === 'air') return `Swing pelan ke ${L.def.dest.label}, kendalikan ayunan, turunkan tepat di marka kuning.`;
  return '';
}

function Mission() {
  useUI((s) => s.tick);
  const L = cr.loads[cr.target];
  const placed = cr.loads.filter((l) => l.placed).length;
  return (
    <section className="mission">
      <header>
        <b>{L.def.name}</b>
        <span>
          {placed}/{cr.loads.length} terpasang · {Math.floor(cr.time / 60)}:{String(Math.floor(cr.time % 60)).padStart(2, '0')}
        </span>
      </header>
      <p className="hint">{hint()}</p>
      <div className="mstats">
        <span>Momen tertinggi {Math.round(cr.maxPct * 100)}%</span>
        <span>Tabrakan {cr.collisions}</span>
        <span>Lockout {cr.lockouts}</span>
      </div>
    </section>
  );
}

function ChartView() {
  const ui = useUI();
  if (!ui.chart) return null;
  const ch = chartTable(cr.cw);
  const col = stopIndex(cr.length);
  const r = radius(cr);
  return (
    <div className="help chart" role="dialog" aria-label="Load chart">
      <button className="x" onClick={() => ui.set({ chart: false })} aria-label="Tutup">
        ×
      </button>
      {ZL ? (
        <h3>Chart PERKIRAAN ZAT40000H763 · boom utama · CW {fmt(cr.cw, 0)} t · superlift · outrigger 16 × 16 m (kg) · dari momen beban 8 000 t·m, bukan chart resmi</h3>
      ) : (
        <h3>Load chart RTC-80160 II · CW {fmt(cr.cw > 20 ? 26.7 : 15.9)} t · outrigger penuh 360° · 85% (kg)</h3>
      )}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>R (m)</th>
              {ch.lengths.map((l, i) => (
                <th key={l} className={i === col ? 'cur' : ''}>
                  {fmt(l, l % 1 ? 1 : 0)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ch.rows.map(([rad, vals]) => (
              <tr key={rad} className={rad >= r && rad - r < 2.01 && r > 0 ? 'curRow' : ''}>
                <th>{fmt(rad, rad % 1 ? 1 : 0)}</th>
                {vals.map((v, i) => (
                  <td key={i} className={i === col ? 'cur' : ''}>
                    {v == null ? '' : Math.round(v).toLocaleString('id')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="credit">
        {ZL
          ? 'Perkiraan: momen beban maksimum Zoomlion (8 000 t·m boom dasar, 6 300 t·m boom panjang + boom wind) dibagi radius, dibatasi kekuatan boom; RCL juga membatasi 80% beban guling. Bukan chart resmi.'
          : 'Sumber: Link-Belt Technical Data 5825 (RTC-80160 Series II), tabel 85% metrik. Radius di antara baris memakai baris yang lebih besar.'}
      </p>
    </div>
  );
}

function Toast() {
  const { toast, toastUntil } = useUI();
  useUI((s) => s.tick);
  if (!toast || performance.now() > toastUntil) return null;
  return (
    <div className="toast" role="status">
      {toast}
    </div>
  );
}

function Help() {
  const ui = useUI();
  if (!ui.help) return null;
  const list = (k: [string, string][]) => (
    <dl>
      {k.map(([a, b]) => (
        <div key={a}>
          <dt>{a}</dt>
          <dd>{b}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <div className="help" role="dialog" aria-label="Tombol">
      <button className="x" onClick={() => ui.set({ help: false })} aria-label="Tutup">
        ×
      </button>
      <h3>Mode crane</h3>
      {list(KEYS_CRANE)}
      <h3>Mode jalan</h3>
      {list(KEYS_DRIVE)}
      <h3>Umum</h3>
      {list(KEYS_COMMON)}
      <h3>Gamepad</h3>
      {list(PAD_KEYS)}
      <p className="credit">
        Data: Link-Belt Technical Data 5825 RTC-80160 Series II (load chart, mesin, winch, outrigger); halaman produk Zoomlion ZAT40000H763 (dimensi, boom, kecepatan, momen beban). Suara: rekaman diesel John Deere 5820 dan pompa hidrolik Komatsu 941 oleh
        Work With Sounds / Werstas (CC BY 4.0), start mesin bus diesel oleh Evan0512 (CC BY-SA 4.0), Wikimedia Commons; mesin Cummins dan alarm disintesis.
      </p>
    </div>
  );
}

/** A virtual joystick for phones: writes x/y in −1..1 while dragged. */
function Stick({ onMove, label }: { onMove: (x: number, y: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState({ x: 0, y: 0 });
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const r = ref.current!.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    setK({ x, y });
    onMove(x, y);
  };
  const end = () => {
    setK({ x: 0, y: 0 });
    onMove(0, 0);
  };
  return (
    <div
      ref={ref}
      className="stick"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => e.buttons && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label={label}
    >
      <i style={{ transform: `translate(${k.x * 34}px, ${k.y * 34}px)` }} />
      <small>{label}</small>
    </div>
  );
}

function Touch() {
  const mode = useUI((s) => s.mode);
  return (
    <div className="touch">
      {mode === 'crane' ? (
        <>
          <Stick label="swing · telescope" onMove={(x, y) => ((touch.lx = x), (touch.ly = y))} />
          <button className="tmode" onClick={toggleMode}>
            Jalan
          </button>
          <Stick
            label="boom ↕ · hoist ↔"
            onMove={(x, y) => {
              touch.ry = y;
              touch.rx = x;
            }}
          />
        </>
      ) : (
        <>
          <Stick label="setir" onMove={(x) => (touch.steer = -x)} />
          <button className="tmode" onClick={toggleMode}>
            Crane
          </button>
          <div className="tped">
            <button onPointerDown={() => (touch.brake = 1)} onPointerUp={() => (touch.brake = 0)} onPointerLeave={() => (touch.brake = 0)}>
              Rem
            </button>
            <button className="gas" onPointerDown={() => (touch.gas = 1)} onPointerUp={() => (touch.gas = 0)} onPointerLeave={() => (touch.gas = 0)}>
              Gas
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Result() {
  useUI((s) => s.tick);
  if (!cr.failed) return null;
  const what = { tipped: 'Crane terguling', boom: 'Boom patah', line: 'Sengatan listrik 20 kV', excavation: 'Crane masuk galian', sling: 'Rigging gagal, beban jatuh', '': '' }[cr.failed];
  return (
    <div className="result" role="alertdialog">
      <h2>⚠ {what}</h2>
      <p>Momen tertinggi {Math.round(cr.maxPct * 100)}% · tabrakan {cr.collisions} · lockout {cr.lockouts}</p>
      <button className="big ok" onClick={resetAll}>
        Mulai ulang
      </button>
    </div>
  );
}

export function App() {
  const started = useUI((s) => s.started);
  const panel = useUI((s) => s.panel);
  const mode = useUI((s) => s.mode);
  useEffect(() => bindKeys(), []);
  return (
    <>
      <Experience />
      <header className="brand">
        <button className="menu" onClick={() => useUI.getState().set({ panel: !panel })} aria-label={panel ? 'Sembunyikan panel' : 'Tampilkan panel'}>
          {panel ? '◀' : '☰'}
        </button>
        <div>
          <h1>{SPEC.name}</h1>
          <p>
            Simulator {ZL ? 'all-terrain crane 4 000 t' : 'rough terrain crane 145 t'} · proyek pabrik · {mode === 'drive' ? 'mode jalan' : 'mode crane'}
          </p>
        </div>
      </header>
      <Panel />
      <Rcl />
      <Mission />
      <ChartView />
      <Toast />
      <Help />
      <Touch />
      <Result />
      {!started && (
        <div className="intro">
          <div>
            <h1>Simulator Crane Traknus</h1>
            <ModelPicker />
            {ZL ? (
              <p>
                All-terrain crane 4 000 ton, 10 gandar, boom utama 7 seksi 19,8–95,4 m, superlift Y, boom wind 51–111 m (tinggi hook sampai ±206 m). Beban terbesar: nacelle
                turbin angin 150 t ke puncak menara 148,5 m. Zoomlion tidak menerbitkan load chart: kapasitas di sini PERKIRAAN dari momen beban yang dipublikasikan.
              </p>
            ) : (
              <p>
                Rough terrain crane 145 ton (Cummins 345 hp, boom 6 seksi pin & latch 12,9–59,5 m, fly 9,4/16,8 m) di proyek pabrik. Pasang genset, trafo, chiller, pelat
                precast, balok baja, tangki, sampai trafo daya 100 ton yang memakai 98% kapasitas, memakai load chart resmi Link-Belt.
              </p>
            )}
            <ol>
              <li>Jalankan crane ke dekat beban dan tujuannya (mode jalan, empat mode setir).</li>
              <li>Outrigger penuh, matras bila perlu, auto-level. Pilih counterweight, hook block dan jalur tali.</li>
              <li>Mode crane: hook di atas beban, pilih rigging, angkat, swing, letakkan tepat di marka. Pantau RCL.</li>
            </ol>
            <p className="dim">Keyboard + mouse, gamepad, atau layar sentuh. Mode ringan aktif (bisa diganti di tab Tampilan).</p>
            <button
              className="big ok"
              onClick={() => {
                void ensureAudio();
                useUI.getState().set({ started: true });
              }}
            >
              Mulai (suara aktif)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
