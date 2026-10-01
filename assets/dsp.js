/*
 * Ölçüm yardımcıları: RMS / tepe ayrımı, pencereli FFT, harmonik ve THD.
 * Yalnızca ham, eş aralıklı analiz tamponuyla kullanılır; ekran için seyreltilmiş diziyle değil.
 */
(function (root) {
  'use strict';

  /** DC ortalama, AC RMS (ortalama çıkarılmış), toplam RMS, tepe değerler. */
  function stats(x) {
    let s = 0, mn = Infinity, mx = -Infinity;
    for (let i = 0; i < x.length; i++) { const v = x[i]; s += v; if (v < mn) mn = v; if (v > mx) mx = v; }
    const dc = s / x.length;
    let a = 0, t = 0;
    for (let i = 0; i < x.length; i++) { const v = x[i]; a += (v - dc) * (v - dc); t += v * v; }
    return { dc, rmsAc: Math.sqrt(a / x.length), rmsTotal: Math.sqrt(t / x.length), max: mx, min: mn, pkPos: mx - dc, pkNeg: dc - mn, pp: mx - mn };
  }

  /** Yerinde radix-2 FFT. */
  function fft(re, im) {
    const n = re.length;
    if (n & (n - 1)) throw new Error('FFT uzunluğu 2\'nin kuvveti olmalı.');
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }

  const WINDOWS = {
    hann: { fn: (i, n) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n), lobe: 3 },
    rect: { fn: () => 1, lobe: 1 },
  };

  /**
   * Tek taraflı genlik spektrumu (tepe genlik, pencere kazancı düzeltilmiş).
   * Dönüş: { amp: Float64Array(n/2), df, pow: pencere düzeltmeli güç (bin toplamı için) }
   */
  function spectrum(x, fs, win = 'hann') {
    const n = x.length, W = WINDOWS[win];
    if (!W) throw new Error(`Bilinmeyen pencere: ${win}`);
    const re = new Float64Array(n), im = new Float64Array(n);
    let dc = 0; for (let i = 0; i < n; i++) dc += x[i]; dc /= n;
    let s1 = 0, s2 = 0;
    for (let i = 0; i < n; i++) { const w = W.fn(i, n); re[i] = (x[i] - dc) * w; s1 += w; s2 += w * w; }
    fft(re, im);
    const half = n / 2, amp = new Float64Array(half), pow = new Float64Array(half);
    for (let k = 0; k < half; k++) {
      const m2 = re[k] * re[k] + im[k] * im[k];
      amp[k] = 2 * Math.sqrt(m2) / s1;       // sinüs tepe genliği (tek çizgi)
      pow[k] = 2 * m2 / (n * s2);            // güç (RMS²), sızıntıdan bağımsız toplanabilir
    }
    return { amp, pow, df: fs / n, n, win, lobe: W.lobe };
  }

  /**
   * Harmonik analizi: k·f0 çevresindeki ana lob gücü toplanır.
   * THD = √(Σ_{k≥2} P_k) / √P_1. Dönüş: { h: [{k, f, amp (tepe), dBc}], thd, fs, n, win, nHarm }
   */
  function harmonics(x, fs, f0, nHarm = 10, win = 'hann') {
    const sp = spectrum(x, fs, win), half = sp.amp.length, L = sp.lobe;
    const h = [];
    for (let k = 1; k <= nHarm; k++) {
      const f = k * f0, c = Math.round(f / sp.df);
      if (c + L >= half) break;
      let p = 0;
      for (let j = Math.max(1, c - L); j <= c + L; j++) p += sp.pow[j];
      h.push({ k, f, amp: Math.sqrt(2 * p), p });
    }
    const p1 = h.length ? h[0].p : 0;
    let ph = 0; for (let i = 1; i < h.length; i++) ph += h[i].p;
    // Sıfıra yakın temel bileşende oran anlamsızdır: açıkça geçersiz işaretlenir
    const valid = p1 > 1e-18;
    h.forEach(q => { q.dBc = valid && q.p > 0 ? 10 * Math.log10(q.p / p1) : -Infinity; });
    return { h, thd: valid ? Math.sqrt(ph / p1) : NaN, valid, fs, n: x.length, win, nHarm: h.length, df: sp.df, spec: sp };
  }

  /** dB; sıfır / negatif girişte −∞ yerine null (grafikte boşluk, "0 dB" değil). */
  const dB = x => (x > 0 && Number.isFinite(x) ? 20 * Math.log10(x) : null);

  const api = { stats, fft, spectrum, harmonics, dB, WINDOWS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DSP = api;
})(typeof self !== 'undefined' ? self : this);
