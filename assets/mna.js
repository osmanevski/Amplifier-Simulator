/*
 * Değiştirilmiş düğüm analizi (MNA) çözücüsü: DC çalışma noktası, zaman alanı (BE / BDF2)
 * ve küçük sinyal AC. Devreye özgü hiçbir şey içermez; netlist amp-model.js tarafından kurulur.
 *
 * Bilinmeyenler: düğüm gerilimleri, ardından dal akımları (gerilim kaynağı, endüktans,
 * trafo sargıları ve çekirdek değişkeni).
 * KCL kuralı: her düğümde elemanlara doğru çıkan akımların toplamı = 0.
 *
 * Yakınsama: Newton–Raphson. Adım sınırlaması yalnızca sayısal bir tekniktir, yakınsanan çözümü
 * değiştirmez. Yakınsamama SolverError olarak fırlatılır; hiçbir değer "makul görünsün" diye kırpılmaz.
 */
(function (root) {
  'use strict';

  class SolverError extends Error {
    constructor(msg, info) { super(msg); this.name = 'SolverError'; this.info = info || {}; }
  }

  class Circuit {
    constructor() {
      this.names = []; this.idx = new Map();
      this.R = []; this.C = []; this.L = []; this.V = []; this.X = []; this.N = [];
      this.n = 0; this.nNodes = 0; this.final = false;
    }
    /** Düğüm indeksi; toprak = -1. */
    node(name) {
      if (name === 'GND' || name === '0') return -1;
      let i = this.idx.get(name);
      if (i == null) {
        if (this.final) throw new Error(`Devre kapatıldıktan sonra yeni düğüm: ${name}`);
        i = this.names.length; this.names.push(name); this.idx.set(name, i);
      }
      return i;
    }
    has(name) { return name === 'GND' || this.idx.has(name); }
    addR(id, a, b, r) {
      if (!(r > 0) || !Number.isFinite(r)) throw new Error(`${id}: geçersiz direnç ${r}`);
      this.R.push({ id, a: this.node(a), b: this.node(b), g: 1 / r, r });
    }
    addC(id, a, b, c) {
      if (!(c > 0) || !Number.isFinite(c)) throw new Error(`${id}: geçersiz kapasite ${c}`);
      this.C.push({ id, a: this.node(a), b: this.node(b), c });
    }
    addL(id, a, b, l) {
      if (!(l > 0) || !Number.isFinite(l)) throw new Error(`${id}: geçersiz endüktans ${l}`);
      this.L.push({ id, a: this.node(a), b: this.node(b), l, j: -1 });
    }
    /** Gerilim kaynağı: v(a) − v(b) = fn(t). ac: küçük sinyal genliği. */
    addV(id, a, b, fn, ac = 0) {
      this.V.push({ id, a: this.node(a), b: this.node(b), fn: typeof fn === 'function' ? fn : () => fn, ac, j: -1 });
    }
    /**
     * Çok sargılı trafo. winds: [{id, a, b, n}], v(a) − v(b) = n · u; u = Lm · d(Σ n·i)/dt.
     * n = 1 olan sargıya göre Lm, o sargının mıknatıslanma endüktansıdır.
     */
    addX(id, winds, lm) {
      this.X.push({ id, lm, ju: -1, w: winds.map(w => ({ id: w.id, a: this.node(w.a), b: this.node(w.b), n: w.n, j: -1 })) });
    }
    /** Doğrusal olmayan eleman. dev: { n, eval(v) → I[], J[] doldurur } */
    addN(id, nodes, dev) {
      const o = { id, nodes: nodes.map(x => this.node(x)), dev };
      this.N.push(o); return o;
    }
    finalize() {
      this.nNodes = this.names.length;
      let j = this.nNodes;
      this.V.forEach(e => { e.j = j++; });
      this.L.forEach(e => { e.j = j++; });
      this.X.forEach(x => { x.w.forEach(w => { w.j = j++; }); x.ju = j++; });
      this.n = j; this.final = true;
      this.branch = new Map();
      this.V.forEach(e => this.branch.set(e.id, e.j));
      this.L.forEach(e => this.branch.set(e.id, e.j));
      this.X.forEach(x => x.w.forEach(w => this.branch.set(w.id, w.j)));
      return this;
    }
    /** Çözüm vektöründen düğüm gerilimi (toprak 0 V). */
    v(x, name) { const i = this.node(name); return i < 0 ? 0 : x[i]; }
    /** Dal akımı: a ucundan elemana giren akım. */
    i(x, id) { const j = this.branch.get(id); if (j == null) throw new Error(`Dal yok: ${id}`); return x[j]; }
  }

  const GMIN = 1e-12;   // her düğümden toprağa; yüzen DC düğümleri tanımlı kılar (sayısal)

  // --- Yoğun doğrusal çözüm (kısmi pivotlu Gauss, sıfır atlamalı) -----------------
  function solveDense(A, b, n) {
    for (let k = 0; k < n; k++) {
      let p = k, max = Math.abs(A[k * n + k]);
      for (let r = k + 1; r < n; r++) { const a = Math.abs(A[r * n + k]); if (a > max) { max = a; p = r; } }
      if (max < 1e-300) return false;
      if (p !== k) {
        for (let c = k; c < n; c++) { const t = A[k * n + c]; A[k * n + c] = A[p * n + c]; A[p * n + c] = t; }
        const t = b[k]; b[k] = b[p]; b[p] = t;
      }
      const piv = A[k * n + k], kn = k * n;
      for (let r = k + 1; r < n; r++) {
        const f = A[r * n + k];
        if (f === 0) continue;
        const m = f / piv, rn = r * n;
        for (let c = k + 1; c < n; c++) { const akc = A[kn + c]; if (akc !== 0) A[rn + c] -= m * akc; }
        b[r] -= m * b[k];
      }
    }
    for (let k = n - 1; k >= 0; k--) {
      let s = b[k]; const kn = k * n;
      for (let c = k + 1; c < n; c++) s -= A[kn + c] * b[c];
      b[k] = s / A[kn + k];
    }
    return true;
  }
  function solveComplex(Ar, Ai, br, bi, n) {
    for (let k = 0; k < n; k++) {
      let p = k, max = Math.hypot(Ar[k * n + k], Ai[k * n + k]);
      for (let r = k + 1; r < n; r++) { const a = Math.hypot(Ar[r * n + k], Ai[r * n + k]); if (a > max) { max = a; p = r; } }
      if (max < 1e-300) return false;
      if (p !== k) {
        for (let c = k; c < n; c++) {
          let t = Ar[k * n + c]; Ar[k * n + c] = Ar[p * n + c]; Ar[p * n + c] = t;
          t = Ai[k * n + c]; Ai[k * n + c] = Ai[p * n + c]; Ai[p * n + c] = t;
        }
        let t = br[k]; br[k] = br[p]; br[p] = t; t = bi[k]; bi[k] = bi[p]; bi[p] = t;
      }
      const pr = Ar[k * n + k], pi = Ai[k * n + k], d = pr * pr + pi * pi, kn = k * n;
      for (let r = k + 1; r < n; r++) {
        const fr = Ar[r * n + k], fi = Ai[r * n + k];
        if (fr === 0 && fi === 0) continue;
        const mr = (fr * pr + fi * pi) / d, mi = (fi * pr - fr * pi) / d, rn = r * n;
        for (let c = k + 1; c < n; c++) {
          const xr = Ar[kn + c], xi = Ai[kn + c];
          if (xr === 0 && xi === 0) continue;
          Ar[rn + c] -= mr * xr - mi * xi; Ai[rn + c] -= mr * xi + mi * xr;
        }
        br[r] -= mr * br[k] - mi * bi[k]; bi[r] -= mr * bi[k] + mi * br[k];
      }
    }
    for (let k = n - 1; k >= 0; k--) {
      let sr = br[k], si = bi[k]; const kn = k * n;
      for (let c = k + 1; c < n; c++) { const xr = Ar[kn + c], xi = Ai[kn + c]; sr -= xr * br[c] - xi * bi[c]; si -= xr * bi[c] + xi * br[c]; }
      const pr = Ar[kn + k], pi = Ai[kn + k], d = pr * pr + pi * pi;
      br[k] = (sr * pr + si * pi) / d; bi[k] = (si * pr - sr * pi) / d;
    }
    return true;
  }

  // --- Damgalar -------------------------------------------------------------------
  function stampG(A, n, a, b, g) {
    if (a >= 0) A[a * n + a] += g;
    if (b >= 0) A[b * n + b] += g;
    if (a >= 0 && b >= 0) { A[a * n + b] -= g; A[b * n + a] -= g; }
  }
  /** Dal akımı j: a'dan çıkar, b'ye girer; dal denklemi satırında v(a) − v(b). */
  function stampBranch(A, n, a, b, j) {
    if (a >= 0) { A[a * n + j] += 1; A[j * n + a] += 1; }
    if (b >= 0) { A[b * n + j] -= 1; A[j * n + b] -= 1; }
  }

  /**
   * Doğrusal bölüm. a0 = 0 → DC (kapasitör açık, endüktans kısa).
   * a0 > 0 → türev ≈ a0·x_n − P; P geçmiş birleşimi step() içinde hesaplanır.
   */
  function linearMatrix(ckt, a0) {
    const n = ckt.n, A = new Float64Array(n * n);
    for (let i = 0; i < ckt.nNodes; i++) A[i * n + i] += GMIN;
    for (const e of ckt.R) stampG(A, n, e.a, e.b, e.g);
    if (a0 > 0) for (const e of ckt.C) stampG(A, n, e.a, e.b, e.c * a0);
    for (const e of ckt.V) stampBranch(A, n, e.a, e.b, e.j);
    for (const e of ckt.L) { stampBranch(A, n, e.a, e.b, e.j); if (a0 > 0) A[e.j * n + e.j] -= e.l * a0; }
    for (const x of ckt.X) {
      for (const w of x.w) {
        stampBranch(A, n, w.a, w.b, w.j);
        A[w.j * n + x.ju] -= w.n;                      // v(a) − v(b) − n·u = 0
        if (a0 > 0) A[x.ju * n + w.j] -= x.lm * a0 * w.n; // u − Lm·a0·Σ n·i = …
      }
      A[x.ju * n + x.ju] += 1;
    }
    return A;
  }

  /** Doğrusal olmayan elemanların Newton damgası. */
  function stampDevices(ckt, x, A, b) {
    const n = ckt.n;
    for (const o of ckt.N) {
      const d = o.dev, m = d.n, nd = o.nodes, v = d.v;
      for (let k = 0; k < m; k++) v[k] = nd[k] < 0 ? 0 : x[nd[k]];
      d.eval(v);
      for (let r = 0; r < m; r++) {
        const nr = nd[r]; if (nr < 0) continue;
        let lin = d.I[r];
        for (let c = 0; c < m; c++) {
          const g = d.J[r * m + c];
          lin -= g * v[c];
          if (nd[c] >= 0) A[nr * n + nd[c]] += g;
        }
        b[nr] -= lin;
      }
    }
  }

  const DEFAULTS = { maxIter: 120, vAbs: 1e-7, vRel: 1e-7, iAbs: 1e-10, vLimit: 40 };

  /** Newton döngüsü. A0/b0 doğrusal bölüm; x başlangıç tahmini (yerinde güncellenir). */
  function newton(ckt, A0, b0, x, work, opt) {
    const n = ckt.n, { A, b } = work, o = opt || DEFAULTS;
    if (!ckt.N.length) {
      A.set(A0); b.set(b0);
      if (!solveDense(A, b, n)) throw new SolverError('Tekil matris: devre tanımı eksik ya da çelişkili.', {});
      x.set(b); return { iters: 1, delta: 0 };
    }
    let delta = Infinity, prev = Infinity, damp = 1;
    for (let it = 1; it <= o.maxIter; it++) {
      A.set(A0); b.set(b0);
      stampDevices(ckt, x, A, b);
      if (!solveDense(A, b, n)) throw new SolverError('Tekil matris: devre tanımı eksik ya da çelişkili.', { iter: it });
      let dmax = 0, conv = true;
      for (let i = 0; i < n; i++) {
        const xn = b[i];
        if (!Number.isFinite(xn)) throw new SolverError('Çözüm sonlu değil (NaN / sonsuz).', { iter: it });
        const d = Math.abs(xn - x[i]);
        if (i < ckt.nNodes) { if (d > dmax) dmax = d; if (d > o.vAbs + o.vRel * Math.abs(xn)) conv = false; }
        else if (d > o.iAbs + o.vRel * Math.abs(xn)) conv = false;
      }
      delta = dmax;
      if (conv) { x.set(b); return { iters: it, delta }; }
      // Sönümleme: büyük adım sınırlanır; salınım sürerse adım küçültülür (yalnız yakınsama yolu değişir)
      // İlerleme yoksa (salınım) adım katsayısı yarıya iner, ilerleme varsa geri açılır.
      if (dmax <= o.vLimit) { if (it > 4 && dmax > 0.7 * prev) damp = Math.max(0.05, damp * 0.5); else damp = Math.min(1, damp * 2); }
      prev = dmax;
      const lam = damp * (dmax > o.vLimit ? o.vLimit / dmax : 1);
      for (let i = 0; i < n; i++) x[i] += lam * (b[i] - x[i]);
    }
    throw new SolverError(`Newton ${o.maxIter} yinelemede yakınsamadı (son |Δv| = ${delta.toExponential(2)} V).`, { delta });
  }

  /**
   * DC çalışma noktası. Düz Newton yakınsamazsa kaynak basamaklama denenir;
   * o da başarısızsa SolverError.
   */
  function dc(ckt, opt = {}) {
    const n = ckt.n, t = opt.t || 0;
    const A0 = linearMatrix(ckt, 0), work = { A: new Float64Array(n * n), b: new Float64Array(n) };
    const rhs = k => { const b0 = new Float64Array(n); for (const e of ckt.V) b0[e.j] = k * e.fn(t); return b0; };
    const x = new Float64Array(n);
    if (opt.guess) x.set(opt.guess);
    try {
      const r = newton(ckt, A0, rhs(1), x, work);
      return { x, iters: r.iters, method: 'newton' };
    } catch (e) {
      if (!(e instanceof SolverError)) throw e;
      x.fill(0);
      let iters = 0;
      const steps = 20;
      for (let s = 1; s <= steps; s++) iters += newton(ckt, A0, rhs(s / steps), x, work).iters;
      return { x, iters, method: 'kaynak basamaklama' };
    }
  }

  /** Zaman alanı adımlayıcı. method: 'bdf2' (varsayılan) ya da 'be'. Adım sabittir. */
  class Transient {
    constructor(ckt, h, method = 'bdf2') {
      if (!(h > 0)) throw new Error('Zaman adımı pozitif olmalı.');
      this.ckt = ckt; this.h = h; this.method = method;
      const n = ckt.n;
      this.Abe = linearMatrix(ckt, 1 / h);
      this.Abdf = method === 'bdf2' ? linearMatrix(ckt, 1.5 / h) : null;
      this.x = new Float64Array(n); this.x1 = new Float64Array(n); this.x2 = new Float64Array(n);
      this.P = new Float64Array(n); this.b0 = new Float64Array(n);
      this.work = { A: new Float64Array(n * n), b: new Float64Array(n) };
      this.t = 0; this.k = 0; this.iters = 0; this.maxIters = 0; this.steps = 0;
    }
    /** Başlangıç durumu; ilk adım BE ile atılır. */
    init(x, t = 0) { this.x.set(x); this.x1.set(x); this.x2.set(x); this.t = t; this.k = 0; return this; }
    step() {
      const c = this.ckt, n = c.n, h = this.h, bdf = this.method === 'bdf2' && this.k >= 1;
      const P = this.P, x1 = this.x, x2 = this.x1;
      // x1 = x_{n-1} (şimdiki), x2 = x_{n-2}
      if (bdf) for (let i = 0; i < n; i++) P[i] = (4 * x1[i] - x2[i]) / (2 * h);
      else for (let i = 0; i < n; i++) P[i] = x1[i] / h;
      const b0 = this.b0; b0.fill(0);
      const tn = this.t + h;
      for (const e of c.V) b0[e.j] = e.fn(tn);
      for (const e of c.C) {
        const q = e.c * ((e.a >= 0 ? P[e.a] : 0) - (e.b >= 0 ? P[e.b] : 0));
        if (e.a >= 0) b0[e.a] += q;
        if (e.b >= 0) b0[e.b] -= q;
      }
      for (const e of c.L) b0[e.j] = -e.l * P[e.j];
      for (const xf of c.X) { let s = 0; for (const w of xf.w) s += w.n * P[w.j]; b0[xf.ju] = -xf.lm * s; }
      this.x2.set(this.x1); this.x1.set(this.x);
      // dikkat: yukarıdaki iki satırdan sonra this.x1 = x_{n-1}, this.x2 = x_{n-2}
      let r;
      try {
        r = newton(c, bdf ? this.Abdf : this.Abe, b0, this.x, this.work);
      } catch (e) {
        if (!(e instanceof SolverError)) throw e;
        r = this.substep(tn, e);
      }
      this.t = tn; this.k++; this.steps++; this.iters += r.iters; if (r.iters > this.maxIters) this.maxIters = r.iters;
      return this.x;
    }
    /**
     * Newton bir adımda yakınsamazsa adım 2, 4, … 64 eşit alt adıma bölünür (BE).
     * Zaman ızgarası ve BDF2 geçmişi tam adım düzeyinde korunur. Hâlâ yakınsamazsa hata yükselir.
     */
    substep(tn, err) {
      const c = this.ckt, n = c.n, tStart = tn - this.h, xStart = this.x1;   // x1 = adım başı çözümü
      if (!this.subA) this.subA = new Map();
      for (let m = 2; m <= 64; m *= 2) {
        const hs = this.h / m;
        let A = this.subA.get(m); if (!A) { A = linearMatrix(c, 1 / hs); this.subA.set(m, A); }
        const x = this.x; x.set(xStart);
        const b0 = this.b0; let iters = 0, ok = true;
        try {
          for (let s = 1; s <= m; s++) {
            const ts = tStart + s * hs;
            b0.fill(0);
            for (const e of c.V) b0[e.j] = e.fn(ts);
            for (const e of c.C) {
              const q = e.c * ((e.a >= 0 ? x[e.a] : 0) - (e.b >= 0 ? x[e.b] : 0)) / hs;
              if (e.a >= 0) b0[e.a] += q;
              if (e.b >= 0) b0[e.b] -= q;
            }
            for (const e of c.L) b0[e.j] = -e.l * x[e.j] / hs;
            for (const xf of c.X) { let sum = 0; for (const w of xf.w) sum += w.n * x[w.j]; b0[xf.ju] = -xf.lm * sum / hs; }
            iters += newton(c, A, b0, x, this.work).iters;
          }
        } catch (e2) { if (!(e2 instanceof SolverError)) throw e2; ok = false; }
        if (ok) { this.subSteps = (this.subSteps || 0) + 1; return { iters }; }
      }
      throw new SolverError(`t = ${tn.toFixed(6)} s: adım 64 alt adıma bölündüğü hâlde yakınsamadı. ${err.message}`, { t: tn });
    }
  }

  /**
   * Küçük sinyal AC. xop: çalışma noktası (elemanların Jacobian'ı bu noktada alınır).
   * Kaynak genlikleri addV(..., ac). Dönüş: f başına { re, im } çözüm vektörleri.
   */
  function ac(ckt, xop, freqs) {
    const n = ckt.n;
    const Gr = linearMatrix(ckt, 0);
    // DC matrisinde endüktans ve çekirdek satırları kısa devre biçimindedir; AC'de reaktans eklenir
    const bdum = new Float64Array(n);
    if (ckt.N.length) stampDevices(ckt, xop, Gr, bdum);
    const out = [];
    const Ar = new Float64Array(n * n), Ai = new Float64Array(n * n);
    for (const f of freqs) {
      const w = 2 * Math.PI * f;
      Ar.set(Gr); Ai.fill(0);
      for (const e of ckt.C) stampG(Ai, n, e.a, e.b, w * e.c);
      for (const e of ckt.L) Ai[e.j * n + e.j] -= w * e.l;
      for (const xf of ckt.X) for (const wd of xf.w) Ai[xf.ju * n + wd.j] -= w * xf.lm * wd.n;
      const br = new Float64Array(n), bi = new Float64Array(n);
      for (const e of ckt.V) br[e.j] = e.ac;
      if (!solveComplex(Ar, Ai, br, bi, n)) throw new SolverError(`AC çözümü tekil (f = ${f} Hz).`, { f });
      out.push({ f, re: br, im: bi });
    }
    return out;
  }

  const api = { Circuit, Transient, SolverError, dc, ac, solveDense, solveComplex, GMIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MNA = api;
})(typeof self !== 'undefined' ? self : this);
