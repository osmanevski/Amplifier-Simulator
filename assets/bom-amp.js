/*
 * Malzeme listesi: kanonik devre tanımından türetilir (ayrı bir parça veritabanı YOKTUR).
 * Elektriksel nominal değer, paket ölçüsü ve tedarik uygunluğu üç ayrı kontroldür;
 * bu liste satın alma onayı değildir.
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const D = node ? require('./circuit-5f1.js') : root.Design;
  const U = node ? require('./units.js') : root.Units;

  const GROUPS = ['Tüpler', 'Trafolar', 'Besleme filtresi', 'Giriş', 'Sinyal katları', 'Ton ağı', 'Volume / voicing', 'Anahtarlar', 'Bağlantı', 'Şebeke', 'Heater', 'Mekanik', 'Test', 'Yedek / deneysel'];

  /** Bir bileşenin değer metni: şema, denetçi ve BOM aynı işlevi kullanır. */
  function valueText(id, profile) {
    const c = D.BY_ID[id];
    if (c.type === 'JACK') return `${c.value} Ω tap`;
    if (['TRIODE', 'PENTODE', 'RECT', 'PT', 'OT', 'SW', 'MECH'].includes(c.type) && c.unit !== 'Ω') return c.spec || '—';
    const r = D.resolve(id, profile);
    if (r.value == null) return 'AÇIK';
    let t = U.fmt(r.value, c.unit);
    if (c.rating && c.rating.V) t += ` / ${c.rating.V} V`;
    if (c.rating && c.rating.W) t += ` / ${c.rating.W} W`;
    if (c.type === 'POT') t += ' ' + ((profile.tapers && profile.tapers[id]) || c.taper || 'lin');
    return t;
  }

  function rows(profile) {
    const out = [];
    for (const c of D.COMPONENTS) {
      const r = D.resolve(c.id, profile), fitted = D.isFitted(c.id, profile);
      const isPart = !['TRIODE'].includes(c.type) || c.id === 'V1A';
      if (!isPart) continue;                                   // 12AX7 tek parça: V1A satırında
      out.push({
        ref: c.id === 'V1A' ? 'V1' : c.id, fn: c.id === 'V1A' ? 'Ön yükselteç tüpü (V1A + V1B)' : c.fn, value: valueText(c.id, profile),
        qty: c.qty || 1, status: ['R', 'C', 'POT'].includes(c.type) ? r.status : c.status,
        stock: c.optional && !fitted ? 'OPSİYONEL · takılı değil' : (c.stock || (r.status === 'DENEYSEL' ? 'DEĞER ONAYI BEKLİYOR' : '—')),
        tol: c.tol, mfr: null, mpn: null, pkg: null,
        supply: c.supply, src: c.src, note: c.note, group: c.group, decision: c.decision || null, id: c.id, fitted,
      });
    }
    for (const x of D.BOM_EXTRA) out.push({ ref: x.ref, fn: x.fn, value: x.spec, qty: x.qty, status: 'RAPOR', stock: x.stock, tol: null, mfr: null, mpn: null, pkg: null, supply: x.supply, src: x.src, note: '', group: x.group, decision: null, id: null, fitted: true });
    out.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
    return out;
  }

  function csv(profile, expId) {
    const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const head = ['Ref', 'İşlev', 'Değer / özellik', 'Adet', 'Karar durumu', 'Tedarik durumu', 'Tolerans', 'Üretici', 'Parça kodu', 'Paket', 'Kaynaklar', 'Bağlantılar', 'Kaynak kontrol tarihi', 'Belge', 'Not'];
    const L = [`# 5F1 Modifiye ${D.REVISION.id} · profil ${profile.id} · deney ${expId || '-'} · satın alma onayı değildir`, head.map(q).join(';')];
    for (const r of rows(profile)) {
      L.push([r.ref, r.fn, r.value, r.qty, D.STATUS_TR[r.status] || r.status, r.stock, r.tol == null ? 'veri eksik' : r.tol, r.mfr || 'veri eksik', r.mpn || 'veri eksik', r.pkg || 'veri eksik',
        r.supply.join(' '), r.supply.map(s => D.SUPPLIERS[s].url).join(' '), r.supply.length ? D.SUPPLY_CHECKED : '', r.src, r.note].map(q).join(';'));
    }
    return '﻿' + L.join('\r\n');
  }

  const api = { rows, csv, valueText, GROUPS };
  if (node) module.exports = api;
  root.BomAmp = api;
})(typeof self !== 'undefined' ? self : this);
