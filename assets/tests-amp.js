/*
 * Kabul testleri: EL (elektriksel), NU (sayısal), UI (veri / arayüz), MK (model kartı).
 * Aynı tanım Node'da (tests/run-tests.js) ve tarayıcıda (dogrulama.html) çalışır.
 *
 * Her test: { id, group, title, req, heavy?, run(ctx) → { status, measured, expected, note } }
 *   status: 'pass' | 'fail' | 'notrun'
 * Kurallar:
 *   - Beklenen değerler kodun çıktısından kopyalanmaz; analitik ifade, bağımsız çözüm ya da
 *     veri sayfası noktası kullanılır.
 *   - Testler SİMÜLATÖRÜN doğruluğunu sınar. Amfinin kendisi hakkındaki bulgular (ör. kapasitör
 *     marjı) "tasarım kontrolü"dür ve test sonucunu kırmızıya çevirmez; nota yazılır.
 *   - Modelin kapsamadığı durumda sayı yerine "model değerlendiremiyor" yazılır.
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const MNA = node ? require('./mna.js') : root.MNA;
  const Tubes = node ? require('./tubes.js') : root.Tubes;
  const D = node ? require('./circuit-5f1.js') : root.Design;
  const U = node ? require('./units.js') : root.Units;
  const DSP = node ? require('./dsp.js') : root.DSP;
  const Amp = node ? require('./amp-model.js') : root.Amp;
  const Bom = node ? require('./bom-amp.js') : root.BomAmp;
  const Sch = node ? require('./schematic-amp.js') : root.SchematicAmp;

  const f = (x, d = 2) => (x == null || !Number.isFinite(x)) ? String(x) : x.toFixed(d).replace('.', ',');
  const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
  const dB = x => 20 * Math.log10(x);
  const P0 = () => D.cloneProfile();
  const S0 = (mod) => { const s = Amp.defaultState(); if (mod) mod(s); return s; };
  const res = (ok, measured, expected, note = '') => ({ status: ok ? 'pass' : 'fail', measured, expected, note });

  /** Ortak, pahalı sonuçlar bir kez hesaplanır. */
  function makeCtx() {
    const cache = {};
    const ctx = {
      steady(key, prof, st) { if (!cache[key]) { const r = Amp.steady(prof, st); r.op = Amp.dcOp(prof, st, r.win.B1); cache[key] = r; } return cache[key]; },
      base() { return ctx.steady('base', P0(), S0()); },
    };
    return ctx;
  }
  /** Tek frekansta, çalışma noktasıyla AC transferi. */
  function acAt(prof, st, freqs, op, extra) { return Amp.acSweep(prof, st, freqs, op, extra); }

  // --- Bağımsız referanslar ---------------------------------------------------------
  /** TMB için el türetimi düğüm çözümü (mna.js ve netlist kurucudan bağımsız karmaşık eleme). */
  function tmbReference(freq, v) {
    // Düğümler: 0 TT, 1 SJ, 2 TB, 3 MT, 4 TW. Giriş Vi = 1 (TSI). Yük: RL (volume) TW–toprak.
    const w = 2 * Math.PI * freq, n = 5;
    const Ar = Array.from({ length: n }, () => new Array(n).fill(0)), Ai = Array.from({ length: n }, () => new Array(n).fill(0));
    const br = new Array(n).fill(0), bi = new Array(n).fill(0);
    const Y = (a, b, gr, gi) => {            // a, b: düğüm; −1 toprak; −2 giriş (1 V)
      const put = (i, j, sr, si) => { Ar[i][j] += sr; Ai[i][j] += si; };
      if (a >= 0) { put(a, a, gr, gi); if (b >= 0) put(a, b, -gr, -gi); if (b === -2) { br[a] += gr; bi[a] += gi; } }
      if (b >= 0) { put(b, b, gr, gi); if (a >= 0) put(b, a, -gr, -gi); if (a === -2) { br[b] += gr; bi[b] += gi; } }
    };
    Y(-2, 0, 0, w * v.CT); Y(-2, 1, 1 / v.RS, 0); Y(1, 2, 0, w * v.CB); Y(1, 3, 0, w * v.CM);
    Y(0, 4, 1 / v.RTu, 0); Y(4, 2, 1 / v.RTl, 0); Y(2, 3, 1 / v.RB, 0); Y(3, -1, 1 / v.RM, 0); Y(4, -1, 1 / v.RL, 0);
    // Gauss–Jordan (karmaşık)
    for (let k = 0; k < n; k++) {
      let p = k; for (let r = k + 1; r < n; r++) if (Math.hypot(Ar[r][k], Ai[r][k]) > Math.hypot(Ar[p][k], Ai[p][k])) p = r;
      [Ar[k], Ar[p]] = [Ar[p], Ar[k]]; [Ai[k], Ai[p]] = [Ai[p], Ai[k]]; [br[k], br[p]] = [br[p], br[k]]; [bi[k], bi[p]] = [bi[p], bi[k]];
      const pr = Ar[k][k], pi = Ai[k][k], d = pr * pr + pi * pi;
      for (let r = 0; r < n; r++) {
        if (r === k) continue;
        const fr = (Ar[r][k] * pr + Ai[r][k] * pi) / d, fi = (Ai[r][k] * pr - Ar[r][k] * pi) / d;
        for (let c = k; c < n; c++) { Ar[r][c] -= fr * Ar[k][c] - fi * Ai[k][c]; Ai[r][c] -= fr * Ai[k][c] + fi * Ar[k][c]; }
        br[r] -= fr * br[k] - fi * bi[k]; bi[r] -= fr * bi[k] + fi * br[k];
      }
    }
    const pr = Ar[4][4], pi = Ai[4][4], d = pr * pr + pi * pi;
    return Math.hypot((br[4] * pr + bi[4] * pi) / d, (bi[4] * pr - br[4] * pi) / d);
  }
  const bisect = (fn, lo, hi) => { for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (fn(m) > 0) hi = m; else lo = m; } return (lo + hi) / 2; };

  const TESTS = [
    // ================================ MODEL KARTLARI ================================
    { id: 'MK-01', group: 'Model', title: '5Y3 modeli, JJ 5Y3S tipik noktasına karşı', req: 'IR §6.3, T1',
      run() {
        const c = new MNA.Circuit(), E = 350 * Math.SQRT2, w = 2 * Math.PI * 50, card = Tubes.CARDS['5Y3-child'];
        c.addV('VA', 'SA', 'GND', t => E * Math.sin(w * t)); c.addV('VB', 'SB', 'GND', t => -E * Math.sin(w * t));
        c.addR('RA', 'SA', 'HA', 50); c.addR('RB', 'SB', 'HB', 50);
        c.addN('DA', ['HA', 'B1'], Tubes.diode(card)); c.addN('DB', ['HB', 'B1'], Tubes.diode(card));
        c.addC('C', 'B1', 'GND', 20e-6); c.addR('RL', 'B1', 'GND', 360 / 0.125); c.finalize();
        const tr = new MNA.Transient(c, 1e-4); const x0 = new Float64Array(c.n); x0[c.node('B1')] = 350; tr.init(x0);
        let s = 0; for (let k = 0; k < 10000; k++) { const x = tr.step(); if (k >= 9800) s += x[c.node('B1')]; }
        const v = s / 200;
        return res(rel(v, 360) < 0.01, `${f(v, 1)} V`, '360 V ± %1 (350 VAC, 20 µF, 50 Ω, 125 mA)', 'Veri sayfası noktası: JJ 5Y3S. Eldeki 5Y3GT\'nin kimliği değildir.');
      } },
    { id: 'MK-02', group: 'Model', title: '6V6 modeli, JJ 6V6S tipik noktasına karşı', req: 'IR §7, T2',
      run() {
        const o = Tubes.pentodeI(Tubes.CARDS['6V6-koren'].p, -12.5, 250, 250, [0, 0]);
        const ok = rel(o[0], 0.045) < 0.05 && rel(o[1], 0.005) < 0.05;
        return res(ok, `Ia ${f(o[0] * 1e3, 1)} mA · Ig2 ${f(o[1] * 1e3, 2)} mA`, '45 mA ± %5 · 5 mA ± %5 (250 V / 250 V / −12,5 V)', 'Tek nokta uyumu; eğrilerin tamamı ve eldeki tüp doğrulanmadı.');
      } },

    // ================================ ELEKTRİKSEL ================================
    { id: 'EL-01', group: 'Elektriksel', title: 'Filtre zinciri ve düğüm doğrulaması', req: 'IR §6.1',
      run() {
        const b = Amp.build(P0(), S0()), c = b.ckt, nm = i => (i < 0 ? 'GND' : c.names[i]);
        const R = id => { const e = c.R.find(q => q.id === id); return e ? [nm(e.a), nm(e.b)].sort().join('–') : null; };
        const C = id => { const e = c.C.find(q => q.id === id); return e ? [nm(e.a), nm(e.b)].sort().join('–') : null; };
        const N = id => c.N.find(q => q.id === id).nodes.map(nm);
        const got = { R10: R('R10'), R11: R('R11'), C3: C('C3'), C4: C('C4'), C5: C('C5'), OT: R('T2.rp').split('–')[0], screen: N('V2')[1], R4: R('R4'), R6: R('R6'), rect: N('V3.a')[1] };
        const want = { R10: 'B1–B2', R11: 'B2–B3', C3: 'B1–GND', C4: 'B2–GND', C5: 'B3–GND', OT: 'B1', screen: 'B2', R4: 'B3–PA', R6: 'B3–PB', rect: 'B1' };
        const bad = Object.keys(want).filter(k => got[k] !== want[k]);
        return res(!bad.length, bad.length ? 'Uyuşmayan: ' + bad.map(k => `${k}=${got[k]}`).join(', ') : 'B+1→R10→B+2→R11→B+3; C3/C4/C5 ve yükler doğru düğümde', 'B+1: OT + 5Y3 katodu · B+2: screen · B+3: R4, R6', 'Seri zincir yorumu kullanıcı onayı bekliyor (K-01).');
      } },
    { id: 'EL-02', group: 'Elektriksel', title: 'High / Low, ideal kaynak (pasif ağ)', req: 'P1 s.5',
      run() {
        const fr = [1000], out = [];
        let ok = true;
        for (const pos of ['HIGH', 'LOW']) {
          const st = S0(s => { s.sw.S1 = pos; });
          const r = Amp.acSweep(P0(), st, fr, null, { noTubes: true });
          const g = r.H('G1').mag[0], z = r.zin[0];
          const zE = pos === 'HIGH' ? 1e6 : 136e3, gE = pos === 'HIGH' ? 1 : 0.5;
          if (rel(z, zE) > 1e-3 || rel(g, gE) > 1e-3) ok = false;
          out.push(`${pos}: Zin ${f(z / 1e3, 1)} kΩ, kazanç ${f(dB(g), 2)} dB`);
        }
        const b = Amp.build(P0(), S0(), { noTubes: true }), r1 = b.ckt.R.find(q => q.id === 'R1'), r2 = b.ckt.R.find(q => q.id === 'R2');
        const par = 1 / (r1.g + r2.g), sameNodes = r1.a === r2.a && r1.b === r2.b || r1.a === r2.b && r1.b === r2.a;
        if (!sameNodes || rel(par, 34e3) > 1e-3) ok = false;
        out.push(`High grid stopper ${f(par / 1e3, 1)} kΩ`);
        return res(ok, out.join(' · '), 'High: 1 MΩ, 0 dB, 68k‖68k = 34 kΩ · Low: 136 kΩ, −6,02 dB (≤ %0,1)');
      } },
    { id: 'EL-03', group: 'Elektriksel', title: 'Sonlu gitar / kablo empedansı', req: 'IR §8.1',
      run(ctx) {
        const op = ctx.base().op, fr = [100, 1000, 5000];
        const g = pos => { const st = S0(s => { s.sw.S1 = pos; s.src.kind = 'pickup'; }); return Amp.acSweep(P0(), st, fr, op).H('G1').mag.map(dB); };
        const hi = g('HIGH'), lo = g('LOW'), d = lo.map((v, i) => v - hi[i]);
        const spread = Math.max(...d) - Math.min(...d), off = Math.max(...d.map(v => Math.abs(v + 6.02)));
        return res(spread > 0.3 && off > 0.3, `Low − High: ${d.map((v, i) => `${fr[i]} Hz ${f(v, 2)} dB`).join(' · ')}`, 'Sabit −6,02 dB DEĞİL; frekansa ve yüklemeye bağlı', 'Manyetik modeli temsilîdir (7 kΩ, 3 H, 470 pF); sayılar belirli bir gitara ait değildir.');
      } },
    { id: 'EL-04', group: 'Elektriksel', title: 'Volume / TMB uç konumları', req: 'IR §8',
      run(ctx) {
        const op = ctx.base().op, fr = [50, 1000, 12000], pos = [0, 0.5, 1];
        let worst = 0, bad = 0, n = 0;
        for (const id of ['VR1', 'VR2']) for (const p of pos) {
          const st = S0(s => { s.sw.S2 = 'EQ'; s.pots[id] = p; });
          const b = Amp.build(P0(), st), tot = b.R.filter(e => e.own === id).reduce((a, e) => a + e.r, 0), nom = D.resolve(id, P0()).value;
          worst = Math.max(worst, Math.abs(tot - nom));
        }
        for (const a of pos) for (const bb of pos) for (const c of pos) for (const d of pos) {
          const st = S0(s => { s.sw.S2 = 'EQ'; s.pots = { VR1: a, VR2: bb, VR3: c, VR4: d }; });
          const m = Amp.acSweep(P0(), st, fr, op).H('G2').mag; n++;
          if (m.some(v => !Number.isFinite(v))) bad++;
        }
        return res(worst <= Amp.RMIN + 1e-9 && bad === 0, `Pot toplam direnci sapması ≤ ${f(worst, 1)} Ω · ${n} kombinasyonun ${n - bad} tanesi sonlu`, `Sapma ≤ ${Amp.RMIN} Ω (uç direnci) · 81 / 81 sonlu`, 'Uç konumda 1 Ω uç direnci kabul edilir (sayısal alt sınır).');
      } },
    { id: 'EL-05', group: 'Elektriksel', title: 'RAW / EQ: ağın çıkarılma biçimi ve yükü', req: 'IR §8.2',
      run(ctx) {
        const op = ctx.base().op, fr = Amp.logspace(40, 10000, 25);
        const run = (sw, method) => { const p = P0(); p.rawMethod = method; const st = S0(s => { s.sw.S2 = sw; }); const r = Amp.acSweep(p, st, fr, op); return { g2: r.H('G2').mag.map(dB), pa: r.H('PA').mag }; };
        const eq = run('EQ', 'lift'), raw = run('RAW', 'lift'), tap = run('RAW', 'tap');
        const diff = eq.g2.map((v, i) => v - raw.g2[i]), spread = Math.max(...diff) - Math.min(...diff);
        const k = 12, load = rel(eq.pa[k], raw.pa[k]), tapLoad = rel(tap.pa[k], raw.pa[k]);
        // Netlist: RAW/lift'te ton ağı elemanları devrede olmamalı
        const b = Amp.build(P0(), S0()), tsi = b.nn('TSI') !== b.nn('CO1'), vt = b.nn('VT') === b.nn('CO1');
        return res(spread > 3 && load > 0.01 && tapLoad > 0.01 && tsi && vt, `EQ − RAW: ${f(Math.min(...diff), 1)} … ${f(Math.max(...diff), 1)} dB (yayılım ${f(spread, 1)} dB) · V1A çıkışı EQ'da %${f(load * 100, 1)} farklı · "tap" yöntemi %${f(tapLoad * 100, 1)} farklı`, 'Kayıp frekansa bağlı (tek kazanç çarpanı değil); V1A yükü değişiyor; RAW\'da TSI ayrık, VT ≡ CO1');
      } },
    { id: 'EL-06', group: 'Elektriksel', title: 'Bright / Dark, dört konum', req: 'IR §8',
      run(ctx) {
        const op = ctx.base().op, fr = [200, 5000];
        const g = (br, dk, vol) => Amp.acSweep(P0(), S0(s => { s.sw.S3 = br; s.sw.S4 = dk; s.pots.VR1 = vol; }), fr, op).H('G2').mag.map(dB);
        const n = g('OFF', 'OFF', 0.3), b = g('ON', 'OFF', 0.3), d = g('OFF', 'ON', 0.3), bd = g('ON', 'ON', 0.3);
        const nF = g('OFF', 'OFF', 1), bF = g('ON', 'OFF', 1);
        const brt = b[1] - n[1], drk = d[1] - n[1], both = bd[1] - n[1], full = Math.max(Math.abs(bF[0] - nF[0]), Math.abs(bF[1] - nF[1]));
        const lowSame = Math.abs(b[0] - n[0]) < 0.5 && Math.abs(d[0] - n[0]) < 0.5;
        return res(brt > 1 && drk < -1 && lowSame && full < 0.05 && Math.abs(both - (brt + drk)) > 0.05, `5 kHz (volume %30): Bright ${f(brt, 2)} dB · Dark ${f(drk, 2)} dB · ikisi ${f(both, 2)} dB · tam volume'da Bright farkı ${f(full, 3)} dB`, 'Bright > +1 dB, Dark < −1 dB, 200 Hz\'de ≈ 0; tam volume\'da Bright farkı < 0,05 dB; ikisi birlikte ≠ basit toplam', 'Gerçek ağ etkileşimi: Bright C11 pot üst yarısını, Dark C12 kaynak empedansını görür.');
      } },
    { id: 'EL-07', group: 'Elektriksel', title: '6V6 DC çalışma noktası', req: 'IR §7',
      run(ctx) {
        const w = ctx.base().win, P = P0(), rk = D.resolve('R9', P).value;
        const ik = w.K6 / rk, sum = w.ia + w.ig2, drop = w.B1 - w.A6, dropE = w.ia * P.T2.rp;
        const ok = rel(ik, sum) < 0.005 && rel(drop, dropE) < 0.02 && w.A6 < w.B1 && rel(w.pa, (w.A6 - w.K6) * w.ia) < 0.01;
        return res(ok, `Ik = Vk/Rk = ${f(ik * 1e3, 2)} mA · Ia + Ig2 = ${f(w.ia * 1e3, 2)} + ${f(w.ig2 * 1e3, 2)} mA · Va ${f(w.A6, 1)} V · Pa ${f(w.pa, 2)} W · Pg2 ${f(w.pg2, 2)} W · OT DCR düşümü ${f(drop, 1)} V`, 'Ik = Ia + Ig2 (≤ %0,5) · B+1 − Va = Ia × R_primer (≤ %2) · Pa = (Va − Vk) × Ia', 'Bir şebeke periyodu ortalamaları. Deneysel profil; eldeki tüp ve trafo ile ölçülmedi.');
      } },
    { id: 'EL-08', group: 'Elektriksel', title: '320 / 325 VAC profilleri', req: 'IR §6.2',
      run(ctx) {
        const a = ctx.base().win, p = P0(); p.T1.vSec = 325;
        const b = ctx.steady('v325', p, S0()).win;
        const d = ['B1', 'B2', 'B3'].map(k => b[k] - a[k]), di = (b.ia - a.ia) * 1e3;
        const distinct = Math.abs(d[0] - d[2]) > 0.05 && di > 0.01 && d.every(v => v > 0);
        return res(distinct, `ΔB+1 ${f(d[0], 2)} V · ΔB+2 ${f(d[1], 2)} V · ΔB+3 ${f(d[2], 2)} V · ΔIa ${f(di, 2)} mA`, 'Bütün gerilim / akımlar yeniden çözülür; fark her düğümde aynı sabit değildir');
      } },
    { id: 'EL-09', group: 'Elektriksel', title: 'Soğuk açılış: kapasitör tepe gerilimleri ve 5Y3 akım darbesi', req: 'IR §6.2–6.3', heavy: true,
      run(ctx) {
        const sim = new Amp.Sim(P0(), S0());
        sim.step(Math.round(28 / sim.h));
        if (sim.error) return res(false, 'Çözücü hatası: ' + sim.error.msg, 'Hatasız çözüm');
        const st = ctx.base().win, pk = sim.peaks.cap, w = sim.win;
        const rat = id => D.BY_ID[id].rating.V;
        const ok = pk.C3 > st.B1 && pk.C4 > st.B2 && pk.C5 > st.B3 && sim.peaks.iRectPk > 0 && Math.abs(w.B1 - st.B1) < 2;
        const flag = ['C3', 'C4', 'C5'].filter(id => pk[id] > 0.9 * rat(id)).map(id => `${id} %${f(100 * pk[id] / rat(id), 0)}`);
        return res(ok, `Tepe: C3 ${f(pk.C3, 0)} V / ${rat('C3')} · C4 ${f(pk.C4, 0)} V / ${rat('C4')} · C5 ${f(pk.C5, 0)} V / ${rat('C5')} · 5Y3 tepe ${f(sim.peaks.iRectPk * 1e3, 0)} mA / plaka · 28 s sonunda B+1 ${f(w.B1, 1)} V`,
          `Açılış tepeleri kararlı değerlerin (${f(st.B1, 0)} / ${f(st.B2, 0)} / ${f(st.B3, 0)} V) üstünde ve kayıtlı; sonunda kararlı değere oturur`,
          (flag.length ? `TASARIM BULGUSU: nominal gerilimin %90'ı aşılıyor → ${flag.join(', ')} (K-10). ` : '') + 'Isınma zaman sabitleri temsilîdir; 5Y3 tepe akım sınırı için veri yok. İdeal yüksüz tepe 452,5 V (320 VAC).');
      } },
    { id: 'EL-10', group: 'Elektriksel', title: '4 / 8 / 16 Ω doğru eşleşme', req: 'IR §9',
      run() {
        const z = (jack, r, ideal) => {
          const st = S0(s => { s.loads = { J2: null, J3: null, J4: null }; s.loads[jack] = r; s.nfb = false; });
          const q = Amp.acSweep(P0(), st, [1000], null, { noTubes: true, idealOT: ideal, probe: 'A6' });
          const j = q.b.ckt.branch.get('VPROBE'), s0 = q.sol[0], ir = -s0.re[j], ii = -s0.im[j];
          const a6 = q.cx('A6')[0], b1 = q.cx('B1')[0], vr = a6[0] - b1[0], vi = a6[1] - b1[1], d = vr * vr + vi * vi;
          return 1 / ((ir * vr + ii * vi) / d);     // 1 / Re(Y): mıknatıslanma endüktansından bağımsız
        };
        const id = [z('J2', 4, true), z('J3', 8, true), z('J4', 16, true)], lossy = [z('J2', 4, false), z('J3', 8, false), z('J4', 16, false)];
        const ok = id.every(v => rel(v, 8000) < 1e-3);
        return res(ok, `İdeal: ${id.map(v => f(v, 1)).join(' / ')} Ω · kayıplı: ${lossy.map(v => f(v, 0)).join(' / ')} Ω`, 'İdeal modelde üç tapta 8000 Ω (≤ %0,1)', 'Kayıplı farkı: primer DCR 300 Ω + sekonder bölüm dirençlerinin n² ile yansıması (deneysel OT verisi).');
      } },
    { id: 'EL-11', group: 'Elektriksel', title: 'Yüksüz / yanlış / çoklu yük', req: 'IR §9.1',
      run(ctx) {
        const P = P0(), L = m => Amp.loadStatus(P, S0(s => { s.loads = m; }));
        const a = L({ J2: null, J3: null, J4: null }), b = L({ J2: null, J3: null, J4: 4 }), c = L({ J2: 4, J3: 8, J4: null }), d = L({ J2: null, J3: 8, J4: null });
        const codes = [a.code, b.code, c.code, d.code].join(', ');
        const okCodes = codes === 'YUKSUZ, YANLIS, COKLU, ESLESMIS' && a.danger && b.danger && c.danger && !d.danger && rel(b.zRef, 2000) < 1e-9;
        // Yüksüz çıkışta sinyal: model amfiyi durdurmaz, plaka gerilimi yükselir
        const base = ctx.base();
        const stN = S0(s => { s.loads = { J2: null, J3: null, J4: null }; s.src.amp = 0.05; });
        const sN = ctx.steady('noload', P, stN);
        const aN = Amp.audio(P, stN, sN.sim, { n: 4096, settleS: 0.05 }), aM = Amp.audio(P, S0(), base.sim, { n: 4096, settleS: 0.05 });
        const ok = okCodes && aN.avg.a6Max > aM.avg.a6Max * 1.3 && aN.avg.ia > 0.01 && !sN.sim.error;
        return res(ok, `Durumlar: ${codes} · 4 Ω yük 16 Ω jakta → ${f(b.zRef, 0)} Ω · yüksüz plaka tepe ${f(aN.avg.a6Max, 0)} V (eşleşmiş ${f(aM.avg.a6Max, 0)} V) · tüp akımı sürüyor (${f(aN.avg.ia * 1e3, 1)} mA)`,
          'Geçersiz / tehlikeli durum açıkça işaretli; yanlış jak 2000 Ω yansıtır; model hayalî koruma uygulamaz', 'Yüksüz plaka gerilimi yalnız doğrusal trafo modelinin sonucudur. Ark, izolasyon delinmesi ve nüve doyumu: model değerlendiremiyor.');
      } },
    { id: 'EL-12', group: 'Elektriksel', title: 'NFB doğru / ters polarite', req: 'IR §9.2',
      run(ctx) {
        const P = P0(), op = ctx.base().op, fr = Amp.logspace(20, 20000, 121), k1 = 68;
        const g = mod => Amp.acSweep(P, S0(mod), [1000], op).H('S4').mag[0];
        const on = g(), off = g(s => { s.nfb = false; }), rev = g(s => { s.otPhase = -1; });
        // Açık çevrim kazancı: R12 yerinde, tap ucu toprakta (katot yüklemesi korunur)
        const aol = Amp.acSweep(P, S0(), [1000], op, { nfbGround: true }).H('S4').mag[0];
        const lg = Amp.loopGain(P, S0(), fr, op), lr = Amp.loopGain(P, S0(s => { s.otPhase = -1; }), fr, op);
        const T1k = lg.T[k1], pred = aol / Math.hypot(1 + T1k[0], T1k[1]);
        const b = Amp.build(P, S0(s => { s.loads = { J2: null, J3: 8, J4: null }; })), r12 = b.ckt.R.find(q => q.id === 'R12');
        const tapFixed = [b.ckt.names[r12.a], b.ckt.names[r12.b]].includes('S4');
        const ok = T1k[0] > 0 && on < off && rel(on, pred) < 0.02 && lr.T[k1][0] < 0 && rev > off && tapFixed;
        return res(ok, `T(1 kHz) = ${f(Math.hypot(T1k[0], T1k[1]), 2)} ∠${f(lg.ph[k1], 0)}° · kazanç: NFB'li ${f(dB(on), 2)} dB, açık çevrim ${f(dB(aol), 2)} dB, R12 sökülü ${f(dB(off), 1)} dB, ters fazda ${f(dB(rev), 1)} dB · A/(1+T) öngörüsü ${f(dB(pred), 2)} dB · ters fazda Nyquist: ${lr.unstable ? 'KARARSIZ' : 'kararlı (|1+T| en az ' + f(lr.minDist, 2) + ')'}`,
          'Doğru fazda T > 0 ve kapalı çevrim kazancı = açık çevrim / (1+T) (≤ %2); ters fazda T < 0 ve kazanç artar; kaynak tapı 8 Ω kabinde de S4',
          'Açık çevrim, R12 katotta bırakılıp tap ucu topraklanarak ölçülür: R12\'yi sökmek katot yükünü de değiştirdiği için 1/(1+T) ile karşılaştırılamaz. Kararlılık yalnız 20 Hz – 20 kHz ve modellenen fazlar (Lp, kaçak endüktans, kuplaj) için geçerlidir; sargı kapasitesi ve hoparlör empedansı modelde yok.');
      } },
    { id: 'EL-13', group: 'Elektriksel', title: 'Küçük sinyal → aşırı sürüş', req: 'IR §7.2', heavy: true,
      run(ctx) {
        const P = P0(), base = ctx.base();
        const stS = S0(s => { s.src.amp = 0.002; }), aS = Amp.audio(P, stS, base.sim);
        const ac = Amp.acSweep(P, stS, [1000], base.op).H('S4').mag[0];
        const stO = S0(s => { s.src.amp = 0.5; s.pots.VR1 = 1; }), sO = ctx.steady('od', P, stO), aO = Amp.audio(P, stO, sO.sim);
        const asym = Math.abs(aO.stat.OUT.pkPos - aO.stat.OUT.pkNeg) / Math.max(aO.stat.OUT.pkPos, aO.stat.OUT.pkNeg);
        const h2 = aO.spec.OUT.h[1].dBc;
        const ok = rel(aS.gain, ac) < 0.02 && aS.thd < 0.01 && aO.thd > 0.1 && asym > 0.05 && h2 > -40 && aO.avg.ig1Max > 1e-5 && aO.gain < aS.gain * 2;
        return res(ok, `2 mV: kazanç ${f(aS.gain, 1)} (AC analizi ${f(ac, 1)}), THD %${f(aS.thd * 100, 2)} · 0,5 V + tam volume: THD %${f(aO.thd * 100, 0)}, tepe +${f(aO.stat.OUT.pkPos, 1)} / −${f(aO.stat.OUT.pkNeg, 1)} V, H2 ${f(h2, 0)} dBc, 6V6 grid akımı tepe ${f(aO.avg.ig1Max * 1e3, 2)} mA`,
          'Küçük sinyalde zaman alanı kazancı = AC kazancı (≤ %2), THD < %1; aşırı sürüşte THD > %10, asimetrik kırpılma, çift harmonik, grid iletimi',
          `FFT: ${aS.opt.fs / 1000} kHz, N = ${aS.opt.n}, Hann, yerleşme ${aS.opt.settleS * 1000} ms, ${aS.opt.nHarm} harmonik. Aşırı sürüşte çıkış gücü ve ekran gücü yaklaşık değerdir (6V6 model kartı).`);
      } },
    { id: 'EL-14', group: 'Elektriksel', title: 'Güç kapatma / bleeder varyantı', req: 'IR §15', heavy: true,
      run() {
        // (a) Sıcak kapatma: tüpler iletimde; kapasitörler tüpler üzerinden boşalır ama anında sıfır olmaz.
        // (b) Soğuk kapatma: açılıştan 3 s sonra (yalnız 5Y3 iletimde, kapasitörler dolu) kapatılır;
        //     tüpler hiç iletime geçmediği için bleeder yoksa yük kalmaz.
        const hot = () => {
          const st = S0(), sim = new Amp.Sim(P0(), st, { hot: true, h: 2.5e-4 });
          sim.step(Math.round(1.5 / sim.h)); const b0 = sim.win.B1; st.mainsOn = false;
          sim.step(Math.round(0.04 / sim.h)); return { b0, b1: sim.win.B1, err: sim.error };
        };
        const cold = bleeder => {
          const p = P0(); p.fitted.R16 = bleeder;
          const st = S0(), sim = new Amp.Sim(p, st, { h: 2.5e-4 });
          sim.step(Math.round(3 / sim.h)); const b0 = sim.win.B1; st.mainsOn = false;
          sim.step(Math.round(40 / sim.h));
          return { b0, b40: sim.win.B1, err: sim.error };
        };
        const h = hot(), a = cold(false), b = cold(true);
        const tau = 220e3 * (16e-6 + 10e-6 + 10e-6), expB = b.b0 * Math.exp(-40 / tau);
        const ok = !h.err && !a.err && !b.err && h.b1 > 0.5 * h.b0 && h.b1 < h.b0 && a.b40 > 0.95 * a.b0 && b.b40 < 0.05 * b.b0 && b.b40 > 0;
        return res(ok, `Sıcak kapatma: ${f(h.b0, 0)} V → 40 ms sonra ${f(h.b1, 0)} V (tüpler üzerinden boşalıyor) · soğuk kapatma, bleeder yok: ${f(a.b0, 0)} V → 40 s sonra ${f(a.b40, 0)} V · 220 kΩ bleeder: ${f(b.b0, 0)} V → 40 s sonra ${f(b.b40, 1)} V (kaba RC öngörüsü ${f(expB, 1)} V)`,
          'Kapatınca B+ anında sıfıra inmez; tüpler iletimde değilken bleeder yoksa gerilim kalır (≥ %95); bleeder ile 40 s\'de < %5',
          'İlk yazımda sıcak kapatmada da gerilimin kalacağı beklenmişti; bu fiziksel olarak yanlıştı (sıcak tüpler kapasitörleri ~0,5 s içinde boşaltır) ve test tehlikeli durumu, yani tüpler iletimde değilken kapatmayı sınayacak biçimde düzeltildi. Soğuma zaman sabitleri temsilîdir; kapasitör kaçağı modelde yok. Boşaldığı her durumda ölçülmelidir.');
      } },

    // ================================ SAYISAL ================================
    { id: 'NU-01', group: 'Sayısal', title: 'Pasif analitik ağ', req: 'IR §16',
      run() {
        const out = []; let worst = 0;
        // 1) Low bölücü 2) volume bölücü (RAW, tüpsüz): CO1 sürülür, G2 okunur
        const lo = Amp.acSweep(P0(), S0(s => { s.sw.S1 = 'LOW'; }), [1000], null, { noTubes: true }).H('G1').mag[0];
        worst = Math.max(worst, rel(lo, 0.5)); out.push(`Low ${f(lo, 5)}`);
        for (const p of [0.25, 0.5, 0.75]) {
          const g = Amp.acSweep(P0(), S0(s => { s.pots.VR1 = p; }), [1000], null, { noTubes: true, probe: 'CO1' }).H('G2').mag[0];
          worst = Math.max(worst, rel(g, p)); out.push(`vol ${p} → ${f(g, 5)}`);
        }
        // 3) DC bölücü: B+ zinciri, tüpsüz ve yüksüz → akım yok, üç düğüm eşit
        const b = Amp.build(P0(), S0(), { supply: 'dc', b1: 400, noTubes: true }), x = MNA.dc(b.ckt).x;
        worst = Math.max(worst, rel(b.v(x, 'B3'), 400)); out.push(`B+3 yüksüz ${f(b.v(x, 'B3'), 3)} V`);
        return res(worst < 1e-3, out.join(' · ') + ` · en büyük bağıl hata ${worst.toExponential(1)}`, 'Bağıl hata ≤ %0,1', 'Sıfıra yakın sonuç yok; mutlak tolerans gerekmedi. Kalan hata: 1 pS düğüm iletkenliği (GMIN).');
      } },
    { id: 'NU-02', group: 'Sayısal', title: 'TMB AC yanıtı, bağımsız el türetimine karşı', req: 'IR §16',
      run() {
        const P = P0(), fr = Amp.logspace(20, 20000, 61), V = id => D.resolve(id, P).value;
        let worst = 0, skipped = 0, n = 0;
        for (const set of [[0.5, 0.5, 0.5], [1, 0, 0.5], [0, 1, 1], [0.3, 0.8, 0.1], [1, 1, 1], [0, 0, 0]]) {
          const st = S0(s => { s.sw.S2 = 'EQ'; s.pots.VR2 = set[0]; s.pots.VR3 = set[1]; s.pots.VR4 = set[2]; s.pots.VR1 = 1; });
          const got = Amp.acSweep(P, st, fr, null, { noTubes: true, probe: 'CO1' }).H('VT').mag;
          const R = Amp.RMIN, ft = set[0], fb = Amp.taperFn(P.tapers.VR3, set[1]), fm = Amp.taperFn(P.tapers.VR4, set[2]);
          const v = { CT: V('C8'), RS: V('R13'), CB: V('C9'), CM: V('C10'), RTu: Math.max(R, (1 - ft) * V('VR2')), RTl: Math.max(R, ft * V('VR2')), RB: Math.max(R, fb * V('VR3')), RM: Math.max(R, fm * V('VR4')), RL: V('VR1') + R };
          fr.forEach((fq, i) => {
            const ref = tmbReference(fq, v); n++;
            if (ref < 1e-4 || got[i] < 1e-4) { skipped++; return; }     // −80 dB altı: karşılaştırma geçersiz
            worst = Math.max(worst, Math.abs(dB(got[i]) - dB(ref)));
          });
        }
        return res(worst < 0.25, `En büyük fark ${worst.toExponential(2)} dB (${n} nokta, ${skipped} tanesi −80 dB altında olduğu için dışarıda)`, '20 Hz – 20 kHz, 6 pot düzeni, ≤ 0,25 dB', 'Referans aynı topolojiyi varsayar (bağımsız kod, aynı devre). Topolojinin kendisi açık karardır (K-05). Tüpsüz, ideal kaynakla.');
      } },
    { id: 'NU-03', group: 'Sayısal', title: 'DC çalışma noktası, bağımsız yük doğrusu çözümüne karşı', req: 'IR §16',
      run(ctx) {
        const P = P0(), op = ctx.base().op.m, V = id => D.resolve(id, P).value;
        const t = Tubes.CARDS[P.models.V1A].p, ra = V('R4'), rk = V('R5');
        const ia = bisect(i => i - Tubes.triodeIp(t, -i * rk, op.B3 - i * (ra + rk)), 0, op.B3 / (ra + rk));
        const pa = op.B3 - ia * ra, ka = ia * rk;
        const p6 = Tubes.CARDS[P.models.V2].p, r9 = V('R9'), o = [0, 0];
        const ik = bisect(i => { const vk = i * r9; Tubes.pentodeI(p6, -vk, op.B2 - vk, op.A6 - vk, o); return i - (o[0] + o[1]); }, 0, 0.3);
        const e = [rel(op.PA, pa), rel(op.KA, ka), rel(op.K6, ik * r9)], worst = Math.max(...e);
        return res(worst < 0.01, `V1A plaka ${f(op.PA, 2)} V (referans ${f(pa, 2)}) · V1A katot ${f(op.KA, 4)} V (${f(ka, 4)}) · 6V6 katot ${f(op.K6, 3)} V (${f(ik * r9, 3)}) · en büyük fark %${f(worst * 100, 3)}`, 'Düğüm gerilimlerinde ≤ %1', 'Aynı tüp denklemi, bağımsız skaler ikiye bölme çözümü: çözücüyü doğrular, tüp modelinin fiziksel doğruluğunu DEĞİL.');
      } },
    { id: 'NU-03b', group: 'Sayısal', title: 'ngspice referans karşılaştırması', req: 'IR §11, T5',
      run() { return { status: 'notrun', measured: '—', expected: 'Aynı netlist ve tüp modeliyle DC / AC / zaman alanı farkları', note: 'ÇALIŞTIRILMADI: bu ortamda ngspice kurulu değil. Netlist dışa aktarımı hazır (Olay günlüğü → Dışa aktar → Netlist). İki modelin aynı sayıyı vermesi, aynı varsayımı paylaşıyorlarsa fiziksel doğrulama değildir.' }; } },
    { id: 'NU-04', group: 'Sayısal', title: 'Adım yakınsaması', req: 'IR §16', heavy: true,
      run(ctx) {
        const P = P0(), base = ctx.base(), st = S0(s => { s.src.amp = 0.05; });
        const a = Amp.audio(P, st, base.sim, { fs: 96000, n: 8192 }), b = Amp.audio(P, st, base.sim, { fs: 192000, n: 16384 });
        const eR = rel(a.stat.OUT.rmsAc, b.stat.OUT.rmsAc), eP = rel(a.stat.OUT.pkPos, b.stat.OUT.pkPos), eT = Math.abs(a.thd - b.thd) * 100;
        const s1 = ctx.base().win, s2 = Amp.steady(P, S0(), { h: 5e-5 }).win, eB = rel(s1.B1, s2.B1), eI = rel(s1.ia, s2.ia);
        const ok = eR < 0.01 && eP < 0.01 && eT < 0.1 && eB < 0.001 && eI < 0.002;
        return res(ok, `96 → 192 kHz: RMS %${f(eR * 100, 3)}, tepe %${f(eP * 100, 3)}, THD ${f(eT, 3)} yüzde puan · besleme 100 → 50 µs: B+1 %${f(eB * 100, 4)}, Ia %${f(eI * 100, 4)}`, 'Adım yarıya inince RMS / tepe ≤ %1, THD ≤ 0,1 yüzde puan; B+1 ≤ %0,1', '50 mV, 1 kHz, 4 Ω eşleşmiş yük. Hann penceresi, 85 ms pencere süresi sabit.');
      } },
    { id: 'NU-05', group: 'Sayısal', title: 'Aynı deneyin tekrarı', req: 'IR §16',
      run(ctx) {
        const P = P0(), base = ctx.base(), st = S0(), o = { n: 2048, settleS: 0.02 };
        const a = Amp.audio(P, st, base.sim, o), b = Amp.audio(P, st, base.sim, o);
        let same = true; for (let i = 0; i < a.buf.OUT.length; i++) if (a.buf.OUT[i] !== b.buf.OUT[i]) { same = false; break; }
        return res(same && a.thd === b.thd, same ? 'İki çalıştırma bit düzeyinde aynı' : 'Fark var', 'Aynı sürüm ve girişte aynı sonuç', 'Modelde rastgele sayı kullanılmaz; tohum gerekmez.');
      } },
    { id: 'NU-06', group: 'Sayısal', title: 'Oynatma hızından bağımsızlık', req: 'IR §16',
      run() {
        const total = 6000, runs = [1, 37, 333, 6000].map(chunk => { const s = new Amp.Sim(P0(), S0()); let n = 0; while (n < total) n += s.step(Math.min(chunk, total - n)); return s; });
        const ref = runs[0].tr.x; let same = true;
        for (const s of runs) for (let i = 0; i < ref.length; i++) if (s.tr.x[i] !== ref[i]) same = false;
        const hist = runs.every(s => s.history.length === runs[0].history.length && s.history[s.history.length - 1].B1 === runs[0].history[runs[0].history.length - 1].B1);
        return res(same && hist, same ? `Kare başına 1 / 37 / 333 / 6000 adım: ${total} adım sonunda durum vektörü ve kayıt bit düzeyinde aynı` : 'Fark var', 'Hız değişimi aynı simülasyon anında aynı ölçümleri verir', 'Hız yalnızca birim gerçek zamanda atılan sabit 100 µs\'lik adım sayısını değiştirir.');
      } },

    // ================================ VERİ / ARAYÜZ ================================
    { id: 'UI-01', group: 'Veri / arayüz', title: 'Veri tutarlılığı: şema, denetçi, netlist ve BOM', req: 'IR §14, §16',
      run() {
        const P = P0(), problems = []; let combos = 0;
        for (const s1 of ['HIGH', 'LOW']) for (const s2 of ['EQ', 'RAW']) for (const s3 of ['OFF', 'ON']) for (const s4 of ['OFF', 'ON']) for (const m of ['lift', 'tap']) {
          const p = D.cloneProfile(P); p.rawMethod = m;
          const st = S0(s => { s.sw = { S1: s1, S2: s2, S3: s3, S4: s4 }; });
          combos++;
          let b; try { b = Amp.build(p, st); } catch (e) { problems.push(`${s1}/${s2}/${s3}/${s4}/${m}: ${e.message}`); continue; }
          const sch = Sch.build({ author: '', source: '', date: '' }, p, st);
          for (const c of D.COMPONENTS) {
            if (!sch.ids.includes(c.id)) problems.push(`${c.id} şemada yok`);
            if (c.type === 'R' || c.type === 'C') {
              const el = (c.type === 'R' ? b.ckt.R : b.ckt.C).find(e => e.id === c.id), want = D.resolve(c.id, p).value;
              if (!D.isFitted(c.id, p) || (c.id === 'R12' && !st.nfb)) { if (el) problems.push(`${c.id} takılı değil ama netlistte`); continue; }
              if (!el) { problems.push(`${c.id} netlistte yok (${s1}/${s2})`); continue; }
              const got = c.type === 'R' ? el.r : el.c;
              if (got !== want) problems.push(`${c.id}: netlist ${got} ≠ tanım ${want}`);
              const txt = U.fmt(want, c.unit === 'Ω' ? '' : c.unit).replace(/ /g, '');
              if (!sch.svg.includes(txt)) problems.push(`${c.id}: şemada "${txt}" yok`);
            }
          }
        }
        const rows = Bom.rows(P);
        for (const c of D.COMPONENTS) { if (c.id === 'V1B') continue; const r = rows.find(q => q.id === c.id); if (!r) problems.push(`${c.id} BOM'da yok`); else if (r.value !== Bom.valueText(c.id, P)) problems.push(`${c.id} BOM değeri farklı`); }
        // Tek noktadan değişiklik: C1 değeri değişince netlist, şema ve BOM birlikte izlemeli
        const p2 = D.cloneProfile(P); p2.overrides = { C1: 47e-9 };
        const b2 = Amp.build(p2, S0()), sc2 = Sch.build({ author: '', source: '', date: '' }, p2, S0()), bm2 = Bom.rows(p2).find(q => q.id === 'C1');
        if (b2.ckt.C.find(e => e.id === 'C1').c !== 47e-9 || !sc2.svg.includes('47nF') || !bm2.value.includes('47 nF')) problems.push('C1 değişikliği dört görünüme birlikte yansımadı');
        if (D.designHash(p2) === D.designHash(P)) problems.push('Deney kimliği değişikliği yansıtmıyor');
        return res(!problems.length, problems.length ? problems.slice(0, 4).join(' · ') : `${combos} anahtar / yöntem kombinasyonu; ${D.COMPONENTS.length} bileşen; tek noktadan değişiklik dört görünümde`, 'Şema, netlist ve BOM aynı referans / değerleri taşır; bütün anahtar kombinasyonları kurulur');
      } },
    { id: 'UI-02', group: 'Veri / arayüz', title: 'Kullanım: klavye, dar ekran, sıfırla / devam, içe aktarım, iptal', req: 'IR §16',
      run() { return { status: 'notrun', measured: '—', expected: 'Gerçek hedef tarayıcılarda elle test', note: 'Otomatik takımda ÇALIŞTIRILMAZ. Elle yapılan tarayıcı kontrolü docs/DOGRULAMA.md içinde ayrıca kayıtlıdır; yalnız headless sonuçla yetinilmez.' }; } },
    { id: 'UI-03', group: 'Veri / arayüz', title: 'Geçersiz veri reddi ve dürüst hata', req: 'IR §14, §16',
      run() {
        const bad = [];
        const same = ['22n', '22 nF', '0,022 µF', '0.022uF', '22e-9'].map(t => U.parse(t, 'F'));
        if (!same.every(r => r.ok && Math.abs(r.value - 22e-9) < 1e-18)) bad.push('22n / 22 nF / 0,022 µF eşit çevrilmedi');
        if (U.parse('4k7').value !== 4700 || U.parse('1,5k', 'Ω').value !== 1500) bad.push('4k7 / 1,5k');
        for (const t of ['-5k', 'abc', '', '1e999', 'NaN', '12 V']) if (U.parse(t, 'Ω').ok) bad.push(`"${t}" kabul edildi`);
        if (U.parsePositive('0', 'Ω').ok) bad.push('0 Ω kabul edildi');
        const p1 = P0(); p1.overrides = { R4: -100 }; if (!D.validateProfile(p1).length) bad.push('negatif değer');
        const p2 = P0(); p2.overrides = { R4: NaN }; if (!D.validateProfile(p2).length) bad.push('NaN');
        const p3 = P0(); p3.values.XX = 1; if (!D.validateProfile(p3).length) bad.push('bilinmeyen bileşen');
        const p4 = P0(); p4.schema = 99; if (!D.validateProfile(p4).length) bad.push('şema sürümü');
        const thr = (fn, cls) => { try { fn(); return false; } catch (e) { return e instanceof cls; } };
        const p5 = P0(); delete p5.values.C8;
        if (!thr(() => Amp.build(p5, S0(s => { s.sw.S2 = 'EQ'; })), Amp.ProfileError)) bad.push('açık değerle netlist kuruldu');
        if (D.resolve('C8', p5).status !== 'ACIK') bad.push('açık değer "ACIK" görünmüyor');
        const p6 = P0(); delete p6.models.V2; if (!thr(() => Amp.build(p6, S0()), Amp.ProfileError)) bad.push('eksik tüp modeli');
        if (!thr(() => Amp.build(P0(), S0(s => { s.pots.VR1 = 1.5; })), Amp.ProfileError)) bad.push('pot aralık dışı');
        const z = DSP.harmonics(new Float64Array(1024), 48000, 1000);
        if (z.valid || Number.isFinite(z.thd)) bad.push('sıfır sinyalde THD sayı döndü');
        if (DSP.dB(0) !== null) bad.push('0 için dB sayı döndü');
        // Tekil devre: açık hata, yeşil sonuç değil
        const c = new MNA.Circuit(); c.addV('V1', 'a', 'GND', 1); c.addV('V2', 'a', 'GND', 2); c.finalize();
        if (!thr(() => MNA.dc(c), MNA.SolverError)) bad.push('çelişkili devre hata vermedi');
        return res(!bad.length, bad.length ? 'Kabul edilen geçersiz durum: ' + bad.join(', ') : 'Birim çevrimi tutarlı; negatif / NaN / sonsuz / bilinmeyen / eksik model / açık değer / tekil devre reddedildi', 'Geçersiz veri reddedilir; NaN, eksik model ve yarım analiz yeşil başarıya dönüşmez');
      } },
  ];

  /** Tümünü (ya da seçilenleri) çalıştırır. onResult her testten sonra çağrılır. Hata → 'fail' + mesaj. */
  function runOne(t, ctx) {
    const t0 = Date.now();
    let r;
    try { r = t.run(ctx); }
    catch (e) { r = { status: 'fail', measured: `${e.name}: ${e.message}`, expected: '—', note: 'Test çalışırken istisna oluştu; sonuç üretilemedi.' }; }
    return Object.assign({ id: t.id, group: t.group, title: t.title, req: t.req, ms: Date.now() - t0 }, r);
  }

  const api = { TESTS, makeCtx, runOne };
  if (node) module.exports = api;
  root.AmpTests = api;
})(typeof self !== 'undefined' ? self : this);
