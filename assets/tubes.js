/*
 * Tüp model kartları ve MNA elemanları.
 *
 * ÖNEMLİ: Eldeki 12AX7 / 6V6GT / 5Y3GT tüplerinin üreticisi ve varyantı kayıtlı değildir.
 * Buradaki kartlar GENEL modellerdir; her kart kaynağını, sürümünü, geçerli aralığını ve
 * modellenmeyen etkileri taşır. Sınır değerleri (limits) yalnızca REFERANS'tır; eldeki tüpe
 * otomatik uygulanmaz ("sınır verisi eksik").
 *
 * em: katot emisyon çarpanı (0 = soğuk, 1 = sıcak). Isınma eğrisi temsilîdir, kalibre değildir.
 */
(function (root) {
  'use strict';

  const CARDS = {
    '12AX7-koren': {
      id: '12AX7-koren', version: '1.0', kind: 'triode', tube: '12AX7 / ECC83 (genel)',
      eq: 'Koren geliştirilmiş triyot: E1 = (Vp/kP)·ln(1 + exp(kP·(1/µ + Vg/√(kVB + Vp²)))); Ip = 2·E1^X / kG1',
      p: { mu: 100, x: 1.4, kg1: 1060, kp: 600, kvb: 300, rgi: 2000, cgp: 1.7e-12, cgk: 1.6e-12, cpk: 0.46e-12 },
      source: 'N. Koren, "Improved Vacuum Tube Models for SPICE Simulations", Glass Audio 5/1996; parametreler yaygın 12AX7 uyumu. Elektrotlar arası kapasiteler: tipik 12AX7 veri sayfası değerleri.',
      license: 'Yayımlanmış denklem ve parametreler; dosya kopyalanmadı.',
      range: 'Vp 0–450 V, Vg −5…+1 V, Ip 0–5 mA',
      missing: ['Üretici / varyant farkı', 'Mikrofoni, gürültü, heater–katot kaçağı', 'Grid akımı yalnız basit diyot + 2 kΩ', 'Sıcaklığa bağlı kayma'],
      evidence: '250 V / −2 V noktasında model 0,95 mA; tipik veri sayfası 1,2 mA (−%21). Genel uyum; eldeki tüp ölçülmedi.',
      heater: { v: 6.3, a: 0.3, note: '6,3 V paralel bağlantı (4+5 / 9)' },
      limits: null,
      limitsRef: 'Eldeki tüpün veri sayfası kaydedilmedi.',
      warm: { tauUp: 6, tauDown: 12, w0: 0.6 },
    },
    '6V6-koren': {
      id: '6V6-koren', version: '1.1', kind: 'pentode', tube: '6V6GT (genel)',
      eq: 'Koren pentot plaka akımı: E1 = (Vg2/kP)·ln(1 + exp(kP·(1/µ + Vg1/Vg2))); Ip = 2·E1^X/kG1 · atan(Vp/kVB). Ekran: akım korunumlu; Ig2 = (Vg1 + Vg2/µ)^X/kG2 + Ip∞·(1 − (2/π)·atan(Vp/kVB)), Ip∞ = π·E1^X/kG1',
      p: { mu: 10.7, x: 1.31, kg1: 1672, kg2: 6575, kp: 41.16, kvb: 12.7, rgi: 2000, cg1: 9e-12, ca: 8.5e-12, cag1: 0.7e-12 },
      source: 'Plaka akımı: Koren pentot denklemi, 6V6GT için yaygın parametre seti. Ekran akımı: BU PROJEYE ÖZGÜ değişiklik — plakanın almadığı uzay akımı ekrana verilir (katot akımı plaka geriliminden yaklaşık bağımsız kalır); kG2, JJ 6V6S tipik noktasında Ig2 = 5 mA olacak şekilde yeniden uyduruldu. Kapasiteler: JJ 6V6S veri sayfası (Cg1 9 pF, Ca 8,5 pF, Ca/g1 0,7 pF).',
      license: 'Yayımlanmış denklem ve parametreler; dosya kopyalanmadı.',
      range: 'Vp 0–500 V, Vg2 0–450 V, Vg1 −40…+2 V',
      missing: ['Ekran akımının diz bölgesindeki biçimi ölçülmüş eğrilerle doğrulanmadı: kırpılmadaki ekran gücü ve çıkış gücü yaklaşık değerlerdir', 'Üretici / varyant farkı', 'İkincil emisyon ve demet oluşumu ayrıntısı', 'Isıl kayma'],
      evidence: 'JJ 6V6S tipik nokta 250 V / 250 V / −12,5 V: veri sayfası Ia 45 mA, Ig2 5 mA; model 46,1 mA ve 5,0 mA (tests/run-tests.js MK-02).',
      heater: { v: 6.3, a: 0.5, note: 'JJ 6V6S: 0,5 A. Eski 6V6GT tipik 0,45 A; eldeki tüple doğrulanmalı.' },
      limits: null,
      limitsRef: 'REFERANS (JJ 6V6S, eldeki tüp değil): Ua 500 V, Ug2 450 V, Wa 14 W; grid devresi direnci self-bias ≤ 0,5 MΩ.',
      ref: { paW: 14, vaV: 500, vg2V: 450, rg1Ohm: 0.5e6 },
      warm: { tauUp: 6, tauDown: 15, w0: 0.6 },
    },
    '5Y3-child': {
      id: '5Y3-child', version: '1.0', kind: 'rectifier', tube: '5Y3GT (genel)',
      eq: 'Plaka başına Child yasası: I = G · V^1,5 (V > 0)',
      p: { g: 3.72e-4 },
      source: 'G, JJ 5Y3S veri sayfasındaki kapasitör girişli tipik noktaya uydurulmuştur: 350 VAC/plaka, C = 20 µF, Rt = 50 Ω, 125 mA → 360 V DC.',
      license: 'Kendi uyumumuz.',
      range: 'Plaka başına 0–0,5 A; ileri düşüm 0–90 V',
      missing: ['Ters kaçak ve ark (flashover)', 'Filaman ısınma ayrıntısı', 'Üretici / varyant farkı'],
      evidence: 'tests/run-tests.js MK-01: aynı koşulda model çıkışı 360 V ± %1.',
      heater: { v: 5, a: 2, note: 'Ayrı 5 V sargı; B+ potansiyelinde yüzer.' },
      limits: null,
      limitsRef: 'REFERANS (JJ 5Y3S tipik çalışma, sınır değil): 350 VAC / 20 µF / 50 Ω / 125 mA. Eldeki 5Y3GT için tepe plaka akımı ve PIV sınırı kaydedilmedi.',
      warm: { tauUp: 0.8, tauDown: 2, w0: 0.6 },
    },
  };

  // --- Akım denklemleri -------------------------------------------------------------
  function softplus(u) { return u > 30 ? u : Math.log1p(Math.exp(u)); }
  /** Grid iletimi: Vgk > 0 civarında yumuşak dizli diyot + seri direnç. */
  function gridI(vgk, rgi) { const s = 0.08; return s * softplus(vgk / s) / rgi; }

  /** Yumuşak max(0, u): 0 çevresinde türev sürekliliği (Newton için); s ≪ çalışma gerilimleri. */
  function smax(u, s) { return s * softplus(u / s); }

  function triodeIp(p, vgk, vpk) {
    if (vpk <= 0) return 0;
    const e1 = vpk / p.kp * softplus(p.kp * (1 / p.mu + vgk / Math.sqrt(p.kvb + vpk * vpk)));
    return e1 > 0 ? 2 * Math.pow(e1, p.x) / p.kg1 : 0;
  }
  /** Yumuşak max(0, u): 0 çevresinde türev sürekliliği (Newton için); s ≪ çalışma gerilimleri. */
  function smax(u, s) { return s * softplus(u / s); }
  /** Pentot akımları: out[0] = plaka, out[1] = ekran. Plaka + ekran, plaka geriliminden yaklaşık bağımsızdır. */
  function pentodeI(p, vg1k, vg2k, vpk, out) {
    if (vg2k <= 0) { out[0] = 0; out[1] = 0; return out; }
    const e1 = vg2k / p.kp * softplus(p.kp * (1 / p.mu + vg1k / vg2k));
    const base = e1 > 0 ? 2 * Math.pow(e1, p.x) / p.kg1 : 0;        // Ip = base · atan(Vp/kVB)
    const at = Math.atan(smax(vpk, 0.05) / p.kvb);
    const es = smax(vg1k + vg2k / p.mu, 0.05);
    out[0] = base * at;
    out[1] = Math.pow(es, p.x) / p.kg2 + base * (Math.PI / 2 - at);
    return out;
  }
  const _pt = [0, 0];
  function pentodeIp(p, vg1k, vg2k, vpk) { return pentodeI(p, vg1k, vg2k, vpk, _pt)[0]; }
  function pentodeIg2(p, vg1k, vg2k, vpk) { return pentodeI(p, vg1k, vg2k, vpk, _pt)[1]; }
  function diodeI(p, v) { const u = smax(v, 0.05); return p.g * u * Math.sqrt(u); }

  const DV = 1e-3;   // merkezî fark adımı (V)

  /** Triyot: uçlar [P, G, K]. I: düğümden elemana giren akım. */
  function triode(card) {
    const p = card.p;
    const d = { n: 3, em: 1, card, v: new Float64Array(3), I: new Float64Array(3), J: new Float64Array(9), ip: 0, ig: 0 };
    d.eval = function (v) {
      const em = d.em, vgk = v[1] - v[2], vpk = v[0] - v[2];
      const ip = em * triodeIp(p, vgk, vpk), ig = em * gridI(vgk, p.rgi);
      const gm = em * (triodeIp(p, vgk + DV, vpk) - triodeIp(p, vgk - DV, vpk)) / (2 * DV);
      const gp = em * (triodeIp(p, vgk, vpk + DV) - triodeIp(p, vgk, vpk - DV)) / (2 * DV);
      const gg = em * (gridI(vgk + DV, p.rgi) - gridI(vgk - DV, p.rgi)) / (2 * DV);
      d.ip = ip; d.ig = ig; d.gm = gm; d.gp = gp;
      const I = d.I, J = d.J;
      I[0] = ip; I[1] = ig; I[2] = -(ip + ig);
      J[0] = gp; J[1] = gm; J[2] = -(gp + gm);
      J[3] = 0; J[4] = gg; J[5] = -gg;
      J[6] = -gp; J[7] = -(gm + gg); J[8] = gp + gm + gg;
    };
    return d;
  }

  /** Pentot / demet tetrot: uçlar [P, G2, G1, K]. */
  function pentode(card) {
    const p = card.p;
    const d = { n: 4, em: 1, card, v: new Float64Array(4), I: new Float64Array(4), J: new Float64Array(16), ip: 0, ig2: 0, ig1: 0 };
    const a = [0, 0], b = [0, 0];
    d.eval = function (v) {
      const em = d.em, vpk = v[0] - v[3], vsk = v[1] - v[3], vgk = v[2] - v[3], c = em / (2 * DV);
      pentodeI(p, vgk, vsk, vpk, a);
      const ip = em * a[0], is = em * a[1], ig = em * gridI(vgk, p.rgi);
      pentodeI(p, vgk, vsk, vpk + DV, a); pentodeI(p, vgk, vsk, vpk - DV, b);
      const ip_p = (a[0] - b[0]) * c, is_p = (a[1] - b[1]) * c;
      pentodeI(p, vgk, vsk + DV, vpk, a); pentodeI(p, vgk, vsk - DV, vpk, b);
      const ip_s = (a[0] - b[0]) * c, is_s = (a[1] - b[1]) * c;
      pentodeI(p, vgk + DV, vsk, vpk, a); pentodeI(p, vgk - DV, vsk, vpk, b);
      const ip_g = (a[0] - b[0]) * c, is_g = (a[1] - b[1]) * c;
      const ig_g = (gridI(vgk + DV, p.rgi) - gridI(vgk - DV, p.rgi)) * c;
      d.ip = ip; d.ig2 = is; d.ig1 = ig; d.gm = ip_g; d.gp = ip_p;
      const I = d.I, J = d.J;
      I[0] = ip; I[1] = is; I[2] = ig; I[3] = -(ip + is + ig);
      J[0] = ip_p; J[1] = ip_s; J[2] = ip_g; J[3] = -(ip_p + ip_s + ip_g);       // satır P
      J[4] = is_p; J[5] = is_s; J[6] = is_g; J[7] = -(is_p + is_s + is_g);       // satır G2
      J[8] = 0; J[9] = 0; J[10] = ig_g; J[11] = -ig_g;                           // satır G1
      for (let k = 0; k < 4; k++) J[12 + k] = -(J[k] + J[4 + k] + J[8 + k]);     // satır K
    };
    return d;
  }

  /** Doğrultucu plakası: uçlar [A, K]. */
  function diode(card) {
    const p = card.p;
    const d = { n: 2, em: 1, card, v: new Float64Array(2), I: new Float64Array(2), J: new Float64Array(4), i: 0 };
    d.eval = function (v) {
      const u = v[0] - v[1], em = d.em;
      const i = em * diodeI(p, u), g = em * (diodeI(p, u + DV) - diodeI(p, u - DV)) / (2 * DV);
      d.i = i;
      d.I[0] = i; d.I[1] = -i;
      d.J[0] = g; d.J[1] = -g; d.J[2] = -g; d.J[3] = g;
    };
    return d;
  }

  /** Isınma değişkeni w ∈ [0,1] → emisyon çarpanı. Eşiğin altında iletim yok. */
  function emission(card, w) {
    const w0 = card.warm.w0, u = (w - w0) / (1 - w0);
    return u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  }

  const api = { CARDS, triode, pentode, diode, emission, triodeIp, pentodeI, pentodeIp, pentodeIg2, diodeI, gridI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Tubes = api;
})(typeof self !== 'undefined' ? self : this);
