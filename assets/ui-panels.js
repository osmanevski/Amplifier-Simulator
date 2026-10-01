/*
 * Alt çekmece panelleri: senaryolar, bileşen denetçisi, çalışma noktası, tasarım kontrolleri,
 * açık kararlar, profil, malzeme / tedarik, model kartları.
 * Bütün içerik kanonik tanımdan ve canlı simülasyondan okunur; burada devre verisi tutulmaz.
 */
(function () {
  'use strict';
  const B = window.Bench, D = window.Design, Amp = window.Amp, U = window.Units, SC = window.ScenariosAmp, Tubes = window.Tubes;
  const $ = B.$, num = B.num;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const chip = (st) => `<span class="chip ${st}">${D.STATUS_TR[st] || st}</span>`;
  const supplyLinks = list => list.map(s => { const x = D.SUPPLIERS[s]; return `<a href="${x.url}" target="_blank" rel="noopener" title="${esc(x.name + ' · ' + x.note)}">${s}</a>`; }).join(' ');

  // ======================================================================= Senaryolar
  function renderScenarios() {
    $('scenList').innerHTML = `<div class="h4" style="grid-column:1/-1">Yeni deney — varsayılan profile döner, zaman geçmişini siler</div>` +
      SC.SCENARIOS.map(s => `<button class="sc ${B.scen === s.id ? 'cur' : ''} ${s.fault ? 'fault' : ''}" data-scen="${s.id}" title="${esc(s.watch)}"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></button>`).join('') +
      `<div class="h4" style="grid-column:1/-1;margin-top:6px">Çalışırken müdahale — zaman geçmişi korunur</div>` +
      SC.LIVE.map(s => `<button class="sc fault" data-live="${s.id}"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></button>`).join('') +
      `<p class="hint" id="scenWatch" style="grid-column:1/-1;margin:4px 0 0"></p>`;
    const cur = SC.SCENARIOS.find(s => s.id === B.scen);
    $('scenWatch').textContent = cur ? 'Ne gözlenir: ' + cur.watch : '';
  }
  $('scenList').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.live) {
      const l = SC.LIVE.find(x => x.id === b.dataset.live), msg = l.act(B.st, B.profile);
      if (l.struct) B.structChanged(msg, 'warn'); else { B.sim.log(msg, 'warn'); B.invalidate('Güç durumu değişti'); }
      B.refreshAll(); B.syncButtons(); return;
    }
    const sc = SC.SCENARIOS.find(x => x.id === b.dataset.scen);
    B.scen = sc.id; B.profile = D.cloneProfile(); B.st = Amp.defaultState();
    if (sc.apply) sc.apply(B.st, B.profile);
    B.prog = sc.inject ? { sc, done: false } : null;
    B.running = true; B.fast = false;
    B.newSim(sc.start, `Senaryo: ${sc.name} — ${sc.desc}`);
    renderScenarios(); B.syncButtons();
  });

  // ======================================================================= Bileşen denetçisi
  const V = (x, d = 1) => `${num(x, d)} V`;
  function liveKV(id) {
    const s = B.sim, w = s.win, c = D.BY_ID[id], P = B.profile, pk = s.peaks, kv = [];
    if (!w) return [['Durum', 'henüz bir şebeke periyodu tamamlanmadı']];
    const dv = s.b.dev;
    switch (c.type) {
      case 'R': {
        if (!D.isFitted(id, P) || w.rp[id] == null) { kv.push(['Durum', id === 'R12' && !B.st.nfb ? 'sökülü' : 'takılı değil']); break; }
        const r = D.resolve(id, P).value, p = w.rp[id];
        kv.push(['Güç (periyot ort.)', `${num(p, p < 0.1 ? 4 : 2)} W` + (c.rating.W ? ` / ${c.rating.W} W` : ' · güç sınırı: veri eksik')]);
        kv.push(['Etkin gerilim', V(Math.sqrt(p * r), 2)], ['Etkin akım', `${num(Math.sqrt(p / r) * 1000, 3)} mA`]);
        break;
      }
      case 'C': {
        const cv = w.cap[id];
        if (!cv) { kv.push(['Durum', D.isFitted(id, P) ? 'anahtar açık: devrede değil' : 'takılı değil']); break; }
        kv.push(['Gerilim (son periyot)', `${num(cv.min, 1)} … ${num(cv.max, 1)} V`]);
        kv.push(['Açılıştan beri tepe', V(pk.cap[id], 1) + (c.rating.V ? ` / ${c.rating.V} V (%${num(100 * pk.cap[id] / c.rating.V, 0)})` : '')]);
        kv.push(['Depolanan enerji', `${num(0.5 * D.resolve(id, P).value * cv.max * cv.max, 3)} J`]);
        break;
      }
      case 'POT': {
        const r = D.resolve(id, P).value, f = Amp.taperFn((P.tapers && P.tapers[id]) || 'lin', B.st.pots[id]);
        kv.push(['Konum', `%${Math.round(B.st.pots[id] * 100)}`], ['Alt uç – wiper', U.fmt(Math.max(Amp.RMIN, f * r), 'Ω')], ['Wiper – üst uç', U.fmt(Math.max(Amp.RMIN, (1 - f) * r), 'Ω')]);
        if (w.rp[id] != null) kv.push(['Güç', `${num(w.rp[id] * 1000, 3)} mW`]);
        break;
      }
      case 'TRIODE': {
        const p = id === 'V1A' ? ['PA', 'KA', 'G1', 'i1a'] : ['PB', 'KB', 'G2', 'i1b'], d = dv[id];
        kv.push(['Plaka', V(w[p[0]], 1)], ['Katot', V(w[p[1]], 3)], ['Anodik akım', `${num(w[p[3]] * 1000, 3)} mA`], ['Güç kaybı', `${num((w[p[0]] - w[p[1]]) * w[p[3]], 3)} W`]);
        kv.push(['gm · rp (anlık)', `${num(d.gm * 1000, 2)} mA/V · ${d.gp > 0 ? num(1 / d.gp / 1000, 1) : '—'} kΩ`], ['Emisyon', `%${num(s.em.V1 * 100, 0)}`]);
        break;
      }
      case 'PENTODE':
        kv.push(['Plaka Va', V(w.A6, 1)], ['Screen Vg2', V(w.B2, 1)], ['Katot Vk', V(w.K6, 2)], ['Ia', `${num(w.ia * 1000, 2)} mA`], ['Ig2', `${num(w.ig2 * 1000, 2)} mA`],
          ['Ik = Vk / Rk', `${num(w.K6 / D.resolve('R9', P).value * 1000, 2)} mA`], ['Pa = (Va − Vk) · Ia', `${num(w.pa, 2)} W`], ['Pg2 = (Vg2 − Vk) · Ig2', `${num(w.pg2, 2)} W`], ['Emisyon', `%${num(s.em.V2 * 100, 0)}`]);
        break;
      case 'RECT':
        kv.push(['DC çıkış akımı (ort.)', `${num(w.iRect * 1000, 1)} mA`], ['Plaka tepe akımı (son periyot)', `${num(w.iRectPk * 1000, 0)} mA`], ['Açılıştan beri tepe', `${num(pk.iRectPk * 1000, 0)} mA`], ['Tepe akım sınırı', 'veri eksik'], ['Emisyon', `%${num(s.em.V3 * 100, 0)}`]);
        break;
      case 'PT': {
        const e = s.b.emk ? s.b.emk() / Math.SQRT2 : 0;
        kv.push(['Yarım sargı EMK', `${num(e, 1)} VAC`], ['İdeal tepe', V(e * Math.SQRT2, 1)], ['Etkin kaynak direnci / plaka', U.fmt(P.T1.rt, 'Ω')], ['HV DC yükü', `${num(w.iRect * 1000, 1)} mA`], ['Sargı kaybı (2 × Rt)', `${num(w.rp.T1 || 0, 2)} W`]);
        break;
      }
      case 'OT': {
        const ls = Amp.loadStatus(P, B.st), t = s.b.turns;
        kv.push(['Yansıyan primer yükü', Number.isFinite(ls.zRef) ? U.fmt(ls.zRef, 'Ω') : '∞ (yüksüz)'], ['Sarım oranı 4 / 8 / 16 Ω', `${num(1 / t.n4, 2)} · ${num(1 / t.n8, 2)} · ${num(1 / t.n16, 2)} : 1`],
          ['Primer DC akımı', `${num(w.ia * 1000, 1)} mA`], ['Primer DCR düşümü', V(w.B1 - w.A6, 1)], ['Bakır kaybı', `${num(w.rp.T2 || 0, 2)} W`], ['Faz', B.st.otPhase > 0 ? 'doğru' : 'TERS']);
        break;
      }
      case 'JACK': {
        const r = B.st.loads[id], a = B.analysis && B.analysis.status === 'ok' ? B.analysis.res : null;
        kv.push(['Takılı yük', r == null ? 'boş' : `${r} Ω (omik)`]);
        if (r != null && w.rp[id] != null) kv.push(['Güç (sinyalsiz, periyot ort.)', `${num(w.rp[id] * 1000, 2)} mW`]);
        if (a && a.out && a.out.jack === id) kv.push(['Sinyal altında', `${num(a.stat.OUT.rmsAc, 2)} V RMS · ${num(a.avg.pOut, 2)} W`]);
        break;
      }
      case 'SW': kv.push(['Konum', B.st.sw[id] || (id === 'S5' ? (B.st.mainsOn ? 'kapalı kontak (güç açık)' : 'açık kontak') : '—')]); break;
      default: break;
    }
    return kv;
  }

  const TRAFO_FIELDS = {
    T1: [['vSec', 'Yarım sargı gerilimi', 'V'], ['rt', 'Etkin kaynak direnci / plaka', 'Ω'], ['noLoadRisePct', 'Yüksüz artış', '%']],
    T2: [['rp', 'Primer DCR', 'Ω'], ['lp', 'Primer endüktansı', 'H'], ['lleak', 'Kaçak endüktans', 'H']],
  };

  B.renderInspector = function () {
    const id = B.selPart, box = $('inspector');
    if (!id) { box.innerHTML = '<p class="empty">Şemada bir bileşene tıklayın: görevi, rapordaki durumu, kaynağı, sınırları ve canlı değerleri burada görünür. Δ işaretleri karar günlüğünü açar.</p>'; return; }
    const c = D.BY_ID[id], P = B.profile, r = D.resolve(id, P), valued = ['R', 'C', 'POT'].includes(c.type);
    const st = valued ? r.status : c.status, card = c.model ? Tubes.CARDS[P.models[id]] : null;
    const dec = c.decision ? D.DECISIONS.find(d => d.id === c.decision) : null;
    let left = `<h3>${esc(c.fn)}</h3><div class="ref">${id} · simülatör referansı${c.rapor ? ' · rapordaki adı ' + c.rapor : ''} · ${chip(st)}${c.stock ? ' · ' + esc(c.stock) : ''}</div>`;
    left += `<p><b>${esc(BomAmp.valueText(id, P))}</b>${valued && r.from ? ` <span class="src">— ${r.status === 'DENEYSEL' ? esc(r.from) + (P.reasons[id] ? ': ' + esc(P.reasons[id]) : '') : 'kaynak ' + esc(r.from)}</span>` : ''}</p>`;
    if (c.note) left += `<p>${esc(c.note)}</p>`;
    if (c.pins) left += `<p class="src">Pinler: ${esc(c.pins)}</p>`;
    if (dec) left += `<p class="why"><b>${dec.id} · ${esc(dec.title)}</b> (${dec.state}). ${esc(dec.sim)} <button class="btn sm" data-dec="${dec.id}">Karara git</button></p>`;
    if (card) left += `<p class="why a"><b>Model: ${card.id} v${card.version}</b> — ${esc(card.tube)}. Sınır verisi eksik: ${esc(card.limitsRef)} <button class="btn sm" data-tab="cards">Model kartı</button></p>`;
    left += `<p class="src">Kaynak: ${esc(c.src || '—')} · tolerans: veri eksik · üretici / parça kodu / paket: veri eksik${c.supply.length ? ' · tedarik adayı: ' + supplyLinks(c.supply) + ` (kontrol ${D.SUPPLY_CHECKED})` : ''}</p>`;

    let right = `<dl class="kv">${liveKV(id).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
    if (valued) {
      const ov = P.overrides && P.overrides[id] != null;
      right += `<div style="margin-top:8px"><label class="field"><span>Değer (${c.unit})</span><span><input type="text" id="valIn" value="${esc(U.fmt(r.value, c.unit))}" aria-label="${id} değeri"> <button class="btn sm" id="valSet">Uygula</button></span></label>` +
        (c.candidates ? `<div class="field"><span>Rapordaki adaylar</span><span>${c.candidates.map(v => `<button class="btn sm" data-cand="${v}">${U.fmt(v, c.unit)}</button>`).join(' ')}</span></div>` : '') +
        (ov ? `<div class="field"><span>Kullanıcı değişikliği etkin</span><button class="btn sm" id="valReset">Tanıma dön</button></div>` : '') +
        `<div class="err" id="valErr"></div><p class="hint">"22n", "22 nF", "0,022 µF" aynı değerdir. Değişiklik şema, netlist, denetçi ve BOM'a birlikte yansır; profil "değiştirilmiş" olur ve doğrulama sonuçları bu profil için geçersizdir.</p></div>`;
    }
    if (c.optional) right += `<label class="field"><span>Takılı (deneysel varyant)</span><input type="checkbox" id="fitChk" ${D.isFitted(id, P) ? 'checked' : ''}></label>`;
    if (c.type === 'POT') right += `<label class="field"><span>Taper</span><select id="taperSel"><option value="lin" ${(P.tapers[id] || 'lin') === 'lin' ? 'selected' : ''}>lineer</option><option value="log" ${P.tapers[id] === 'log' ? 'selected' : ''}>log (orta nokta %10, yaklaşık)</option></select></label>`;
    if (TRAFO_FIELDS[id]) right += `<div style="margin-top:8px"><div class="h4">Deneysel trafo verisi (üretici verisi yok)</div>` + TRAFO_FIELDS[id].map(([k, l, u]) => `<label class="field"><span>${l}</span><span><input type="number" step="any" min="0" data-trafo="${id}.${k}" value="${P[id][k]}"> ${u}</span></label>`).join('') + `<div class="err" id="valErr"></div></div>`;
    box.innerHTML = `<div class="insp"><div>${left}</div><div>${right}</div></div>`;
  };
  function applyValue(id, text) {
    const c = D.BY_ID[id], r = U.parsePositive(text, c.unit), err = $('valErr');
    if (!r.ok) { err.textContent = 'Reddedildi: ' + r.error; return; }
    B.profile.overrides = Object.assign({}, B.profile.overrides, { [id]: r.value });
    B.structChanged(`${id} = ${U.fmt(r.value, c.unit)} (kullanıcı değişikliği; deneysel).`, 'warn'); B.renderInspector(); renderProfile();
  }
  $('inspector').addEventListener('click', e => {
    const t = e.target, id = B.selPart;
    if (t.id === 'valSet') applyValue(id, $('valIn').value);
    else if (t.dataset.cand) applyValue(id, +t.dataset.cand);
    else if (t.id === 'valReset') { delete B.profile.overrides[id]; B.structChanged(`${id}: kullanıcı değişikliği kaldırıldı.`); B.renderInspector(); renderProfile(); }
    else if (t.dataset.dec) B.openDecision(t.dataset.dec);
    else if (t.dataset.tab) B.showTab(t.dataset.tab);
  });
  $('inspector').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'valIn') applyValue(B.selPart, e.target.value); });
  $('inspector').addEventListener('change', e => {
    const t = e.target, id = B.selPart;
    if (t.id === 'fitChk') { B.profile.fitted[id] = t.checked; B.structChanged(`${id} ${t.checked ? 'takıldı' : 'söküldü'} (deneysel varyant).`, 'warn'); B.renderInspector(); renderProfile(); }
    else if (t.id === 'taperSel') { B.profile.tapers[id] = t.value; B.structChanged(`${id} taper: ${t.value}.`, 'warn'); }
    else if (t.dataset.trafo) setTrafo(t);
  });
  function setTrafo(t) {
    const [tid, k] = t.dataset.trafo.split('.'), v = parseFloat(t.value), err = document.getElementById('valErr') || $('profErr');
    const ok = Number.isFinite(v) && (k === 'noLoadRisePct' ? v >= 0 : v > 0);
    if (!ok) { if (err) err.textContent = 'Reddedildi: pozitif, sonlu bir sayı gerekir.'; t.value = B.profile[tid][k]; return; }
    if (err) err.textContent = '';
    B.profile[tid][k] = v; B.structChanged(`${tid}.${k} = ${v} (deneysel trafo verisi).`, 'warn'); renderProfile();
  }
  function refreshInspectorValues() {
    if (!B.selPart || B.tab !== 'part') return;
    const dds = $('inspector').querySelectorAll('dl.kv dd'), kv = liveKV(B.selPart);
    if (dds.length !== kv.length) { if (!$('inspector').contains(document.activeElement)) B.renderInspector(); return; }
    kv.forEach(([, v], i) => { if (dds[i].innerHTML !== v) dds[i].innerHTML = v; });
  }

  // ======================================================================= Çalışma noktası
  function renderOp() {
    const w = B.sim.win, P = B.profile;
    if (!w) { $('opTable').innerHTML = '<p class="empty">Henüz bir şebeke periyodu tamamlanmadı.</p>'; return; }
    const row = (n, k, d, unit, note) => `<tr><td>${n}</td><td class="n">${num(w[k] * (unit === 'mA' ? 1000 : 1), d)} ${unit}</td><td class="n">${num(w[k + 'Min'] * (unit === 'mA' ? 1000 : 1), d)} … ${num(w[k + 'Max'] * (unit === 'mA' ? 1000 : 1), d)}</td><td class="note">${note || ''}</td></tr>`;
    const head = '<tr><th>Düğüm / büyüklük</th><th>Periyot ort.</th><th>Min … maks</th><th></th></tr>';
    const rk = D.resolve('R9', P).value, hl = Amp.heaterLoad(P);
    $('opTable').innerHTML = `<div class="cols2"><div><div class="h4">Besleme</div><table class="optable">${head}` +
      row('B+1', 'B1', 1, 'V', 'OT / güç katı; ripple 100 Hz') + row('B+2', 'B2', 1, 'V', 'screen') + row('B+3', 'B3', 1, 'V', '12AX7 anodik yükleri') +
      row('5Y3 çıkış akımı', 'iRect', 1, 'mA', `plaka tepe ${num(w.iRectPk * 1000, 0)} mA: darbeli şarj`) +
      `<tr><td>6,3 V heater yükü</td><td class="n">${num(hl.a63, 2)} A</td><td class="n">/ 1,5 A</td><td class="note">${hl.parts.map(p => `${p[0]} ${num(p[1], 2)} A`).join(' + ')} (model kartı; eldeki tüple doğrulanmalı)</td></tr>` +
      `<tr><td>5 V filaman</td><td class="n">${num(hl.a5, 1)} A</td><td class="n">/ 2 A</td><td class="note">ayrı sargı, B+ üzerinde yüzer</td></tr></table>` +
      `<div class="h4" style="margin-top:8px">Ön yükselteç (12AX7)</div><table class="optable">${head}` +
      row('V1A plaka', 'PA', 1, 'V') + row('V1A katot', 'KA', 3, 'V') + row('V1A akımı', 'i1a', 3, 'mA') + row('V1B plaka', 'PB', 1, 'V') + row('V1B katot', 'KB', 3, 'V', 'NFB düğümü') + row('V1B akımı', 'i1b', 3, 'mA') + `</table></div>` +
      `<div><div class="h4">Güç katı (6V6GT)</div><table class="optable">${head}` +
      row('Plaka Va', 'A6', 1, 'V', `B+1 − Va = ${num(w.B1 - w.A6, 1)} V: OT primer DCR düşümü`) + row('Katot Vk', 'K6', 2, 'V') + row('Kontrol gridi', 'G6', 3, 'V') +
      row('Anodik akım Ia', 'ia', 2, 'mA') + row('Screen akımı Ig2', 'ig2', 2, 'mA') +
      `<tr><td>Katot akımı Ik = Vk / Rk</td><td class="n">${num(w.K6 / rk * 1000, 2)} mA</td><td class="n">Ia + Ig2 = ${num((w.ia + w.ig2) * 1000, 2)}</td><td class="note">Ia = Ik − Ig2</td></tr>` +
      row('Anodik güç Pa', 'pa', 2, 'W', 'anlık (Va − Vk) × Ia\'nın ortalaması') + row('Screen gücü Pg2', 'pg2', 2, 'W') + `</table>` +
      `<p class="hint">Değerler son şebeke periyodunun (20 ms) ortalaması ve uç değerleridir; giriş sinyali yokken. Sinyal altındaki güçler "Osiloskop" görünümünün altındadır. Hepsi deneysel profile ve genel tüp modellerine dayanır; ölçüm değildir.</p></div></div>`;
  }

  // ======================================================================= Tasarım kontrolleri
  const MARK = { ok: '✓', warn: '!', bad: '✕', na: '?' };
  function renderChecks() {
    const list = Amp.checks(B.sim), n = list.filter(c => c.lv === 'bad' || c.lv === 'warn').length;
    const cnt = $('checkCnt'); cnt.hidden = !n; cnt.textContent = n;
    if (B.tab !== 'checks') return;
    $('checksBox').innerHTML = (B.modified() ? `<div class="banner">Profil değiştirildi (kimlik ${B.hash()} ≠ doğrulanan ${B.baseHash}). Doğrulama sayfasındaki ve docs/ altındaki test sonuçları bu profil için geçersizdir.</div>` : '') +
      `<table><tr><th></th><th>Kontrol</th><th>Değer</th><th>Açıklama</th></tr>` + list.map(c => `<tr><td class="lv ${c.lv}">${MARK[c.lv]}</td><td>${esc(c.title)}</td><td class="n">${esc(c.value)}</td><td class="note">${esc(c.note)}</td></tr>`).join('') +
      `</table><p class="hint">✓ sınır içinde · ! dikkat · ✕ sınır aşıldı ya da tehlikeli koşul · ? sınır verisi eksik (uygun denemez). Bunlar model tahminine dayalı tasarım kontrolleridir; güvenlik onayı değildir ve gerçek devrede otomatik durdurma yoktur.</p>`;
  }

  // ======================================================================= Açık kararlar
  let decFocus = null;
  function renderDecisions() {
    const cnt = k => D.DECISIONS.filter(d => d.pri === k).length;
    $('decList').innerHTML = `<div class="h4">Karar günlüğü — ${D.DECISIONS.length} kayıt (P0: ${cnt('P0')}, P1: ${cnt('P1')}, P2: ${cnt('P2')}). "Simülasyon varsayımı" sütunu deneysel profildir; Rev A kararı değildir.</div>` +
      D.DECISIONS.map(d => `<article class="dec ${decFocus === d.id ? 'focus' : ''}" id="dec-${d.id}"><div><span class="chip ${d.pri}">${d.pri}</span> <b>${d.id}</b><br><span class="chip ACIK">${d.state}</span></div>` +
        `<div><h4>${esc(d.title)}</h4><dl><dt>Açık olan</dt><dd>${esc(d.open)}</dd><dt>Simülasyon varsayımı</dt><dd>${esc(d.sim)}</dd><dt>Nasıl kapanır</dt><dd>${esc(d.close)}</dd>` +
        `<dt>Kaynak · parçalar</dt><dd><span class="src">${esc(d.src)}</span> · ${d.parts.map(p => `<button class="btn sm" data-goto="${p}">${p}</button>`).join(' ')}</dd></dl></div></article>`).join('');
    if (decFocus) { const el = $('dec-' + decFocus); if (el) el.scrollIntoView({ block: 'nearest' }); }
  }
  B.openDecision = function (id) { decFocus = id; B.showTab('dec'); renderDecisions(); };
  $('decList').addEventListener('click', e => { const b = e.target.closest('[data-goto]'); if (b) B.selectPart(b.dataset.goto); });

  // ======================================================================= Profil
  function renderProfile() {
    const P = B.profile, mod = B.modified();
    const open = D.COMPONENTS.filter(c => c.value == null && ['R', 'C', 'POT'].includes(c.type));
    const sel = c => {
      const cur = D.resolve(c.id, P).value, opts = Array.from(new Set((c.candidates || []).concat(cur == null ? [] : [cur]))).sort((a, b) => a - b);
      return `<label class="field"><span>${c.id} · ${esc(c.fn)}</span><select data-pval="${c.id}">${opts.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${U.fmt(v, c.unit)}</option>`).join('')}</select></label>`;
    };
    $('profBox').innerHTML = `<div class="banner ${mod ? '' : ''}"><b>${esc(P.id)}${mod ? ' · değiştirilmiş' : ''}</b> — ${esc(P.name)}. ${esc(P.why)} Onay durumu: <b>onaylanmadı</b>. Kimlik ${B.hash()}${mod ? ` (doğrulanan ${B.baseHash})` : ''}. ` +
      `<button class="btn sm" id="profReset">Varsayılan profile dön</button></div><div class="params">` +
      `<fieldset><legend>Açık değerler (deneysel seçim)</legend>${open.map(sel).join('')}</fieldset>` +
      `<fieldset><legend>Pot eğrileri ve RAW yöntemi</legend>` + ['VR1', 'VR2', 'VR3', 'VR4'].map(id => `<label class="field"><span>${id} · ${esc(D.BY_ID[id].fn)}</span><select data-taper="${id}"><option value="lin" ${P.tapers[id] === 'lin' ? 'selected' : ''}>lineer</option><option value="log" ${P.tapers[id] === 'log' ? 'selected' : ''}>log</option></select></label>`).join('') +
      `<label class="field"><span>RAW yöntemi (K-06)</span><select data-raw><option value="lift" ${P.rawMethod === 'lift' ? 'selected' : ''}>ağ girişten ayrılır (lift)</option><option value="tap" ${P.rawMethod === 'tap' ? 'selected' : ''}>ağ yük olarak kalır (tap)</option></select></label></fieldset>` +
      `<fieldset><legend>Opsiyonel parçalar (varyant)</legend>` + D.COMPONENTS.filter(c => c.optional).map(c => `<label class="field"><span>${c.id} · ${esc(c.fn)} · ${U.fmt(D.resolve(c.id, P).value, c.unit)}</span><input type="checkbox" data-fit="${c.id}" ${D.isFitted(c.id, P) ? 'checked' : ''}></label>`).join('') +
      `<p class="hint">Takılı olmayan parça netlistte de BOM'da da "takılı değil" görünür.</p></fieldset>` +
      Object.entries(TRAFO_FIELDS).map(([tid, fs]) => `<fieldset><legend>${tid} · deneysel trafo verisi</legend>${fs.map(([k, l, u]) => `<label class="field"><span>${l}</span><span><input type="number" step="any" min="0" data-trafo="${tid}.${k}" value="${P[tid][k]}"> ${u}</span></label>`).join('')}<p class="hint">${esc(P.reasons[tid])}</p></fieldset>`).join('') +
      `</div><div class="err" id="profErr" style="color:var(--fault);font-size:12px"></div>`;
  }
  $('profBox').addEventListener('change', e => {
    const t = e.target, P = B.profile;
    if (t.dataset.pval) { P.values[t.dataset.pval] = +t.value; if (P.overrides) delete P.overrides[t.dataset.pval]; B.structChanged(`${t.dataset.pval} = ${U.fmt(+t.value, D.BY_ID[t.dataset.pval].unit)} (deneysel seçim).`, 'warn'); }
    else if (t.dataset.taper) { P.tapers[t.dataset.taper] = t.value; B.structChanged(`${t.dataset.taper} taper: ${t.value}.`, 'warn'); }
    else if (t.hasAttribute('data-raw')) { P.rawMethod = t.value; B.structChanged(`RAW yöntemi: ${t.value}.`, 'warn'); }
    else if (t.dataset.fit) { P.fitted[t.dataset.fit] = t.checked; B.structChanged(`${t.dataset.fit} ${t.checked ? 'takıldı' : 'söküldü'} (deneysel varyant).`, 'warn'); }
    else if (t.dataset.trafo) { setTrafo(t); return; }
    renderProfile();
  });
  $('profBox').addEventListener('click', e => {
    if (e.target.id !== 'profReset') return;
    B.profile = D.cloneProfile(); B.structChanged('Profil varsayılana döndü (' + B.profile.id + ').'); renderProfile(); B.renderInspector();
  });

  // ======================================================================= Malzeme / tedarik
  function renderBom() {
    const rows = BomAmp.rows(B.profile), by = k => rows.filter(r => r.stock && r.stock.startsWith(k)).length;
    let html = `<div class="bom-head"><span class="bom-sum"><b>${rows.length}</b> satır · elde <b>${by('ELDE')}</b> · satın alınacak <b>${by('SATIN AL')}</b> · özel sarım <b>${by('ÖZEL')}</b> · şartname / onay bekleyen <b>${rows.filter(r => /BEKLİYOR|KOŞULLU/.test(r.stock)).length}</b></span>` +
      `<span class="hint">Satın alma onayı değildir. Tedarik kaynakları ${D.SUPPLY_CHECKED} tarihinde kontrol edilen adaylardır; stok, fiyat ve teslimat teyit edilmedi. Tolerans, üretici, parça kodu ve paket alanları: veri eksik (CSV'de ayrı sütunlar).</span>` +
      `<button class="btn sm" id="bomCsv">CSV indir</button></div><table class="bom"><thead><tr><th>Ref</th><th>İşlev</th><th>Değer / özellik</th><th class="n">Adet</th><th>Karar</th><th>Tedarik durumu</th><th>Kaynak · aday</th><th>Not</th></tr></thead><tbody>`;
    let g = null;
    for (const r of rows) {
      if (r.group !== g) { g = r.group; html += `<tr class="grp"><th colspan="8">${esc(g)}</th></tr>`; }
      html += `<tr class="${r.fitted ? '' : 'none'}"><td class="ref">${r.id ? `<a href="#" data-goto="${r.id}">${esc(r.ref)}</a>` : esc(r.ref)}</td><td>${esc(r.fn)}</td><td>${esc(r.value)}</td><td class="n">${r.qty}</td><td>${chip(r.status)}${r.decision ? ` <a href="#" data-dec="${r.decision}">${r.decision}</a>` : ''}</td><td>${esc(r.stock)}</td>` +
        `<td><span class="src">${esc(r.src)}</span>${r.supply.length ? ' · ' + supplyLinks(r.supply) : ''}</td><td class="hint">${esc(r.note)}</td></tr>`;
    }
    html += `</tbody></table><div class="h4" style="margin-top:10px">Tedarik kaynakları (aday; kontrol ${D.SUPPLY_CHECKED})</div><table class="bom"><tbody>` +
      Object.entries(D.SUPPLIERS).map(([k, s]) => `<tr><td class="ref">${k}</td><td>${esc(s.name)} <span class="hint">(${s.country} · ${s.kind})</span></td><td>${esc(s.what)}</td><td colspan="2"><a href="${s.url}" target="_blank" rel="noopener">bağlantı</a></td><td colspan="3" class="hint">${esc(s.note)}</td></tr>`).join('') + `</tbody></table>`;
    $('bom').innerHTML = html;
  }
  $('bom').addEventListener('click', e => {
    const t = e.target;
    if (t.id === 'bomCsv') { const a = document.createElement('a'), id = B.expId(); a.href = URL.createObjectURL(new Blob([BomAmp.csv(B.profile, id)], { type: 'text/csv;charset=utf-8' })); a.download = `5f1-bom-${id}.csv`; document.body.appendChild(a); a.click(); a.remove(); }
    else if (t.dataset.goto) { e.preventDefault(); B.selectPart(t.dataset.goto); }
    else if (t.dataset.dec) { e.preventDefault(); B.openDecision(t.dataset.dec); }
  });

  // ======================================================================= Model kartları
  function renderCards() {
    const P = B.profile, used = Array.from(new Set(Object.values(P.models))), o = Amp.AUDIO_DEFAULTS;
    const card = c => `<article class="card"><h4>${c.id} <span class="hint">v${c.version} · ${esc(c.tube)}</span></h4><p><code>${esc(c.eq)}</code></p>` +
      `<dl class="kv"><dt>Kaynak</dt><dd style="font-family:inherit">${esc(c.source)}</dd><dt>Lisans</dt><dd style="font-family:inherit">${esc(c.license)}</dd><dt>Geçerli aralık</dt><dd style="font-family:inherit">${esc(c.range)}</dd>` +
      `<dt>Doğrulama kanıtı</dt><dd style="font-family:inherit">${esc(c.evidence)}</dd><dt>Heater</dt><dd style="font-family:inherit">${num(c.heater.v, 1)} V / ${num(c.heater.a, 2)} A — ${esc(c.heater.note)}</dd>` +
      `<dt>Sınır değerleri</dt><dd style="font-family:inherit">veri eksik. ${esc(c.limitsRef)}</dd><dt>Isınma (temsilî)</dt><dd style="font-family:inherit">τ açılış ${c.warm.tauUp} s, kapanış ${c.warm.tauDown} s; kalibre değil</dd></dl>` +
      `<div class="h4">Modellenmeyen etkiler</div><ul>${c.missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul></article>`;
    $('cards').innerHTML = `<div class="cols2">${used.map(k => card(Tubes.CARDS[k])).join('')}` +
      `<article class="card"><h4>Trafolar <span class="hint">deneysel veri</span></h4><p>T1: iki ideal sinüs kaynağı + plaka başına ${U.fmt(P.T1.rt, 'Ω')} seri direnç. T2: çok sargılı ideal trafo + mıknatıslanma endüktansı ${num(P.T2.lp, 0)} H + kaçak ${U.fmt(P.T2.lleak, 'H')} + sargı dirençleri.</p>` +
      `<div class="h4">Modellenmeyen etkiler</div><ul><li>Nüve doyumu ve histerezis (DC bias altında endüktans değişimi)</li><li>Sargı kapasiteleri (yüksek frekans rezonansı)</li><li>PT kaçak endüktansı, mıknatıslanma akımı ve inrush</li><li>Manyetik kuplaj / hum: görsel yerleşimden hum miktarı türetilmez</li></ul></article>` +
      `<article class="card"><h4>Çözücü <span class="hint">MNA · Newton–Raphson</span></h4><dl class="kv"><dt>Canlı besleme adımı</dt><dd>${Amp.LIVE_H * 1e6} µs, sabit (BDF2)</dd><dt>Ses analizi</dt><dd>${o.fs / 1000} kHz, N = ${o.n}, ${o.window}, yerleşme ${o.settleS * 1000} ms</dd>` +
      `<dt>Yakınsama</dt><dd>|Δv| ≤ 0,1 µV + 10⁻⁷·|v|</dd><dt>Yakınsamazsa</dt><dd>adım 2…64'e bölünür; sonra açık hata</dd><dt>Sayısal eklemeler</dt><dd>GMIN 1 pS / düğüm; pot uç direnci ${Amp.RMIN} Ω</dd><dt>Rastgelelik</dt><dd>yok (tohum gerekmez)</dd></dl>` +
      `<p class="hint">Hiçbir gerilim ya da akım "makul görünsün" diye kırpılmaz. Yakınsamama fiziksel arıza ya da koruma olarak raporlanmaz.</p></article>` +
      `<article class="card"><h4>Kapsam dışı <span class="hint">sayı üretilmez</span></h4><ul><li>Ark, izolasyon delinmesi, mikrofoni</li><li>Heater hum'ı, toprak döngüsü, trafo yerleşimi kaynaklı hum</li><li>Parça ve kabin sıcaklığı (kalibre ısıl model yok)</li><li>Hoparlör akustiği, SPL, kabin tonu (T/S ve IR yok); yük omik dirençtir</li><li>Canlı ses dinleme (M3) ve 3B görünüm (M4): bu sürümde yok</li><li>Bağımsız SPICE karşılaştırması: çalıştırılmadı</li></ul></article></div>`;
  }

  // ======================================================================= Tazeleme
  const RENDER = { scen: renderScenarios, part: refreshInspectorValues, op: renderOp, checks: renderChecks, dec: null, prof: null, log: null, bom: null, cards: null };
  const ONCE = { dec: renderDecisions, prof: renderProfile, bom: renderBom, cards: renderCards, part: () => B.renderInspector(), scen: renderScenarios };
  B.hooks.slow.push(force => {
    if (force && ONCE[B.tab]) ONCE[B.tab]();
    if (B.tab !== 'scen' && RENDER[B.tab]) RENDER[B.tab]();
    if (B.tab !== 'checks') renderChecks();           // sekmedeki sayaç güncel kalsın
  });
  B.hooks.struct.push(() => { if (ONCE[B.tab] && B.tab !== 'part') ONCE[B.tab](); });
  B.hooks.reset.push(() => { renderScenarios(); if (B.selPart) B.renderInspector(); });
})();
