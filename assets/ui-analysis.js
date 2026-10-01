/*
 * Grafikler ve analiz yürütücüsü.
 *   - Besleme grafiği: canlı simülasyonun şebeke periyodu özetleri (gösterim kaydı).
 *   - Ses analizi: ayrı ham tampon; ana iş parçacığında dilimler hâlinde çalışır, iptal edilebilir.
 *     Yarım kalan ya da geçersizleşen sonuç "tamam" olarak gösterilmez.
 *   - Frekans cevabı / NFB çevrimi: DC çalışma noktasında küçük sinyal AC.
 */
(function () {
  'use strict';
  const B = window.Bench, D = window.Design, Amp = window.Amp, DSP = window.DSP;
  const $ = B.$, num = B.num;
  const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const dB = x => (x > 0 && Number.isFinite(x) ? 20 * Math.log10(x) : null);

  // --- Besleme grafiği ----------------------------------------------------------------------
  const chSupply = new LineChart($('chSupply'), {
    xLabel: 's', minSpan: 5, xDigits: 2, tipW: 130,
    left: { min: 0, max: 550, label: 'V', step: 100 },
    series: [{ key: 'B1', color: cssv('--ink'), label: 'B+1', digits: 1 }, { key: 'B2', color: cssv('--cc'), label: 'B+2', digits: 1, width: 1.6 }, { key: 'B3', color: cssv('--a28'), label: 'B+3', digits: 1, width: 1.6 }],
    refLines: [{ axis: 'left', value: 450, color: cssv('--fault'), label: '450 V', right: true }, { axis: 'left', value: 500, color: cssv('--ink-3'), label: '500 V', right: true }],
  });
  function drawSupply() {
    const s = B.sim, H = s.history, span = 45;
    const xMax = Math.max(5, s.t), xMin = Math.max(0, xMax - span);
    const rows = xMin > 0 ? H.filter(r => r.t >= xMin) : H;
    let top = 550; for (const r of rows) if (r.B1Max > top - 10) top = Math.ceil((r.B1Max + 20) / 50) * 50;
    chSupply.o.left.max = top;
    chSupply.draw(rows, { xMin, xMax });
    const pk = s.peaks.cap;
    $('supplyNote').innerHTML = pk.C3 != null ? `<span>tepe: <b>C3 ${num(pk.C3, 0)}</b> · <b>C4 ${num(pk.C4, 0)}</b> · <b>C5 ${num(pk.C5, 0)} V</b></span>` : '';
  }

  // --- Analiz durumu -------------------------------------------------------------------------
  const A = B.analysis = { status: 'wait', res: null, ac: null, lg: null, gen: null, progress: 0, pending: true, msg: '', since: 0, expId: null };
  const FREQS = Amp.logspace(20, 20000, 121);
  B.analysisBusy = () => !!A.gen;

  B.invalidate = function (reason) {
    if (A.gen) { A.gen = null; }
    if (A.status === 'ok' || A.status === 'stale') { A.status = 'stale'; A.msg = (reason || 'Ayar değişti') + ': gösterilen sonuç GEÇERSİZ, yeniden hesaplanacak.'; }
    else { A.status = 'wait'; }
    A.pending = true; A.since = performance.now(); renderStatus();
  };
  B.hooks.struct.push(() => B.invalidate('Devre değişti'));
  B.hooks.reset.push(() => { A.res = null; A.ac = null; A.lg = null; A.status = 'wait'; A.pending = true; A.since = performance.now(); drawView(); });

  function startAnalysis() {
    const s = B.sim, st = Amp.cloneState(B.st), P = B.profile;
    A.pending = false; A.progress = 0; A.expId = B.expId();
    try {
      const op = Amp.dcOp(P, st, s.win.B1);
      const cur = Amp.acSweep(P, st, FREQS, op);
      const alt = Amp.cloneState(st); alt.sw.S2 = st.sw.S2 === 'EQ' ? 'RAW' : 'EQ';
      const ref = Amp.acSweep(P, alt, FREQS, Amp.dcOp(P, alt, s.win.B1));
      const outNode = n => (n.b.loads.length ? n.b.loads[n.b.loads.length - 1].node : 'S4');
      A.ac = { op, altName: alt.sw.S2, curName: st.sw.S2,
        out: cur.H(outNode(cur)), g2: cur.H('G2'), refOut: ref.H(outNode(ref)), refG2: ref.H('G2'), zin: cur.zin };
      A.lg = Amp.loopGain(P, st, FREQS, op);
      A.gen = Amp.audioGen(P, st, s);
      A.gen.next();                      // başlangıç durumunu hemen yakala
      A.status = 'run'; A.msg = '';
    } catch (e) {
      if (!(e instanceof MNA.SolverError) && !(e instanceof Amp.ProfileError)) throw e;
      A.gen = null; A.status = 'bad'; A.res = null;
      A.msg = `Analiz çalıştırılamadı: ${e.message} Bu bir çözücü / profil hatasıdır; fiziksel arıza olarak yorumlanmaz.`;
    }
    renderStatus(); drawView();
  }

  B.analysisTick = function () {
    if (A.gen) {
      const t0 = performance.now();
      try {
        while (performance.now() - t0 < 9) {
          const r = A.gen.next();
          if (r.done) { A.res = r.value; A.gen = null; A.status = 'ok'; A.msg = ''; drawView(); B.renderFast(); break; }
          A.progress = r.value;
        }
      } catch (e) {
        if (!(e instanceof MNA.SolverError)) throw e;
        A.gen = null; A.res = null; A.status = 'bad';
        A.msg = `Ses analizi yakınsamadı: ${e.message} Sonuç üretilmedi (sayısal hata; fiziksel arıza değil).`;
        drawView();
      }
      renderStatus(); return;
    }
    if (!A.pending) return;
    const s = B.sim;
    let why = null;
    if (B.profileError) why = 'profil geçersiz';
    else if (s.error) why = 'canlı çözücü hata verdi';
    else if (!B.st.mainsOn) why = 'güç kapalı';
    else if (!s.win || !s.isSteady()) why = 'kararlı durum bekleniyor';
    if (why) { if (A.waitWhy !== why) { A.waitWhy = why; renderStatus(); } return; }
    A.waitWhy = null;
    if (performance.now() - A.since > 350) startAnalysis();
  };

  function renderStatus() {
    const el = $('astat'), tx = $('astatText');
    let cls = '', html = '';
    const o = Amp.AUDIO_DEFAULTS, cfg = `${o.fs / 1000} kHz · N = ${o.n} · Hann · yerleşme ${o.settleS * 1000} ms · ${o.nHarm} harmonik`;
    if (A.status === 'run') { cls = 'run'; html = `Ses analizi hesaplanıyor <progress max="1" value="${A.progress.toFixed(2)}"></progress> %${Math.round(A.progress * 100)} <button class="btn sm" id="aCancel">İptal</button>`; }
    else if (A.status === 'ok') { cls = 'ok'; html = `Analiz tamam · ${cfg} · deney ${A.expId} · ${A.res.steps} adım, ort. ${num(A.res.itersAvg, 1)} / en çok ${A.res.itersMax} Newton yinelemesi`; }
    else if (A.status === 'stale') { cls = 'stale'; html = A.msg + (A.waitWhy ? ` (${A.waitWhy})` : ''); }
    else if (A.status === 'bad') { cls = 'bad'; html = A.msg + ` <button class="btn sm" id="aRetry">Yeniden dene</button>`; }
    else if (A.status === 'cancel') { cls = 'bad'; html = `Analiz iptal edildi: sonuç yok. <button class="btn sm" id="aRetry">Çalıştır</button>`; }
    else { html = `Analiz çalıştırılmadı${A.waitWhy ? ': ' + A.waitWhy : ''}.`; }
    el.className = 'astat ' + cls; tx.innerHTML = html;
  }
  $('astat').addEventListener('click', e => {
    if (e.target.id === 'aCancel') { A.gen = null; A.res = null; A.status = 'cancel'; A.pending = false; renderStatus(); drawView(); }
    if (e.target.id === 'aRetry') { A.pending = true; A.since = 0; A.status = 'wait'; renderStatus(); }
  });

  // --- Görünümler -----------------------------------------------------------------------------
  let view = 'scope', chart = null;
  const PROBE_UI = [['IN', 'Giriş', '--ink-3'], ['PA', 'V1A plaka', '--c3'], ['G2', 'V1B grid', '--redline'], ['PB', 'V1B plaka', '--a28'], ['A6', '6V6 plaka', '--fault'], ['OUT', 'Hoparlör', '--ink']];
  const ui = { probes: { IN: true, PA: false, G2: false, PB: true, A6: false, OUT: true }, norm: true, target: 'out', normF: false };

  function setView(v) {
    view = v;
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === v));
    const o = $('viewOpts');
    if (v === 'scope') o.innerHTML = PROBE_UI.map(([k, t, c]) => `<label><input type="checkbox" data-probe="${k}" ${ui.probes[k] ? 'checked' : ''}><i style="color:var(${c})"></i>${t}</label>`).join('') +
      `<label title="Her iz kendi tepe değerine bölünür; gerçek genlikler aşağıda"><input type="checkbox" data-opt="norm" ${ui.norm ? 'checked' : ''}>kendi tepesine ölçekle</label>`;
    else if (v === 'freq') o.innerHTML = `<label>ölçüm noktası <select data-opt="target"><option value="out" ${ui.target === 'out' ? 'selected' : ''}>hoparlör çıkışı</option><option value="g2" ${ui.target === 'g2' ? 'selected' : ''}>V1B gridi (ton + volume sonrası)</option></select></label>` +
      `<label title="İki eğri 1 kHz'de 0 dB'ye çekilir: seviye farkı ayrılır, yalnız ton farkı kalır"><input type="checkbox" data-opt="normF" ${ui.normF ? 'checked' : ''}>1 kHz'de normalize et</label>`;
    else o.innerHTML = '';
    chart = null; drawView();
  }
  document.querySelector('.plot.tall .seg').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  $('viewOpts').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.probe) ui.probes[t.dataset.probe] = t.checked;
    else if (t.dataset.opt === 'target') ui.target = t.value;
    else if (t.dataset.opt) ui[t.dataset.opt] = t.checked;
    chart = null; drawView();
  });

  const blank = msg => { const c = $('chView'), ctx = c.getContext('2d'); const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; c.width = r.width * dpr; c.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height); ctx.fillStyle = cssv('--ink-3'); ctx.font = `13px ${cssv('--font-body')}`; ctx.textAlign = 'center'; ctx.fillText(msg, r.width / 2, r.height / 2); };

  function drawView() {
    const a = A.res, m = $('viewMeas');
    if (view === 'scope' || view === 'spec') {
      if (!a) { m.innerHTML = ''; return blank(A.status === 'run' ? 'Hesaplanıyor…' : 'Ses analizi sonucu yok'); }
      view === 'scope' ? drawScope(a) : drawSpec(a);
    } else {
      if (!A.ac) { m.innerHTML = ''; return blank('AC analizi sonucu yok'); }
      view === 'freq' ? drawFreq() : drawNfb();
    }
  }

  function drawScope(a) {
    const fs = a.opt.fs, N = a.opt.n, show = Math.min(N, Math.round(3 * fs / a.f0)), step = Math.max(1, Math.floor(show / 900));
    const sel = PROBE_UI.filter(([k]) => ui.probes[k]);
    const rows = [];
    let lo = Infinity, hi = -Infinity;
    const sc = {}; sel.forEach(([k]) => { const s = a.stat[k]; sc[k] = ui.norm ? (Math.max(s.pkPos, s.pkNeg) || 1) : 1; });
    for (let i = N - show; i < N; i += step) {
      const r = { t: (i - (N - show)) / fs * 1000 };
      for (const [k] of sel) { const v = (a.buf[k][i] - a.stat[k].dc) / sc[k]; r[k] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
      rows.push(r);
    }
    if (!sel.length) { lo = -1; hi = 1; }
    const pad = (hi - lo) * 0.08 || 1;
    chart = new LineChart($('chView'), { xLabel: 'ms', xDigits: 3, tipW: 170, minSpan: 0.001,
      left: { min: ui.norm ? -1.15 : lo - pad, max: ui.norm ? 1.15 : hi + pad, label: ui.norm ? 'tepe = 1' : 'V (AC)' },
      series: sel.map(([k, t, c]) => ({ key: k, color: cssv(c), label: t, width: k === 'OUT' ? 2 : 1.5, digits: 3 })),
      refLines: [{ axis: 'left', value: 0, color: cssv('--ink-3'), label: '' }] });
    chart.draw(rows, { xMin: 0, xMax: show / fs * 1000 });
    const o = a.stat.OUT;
    $('viewMeas').innerHTML = (a.out ? `Hoparlör (${a.out.jack}, ${a.out.r} Ω): <b>${num(o.rmsAc, 2)} V RMS</b> · tepe <b>+${num(o.pkPos, 2)} / −${num(o.pkNeg, 2)} V</b> · ortalama güç <b>${num(a.avg.pOut, 2)} W</b> · kazanç <b>${num(dB(a.gain), 1)} dB</b>` : 'Yük yok: çıkış gücü tanımsız.') +
      ` · 6V6 sinyal altında: Pa <b>${num(a.avg.pa, 1)} W</b>, Ia ort. <b>${num(a.avg.ia * 1000, 1)} mA</b>, plaka tepe <b>${num(a.avg.a6Max, 0)} V</b>` +
      sel.map(([k, t]) => ` · ${t} ${num(a.stat[k].rmsAc, a.stat[k].rmsAc < 1 ? 4 : 2)} V RMS`).join('');
  }

  function drawSpec(a) {
    const sp = a.spec.OUT, s = sp.spec, a1 = sp.h[0].amp, rows = [];
    for (let k = 2; k < s.amp.length; k++) { const f = k * s.df; if (f > 20000) break; rows.push({ f, d: Math.max(-130, 20 * Math.log10(Math.max(s.amp[k], 1e-12) / a1)) }); }
    chart = new LineChart($('chView'), { xLabel: 'Hz', xLog: true, xDigits: 0, tipW: 150, left: { min: -120, max: 5, label: 'dBc', step: 20 },
      series: [{ key: 'd', color: cssv('--ink'), label: 'çıkış', width: 1.2, digits: 1 }] });
    chart.draw(rows, { xKey: 'f', xMin: 20, xMax: 20000 });
    $('viewMeas').innerHTML = sp.valid ? `THD <b>%${num(a.thd * 100, 2)}</b> (${sp.nHarm} harmonik) · ` + sp.h.slice(1, 6).map(h => `H${h.k} <b>${Number.isFinite(h.dBc) ? num(h.dBc, 1) : '—'} dBc</b>`).join(' · ') + ` · temel ${num(a.f0, 1)} Hz · çözünürlük ${num(s.df, 2)} Hz · 100 Hz ve katları besleme ripple'ıdır`
      : 'Temel bileşen sıfıra yakın: THD ve dBc değerleri GEÇERSİZ (sayı gösterilmez).';
  }

  function drawFreq() {
    const c = A.ac, cur = ui.target === 'out' ? c.out : c.g2, ref = ui.target === 'out' ? c.refOut : c.refG2;
    const i1k = FREQS.reduce((b, f, i) => (Math.abs(f - 1000) < Math.abs(FREQS[b] - 1000) ? i : b), 0);
    const o1 = ui.normF ? dB(cur.mag[i1k]) || 0 : 0, o2 = ui.normF ? dB(ref.mag[i1k]) || 0 : 0;
    const rows = FREQS.map((f, i) => { const g = dB(cur.mag[i]), r = dB(ref.mag[i]); return { f, g: g == null ? null : g - o1, r: r == null ? null : r - o2, ph: Number.isFinite(cur.ph[i]) ? cur.ph[i] : null }; });
    let lo = Infinity, hi = -Infinity; rows.forEach(r => { for (const v of [r.g, r.r]) if (v != null) { if (v < lo) lo = v; if (v > hi) hi = v; } });
    if (!Number.isFinite(lo)) { lo = -1; hi = 1; }
    chart = new LineChart($('chView'), { xLabel: 'Hz', xLog: true, xDigits: 0, tipW: 170,
      left: { min: Math.floor((lo - 2) / 5) * 5, max: Math.ceil((hi + 2) / 5) * 5, label: 'dB' }, right: { min: -180, max: 180, label: 'faz °', step: 90, color: cssv('--ink-3') },
      series: [{ key: 'g', color: cssv('--ink'), label: c.curName, digits: 2 }, { key: 'r', color: cssv('--redline'), label: c.altName, dash: [5, 4], width: 1.5, digits: 2 }, { key: 'ph', color: cssv('--ink-3'), axis: 'right', label: 'faz', width: 1, digits: 0 }] });
    chart.draw(rows, { xKey: 'f', xMin: 20, xMax: 20000 });
    const d = dB(cur.mag[i1k]) - dB(ref.mag[i1k]);
    const diffs = rows.map((r, i) => dB(cur.mag[i]) - dB(ref.mag[i])).filter(Number.isFinite);
    $('viewMeas').innerHTML = `Düz çizgi: şu anki konum (<b>${c.curName}</b>) · kesikli: <b>${c.altName}</b> · 1 kHz kazanç <b>${num(dB(cur.mag[i1k]), 1)} dB</b> · ${c.curName} − ${c.altName}: 1 kHz'de <b>${num(d, 1)} dB</b>, bant içinde <b>${num(Math.min(...diffs), 1)} … ${num(Math.max(...diffs), 1)} dB</b> (ham seviye farkı; ton farkı için normalize edin) · giriş empedansı 1 kHz <b>${num(c.zin[i1k] / 1000, 0)} kΩ</b> · küçük sinyal, doğrusallaştırılmış`;
  }

  function drawNfb() {
    const g = A.lg, m = $('viewMeas');
    if (!g) { m.innerHTML = 'R12 sökülü: geri besleme çevrimi yok.'; return blank('NFB yok'); }
    const rows = FREQS.map((f, i) => ({ f, t: dB(g.mag[i]), ph: g.ph[i] }));
    let lo = Infinity, hi = -Infinity; rows.forEach(r => { if (r.t != null) { if (r.t < lo) lo = r.t; if (r.t > hi) hi = r.t; } });
    chart = new LineChart($('chView'), { xLabel: 'Hz', xLog: true, xDigits: 0, tipW: 150,
      left: { min: Math.floor((lo - 2) / 5) * 5, max: Math.ceil((Math.max(hi, 0) + 2) / 5) * 5, label: '|T| dB' }, right: { min: -180, max: 180, label: 'faz °', step: 90, color: cssv('--ink-3') },
      series: [{ key: 't', color: cssv('--ink'), label: '|T|', digits: 2 }, { key: 'ph', color: cssv('--ink-3'), axis: 'right', label: '∠T', width: 1, digits: 0 }],
      refLines: [{ axis: 'left', value: 0, color: cssv('--fault'), label: '|T| = 1', right: true }] });
    chart.draw(rows, { xKey: 'f', xMin: 20, xMax: 20000 });
    const k = FREQS.reduce((b, f, i) => (Math.abs(f - 1000) < Math.abs(FREQS[b] - 1000) ? i : b), 0), neg = g.T[k][0] > 0;
    m.innerHTML = `T = −V(4 Ω tap) / V<sub>test</sub> · 1 kHz: <b>|T| = ${num(g.mag[k], 2)}, ∠${num(g.ph[k], 0)}°</b> → <b>${neg ? 'negatif' : 'POZİTİF'} geri besleme</b>` +
      (neg ? ` · kazanç azalması ${num(20 * Math.log10(Math.hypot(1 + g.T[k][0], g.T[k][1])), 1)} dB` : '') +
      ` · Nyquist (20 Hz – 20 kHz, modellenen fazlar): <b>${g.unstable ? 'KARARSIZ: osilasyon beklenir' : 'kararlı'}</b> · en küçük |1 + T| = ${num(g.minDist, 2)} @ ${num(g.fMin, 0)} Hz · sargı kapasitesi ve hoparlör empedansı modelde yok`;
  }

  B.hooks.slow.push(() => { drawSupply(); });
  window.addEventListener('resize', () => { drawSupply(); drawView(); });
  setView('scope');
})();
