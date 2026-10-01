/*
 * SI birim ayrıştırma ve gösterim.
 * İç hesap daima SI (V, A, Ω, F, H, s). Arayüz kΩ / µF / nF ve Türkçe ondalık virgül kullanır.
 * "22n", "22 nF", "0,022 µF" aynı değere çevrilir; hatalı, negatif veya sonsuz değer reddedilir.
 */
(function (root) {
  'use strict';

  const PREFIX = { p: 1e-12, n: 1e-9, 'µ': 1e-6, 'μ': 1e-6, u: 1e-6, m: 1e-3, '': 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };
  const UNIT_ALIASES = { 'Ω': 'Ω', ohm: 'Ω', Ohm: 'Ω', R: 'Ω', F: 'F', H: 'H', V: 'V', A: 'A', W: 'W', s: 's', Hz: 'Hz' };

  /**
   * Metni SI değere çevirir. unit verilirse metindeki birim onunla uyuşmalıdır.
   * Dönüş: { ok: true, value } ya da { ok: false, error }.
   */
  function parse(text, unit) {
    if (typeof text === 'number') return check(text);
    if (typeof text !== 'string') return { ok: false, error: 'Değer metin ya da sayı olmalı.' };
    const s = text.trim().replace(/\s+/g, '');
    if (!s) return { ok: false, error: 'Boş değer.' };
    // "4k7" biçimi: önek ondalık ayırıcı yerinde
    const inl = s.match(/^(\d+)([pnuµμmkKMG])(\d+)(Ω|ohm|Ohm|F|H|V|A|W|s|Hz)?$/);
    let num, pre, u;
    if (inl) { num = parseFloat(inl[1] + '.' + inl[3]); pre = inl[2]; u = inl[4] || ''; }
    else {
      const m = s.match(/^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?)([pnuµμmkKMG]?)(Ω|ohm|Ohm|R|F|H|V|A|W|s|Hz)?$/);
      if (!m) return { ok: false, error: `"${text}" sayı olarak okunamadı.` };
      num = parseFloat(m[1].replace(',', '.')); pre = m[2] || ''; u = m[3] || '';
    }
    if (u && unit && UNIT_ALIASES[u] !== unit) return { ok: false, error: `Birim uyuşmuyor: ${u} verildi, ${unit} bekleniyor.` };
    return check(num * PREFIX[pre]);
  }
  function check(v) {
    if (!Number.isFinite(v)) return { ok: false, error: 'Sonlu bir sayı değil.' };
    if (v < 0) return { ok: false, error: 'Negatif değer kabul edilmez.' };
    return { ok: true, value: v };
  }
  /** Bileşen değeri: sıfır da reddedilir (0 Ω direnç, 0 F kapasitör devre tanımı değildir). */
  function parsePositive(text, unit) {
    const r = parse(text, unit);
    if (r.ok && r.value === 0) return { ok: false, error: 'Sıfır değer kabul edilmez.' };
    return r;
  }

  /** Türkçe ondalık virgüllü sayı. */
  function num(x, digits = 2) {
    if (x == null || !Number.isFinite(x)) return '—';
    return x.toFixed(digits).replace('.', ',');
  }
  /** Gereksiz sıfırlar atılmış sayı: 1,50 → 1,5; 22,00 → 22 */
  function trim(x, sig = 3) {
    if (x == null || !Number.isFinite(x)) return '—';
    if (x === 0) return '0';
    const p = Number(x.toPrecision(sig));
    return String(p).replace('.', ',');
  }
  /** Mühendislik gösterimi: 22e-9,'F' → "22 nF"; 1500,'Ω' → "1,5 kΩ" */
  function fmt(x, unit = '', sig = 3) {
    if (x == null || !Number.isFinite(x)) return '—';
    if (x === 0) return `0 ${unit}`.trim();
    const a = Math.abs(x);
    const steps = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
    let pick = steps[steps.length - 1];
    for (const st of steps) { if (a >= st[0] * 0.9995) { pick = st; break; } }
    return `${trim(x / pick[0], sig)} ${pick[1]}${unit}`.trim();
  }
  /** Şema üzerindeki kısa değer: "68k", "22n", "1M5" yerine "1,5k" */
  function short(x, unit) {
    if (x == null) return '?';
    return fmt(x, '', 3).replace(' ', '') + (unit === 'F' ? 'F' : '');
  }

  const api = { parse, parsePositive, num, trim, fmt, short };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Units = api;
})(typeof self !== 'undefined' ? self : this);
