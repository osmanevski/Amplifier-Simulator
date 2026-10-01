/*
 * Amfi modeli: kanonik devre tanımından (circuit-5f1.js) netlist kurar ve analizleri çalıştırır.
 *
 * Üç ayrı ritim (inceleme raporu §12):
 *   1. Canlı besleme / çalışma noktası (Sim): sabit 100 µs adım; ısınma, ripple, açılış ve kapanış.
 *      Oynatma hızı yalnızca birim zamanda atılan adım sayısını değiştirir, sonucu değil.
 *   2. Ses analizi (audio): ayrı, eş aralıklı ham tampon (varsayılan 96 kHz); FFT / THD buradan.
 *   3. Küçük sinyal AC (acSweep): DC çalışma noktasında doğrusallaştırma.
 * Ekran yenilemesi bunların hiçbirinin çözünürlüğünü belirlemez.
 *
 * Kapsam dışı (sayı üretilmez): ark, mikrofoni, manyetik hum kuplajı, nüve doyumu, ısıl model,
 * hoparlör akustiği. Çözücü hatası fiziksel arıza ya da koruma olarak raporlanmaz.
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const MNA = node ? require('./mna.js') : root.MNA;
  const Tubes = node ? require('./tubes.js') : root.Tubes;
  const D = node ? require('./circuit-5f1.js') : root.Design;
  const DSP = node ? require('./dsp.js') : root.DSP;

  class ProfileError extends Error { constructor(msg, list) { super(msg); this.name = 'ProfileError'; this.list = list || []; } }

  const RMIN = 1;          // pot uç direnci (Ω): sıfır dirençte çözücüyü tanımlı tutar; fiziksel uç direnci varsayımı
  const LIVE_H = 1e-4;     // canlı besleme adımı (s)
  const CYCLE = 0.02;      // şebeke periyodu (50 Hz)

  function defaultState() {
    return {
      mainsOn: true, mainsV: 230,
      sw: { S1: 'HIGH', S2: 'RAW', S3: 'OFF', S4: 'OFF' },
      pots: { VR1: 0.5, VR2: 0.5, VR3: 0.5, VR4: 0.5 },
      loads: { J2: 4, J3: null, J4: null },      // jaka takılı yük (Ω); null = boş
      otPhase: 1,                                 // +1 doğru, −1 ters (NFB pozitife döner)
      nfb: true,
      src: { kind: 'ideal', amp: 0.05, freq: 1000 },   // amp: tepe (V)
    };
  }
  const cloneState = s => JSON.parse(JSON.stringify(s));

  /** Pot taper'ı: konum (0–1) → alt uç–wiper direnç oranı. log: orta noktada %10 (yaklaşık audio taper). */
  function taperFn(kind, pos) {
    const p = Math.max(0, Math.min(1, pos));
    if (kind === 'log') { const b = 81; return (Math.pow(b, p) - 1) / (b - 1); }
    return p;
  }

  // Temsili manyetik + kablo (kalibre değil): seri R–L, kablo kapasitesi toprağa
  const PICKUP = { r: 7000, l: 3.0, cCable: 470e-12 };

  /**
   * Netlist kurucu.
   * opts.supply: 'pt' (varsayılan, trafo + 5Y3) | 'dc' (B+1 sabit kaynak: opts.b1) | 'open' (AC analizi)
   * opts.input:  t → V (giriş kaynağı); yoksa 0
   * opts.idealOT: sargı dirençleri ve kaçak ≈ 0 (EL-10 ideal karşılaştırması)
   * opts.breakNfb: R12'nin tap ucu test kaynağına bağlanır (çevrim kazancı)
   * opts.nfbGround: R12'nin tap ucu toprağa bağlanır (yüklemesi korunmuş açık çevrim kazancı)
   * opts.noTubes: tüpler ve elektrot kapasiteleri çıkarılır (pasif ağ testleri)
   * opts.probe: adı verilen düğüm 1 V AC test kaynağıyla sürülür (giriş kaynağı AC'de susturulur)
   */
  function build(profile, state, opts = {}) {
    const errs = D.validateProfile(profile);
    if (errs.length) throw new ProfileError('Geçersiz profil: ' + errs[0], errs);

    // --- Anahtar konumlarına göre düğüm birleşimi ---
    const parent = new Map();
    const find = a => { let r = a; while (parent.has(r)) r = parent.get(r); return r; };
    const union = (a, b) => { let ra = find(a), rb = find(b); if (ra === rb) return; if (ra === 'GND') { const t = ra; ra = rb; rb = t; } parent.set(ra, rb); };
    for (const [sid, sw] of Object.entries(D.SWITCHES)) {
      let pos = state.sw[sid];
      if (!sw.positions.includes(pos)) throw new ProfileError(`${sid}: geçersiz konum "${pos}"`);
      if (sid === 'S2' && pos === 'RAW' && profile.rawMethod === 'tap') pos = 'RAW:tap';
      for (const [a, b] of sw.join[pos]) union(a, b);
    }
    const nn = find;
    const ckt = new MNA.Circuit();
    const b = { ckt, nn, dev: {}, R: [], C: [], state, profile, opts, loads: [] };
    const val = id => {
      const r = D.resolve(id, profile);
      if (r.value == null) throw new ProfileError(`${id}: değer açık karar; etkin profil bir değer vermiyor.`);
      return r.value;
    };
    const addR = (id, a, bb, r, own) => { a = nn(a); bb = nn(bb); if (a === bb) return; ckt.addR(id, a, bb, r); b.R.push({ id, own: own || id, a: ckt.node(a), b: ckt.node(bb), r }); };
    const addC = (id, a, bb, cv, own) => { a = nn(a); bb = nn(bb); if (a === bb) return; ckt.addC(id, a, bb, cv); if (own) b.C.push({ id, own, a: ckt.node(a), b: ckt.node(bb) }); };
    const supply = opts.supply || 'pt';

    for (const comp of D.COMPONENTS) {
      const id = comp.id;
      if (comp.optional && !D.isFitted(id, profile)) continue;
      switch (comp.type) {
        case 'R':
          if (id === 'R12') {
            if (!state.nfb) break;
            if (opts.nfbGround) { addR(id, 'GND', comp.nodes[1], val(id)); break; }   // açık çevrim: yükleme korunur
            if (opts.breakNfb) { addR(id, 'NFBT', comp.nodes[1], val(id)); break; }
          }
          addR(id, comp.nodes[0], comp.nodes[1], val(id)); break;
        case 'C': addC(id, comp.nodes[0], comp.nodes[1], val(id), id); break;
        case 'POT': {
          const rt = val(id), kind = (profile.tapers && profile.tapers[id]) || comp.taper || 'lin';
          const pos = state.pots[id];
          if (!(pos >= 0 && pos <= 1)) throw new ProfileError(`${id}: pot konumu 0–1 aralığında olmalı.`);
          const f = taperFn(kind, pos), [top, wip, bot] = comp.nodes;
          addR(id + '.alt', bot, wip, Math.max(RMIN, f * rt), id);
          addR(id + '.ust', wip, top, Math.max(RMIN, (1 - f) * rt), id);
          break;
        }
        case 'TRIODE': {
          if (opts.noTubes) break;
          const card = Tubes.CARDS[profile.models[id]];
          if (!card || card.kind !== 'triode') throw new ProfileError(`${id}: tüp modeli eksik ya da tipi uyumsuz.`);
          const [p, g, k] = comp.nodes.map(nn);
          b.dev[id] = ckt.addN(id, [p, g, k], Tubes.triode(card)).dev;
          addC(id + '.cgp', g, p, card.p.cgp); addC(id + '.cgk', g, k, card.p.cgk); addC(id + '.cpk', p, k, card.p.cpk);
          break;
        }
        case 'PENTODE': {
          if (opts.noTubes) break;
          const card = Tubes.CARDS[profile.models[id]];
          if (!card || card.kind !== 'pentode') throw new ProfileError(`${id}: tüp modeli eksik ya da tipi uyumsuz.`);
          const [p, s, g, k] = comp.nodes.map(nn);
          b.dev[id] = ckt.addN(id, [p, s, g, k], Tubes.pentode(card)).dev;
          addC(id + '.cg1', g, k, card.p.cg1); addC(id + '.ca', p, k, card.p.ca); addC(id + '.cag1', p, g, card.p.cag1);
          break;
        }
        case 'RECT': {
          if (supply !== 'pt') break;
          const card = Tubes.CARDS[profile.models[id]];
          if (!card || card.kind !== 'rectifier') throw new ProfileError(`${id}: doğrultucu modeli eksik.`);
          b.dev.DA = ckt.addN(id + '.a', [comp.nodes[0], comp.nodes[2]], Tubes.diode(card)).dev;
          b.dev.DB = ckt.addN(id + '.b', [comp.nodes[1], comp.nodes[2]], Tubes.diode(card)).dev;
          break;
        }
        case 'PT': {
          if (supply === 'dc') { ckt.addV('VB1', 'B1', 'GND', opts.b1); break; }
          if (supply !== 'pt') break;
          const t1 = profile.T1, w = 2 * Math.PI * t1.freq;
          const emk = () => state.mainsOn ? t1.vSec * (1 + t1.noLoadRisePct / 100) * (state.mainsV / t1.mainsNom) * Math.SQRT2 : 0;
          ckt.addV('T1.a', 'T1SA', 'GND', t => emk() * Math.sin(w * t));
          ckt.addV('T1.b', 'T1SB', 'GND', t => -emk() * Math.sin(w * t));
          addR('T1.ra', 'T1SA', comp.nodes[0], t1.rt, 'T1'); addR('T1.rb', 'T1SB', comp.nodes[1], t1.rt, 'T1');
          b.emk = emk;
          break;
        }
        case 'OT': {
          const t2 = profile.T2, [bp, a6, s4, s8, s16] = comp.nodes, ph = state.otPhase;
          const tiny = 1e-3, ideal = !!opts.idealOT;
          const n4 = Math.sqrt(4 / t2.zp), n8 = Math.sqrt(8 / t2.zp), n16 = Math.sqrt(16 / t2.zp);
          b.turns = { n4, n8, n16 };
          addR('T2.rp', bp, 'T2P1', ideal ? tiny : t2.rp, 'T2');
          ckt.addL('T2.ll', 'T2P1', 'T2P2', ideal ? 1e-9 : t2.lleak);
          ckt.addX('T2', [
            { id: 'T2.p', a: 'T2P2', b: a6, n: 1 },
            { id: 'T2.s4', a: 'GND', b: 'T2X4', n: ph * n4 },
            { id: 'T2.s8', a: s4, b: 'T2X8', n: ph * (n8 - n4) },
            { id: 'T2.s16', a: s8, b: 'T2X16', n: ph * (n16 - n8) },
          ], t2.lp);
          addR('T2.rs4', 'T2X4', s4, ideal ? tiny : t2.rs[0], 'T2');
          addR('T2.rs8', 'T2X8', s8, ideal ? tiny : t2.rs[1], 'T2');
          addR('T2.rs16', 'T2X16', s16, ideal ? tiny : t2.rs[2], 'T2');
          break;
        }
        case 'JACK': {
          const r = state.loads[id];
          if (r == null) break;
          if (!(r > 0) || !Number.isFinite(r)) throw new ProfileError(`${id}: yük direnci geçersiz.`);
          addR(id + '.yuk', comp.nodes[0], 'GND', r, id);
          b.loads.push({ id, tap: comp.value, r, node: comp.nodes[0] });
          break;
        }
        default: break;   // MECH, SW: netlistte eleman değil
      }
    }
    // --- Giriş kaynağı ---
    const fn = opts.input || (() => 0);
    ckt.addV('VIN', 'SRC', 'GND', fn, opts.breakNfb || opts.probe ? 0 : 1);
    if (opts.probe) ckt.addV('VPROBE', nn(opts.probe), 'GND', 0, 1);   // test: bir düğümü 1 V AC ile sür
    if (state.src.kind === 'pickup') {
      addR('SRC.r', 'SRC', 'SRCL', PICKUP.r); ckt.addL('SRC.l', 'SRCL', 'IN', PICKUP.l); addC('SRC.c', 'IN', 'GND', PICKUP.cCable);
    } else addR('SRC.r', 'SRC', 'IN', 1e-3);
    if (opts.breakNfb && state.nfb) ckt.addV('VNFB', 'NFBT', 'GND', 0, 1);
    ckt.finalize();
    b.v = (x, name) => { const r = nn(name); return ckt.has(r) ? ckt.v(x, r) : NaN; };
    return b;
  }

  /** Bir çözüm vektörünü ada göre başka bir netliste taşır (anahtar değişiminde kapasitör yükleri korunur). */
  function mapX(from, x, to) {
    const y = new Float64Array(to.ckt.n);
    to.ckt.names.forEach((nm, i) => { const j = from.ckt.idx.get(nm); if (j != null) y[i] = x[j]; });
    for (const [id, j] of to.ckt.branch) { const k = from.ckt.branch.get(id); if (k != null) y[j] = x[k]; }
    for (const xf of to.ckt.X) { const o = from.ckt.X.find(q => q.id === xf.id); if (o) y[xf.ju] = x[o.ju]; }
    return y;
  }

  function evalDevices(b, x) {
    for (const o of b.ckt.N) {
      const d = o.dev;
      for (let k = 0; k < d.n; k++) d.v[k] = o.nodes[k] < 0 ? 0 : x[o.nodes[k]];
      d.eval(d.v);
    }
  }

  /** Çözümden türetilen büyüklükler (tek noktada tanımlı; tezgâh, denetçi ve testler bunu kullanır). */
  function measure(b, x, m = {}) {
    evalDevices(b, x);
    const v = n => b.v(x, n), dv = b.dev;
    m.B1 = v('B1'); m.B2 = v('B2'); m.B3 = v('B3');
    m.PA = v('PA'); m.KA = v('KA'); m.PB = v('PB'); m.KB = v('KB');
    m.G1 = v('G1'); m.G2 = v('G2'); m.G6 = v('G6'); m.K6 = v('K6'); m.A6 = v('A6');
    m.IN = v('IN'); m.CO1 = v('CO1'); m.VT = v('VT');
    m.S4 = v('S4'); m.S8 = v('S8'); m.S16 = v('S16');
    if (dv.V2) {
      m.ia = dv.V2.ip; m.ig2 = dv.V2.ig2; m.ig1 = dv.V2.ig1;
      m.pa = (m.A6 - m.K6) * m.ia; m.pg2 = (m.B2 - m.K6) * m.ig2;
    }
    if (dv.V1A) { m.i1a = dv.V1A.ip; m.i1b = dv.V1B.ip; }
    if (dv.DA) { m.iDA = dv.DA.i; m.iDB = dv.DB.i; m.iRect = dv.DA.i + dv.DB.i; }
    let pOut = 0;
    for (const l of b.loads) { const u = v(l.node); pOut += u * u / l.r; }
    m.pOut = pOut;
    return m;
  }

  /** Yük durumu: her jaktaki yük primere yansıtılır. Gerçek devrede yük algılama / koruma YOKTUR. */
  function loadStatus(profile, state) {
    const zp = profile.T2.zp, taps = { J2: 4, J3: 8, J4: 16 };
    const used = Object.entries(state.loads).filter(([, r]) => r != null);
    if (!used.length) return { code: 'YUKSUZ', label: 'YÜKSÜZ ÇIKIŞ', danger: true, zRef: Infinity, text: 'Hiçbir jakta yük yok. Gerçek devrede koruma bulunmadığından bu koşul amfi için tehlikelidir; model ark ya da izolasyon delinmesini değerlendiremez.' };
    let g = 0;
    for (const [j, r] of used) g += (taps[j] / zp) / r;    // yansıyan iletkenlik = n² / R
    const zRef = 1 / g;
    if (used.length > 1) return { code: 'COKLU', label: 'ÇOKLU YÜK', danger: true, zRef, text: `${used.length} jakta aynı anda yük var. Varsayılan kullanım tek kabindir; yansıyan primer yükü ${Math.round(zRef)} Ω.` };
    const [j, r] = used[0], ok = Math.abs(r - taps[j]) / taps[j] < 0.02;
    if (ok) return { code: 'ESLESMIS', label: 'EŞLEŞMİŞ', danger: false, zRef, text: `${r} Ω yük ${taps[j]} Ω jakta. Yansıyan primer yükü ≈ ${Math.round(zRef)} Ω.` };
    return { code: 'YANLIS', label: 'YANLIŞ JAK', danger: true, zRef, text: `${r} Ω yük ${taps[j]} Ω jakta. Yansıyan primer yükü ${Math.round(zRef)} Ω (hedef ${zp} Ω).` };
  }

  // ====================================================================================
  // Canlı simülasyon (besleme / çalışma noktası ritmi)
  // ====================================================================================
  const WARM = ['V1', 'V2', 'V3'];
  const CARD_OF = { V1: 'V1A', V2: 'V2', V3: 'V3' };

  class Sim {
    constructor(profile, state, opt = {}) {
      this.profile = profile; this.state = state;
      this.h = opt.h || LIVE_H; this.method = opt.method || 'bdf2';
      this.t = 0; this.warm = { V1: 0, V2: 0, V3: 0 };
      this.history = []; this.events = [];
      this.error = null;
      this.resetPeaks();
      this.b = null; this.tr = null;
      this.rebuild();
      if (opt.hot) this.seedHot();
    }
    resetPeaks() { this.peaks = { cap: {}, iRectPk: 0, pa: 0, t0: this.t }; this.win = null; this._acc = null; }
    log(msg, lv = '') { this.events.push({ t: this.t, msg, lv }); }

    /** Netlisti yeniden kurar; düğüm gerilimleri ve dal akımları ada göre korunur. */
    rebuild() {
      const nb = build(this.profile, this.state, { supply: 'pt' });
      const x = this.b ? mapX(this.b, this.tr.x, nb) : new Float64Array(nb.ckt.n);
      this.b = nb;
      this.tr = new MNA.Transient(nb.ckt, this.h, this.method).init(x, this.t);
      this.m = {}; this._acc = null;
      this.applyEmission();
    }
    applyEmission() {
      const dv = this.b.dev, P = this.profile.models, W = this.warm;
      const e1 = Tubes.emission(Tubes.CARDS[P.V1A], W.V1), e2 = Tubes.emission(Tubes.CARDS[P.V2], W.V2), e3 = Tubes.emission(Tubes.CARDS[P.V3], W.V3);
      dv.V1A.em = e1; dv.V1B.em = e1; dv.V2.em = e2; dv.DA.em = e3; dv.DB.em = e3;
      this.em = { V1: e1, V2: e2, V3: e3 };
    }
    /**
     * Sıcak başlangıç: tüpler ısınmış; kapasitörler, B+1 tahminî değerde tutulan tutarlı bir DC
     * çözümünden yüklenir. Periyodik kararlı duruma kısa sürede oturur.
     */
    seedHot() {
      this.warm = { V1: 1, V2: 1, V3: 1 }; this.applyEmission();
      const guess = (this.b.emk ? this.b.emk() : 0) * 0.8;
      if (guess > 1) {
        const op = dcOp(this.profile, this.state, guess);
        this.tr.init(mapX(op.b, op.x, this.b), this.t);
      }
    }
    /**
     * Sıcak başlangıçtan sonra periyodik kararlı duruma oturtur ve saati sıfırlar.
     * Tam sayıda şebeke periyodu ilerlenir; böylece t = 0 yapılınca kaynak fazı korunur.
     */
    settle(cycles = 75) {
      const per = Math.round(CYCLE / this.h);
      for (let k = 0; k < cycles && !this.error; k++) this.step(per);
      this.t = 0; this.tr.t = 0; this.history = []; this.resetPeaks();
      return this;
    }
    get warmDone() { return WARM.every(k => this.warm[k] > 0.985); }

    /** n adım ilerler. Hata olursa this.error dolar ve ilerleme durur (yarım sonuç "tamam" sayılmaz). */
    step(n) {
      if (this.error) return 0;
      const h = this.h, W = this.warm, P = this.profile.models, on = this.state.mainsOn;
      const perCycle = Math.round(CYCLE / h);
      let done = 0;
      try {
        for (let k = 0; k < n; k++) {
          for (const key of WARM) {
            const w = Tubes.CARDS[P[CARD_OF[key]]].warm, tau = on ? w.tauUp : w.tauDown, target = on ? 1 : 0;
            W[key] = target + (W[key] - target) * Math.exp(-h / tau);
          }
          this.applyEmission();
          const x = this.tr.step();
          this.t = this.tr.t; done++;
          this.accumulate(x);
          if (this._acc.n >= perCycle) this.closeWindow();
        }
      } catch (e) {
        if (e instanceof MNA.SolverError) { this.error = { t: this.t, msg: e.message }; this.log('ÇÖZÜCÜ HATASI: ' + e.message + ' Bu bir sayısal hatadır; fiziksel arıza ya da koruma değildir.', 'bad'); }
        else throw e;
      }
      return done;
    }
    accumulate(x) {
      const b = this.b, m = measure(b, x, this.m);
      let a = this._acc;
      if (!a) {
        a = this._acc = { n: 0, sum: {}, min: {}, max: {}, rp: new Float64Array(b.R.length), cv: new Float64Array(b.C.length), cmin: new Float64Array(b.C.length).fill(Infinity), cmax: new Float64Array(b.C.length).fill(-Infinity), iPk: 0 };
        for (const k of SUMKEYS) { a.sum[k] = 0; a.min[k] = Infinity; a.max[k] = -Infinity; }
      }
      a.n++;
      for (const k of SUMKEYS) { const v = m[k]; a.sum[k] += v; if (v < a.min[k]) a.min[k] = v; if (v > a.max[k]) a.max[k] = v; }
      const R = b.R, C = b.C;
      for (let i = 0; i < R.length; i++) { const e = R[i], u = (e.a < 0 ? 0 : x[e.a]) - (e.b < 0 ? 0 : x[e.b]); a.rp[i] += u * u / e.r; }
      for (let i = 0; i < C.length; i++) { const e = C[i], u = (e.a < 0 ? 0 : x[e.a]) - (e.b < 0 ? 0 : x[e.b]); if (u < a.cmin[i]) a.cmin[i] = u; if (u > a.cmax[i]) a.cmax[i] = u; }
      const ip = Math.max(m.iDA, m.iDB); if (ip > a.iPk) a.iPk = ip;
    }
    /** Bir şebeke periyodunun özeti: ortalama, min, maks; uzun zaman kaydı buradan beslenir. */
    closeWindow() {
      const a = this._acc, b = this.b, n = a.n, w = { t: this.t, n };
      for (const k of SUMKEYS) { w[k] = a.sum[k] / n; w[k + 'Min'] = a.min[k]; w[k + 'Max'] = a.max[k]; }
      w.iRectPk = a.iPk;
      w.rp = {}; b.R.forEach((e, i) => { w.rp[e.own] = (w.rp[e.own] || 0) + a.rp[i] / n; });
      w.cap = {}; b.C.forEach((e, i) => { w.cap[e.own] = { min: a.cmin[i], max: a.cmax[i] }; });
      w.em = Object.assign({}, this.em);
      this.win = w;
      const pk = this.peaks;
      for (const [id, c] of Object.entries(w.cap)) { const u = Math.max(Math.abs(c.min), Math.abs(c.max)); if (!(pk.cap[id] >= u)) pk.cap[id] = u; }
      if (w.iRectPk > pk.iRectPk) pk.iRectPk = w.iRectPk;
      if (w.pa > pk.pa) pk.pa = w.pa;
      this.history.push({ t: w.t, B1: w.B1, B1Min: w.B1Min, B1Max: w.B1Max, B2: w.B2, B3: w.B3, A6: w.A6, K6: w.K6, ia: w.ia, ig2: w.ig2, pa: w.pa, iRect: w.iRect, iRectPk: w.iRectPk, PA: w.PA, PB: w.PB });
      if (this.history.length > 6000) this.history = this.history.filter((_, i) => i % 2 === 0);   // yalnız gösterim kaydı seyreltilir
      this._acc = null;
    }
    /** Kararlı mı: tüpler ısındı ve son periyotlarda ortalama değişmiyor. */
    isSteady(tolV = 0.02) {
      const H = this.history; if (H.length < 6 || !this.warmDone) return false;
      const a = H[H.length - 1], c = H[H.length - 6];
      return Math.abs(a.B1 - c.B1) < tolV && Math.abs(a.B3 - c.B3) < tolV && Math.abs(a.K6 - c.K6) < tolV * 0.1;
    }
  }
  const SUMKEYS = ['B1', 'B2', 'B3', 'PA', 'KA', 'PB', 'KB', 'G6', 'K6', 'A6', 'ia', 'ig2', 'pa', 'pg2', 'i1a', 'i1b', 'iRect', 'pOut', 'S4'];

  /**
   * Periyodik kararlı durum (tüpler sıcak). Yakınsamazsa SolverError.
   * Dönüş: { sim, win } — win: son şebeke periyodunun ortalamaları.
   */
  function steady(profile, state, opt = {}) {
    const sim = new Sim(profile, state, { hot: true, h: opt.h, method: opt.method });
    const per = Math.round(CYCLE / sim.h), maxT = opt.maxT || 8;
    let ok = 0, prev = null;
    while (sim.t < maxT) {
      sim.step(per);
      if (sim.error) throw new MNA.SolverError(sim.error.msg, { t: sim.error.t });
      const w = sim.win;
      if (prev && Math.abs(w.B1 - prev.B1) < 2e-3 && Math.abs(w.B3 - prev.B3) < 2e-3 && Math.abs(w.K6 - prev.K6) < 2e-4 && Math.abs(w.PA - prev.PA) < 2e-3) ok++; else ok = 0;
      prev = w;
      if (ok >= 3 && sim.t > 0.1) return { sim, win: w };
    }
    throw new MNA.SolverError(`Periyodik kararlı duruma ${maxT} s içinde ulaşılamadı.`, { t: sim.t });
  }

  /** B+1 ortalamasında tutarlı DC çalışma noktası (AC doğrusallaştırması için). */
  function dcOp(profile, state, b1) {
    const b = build(profile, state, { supply: 'dc', b1 });
    const r = MNA.dc(b.ckt);
    return { b, x: r.x, m: measure(b, r.x, {}), iters: r.iters, method: r.method };
  }

  const logspace = (f1, f2, n) => Array.from({ length: n }, (_, i) => f1 * Math.pow(f2 / f1, i / (n - 1)));

  /**
   * Küçük sinyal AC taraması. op: dcOp() sonucu. Doğrultucu açık devre kabul edilir; besleme
   * empedansını C3 / C4 / C5 belirler.
   * Dönüş: { freqs, H(name) → {mag[], ph[] (derece)}, zin[] }
   */
  function acSweep(profile, state, freqs, op, extra = {}) {
    const b = build(profile, state, Object.assign({ supply: 'open' }, extra));
    const xop = op ? mapX(op.b, op.x, b) : new Float64Array(b.ckt.n);
    const sol = MNA.ac(b.ckt, xop, freqs);
    const cx = name => {
      const r = b.nn(name), i = b.ckt.has(r) ? b.ckt.node(r) : null;
      return sol.map(s => (i == null ? [NaN, NaN] : i < 0 ? [0, 0] : [s.re[i], s.im[i]]));
    };
    const H = name => {
      const z = cx(name);
      return { mag: z.map(([re, im]) => Math.hypot(re, im)), ph: z.map(([re, im]) => Math.atan2(im, re) * 180 / Math.PI), re: z.map(q => q[0]), im: z.map(q => q[1]) };
    };
    const jv = b.ckt.branch.get('VIN'), iin = cx('IN');
    const zin = sol.map((s, k) => {     // giriş empedansı: V(IN) / kaynaktan çıkan akım
      const ir = -s.re[jv], ii = -s.im[jv], d = ir * ir + ii * ii;
      return d < 1e-300 ? Infinity : Math.hypot(iin[k][0], iin[k][1]) / Math.sqrt(d);
    });
    return { b, freqs, H, cx, zin, sol };
  }

  /**
   * NFB çevrim kazancı: R12 tap ucundan ayrılıp 1 V test kaynağıyla sürülür.
   * T = −V(S4) / Vtest. Negatif geri beslemede orta bantta T > 0.
   * Kararlılık yalnız modelin kapsadığı frekans aralığında ve modellenen fazlarla değerlendirilir.
   */
  function loopGain(profile, state, freqs, op) {
    if (!state.nfb) return null;
    const r = acSweep(profile, state, freqs, op, { breakNfb: true });
    const z = r.cx('S4');
    const T = z.map(([re, im]) => [-re, -im]);
    let minDist = Infinity, fMin = null, unstable = false;
    for (let k = 0; k < T.length; k++) {
      const d = Math.hypot(1 + T[k][0], T[k][1]);
      if (d < minDist) { minDist = d; fMin = freqs[k]; }
      // Nyquist: T, −1'in solundan gerçek ekseni kesiyorsa çevrim kararsız
      if (k > 0 && T[k - 1][1] * T[k][1] <= 0 && T[k - 1][1] !== T[k][1]) {
        const u = T[k - 1][1] / (T[k - 1][1] - T[k][1]), re = T[k - 1][0] + u * (T[k][0] - T[k - 1][0]);
        if (re <= -1) unstable = true;
      }
    }
    const mid = T[Math.floor(T.length / 2)];
    if (T.some(q => q[0] <= -1 && Math.abs(q[1]) < 1e-9)) unstable = true;
    return { freqs, T, mag: T.map(q => Math.hypot(q[0], q[1])), ph: T.map(q => Math.atan2(q[1], q[0]) * 180 / Math.PI), minDist, fMin, unstable, mid };
  }

  // ====================================================================================
  // Ses analizi (ham, eş aralıklı tampon)
  // ====================================================================================
  const AUDIO_DEFAULTS = { fs: 96000, n: 16384, settleS: 0.12, window: 'hann', nHarm: 10, method: 'bdf2' };
  const PROBES = ['IN', 'G1', 'PA', 'VT', 'G2', 'PB', 'G6', 'A6', 'K6', 'OUT'];

  /**
   * Üreteç: her yield bir ilerleme oranı döner (0–1); bitince sonuç nesnesi return edilir.
   * seed: kararlı durumdaki Sim (aynı anahtar / yük durumu). Çıkış: en yüksek tapı yüklü jak.
   */
  function* audioGen(profile, state, seed, opt = {}) {
    const o = Object.assign({}, AUDIO_DEFAULTS, opt);
    const h = 1 / o.fs, amp = state.src.amp, f0 = state.src.freq, w0 = 2 * Math.PI * f0;
    const t0 = seed.t;
    // Başlangıçta genlik yumuşak açılır: sayısal bir darbe üretmemek için (yerleşme süresine dâhil)
    const ramp = 0.01;
    const input = t => { const dt = t - t0; return amp * Math.sin(w0 * dt) * (dt < ramp ? dt / ramp : 1); };
    const b = build(profile, state, { supply: 'pt', input });
    const tr = new MNA.Transient(b.ckt, h, o.method).init(mapX(seed.b, seed.tr.x, b), t0);
    for (const k of Object.keys(b.dev)) b.dev[k].em = seed.b.dev[k].em;
    const out = b.loads.length ? b.loads[b.loads.length - 1] : null;
    const nSettle = Math.round(o.settleS * o.fs), N = o.n, total = nSettle + N;
    const buf = {}; PROBES.forEach(p => { buf[p] = new Float64Array(N); });
    const m = {}, acc = { pa: 0, pg2: 0, pOut: 0, ia: 0, ig2: 0, B1: 0, K6: 0, iaMax: 0, ig1Max: 0, a6Max: -Infinity, a6Min: Infinity, igA: 0, igB: 0 };
    const chunk = 1024;
    for (let k = 0; k < total; k++) {
      const x = tr.step();
      if (k >= nSettle) {
        const i = k - nSettle;
        measure(b, x, m);
        buf.IN[i] = m.IN; buf.G1[i] = m.G1; buf.PA[i] = m.PA; buf.VT[i] = m.VT; buf.G2[i] = m.G2; buf.PB[i] = m.PB; buf.G6[i] = m.G6; buf.A6[i] = m.A6; buf.K6[i] = m.K6;
        buf.OUT[i] = out ? b.v(x, out.node) : 0;
        acc.pa += m.pa; acc.pg2 += m.pg2; acc.pOut += m.pOut; acc.ia += m.ia; acc.ig2 += m.ig2; acc.B1 += m.B1; acc.K6 += m.K6;
        if (m.ia > acc.iaMax) acc.iaMax = m.ia; if (m.ig1 > acc.ig1Max) acc.ig1Max = m.ig1;
        if (m.A6 > acc.a6Max) acc.a6Max = m.A6; if (m.A6 < acc.a6Min) acc.a6Min = m.A6;
        if (b.dev.V1A.ig > acc.igA) acc.igA = b.dev.V1A.ig; if (b.dev.V1B.ig > acc.igB) acc.igB = b.dev.V1B.ig;
      }
      if (k % chunk === chunk - 1) yield (k + 1) / total;
    }
    const res = { ok: true, opt: o, f0, amp, tStart: t0 + nSettle * h, buf, out: out ? { jack: out.id, r: out.r, tap: out.tap } : null,
      steps: tr.steps, itersAvg: tr.iters / tr.steps, itersMax: tr.maxIters, nodes: b.ckt.n };
    res.stat = {};
    for (const p of PROBES) res.stat[p] = DSP.stats(buf[p]);
    res.avg = { pa: acc.pa / N, pg2: acc.pg2 / N, pOut: acc.pOut / N, ia: acc.ia / N, ig2: acc.ig2 / N, B1: acc.B1 / N, K6: acc.K6 / N,
      iaMax: acc.iaMax, ig1Max: acc.ig1Max, a6Max: acc.a6Max, a6Min: acc.a6Min, ig1aMax: acc.igA, ig1bMax: acc.igB };
    res.spec = {};
    for (const p of ['OUT', 'PA', 'PB', 'A6', 'G6']) res.spec[p] = DSP.harmonics(buf[p], o.fs, f0, o.nHarm, o.window);
    const fo = res.spec.OUT.h[0];
    res.gain = amp > 0 ? fo.amp / amp : NaN;                       // temel bileşen, tepe / tepe
    res.thd = res.spec.OUT.thd;
    res.pFund = out ? fo.amp * fo.amp / 2 / out.r : 0;             // temel bileşenin gücü
    return res;
  }
  /** Senkron çalıştırma (Node testleri). */
  function audio(profile, state, seed, opt) {
    const g = audioGen(profile, state, seed, opt);
    let r = g.next(); while (!r.done) r = g.next();
    return r.value;
  }

  // ====================================================================================
  // Tasarım kontrolleri (amfinin kendisi hakkında; simülatör testleri değildir)
  // ====================================================================================
  function idealPeaks(profile) {
    const v = profile.T1.vSec, r2 = Math.SQRT2;
    return [
      { name: `${v} VAC / yarım sargı`, v: v * r2 },
      { name: `${v + 5} VAC / yarım sargı`, v: (v + 5) * r2 },
      { name: `${v} VAC, şebeke +%10 (varsayım)`, v: v * 1.1 * r2 },
      { name: 'Aynı + %5 yüksüz artışı (varsayım)', v: v * 1.1 * 1.05 * r2 },
    ];
  }
  const heaterLoad = profile => {
    const c1 = Tubes.CARDS[profile.models.V1A], c2 = Tubes.CARDS[profile.models.V2], c3 = Tubes.CARDS[profile.models.V3];
    return { a63: c1.heater.a + c2.heater.a, a5: c3.heater.a, parts: [['12AX7', c1.heater.a], ['6V6', c2.heater.a]] };
  };

  function checks(sim) {
    const out = [], P = sim.profile, st = sim.state, w = sim.win, pk = sim.peaks;
    const add = (lv, title, value, note) => out.push({ lv, title, value, note });
    const U = (x, d = 0) => (x == null || !Number.isFinite(x)) ? '—' : x.toFixed(d).replace('.', ',');
    if (sim.error) add('bad', 'Çözücü hatası', `t = ${U(sim.error.t, 3)} s`, sim.error.msg + ' Sayısal hatadır; fiziksel arıza ya da koruma olarak yorumlanmaz.');
    add(P.approved ? 'ok' : 'warn', 'Etkin profil', P.id + (P.overrides && Object.keys(P.overrides).length ? ' + kullanıcı değişikliği' : ''), 'Deneysel profil: açık kararların ilk deney değerleri. Rev A\'nın kesin kararı değildir; sonuçlar "referans 5F1 sonucu" olarak sunulamaz.');
    const ls = loadStatus(P, st);
    add(ls.danger ? 'bad' : 'ok', 'Hoparlör yükü', ls.label, ls.text + (ls.danger ? ' Simülatör amfiyi durdurmaz: gerçek devrede yük algılama ya da otomatik kesme yok.' : ''));
    if (st.otPhase < 0 && st.nfb) add('bad', 'NFB polaritesi', 'TERS', 'OT fazı ters: geri besleme pozitife döner. Kararlılık için "NFB" sekmesindeki çevrim analizine bakın.');
    // Kapasitör gerilim marjı (açılıştan beri görülen tepe)
    for (const id of ['C3', 'C4', 'C5', 'C1', 'C2', 'C6']) {
      const comp = D.BY_ID[id], vr = comp.rating.V, v = pk.cap[id];
      if (v == null) continue;
      const lv = v > vr ? 'bad' : v > 0.9 * vr ? 'warn' : 'ok';
      add(lv, `${id} tepe gerilimi`, `${U(v)} V / ${vr} V (%${U(100 * v / vr)})`, lv === 'ok' ? 'Açılıştan beri görülen tepe. Model tahmini; gerçek PT verisi ve ölçümle doğrulanmalı.' : `${comp.fn}: nominal gerilime ${lv === 'bad' ? 'ulaşıldı / aşıldı' : 'yaklaşıldı'}. Model tahmini; "güvenli" ilan edilemez (K-10).`);
    }
    const pkIdeal = idealPeaks(P);
    add(pkIdeal[3].v > 500 ? 'warn' : 'ok', 'İdeal yüksüz tepe (sınır örnekleri)', pkIdeal.map(p => U(p.v, 1) + ' V').join(' · '), 'Gerçek B+ tahmini değil; gerilim marjını sorgulayan ideal örnekler. +%10 ve %5 test varsayımıdır (inceleme raporu §6.2).');
    if (w) {
      for (const id of ['R10', 'R11', 'R9']) {
        const comp = D.BY_ID[id], p = w.rp[id], pr = comp.rating.W;
        add(p > pr ? 'bad' : p > 0.6 * pr ? 'warn' : 'ok', `${id} güç kaybı`, `${U(p, 2)} W / ${pr} W`, `${comp.fn}. Sürekli çalışmada pay bırakılması önerilir.`);
      }
      const ref = Tubes.CARDS[P.models.V2].ref;
      add(w.pa > ref.paW ? 'warn' : 'na', '6V6 anodik güç kaybı', `${U(w.pa, 1)} W`, `Sınır verisi eksik: eldeki 6V6GT\'nin üreticisi bilinmiyor. Yalnız referans: JJ 6V6S ${ref.paW} W. Pa = (Va − Vk) × Ia; Va, B+1\'den OT primer DCR düşümü kadar düşüktür.`);
      add('na', '6V6 screen güç kaybı', `${U(w.pg2, 2)} W`, 'Pg2 = (Vg2 − Vk) × Ig2. Sınır verisi eksik. Model ekran akımını plaka geriliminden bağımsız hesaplar; kırpılmada düşük tahmin eder.');
      add(w.A6Max > ref.vaV || w.B2 > ref.vg2V ? 'warn' : 'na', '6V6 plaka / screen gerilimi', `Va ${U(w.A6)} V · Vg2 ${U(w.B2)} V`, `Sınır verisi eksik. Yalnız referans: JJ 6V6S Ua ${ref.vaV} V, Ug2 ${ref.vg2V} V.`);
      add(w.ia > 0.04 ? 'warn' : 'ok', 'OT primer DC akımı', `${U(w.ia * 1000, 1)} mA`, 'Şartname: "en az ~40 mA; tercihen ~50 mA". Teklifte DC bias kapasitesi bu çalışma noktasıyla teyit edilmeli.');
      add('na', 'PT HV sargısı DC yükü', `${U(w.iRect * 1000, 1)} mA ort. · ${U(pk.iRectPk * 1000)} mA tepe / plaka`, '"70 mA"nın tanımı açık (K-08). Ortalama DC akım ile sargının darbeli RMS akımı eşit değildir. 5Y3 tepe akım sınırı: veri eksik.');
    }
    const hl = heaterLoad(P);
    add(hl.a63 <= 1.5 ? 'ok' : 'bad', '6,3 V heater yükü', `${U(hl.a63, 2)} A / 1,5 A`, 'Model kartlarındaki tipik heater akımları; eldeki tüp setiyle doğrulanmalı. Heater hum için sayı üretilmez.');
    add('ok', '5 V doğrultucu filamanı', `${U(hl.a5, 1)} A / 2 A`, 'Ayrı sargı; B+ potansiyelinde yüzer. 6,3 V sistemiyle birleştirilmez.');
    const r8 = D.resolve('R8', P).value;
    add('na', '6V6 grid devresi direnci', `${Math.round(r8 / 1000)} kΩ`, 'Sınır verisi eksik. Yalnız referans: JJ 6V6S self-bias ≤ 0,5 MΩ.');
    if (!D.isFitted('R16', P)) add('warn', 'Bleeder', 'yok', 'Güç kesilince filtre kapasitörleri tüpler soğudukça yük bulamaz ve şarj tutar. Boşaldığı ölçülmeden dokunulmaz.');
    return out;
  }

  /** SPICE benzeri okunur netlist (referans çözücü karşılaştırması ve dışa aktarım için). */
  function netlistText(b, title) {
    const c = b.ckt, nm = i => (i < 0 ? '0' : c.names[i]), L = [`* ${title || '5F1 Modifiye'}`, `* Kanonik tanımdan üretildi; düğüm adları anahtar konumlarına göre birleştirilmiştir.`];
    c.R.forEach(e => L.push(`R_${e.id} ${nm(e.a)} ${nm(e.b)} ${e.r}`));
    c.C.forEach(e => L.push(`C_${e.id} ${nm(e.a)} ${nm(e.b)} ${e.c}`));
    c.L.forEach(e => L.push(`L_${e.id} ${nm(e.a)} ${nm(e.b)} ${e.l}`));
    c.V.forEach(e => L.push(`V_${e.id} ${nm(e.a)} ${nm(e.b)} ; kaynak`));
    c.X.forEach(x => { L.push(`* Trafo ${x.id}: Lm = ${x.lm} H (n = 1 sargısına göre)`); x.w.forEach(w => L.push(`*   sargı ${w.id}: ${nm(w.a)} → ${nm(w.b)}  n = ${w.n}`)); });
    c.N.forEach(o => L.push(`X_${o.id} ${o.nodes.map(nm).join(' ')} ${o.dev.card.id} ; ${o.dev.card.eq}`));
    L.push('.end');
    return L.join('\n');
  }

  const api = { ProfileError, defaultState, cloneState, build, mapX, measure, loadStatus, Sim, steady, dcOp, acSweep, loopGain, logspace,
    audioGen, audio, checks, idealPeaks, heaterLoad, netlistText, taperFn, AUDIO_DEFAULTS, PROBES, LIVE_H, CYCLE, RMIN, PICKUP };
  if (node) module.exports = api;
  root.Amp = api;
})(typeof self !== 'undefined' ? self : this);
