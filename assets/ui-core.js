/*
 * Tezgâh çekirdeği: durum, simülasyon döngüsü, ön / arka panel kontrolleri, okuma şeridi, şema.
 * Fizik sabiti ÜRETMEZ: bütün değerler circuit-5f1.js ve amp-model.js'ten gelir.
 * Paneller ui-panels.js, grafikler ve analiz ui-analysis.js içindedir.
 */
(function () {
  'use strict';
  const D = window.Design, Amp = window.Amp, U = window.Units, SC = window.ScenariosAmp;
  const $ = id => document.getElementById(id);
  const num = U.num;

  const B = window.Bench = {
    META: { author: 'Amplifier-Simulator', source: '5F1 Modifiye Proje Raporu · Rev A', date: D.REVISION.date },
    profile: D.cloneProfile(), st: Amp.defaultState(), sim: null,
    running: true, speed: 1, fast: false, selPart: null, tab: 'scen', scen: 'base', prog: null,
    baseHash: D.designHash(D.cloneProfile()), hooks: { struct: [], slow: [], reset: [] }, shownEvents: 0, rate: 0,
    $, num,
  };
  B.hash = () => D.designHash(B.profile);
  B.expId = () => `${B.hash()}-${Math.round(B.sim.t * 1000)}`;
  B.modified = () => B.hash() !== B.baseHash;

  // --- Simülasyon kurulumu -------------------------------------------------------------
  /** Yeni deney: zaman geçmişi silinir. mode: 'hot' | 'cold'. */
  B.newSim = function (mode, note) {
    try {
      B.sim = new Amp.Sim(B.profile, B.st, { hot: mode === 'hot' });
      if (mode === 'hot') { B.sim.settle(); B.sim.step(Math.round(6 * Amp.CYCLE / B.sim.h)); }   // kararlı durumdan başla
      B.profileError = null;
    } catch (e) {
      if (!(e instanceof Amp.ProfileError) && !(e instanceof MNA.SolverError)) throw e;
      B.profileError = e.message;
      // Geçersiz profil: son geçerli simülasyon görüntüde kalır ama ilerlemez
      if (!B.sim) { B.profile = D.cloneProfile(); B.sim = new Amp.Sim(B.profile, B.st, { hot: true }); }
      B.sim.log('GEÇERSİZ PROFİL: ' + e.message, 'bad');
      B.refreshAll(); return;
    }
    B.shownEvents = 0; $('log').innerHTML = '';
    B.sim.log(note || (mode === 'hot' ? 'Yeni deney: sıcak başlangıç (tüpler ısınmış).' : 'Yeni deney: soğuk açılış (t = 0, tüpler soğuk, kapasitörler boş).'));
    B.hooks.reset.forEach(f => f());
    B.refreshAll();
  };
  /** Devre yapısı değişti (anahtar, pot, yük, profil değeri): netlist yeniden kurulur, geçmiş KORUNUR. */
  B.structChanged = function (msg, lv) {
    try { B.sim.profile = B.profile; B.sim.rebuild(); B.profileError = null; if (B.sim.error) { B.sim.error = null; } }
    catch (e) {
      if (!(e instanceof Amp.ProfileError)) throw e;
      B.profileError = e.message; B.sim.log('GEÇERSİZ PROFİL: ' + e.message, 'bad');
    }
    if (msg) B.sim.log(msg, lv || '');
    drawSchematic();
    B.hooks.struct.forEach(f => f());
    renderFast(); B.renderSlow();
  };
  B.refreshAll = function () { buildPanel(); drawSchematic(); B.hooks.struct.forEach(f => f()); renderFast(); B.renderSlow(); };

  // --- Durum ----------------------------------------------------------------------------
  B.status = function () {
    const s = B.sim, st = B.st;
    if (B.profileError) return { key: 'bad', cls: 'fault', title: 'Geçersiz profil', sub: B.profileError };
    if (s.error) return { key: 'err', cls: 'fault', title: 'Çözücü hatası', sub: 'Sayısal hata; fiziksel arıza ya da koruma değildir.' };
    const ls = Amp.loadStatus(B.profile, st), w = s.win;
    if (!st.mainsOn) {
      const v = w ? w.B1 : 0;
      return { key: 'off', cls: v > 50 ? 'warn' : 'off', title: 'Güç kapalı', sub: v > 50 ? `B+1 hâlâ ${num(v, 0)} V: kapasitörler dolu` : 'Kapasitör gerilimi düşük (modelde)' };
    }
    if (ls.danger) return { key: 'load', cls: 'fault', title: 'Tehlikeli yük koşulu', sub: ls.label + ' · model amfiyi durdurmaz' };
    if (st.otPhase < 0 && st.nfb) return { key: 'nfb', cls: 'fault', title: 'NFB ters faz', sub: 'pozitif geri besleme · osilasyon beklenir (NFB çevrimi sekmesi)' };
    if (!s.warmDone) return { key: 'warm', cls: 'warn', title: 'Isınma', sub: `emisyon: 5Y3 %${num(s.em.V3 * 100, 0)} · 6V6 %${num(s.em.V2 * 100, 0)} · 12AX7 %${num(s.em.V1 * 100, 0)}` };
    if (s.isSteady()) return { key: 'ok', cls: 'done', title: 'Kararlı çalışma', sub: B.modified() ? 'değiştirilmiş profil · doğrulanmadı' : `profil ${B.profile.id}` };
    return { key: 'trans', cls: 'warn', title: 'Geçiş', sub: 'besleme yeni dengeye oturuyor' };
  };

  // --- Ön / arka panel -------------------------------------------------------------------
  const AMP_MIN = 0.001, AMP_MAX = 1;
  const ampFromSlider = v => AMP_MIN * Math.pow(AMP_MAX / AMP_MIN, v / 100);
  const sliderFromAmp = a => 100 * Math.log(a / AMP_MIN) / Math.log(AMP_MAX / AMP_MIN);
  const FREQS = [82.4, 110, 220, 440, 1000, 2000, 5000];
  const LOADS = [['', 'boş'], ['4', '4 Ω'], ['8', '8 Ω'], ['16', '16 Ω']];

  function buildPanel() {
    const st = B.st, def = Amp.defaultState();
    const pot = (id, label) => `<label class="ctl ${st.pots[id] !== def.pots[id] ? 'changed' : ''}"><b>${label}<span id="pv-${id}">%${Math.round(st.pots[id] * 100)}</span></b><input type="range" min="0" max="100" step="1" value="${Math.round(st.pots[id] * 100)}" data-pot="${id}" aria-label="${label}"></label>`;
    const tg = (sid, label, a, b, la, lb) => `<div class="ctl ${st.sw[sid] !== def.sw[sid] ? 'changed' : ''}"><b>${label}</b><div class="tg" role="group" aria-label="${label}"><button data-sw="${sid}" data-pos="${a}" aria-pressed="${st.sw[sid] === a}">${la}</button><button data-sw="${sid}" data-pos="${b}" aria-pressed="${st.sw[sid] === b}">${lb}</button></div></div>`;
    const ls = Amp.loadStatus(B.profile, st);
    const jack = (id, label) => `<label class="ctl ${ls.danger ? 'danger' : st.loads[id] != null ? 'active' : ''}"><b>${label}</b><select data-load="${id}" aria-label="${label} jakındaki yük">${LOADS.map(([v, t]) => `<option value="${v}" ${String(st.loads[id] ?? '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
    $('ampPanel').innerHTML =
      `<div class="eyebrow" style="font-size:10.5px;color:var(--ink-3)">Ön panel</div><div class="amp-row">` +
      `<div class="ctl wide"><b>Giriş<span id="pv-amp">${fmtAmp(st.src.amp)}</span></b><input type="range" min="0" max="100" step="1" value="${Math.round(sliderFromAmp(st.src.amp))}" data-src="amp" aria-label="Giriş genliği (tepe)">` +
      `<div style="display:flex;gap:4px"><select data-src="freq" aria-label="Test frekansı">${FREQS.map(f => `<option value="${f}" ${st.src.freq === f ? 'selected' : ''}>${String(f).replace('.', ',')} Hz</option>`).join('')}</select>` +
      `<select data-src="kind" aria-label="Kaynak modeli"><option value="ideal" ${st.src.kind === 'ideal' ? 'selected' : ''}>ideal</option><option value="pickup" ${st.src.kind === 'pickup' ? 'selected' : ''}>manyetik</option></select></div></div>` +
      tg('S1', 'Hi / Lo', 'HIGH', 'LOW', 'High', 'Low') + pot('VR3', 'Bass') + pot('VR4', 'Mid') + pot('VR2', 'Treble') +
      tg('S2', 'EQ / RAW', 'EQ', 'RAW', 'EQ', 'RAW') + tg('S3', 'Bright', 'OFF', 'ON', 'kapalı', 'açık') + tg('S4', 'Dark', 'OFF', 'ON', 'kapalı', 'açık') + pot('VR1', 'Volume') + `</div>` +
      `<div class="eyebrow" style="font-size:10.5px;color:var(--ink-3)">Arka panel · hoparlör yükü (omik) ve şebeke</div><div class="amp-row">` +
      jack('J2', '4 Ω çıkış') + jack('J3', '8 Ω çıkış') + jack('J4', '16 Ω çıkış') +
      `<label class="ctl ${st.mainsV !== 230 ? 'changed' : ''}"><b>Şebeke</b><select data-mains aria-label="Şebeke gerilimi">${[207, 220, 230, 240, 253].map(v => `<option value="${v}" ${st.mainsV === v ? 'selected' : ''}>${v} VAC</option>`).join('')}</select></label>` +
      `<div class="ctl wide ${ls.danger ? 'danger' : ''}"><b>Yük durumu<span>${ls.label}</span></b><small title="${ls.text}">${ls.text}</small></div></div>`;
  }
  const fmtAmp = a => (a < 0.0995 ? `${num(a * 1000, a < 0.01 ? 1 : 0)} mV` : `${num(a, 2)} V`) + ' tepe';

  let rebuildTimer = null;
  const queueRebuild = (msg) => { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(() => { B.structChanged(msg); buildPanelSoft(); }, 70); };
  /** Sürgü sürüklenirken panel yeniden kurulmaz (odak kaybolmasın); yalnız vurgu sınıfları tazelenir. */
  function buildPanelSoft() { if (!document.activeElement || !document.activeElement.closest || !document.activeElement.closest('#ampPanel')) buildPanel(); }

  $('ampPanel').addEventListener('input', e => {
    const t = e.target, st = B.st;
    if (t.dataset.pot) {
      st.pots[t.dataset.pot] = +t.value / 100; $('pv-' + t.dataset.pot).textContent = '%' + t.value;
      queueRebuild();
    } else if (t.dataset.src === 'amp') { st.src.amp = +ampFromSlider(+t.value).toPrecision(3); $('pv-amp').textContent = fmtAmp(st.src.amp); B.invalidate('Giriş genliği değişti'); }
  });
  $('ampPanel').addEventListener('change', e => {
    const t = e.target, st = B.st;
    if (t.dataset.pot) { B.sim.log(`${D.BY_ID[t.dataset.pot].fn}: %${t.value}`); buildPanel(); }
    else if (t.dataset.src === 'freq') { st.src.freq = +t.value; B.invalidate('Test frekansı değişti'); }
    else if (t.dataset.src === 'kind') { st.src.kind = t.value; B.structChanged(`Giriş kaynağı: ${t.value === 'ideal' ? 'ideal (0 Ω)' : 'temsili manyetik + kablo (7 kΩ, 3 H, 470 pF)'}`); buildPanel(); }
    else if (t.dataset.load) { st.loads[t.dataset.load] = t.value === '' ? null : +t.value; B.structChanged(`${t.dataset.load}: ${t.value === '' ? 'yük çıkarıldı' : t.value + ' Ω yük takıldı'}`, Amp.loadStatus(B.profile, st).danger ? 'bad' : ''); buildPanel(); }
    else if (t.hasAttribute('data-mains')) { st.mainsV = +t.value; B.sim.log(`Şebeke gerilimi ${t.value} VAC.`, 'warn'); B.invalidate('Şebeke gerilimi değişti'); buildPanel(); }
  });
  $('ampPanel').addEventListener('click', e => {
    const b = e.target.closest('[data-sw]'); if (!b) return;
    const sid = b.dataset.sw; if (B.st.sw[sid] === b.dataset.pos) return;
    B.st.sw[sid] = b.dataset.pos;
    B.structChanged(`${D.SWITCHES[sid].label}: ${b.dataset.pos}`); buildPanel();
  });

  // --- Şema ---------------------------------------------------------------------------------
  let svg = null;
  function drawSchematic() {
    const r = SchematicAmp.build(Object.assign({ hash: B.hash() }, B.META), B.profile, B.st);
    $('sheet').innerHTML = r.svg; svg = $('sheet').querySelector('svg');
    if (B.selPart) svg.querySelectorAll('.part').forEach(g => g.classList.toggle('sel', g.dataset.part === B.selPart));
  }
  const setT = (id, s, cls) => { const el = svg && svg.querySelector('#' + id); if (!el) return; if (el.textContent !== s) el.textContent = s; if (cls != null) el.setAttribute('class', cls); };
  $('sheet').addEventListener('click', e => {
    const d = e.target.closest('.delta'); if (d) return B.openDecision(d.dataset.decision);
    const g = e.target.closest('.part'); if (g) B.selectPart(g.dataset.part);
  });
  $('sheet').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const d = e.target.closest('.delta'), g = e.target.closest('.part');
    if (d || g) { e.preventDefault(); e.stopPropagation(); d ? B.openDecision(d.dataset.decision) : B.selectPart(g.dataset.part); }
  });
  B.selectPart = function (id) {
    B.selPart = id;
    if (svg) svg.querySelectorAll('.part').forEach(g => g.classList.toggle('sel', g.dataset.part === id));
    B.showTab('part'); B.renderInspector();
  };

  // --- Sekmeler ------------------------------------------------------------------------------
  B.showTab = function (t) {
    B.tab = t;
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
    document.querySelectorAll('.panel').forEach(p => { p.hidden = p.dataset.panel !== t; });
    B.renderSlow(true);
  };
  document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) B.showTab(b.dataset.tab); });

  // --- Okuma şeridi ve şema probları -----------------------------------------------------------
  const hms = s => { s = Math.max(0, s); const m = Math.floor(s / 60); return `${String(m).padStart(2, '0')}:${num(s - m * 60, 1).padStart(4, '0')}`; };
  function renderFast() {
    const s = B.sim, w = s.win, st = B.st;
    const big = (id, v, unit) => { $(id).innerHTML = `${v}<small>${unit}</small>`; };
    if (w) {
      big('rB1', num(w.B1, 1), 'V'); $('rB1s').textContent = `ripple ${num(w.B1Max - w.B1Min, 1)} V t-t · B+2 ${num(w.B2, 0)} · B+3 ${num(w.B3, 0)} V`;
      big('rIa', num(w.ia * 1000, 1), 'mA'); $('rIas').textContent = `Va ${num(w.A6, 0)} V · Vk ${num(w.K6, 1)} V · Ig2 ${num(w.ig2 * 1000, 1)} mA`;
      big('rPa', num(w.pa, 1), 'W'); $('rPas').textContent = `screen ${num(w.pg2, 2)} W · sınır verisi eksik`;
    } else { ['rB1', 'rIa', 'rPa'].forEach(id => { $(id).textContent = '—'; }); }
    const an = B.analysis;
    if (an && an.res && (an.status === 'ok' || an.status === 'stale')) {
      big('rPo', num(an.res.avg.pOut, 2), 'W');
      $('rPos').textContent = an.status === 'stale' ? 'GEÇERSİZ: yeniden hesaplanacak' : `THD %${num(an.res.thd * 100, 1)} · ${String(an.res.f0).replace('.', ',')} Hz · ${an.res.out ? an.res.out.r + ' Ω' : 'yüksüz'}`;
    } else { $('rPo').textContent = '—'; $('rPos').textContent = an && an.status === 'run' ? 'hesaplanıyor' : 'analiz bekleniyor'; }
    big('rt', hms(s.t), ''); $('rts').textContent = B.running ? (B.fast ? 'hızlı ilerliyor' : `oynatma ${num(B.rate, B.rate < 1 ? 2 : 1)}× (hedef ${String(B.speed).replace('.', ',')}×)`) : 'duraklatıldı';
    const stt = B.status();
    $('rState').textContent = stt.title; $('rStates').textContent = stt.sub; $('rStates').title = stt.sub;
    $('rStateBox').className = 'rd state ' + stt.cls;
    $('ledPwr').classList.toggle('on', st.mainsOn);
    $('ledWarm').classList.toggle('on', st.mainsOn && !s.warmDone);
    $('ledRdy').classList.toggle('on', stt.key === 'ok');
    if (!svg || !w) return;
    svg.classList.toggle('hot', s.em.V2 > 0.5);
    const hv = v => (v > 50 ? 'probe strong hv' : 'probe strong');
    setT('sB1', `${num(w.B1, 1)} V`, hv(w.B1)); setT('sB2', `${num(w.B2, 1)} V`, hv(w.B2)); setT('sB3', `${num(w.B3, 1)} V`, hv(w.B3));
    setT('sPA', `${num(w.PA, 0)} V`); setT('sKA', `${num(w.KA, 2)} V`); setT('sPB', `${num(w.PB, 0)} V`); setT('sKB', `${num(w.KB, 2)} V`);
    setT('sA6', `Va ${num(w.A6, 0)} V`); setT('sK6', `Vk ${num(w.K6, 1)} V`); setT('sIa', `Ia ${num(w.ia * 1000, 1)} mA`);
    const emk = s.b.emk ? s.b.emk() / Math.SQRT2 : 0;
    setT('sMains', st.mainsOn ? `${st.mainsV} VAC` : 'kesik'); setT('sSec', st.mainsOn ? `${num(emk, 0)}-0-${num(emk, 0)} VAC` : '0 VAC');
    setT('sRect', `${num(w.iRect * 1000, 0)} mA ort. · ${num(w.iRectPk * 1000, 0)} mA tepe`);
    const hl = Amp.heaterLoad(B.profile); setT('sHeat', st.mainsOn ? `yük ${num(hl.a63, 2)} A` : 'kapalı');
    setT('sIn', `${fmtAmp(st.src.amp)} · ${String(st.src.freq).replace('.', ',')} Hz`);
    const a = B.analysis && B.analysis.res && B.analysis.status === 'ok' ? B.analysis.res : null;
    setT('sOut', a ? `${num(a.avg.pOut, 2)} W · THD %${num(a.thd * 100, 1)}` : 'analiz bekleniyor');
    setT('sLoad', a && a.out ? `${num(a.stat.OUT.rmsAc, 2)} V RMS · ${a.out.r} Ω (${a.out.jack})` : Amp.loadStatus(B.profile, st).label);
  }
  B.renderFast = renderFast;

  // --- Günlük ve dışa aktarım ----------------------------------------------------------------
  function renderLog() {
    const ev = B.sim.events, box = $('log');
    for (; B.shownEvents < ev.length; B.shownEvents++) {
      const e = ev[B.shownEvents], d = document.createElement('div');
      d.innerHTML = `<time>${hms(e.t)}</time><span class="${e.lv}"></span>`; d.lastChild.textContent = e.msg;
      box.prepend(d);
    }
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }
  B.configJSON = () => ({ kind: '5f1-amp-lab-config', schema: 1, revision: D.REVISION.id, experiment: B.expId(), designHash: B.hash(), exported: new Date().toISOString(),
    solver: { liveStepS: Amp.LIVE_H, method: 'bdf2', audio: Amp.AUDIO_DEFAULTS }, state: B.st, profile: B.profile });
  function buildExports() {
    $('exports').innerHTML = `<span class="h4">Dışa aktar (aynı deney kimliğiyle)</span>` +
      `<button class="btn sm" data-exp="json">Konfigürasyon JSON</button><button class="btn sm" data-exp="net">Netlist</button><button class="btn sm" data-exp="bom">BOM CSV</button>` +
      `<button class="btn sm" data-exp="raw">Ham ses tamponu CSV</button><button class="btn sm" data-exp="hist">Besleme özeti CSV</button>` +
      `<label class="btn sm" style="cursor:pointer">Profil içe aktar<input type="file" id="impFile" accept="application/json,.json" hidden></label><span class="hint" id="expNote"></span>`;
  }
  $('exports').addEventListener('click', e => {
    const b = e.target.closest('[data-exp]'); if (!b) return;
    const id = B.expId(), k = b.dataset.exp;
    if (k === 'json') download(`5f1-config-${id}.json`, JSON.stringify(B.configJSON(), null, 2), 'application/json');
    else if (k === 'net') download(`5f1-netlist-${id}.cir`, Amp.netlistText(B.sim.b, `5F1 Modifiye ${D.REVISION.id} · profil ${B.profile.id} · deney ${id}`));
    else if (k === 'bom') download(`5f1-bom-${id}.csv`, BomAmp.csv(B.profile, id), 'text/csv;charset=utf-8');
    else if (k === 'hist') download(`5f1-besleme-${id}.csv`, '# deney ' + id + ' · şebeke periyodu başına ortalama (seyreltilmiş gösterim kaydı; FFT için kullanılmaz)\nt_s;B1_V;B1min_V;B1max_V;B2_V;B3_V;Va_V;Vk_V;Ia_A;Ig2_A;Pa_W\n' +
      B.sim.history.map(r => [r.t, r.B1, r.B1Min, r.B1Max, r.B2, r.B3, r.A6, r.K6, r.ia, r.ig2, r.pa].map(v => v.toPrecision(7)).join(';')).join('\n'), 'text/csv;charset=utf-8');
    else if (k === 'raw') {
      const a = B.analysis && B.analysis.status === 'ok' ? B.analysis.res : null;
      if (!a) { $('expNote').textContent = 'Ham tampon yok: tamamlanmış bir ses analizi gerekir (yarım sonuç dışa aktarılmaz).'; return; }
      const P = Amp.PROBES, L = [`# deney ${B.analysis.expId} · fs ${a.opt.fs} Hz · N ${a.opt.n} · ${a.opt.method} · giriş ${a.amp} V tepe, ${a.f0} Hz · birim V`, 't_s;' + P.join(';')];
      for (let i = 0; i < a.opt.n; i++) L.push([(a.tStart + i / a.opt.fs).toFixed(7)].concat(P.map(p => a.buf[p][i].toPrecision(8))).join(';'));
      download(`5f1-ham-${B.analysis.expId}.csv`, L.join('\n'), 'text/csv;charset=utf-8');
    }
  });
  $('exports').addEventListener('change', e => {
    if (e.target.id !== 'impFile' || !e.target.files[0]) return;
    const rd = new FileReader();
    rd.onload = () => {
      let cfg; const note = $('expNote');
      try { cfg = JSON.parse(rd.result); } catch (err) { note.textContent = 'İçe aktarılamadı: dosya geçerli JSON değil.'; return; }
      if (!cfg || cfg.kind !== '5f1-amp-lab-config') { note.textContent = 'İçe aktarılamadı: bu dosya bir 5F1 tezgâh konfigürasyonu değil.'; return; }
      const errs = D.validateProfile(cfg.profile);
      if (errs.length) { note.textContent = 'Profil reddedildi: ' + errs[0]; return; }
      let st; try { st = Object.assign(Amp.defaultState(), cfg.state); Amp.build(cfg.profile, st); } catch (err) { note.textContent = 'Durum reddedildi: ' + err.message; return; }
      B.profile = cfg.profile; B.st = st; B.scen = null;
      B.newSim('hot', `Profil içe aktarıldı (${cfg.profile.id}, kaynak deney ${cfg.experiment || '—'}). Sonuçlar bu oturumda YENİDEN hesaplanır; eski sonuçlar taşınmaz.`);
      note.textContent = cfg.designHash !== B.hash() ? 'İçe aktarıldı. Devre tanımı dosyadakinden farklı (kimlik değişti): sonuçlar yeni tanımla hesaplanır.' : 'İçe aktarıldı.';
      e.target.value = '';
    };
    rd.readAsText(e.target.files[0]);
  });

  // --- Güç ve taşıma düğmeleri ------------------------------------------------------------------
  function setPower(on) {
    if (B.st.mainsOn === on) return;
    B.st.mainsOn = on; B.sim.log(on ? 'Şebeke verildi (S5).' : 'Şebeke kesildi (S5). Kapasitörler boşalana kadar yüksek gerilim sürer.', on ? '' : 'warn');
    B.running = true; drawSchematic(); B.invalidate('Güç durumu değişti'); syncButtons();
  }
  B.setPower = setPower;
  function syncButtons() {
    document.querySelectorAll('[data-power]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.power === 'on') === B.st.mainsOn));
    $('playIcon').textContent = B.running ? '❚❚' : '▶'; $('playText').textContent = B.running ? 'Duraklat' : 'Devam et';
    $('toSteady').disabled = !B.st.mainsOn || !!B.sim.error;
  }
  B.syncButtons = syncButtons;
  document.querySelectorAll('[data-power]').forEach(b => b.addEventListener('click', () => setPower(b.dataset.power === 'on')));
  $('play').addEventListener('click', () => { B.running = !B.running; B.fast = false; syncButtons(); });
  $('cold').addEventListener('click', () => { B.prog = null; B.st.mainsOn = true; B.running = true; B.fast = false; B.newSim('cold'); syncButtons(); });
  $('toSteady').addEventListener('click', () => { B.fast = true; B.running = true; B.fastStart = B.sim.t; syncButtons(); });
  $('speed').addEventListener('change', e => { B.speed = +e.target.value; });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea, button, [role="button"], a')) return;
    if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
    else if (e.key === 'r' || e.key === 'R') $('cold').click();
    else if (e.key === 'e' || e.key === 'E') { if (!$('toSteady').disabled) $('toSteady').click(); }
    else if (e.key === 'p' || e.key === 'P') setPower(!B.st.mainsOn);
  });

  // --- Ana döngü -------------------------------------------------------------------------------
  // Elektrik çözümü sabit adımlıdır; burada yalnızca kare başına kaç adım atılacağı belirlenir.
  let last = performance.now(), lastSlow = 0, lastFast = 0, debt = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const s = B.sim;
    if (B.running && !s.error && !B.profileError) {
      const h = s.h, t0 = performance.now(), tSim0 = s.t;
      const budget = B.analysisBusy && B.analysisBusy() ? 5 : 12;       // ms
      if (B.fast) {
        while (performance.now() - t0 < budget + 2) { stepWithEvents(200); if (s.error || (s.isSteady() && s.t - B.fastStart > 0.15)) { B.fast = false; s.log(s.error ? 'Hızlı ilerleme durdu.' : `Kararlı duruma ulaşıldı (t = ${num(s.t, 2)} s).`, s.error ? 'bad' : 'ok'); break; }
          if (s.t - B.fastStart > 120) { B.fast = false; s.log('Kararlı duruma 120 s içinde ulaşılamadı; ilerleme durduruldu. Bu bir "tamamlandı" sonucu değildir.', 'bad'); break; } }
      } else {
        debt = Math.min(debt + dt * B.speed / h, 0.25 * B.speed / h);     // sekme arkaya düşerse birikmiş borç sınırlı
        while (debt >= 1 && performance.now() - t0 < budget) { const n = Math.min(40, Math.floor(debt)); stepWithEvents(n); debt -= n; if (s.error) break; }
      }
      const r = (s.t - tSim0) / Math.max(dt, 1e-3); B.rate = B.rate ? B.rate * 0.9 + r * 0.1 : r;
      if (s.error) syncButtons();
    }
    if (now - lastFast > 100) { lastFast = now; renderFast(); renderLog(); }
    if (now - lastSlow > 320) { lastSlow = now; B.renderSlow(); }
    if (B.analysisTick) B.analysisTick();
    requestAnimationFrame(frame);
  }
  function stepWithEvents(n) {
    const s = B.sim, p = B.prog;
    if (p && !p.done && s.t + n * s.h >= p.sc.at) {
      const pre = Math.max(0, Math.round((p.sc.at - s.t) / s.h)); if (pre) s.step(pre);
      p.sc.inject(B.st, B.profile); p.done = true; s.log(`Senaryo olayı (t = ${num(p.sc.at, 1)} s): ${p.sc.name}`, 'bad');
      drawSchematic(); syncButtons(); n -= pre;
    }
    if (n > 0) s.step(n);
  }

  /** Yavaş tazeleme: paneller kendi işlevlerini buraya bağlar. */
  B.renderSlow = function (force) { B.hooks.slow.forEach(f => f(force)); };
  /** Analiz sonuçlarını geçersiz kıl (ui-analysis.js doldurur). */
  B.invalidate = function () {};
  B.openDecision = function () {};
  B.renderInspector = function () {};

  /** rAF çalışmadığında (arka plan sekmesi, otomatik test) döngüyü elle ilerletir. */
  B.pump = function (simSeconds) { stepWithEvents(Math.round(simSeconds / B.sim.h)); renderFast(); renderLog(); B.renderSlow(); if (B.analysisTick) B.analysisTick(); };

  B.start = function () {
    buildExports();
    B.newSim('hot');
    syncButtons();
    requestAnimationFrame(t => { last = t; frame(t); });
  };
})();
