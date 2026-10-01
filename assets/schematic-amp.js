/*
 * Kavramsal devre şeması (tek SVG): pafta çerçevesi, bölgeler, antet.
 * Bileşen değerleri ve durumları kanonik tanımdan (circuit-5f1.js) okunur; burada yalnızca
 * yerleşim (koordinat) bulunur. Anahtar konumu ve takılı / takılı değil durumu çizime yansır.
 * Canlı değerler id'li <text> düğümlerine yazılır (bench-amp.js).
 *
 * Bu çizim lehimleme / PCB üretim şeması DEĞİLDİR.
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const D = node ? require('./circuit-5f1.js') : root.Design;
  const U = node ? require('./units.js') : root.Units;

  const VB = { w: 1280, h: 724 };
  const FRAME = { x: 24, y: 24, w: 1232, h: 676 };
  const COLS = 8, ROWS = 4;

  function zone(x, y) {
    const c = Math.min(COLS, Math.max(1, Math.floor((x - FRAME.x) / (FRAME.w / COLS)) + 1));
    const r = Math.min(ROWS, Math.max(1, Math.floor((y - FRAME.y) / (FRAME.h / ROWS)) + 1));
    return 'ABCD'[r - 1] + c;
  }

  // --- Çizim yardımcıları --------------------------------------------------------
  const W = (pts, cls = 'w') => `<polyline class="${cls}" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
  const dot = (x, y) => `<circle class="jn" cx="${x}" cy="${y}" r="3"/>`;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const T = (x, y, s, cls = 'val', anchor = 'start', id = '') => `<text ${id ? `id="${id}"` : ''} class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;
  const gnd = (x, y) => W([[x, y - 8], [x, y]]) +
    `<line class="sym-l" x1="${x - 9}" y1="${y}" x2="${x + 9}" y2="${y}"/><line class="sym-l" x1="${x - 5.5}" y1="${y + 4}" x2="${x + 5.5}" y2="${y + 4}"/><line class="sym-l" x1="${x - 2}" y1="${y + 8}" x2="${x + 2}" y2="${y + 8}"/>`;
  function net(x, y, name, dir = 'r') {
    const w = 10 + name.length * 6.6, s = dir === 'r' ? 1 : -1;
    const p = `M${x} ${y} L${x + s * 6} ${y - 8} L${x + s * (w + 6)} ${y - 8} L${x + s * (w + 6)} ${y + 8} L${x + s * 6} ${y + 8} Z`;
    return `<path class="net" d="${p}"/>` + T(x + s * (w / 2 + 6), y + 4, name, 'netname', 'middle');
  }
  /** Yukarı bakan besleme bayrağı. */
  const rail = (x, y, name) => W([[x, y], [x, y - 10]]) + `<line class="sym-l" x1="${x - 12}" y1="${y - 10}" x2="${x + 12}" y2="${y - 10}"/>` + T(x, y - 15, name, 'netname', 'middle');
  const coil = (x, y1, y2, side) => {
    const n = Math.max(2, Math.round((y2 - y1) / 13)), st = (y2 - y1) / n;
    let d = `M${x} ${y1}`;
    for (let i = 0; i < n; i++) d += ` a${st / 2} ${st / 2} 0 0 ${side > 0 ? 1 : 0} 0 ${st}`;
    return `<path class="coil" d="${d}"/>`;
  };
  const delta = (x, y, kid) => `<g class="delta" data-decision="${kid}" tabindex="0" role="button" aria-label="Açık karar ${kid}"><path d="M${x} ${y - 9} l10 18 h-20 z"/>${T(x, y + 6.5, kid.replace('K-', '').replace(/^0/, ''), 'deltanum', 'middle')}</g>`;

  function build(meta, profile, state) {
    const s = [], ids = [];
    const res = id => D.resolve(id, profile);
    const sv = id => {
      const c = D.BY_ID[id], r = res(id);
      if (r.value == null) return 'AÇIK';
      let t = U.fmt(r.value, c.unit === 'Ω' ? '' : c.unit).replace(/ /g, '');
      if (c.unit === 'Ω' && !/[kM]/.test(t)) t += ' Ω';
      return t;
    };
    const cls = id => {
      const c = D.BY_ID[id], r = res(id), fit = D.isFitted(id, profile);
      return `st-${c.type === 'R' || c.type === 'C' || c.type === 'POT' ? r.status : c.status}${fit ? '' : ' unfit'}`;
    };
    /** Tıklanabilir parça sarmalayıcısı. */
    const part = (id, hit, inner) => {
      ids.push(id);
      const c = D.BY_ID[id];
      return `<g class="part ${cls(id)}" data-part="${id}" tabindex="0" role="button" aria-label="${id} ${esc(c.fn)}"><rect class="hit" x="${hit[0]}" y="${hit[1]}" width="${hit[2]}" height="${hit[3]}"/>${inner}</g>`;
    };
    const lbl = (x, y, id, anchor = 'start', extra = '') => T(x, y, id, 'ref', anchor) + T(x, y + 13, sv(id) + extra, 'val', anchor);
    const resV = (id, x, y1, y2, side = 'r') => {
      const m = (y1 + y2) / 2, tx = side === 'r' ? x + 11 : x - 11, a = side === 'r' ? 'start' : 'end';
      return part(id, [Math.min(x - 9, side === 'r' ? x - 9 : x - 62), m - 22, 72, 44],
        W([[x, y1], [x, m - 15]]) + `<rect class="sym" x="${x - 5}" y="${m - 15}" width="10" height="30"/>` + W([[x, m + 15], [x, y2]]) + lbl(tx, m - 3, id, a));
    };
    const resH = (id, x1, x2, y, below = false) => {
      const m = (x1 + x2) / 2;
      return part(id, [m - 22, y - 26, 44, 36],
        W([[x1, y], [m - 16, y]]) + `<rect class="sym" x="${m - 16}" y="${y - 5}" width="32" height="10"/>` + W([[m + 16, y], [x2, y]]) +
        `<text class="ref" x="${m}" y="${below ? y + 19 : y - 10}" text-anchor="middle">${id} <tspan class="val">${esc(sv(id))}</tspan></text>`);
    };
    const capV = (id, x, y1, y2, side = 'r') => {
      const m = (y1 + y2) / 2, c = D.BY_ID[id], tx = side === 'r' ? x + 13 : x - 13, a = side === 'r' ? 'start' : 'end';
      return part(id, [side === 'r' ? x - 12 : x - 74, m - 20, 86, 40],
        W([[x, y1], [x, m - 4]]) + `<line class="sym-l" x1="${x - 10}" y1="${m - 4}" x2="${x + 10}" y2="${m - 4}"/><line class="sym-l" x1="${x - 10}" y1="${m + 4}" x2="${x + 10}" y2="${m + 4}"/>` +
        (c.polar ? T(x - 15, m - 7, '+', 'pm', 'middle') : '') + W([[x, m + 4], [x, y2]]) + lbl(tx, m - 3, id, a) + (c.rating.V && c.polar ? T(tx, m + 23, `${c.rating.V} V`, 'val', a) : ''));
    };
    const capH = (id, x1, x2, y) => {
      const m = (x1 + x2) / 2;
      return part(id, [m - 24, y - 28, 48, 40],
        W([[x1, y], [m - 4, y]]) + `<line class="sym-l" x1="${m - 4}" y1="${y - 10}" x2="${m - 4}" y2="${y + 10}"/><line class="sym-l" x1="${m + 4}" y1="${y - 10}" x2="${m + 4}" y2="${y + 10}"/>` + W([[m + 4, y], [x2, y]]) +
        `<text class="ref" x="${m}" y="${y - 15}" text-anchor="middle">${id} <tspan class="val">${esc(sv(id))}</tspan></text>`);
    };
    /** Dikey pot. wiper: 'r' / 'l' (üç uçlu) ya da null (reosta). */
    const potV = (id, x, y1, y2, wiper, labelSide = 'l') => {
      const m = (y1 + y2) / 2, h = 22, pos = state.pots[id], yw = m + h - pos * 2 * h;
      const taper = (profile.tapers && profile.tapers[id]) || 'lin';
      const tx = labelSide === 'l' ? x - 12 : x + 12, a = labelSide === 'l' ? 'end' : 'start';
      let g = W([[x, y1], [x, m - h]]) + `<rect class="sym" x="${x - 5.5}" y="${m - h}" width="11" height="${2 * h}"/>` + W([[x, m + h], [x, y2]]);
      if (wiper) { const sd = wiper === 'r' ? 1 : -1; g += `<line class="potarrow" x1="${x + sd * 26}" y1="${yw}" x2="${x + sd * 8}" y2="${yw}" marker-end="url(#arr)"/>`; }
      else g += `<line class="potarrow" x1="${x - 13}" y1="${m + 14}" x2="${x + 13}" y2="${m - 14}" marker-end="url(#arr)"/>`;
      g += T(tx, m - 9, id, 'ref', a) + T(tx, m + 4, `${sv(id)} ${taper}`, 'val', a) + T(tx, m + 17, `%${Math.round(pos * 100)}`, 'probe', a, `pot-${id}`);
      return { svg: part(id, [labelSide === 'l' ? x - 70 : x - 28, m - h - 4, 98, 2 * h + 8], g), yw };
    };
    const triode = (id, cx, cy, name) => part(id, [cx - 30, cy - 30, 60, 60],
      `<circle class="sym tube" cx="${cx}" cy="${cy}" r="27"/>` +
      `<line class="sym-l" x1="${cx - 13}" y1="${cy - 12}" x2="${cx + 13}" y2="${cy - 12}"/>` + W([[cx, cy - 12], [cx, cy - 27]]) +
      `<line class="grid" x1="${cx - 17}" y1="${cy}" x2="${cx + 17}" y2="${cy}"/>` + W([[cx - 17, cy], [cx - 27, cy]]) +
      `<path class="w" d="M${cx - 12} ${cy + 15} v-4 h24 v4"/>` + W([[cx, cy + 11], [cx, cy + 27]]) +
      T(cx + 31, cy - 14, id, 'ref') + T(cx + 31, cy - 1, name, 'val'));

    s.push(`<svg viewBox="0 0 ${VB.w} ${VB.h}" class="sheet-svg" role="img" aria-label="5F1 modifiye amfi kavramsal şeması" xmlns="http://www.w3.org/2000/svg">`);
    s.push(sheetFrame());

    // ============================== SİNYAL YOLU ==============================
    const Y = 250, GY = 392;
    const S1 = state.sw.S1, S2 = state.sw.S2, tap = S2 === 'RAW' && profile.rawMethod === 'tap';

    // --- Giriş jakı ve High/Low ağı ---
    s.push(part('J1', [30, 232, 26, 36], `<circle class="sym" cx="42" cy="${Y}" r="6"/><circle class="jn" cx="42" cy="${Y}" r="2"/>` + T(42, Y - 14, 'J1', 'ref', 'middle')));
    s.push(T(34, Y + 78, 'GİRİŞ', 'tbk') + T(34, Y + 91, '—', 'probe', 'start', 'sIn'));
    s.push(W([[48, Y], [100, Y]]) + dot(80, Y));
    s.push(resH('R1', 100, 190, Y) + W([[190, Y], [233, Y]]) + dot(200, Y));
    s.push(resH('R2', 100, 190, 300, true) + W([[190, 300], [200, 300], [200, Y]]));
    // S1A: R2'nin sol ucu High'da girişe, Low'da toprağa
    s.push(part('S1', [70, 262, 26, 54], (S1 === 'HIGH' ? W([[100, 300], [80, 300], [80, Y]]) : W([[100, 300], [88, 300], [88, 322]]) + gnd(88, 330)) +
      T(100, 282, `S1 ${S1}`, 'swl', 'start')));
    // S1B + R3: 1 MΩ yalnız High'da devrede
    s.push(dot(62, Y) + (S1 === 'HIGH' ? W([[62, Y], [62, 196]]) : W([[62, Y], [62, 228]]) + `<line class="xmark" x1="57" y1="215" x2="67" y2="225"/><line class="xmark" x1="67" y1="215" x2="57" y2="225"/>`));
    s.push(resV('R3', 62, 196, 140, 'r') + W([[62, 140], [62, 128], [92, 128]]) + gnd(92, 136));

    // --- V1A ---
    s.push(triode('V1A', 260, Y, '½ 12AX7'));
    s.push(W([[260, 223], [260, 170]]) + dot(260, 170) + resV('R4', 260, 170, 96, 'l') + rail(260, 96, 'B+3'));
    s.push(W([[260, 277], [260, 304]]) + resV('R5', 260, 304, 384, 'l') + gnd(260, GY));
    s.push(dot(260, 304) + W([[260, 304], [300, 304]]) + capV('C7', 300, 304, 384) + gnd(300, GY) + delta(340, 322, 'K-03'));
    s.push(T(212, 170, '—', 'probe', 'end', 'sPA') + T(246, 298, '—', 'probe', 'end', 'sKA'));
    s.push(capH('C1', 260, 350, 170));

    // --- S2 EQ/RAW ve ton ağı ---
    const eq = S2 === 'EQ';
    s.push(part('S2', [342, 176, 60, 30], T(350, 190, `S2 ${S2}${tap ? '·tap' : ''}`, 'swl', 'start')) + delta(378, 206, 'K-06'));
    s.push(dot(350, 170));
    if (eq || tap) s.push(W([[350, 170], [410, 170]]));
    else s.push(`<line class="xmark" x1="372" y1="165" x2="382" y2="175"/><line class="xmark" x1="382" y1="165" x2="372" y2="175"/>` + W([[386, 170], [410, 170]], 'w off'));
    const stackCls = eq || tap ? '' : ' lifted';
    s.push(`<g class="stack${stackCls}">`);
    s.push(dot(410, 170) + W([[410, 170], [410, 124]]) + capH('C8', 410, 520, 124));
    s.push(resV('R13', 410, 170, 250, 'r') + dot(410, 250) + capH('C9', 410, 520, 250) + W([[410, 250], [410, 330]]) + capH('C10', 410, 520, 330));
    const pT = potV('VR2', 520, 124, 250, 'r', 'r'), pB = potV('VR3', 520, 250, 330, null, 'r'), pM = potV('VR4', 520, 330, 384, null, 'r');
    s.push(pT.svg + dot(520, 250) + pB.svg + dot(520, 330) + pM.svg + gnd(520, GY));
    s.push(T(445, 100, 'TON AĞI (TMB) · DENEYSEL', 'tbk') + delta(432, 96, 'K-05'));
    s.push('</g>');
    // TW → VT (EQ) ya da baypas (RAW)
    const VTX = 660, VTY = 140;
    if (eq) s.push(W([[546, pT.yw], [612, pT.yw], [612, VTY], [VTX, VTY]]));
    else s.push(W([[350, 170], [350, 76], [612, 76], [612, VTY], [VTX, VTY]]) + T(480, 70, 'RAW baypas', 'swl', 'middle'));
    // --- Volume, Bright, Dark ---
    const pV = potV('VR1', VTX, VTY, 346, 'r', 'l');
    s.push(pV.svg + gnd(VTX, 354) + dot(VTX, VTY) + delta(640, 318, 'K-14'));
    const GX = 700;
    s.push(W([[VTX + 26, pV.yw], [GX, pV.yw], [GX, Y]]) + W([[GX, Y], [723, Y]]) + dot(GX, Y) + dot(GX, pV.yw));
    // Bright: VT – wiper arası (C11, wiper hattının üstünde)
    s.push(part('S3', [664, 100, 60, 34], T(668, 112, `S3 ${state.sw.S3 === 'ON' ? 'BRIGHT' : 'kapalı'}`, 'swl', 'start') +
      (state.sw.S3 === 'ON' ? W([[VTX, VTY], [GX, VTY]]) : W([[VTX, VTY], [674, VTY]]) + `<line class="sym-l blade" x1="674" y1="${VTY}" x2="694" y2="${VTY - 12}"/>`) +
      `<circle class="pin" cx="674" cy="${VTY}" r="2.4"/><circle class="pin" cx="${GX}" cy="${VTY}" r="2.4"/>`));
    s.push(capV('C11', GX, VTY, 210) + W([[GX, 210], [GX, pV.yw]]));
    // Dark: G2 – toprak
    s.push(part('S4', [640, 372, 56, 20], T(644, 386, `S4 ${state.sw.S4 === 'ON' ? 'DARK' : 'kapalı'}`, 'swl', 'start')));
    s.push((state.sw.S4 === 'ON' ? W([[GX, Y], [GX, 296]]) : W([[GX, Y], [GX, 272]]) + `<line class="sym-l blade" x1="${GX}" y1="272" x2="${GX + 12}" y2="292"/>`) +
      `<circle class="pin" cx="${GX}" cy="272" r="2.4"/><circle class="pin" cx="${GX}" cy="296" r="2.4"/>`);
    s.push(capV('C12', GX, 296, 384, 'l') + gnd(GX, GY) + delta(712, 356, 'K-07'));

    // --- V1B ---
    s.push(triode('V1B', 750, Y, '½ 12AX7'));
    s.push(W([[750, 223], [750, 170]]) + dot(750, 170) + resV('R6', 750, 170, 96, 'l') + rail(750, 96, 'B+3'));
    s.push(W([[750, 277], [750, 304]]) + dot(750, 304) + resV('R7', 750, 304, 384, 'l') + gnd(750, GY));
    s.push(T(744, 161, '—', 'probe', 'end', 'sPB') + T(738, 298, '—', 'probe', 'end', 'sKB'));
    // NFB: KB ← R12 ← 4 Ω tap
    s.push(W([[750, 304], [790, 304]]) + resV('R12', 790, 304, 372, 'r') + (state.nfb ? W([[790, 372], [790, 380]]) + net(790, 388, '4Ω TAP') : T(790, 388, 'NFB yok', 'swl', 'middle')) + delta(778, 296, 'K-04'));
    s.push(capH('C2', 750, 850, 170) + W([[850, 170], [850, Y]]) + dot(850, Y) + W([[850, Y], [879, Y]]));
    s.push(resV('R8', 850, Y, 384, 'r') + gnd(850, GY));

    // --- V2 6V6 ---
    const VX = 910;
    s.push(part('V2', [VX - 33, Y - 33, 66, 66],
      `<circle class="sym tube" cx="${VX}" cy="${Y}" r="31"/>` +
      `<line class="sym-l" x1="${VX - 14}" y1="${Y - 16}" x2="${VX + 14}" y2="${Y - 16}"/>` + W([[VX, Y - 16], [VX, Y - 31]]) +
      `<line class="grid" x1="${VX - 18}" y1="${Y - 6}" x2="${VX + 18}" y2="${Y - 6}"/>` + W([[VX + 18, Y - 6], [VX + 30, Y - 6]]) +
      `<line class="grid" x1="${VX - 18}" y1="${Y + 4}" x2="${VX + 18}" y2="${Y + 4}"/>` + W([[VX - 18, Y + 4], [VX - 24, Y + 4], [VX - 24, Y], [VX - 31, Y]]) +
      `<path class="w" d="M${VX - 12} ${Y + 19} v-4 h24 v4"/>` + W([[VX, Y + 15], [VX, Y + 31]]) +
      T(VX + 34, Y + 16, 'V2', 'ref') + T(VX + 34, Y + 29, '6V6GT', 'val')) + delta(VX - 30, Y - 42, 'K-02'));
    s.push(W([[VX + 30, Y - 6], [958, Y - 6], [958, 214]]) + rail(958, 214, 'B+2') + delta(984, 222, 'K-15'));
    s.push(W([[VX, 281], [VX, 304]]) + dot(VX, 304) + resV('R9', VX, 304, 384, 'l') + gnd(VX, GY));
    s.push(W([[VX, 304], [958, 304]]) + capV('C6', 958, 304, 384) + gnd(958, GY));
    s.push(T(VX + 8, 298, '—', 'probe', 'start', 'sK6') + T(VX + 8, 188, '—', 'probe', 'start', 'sA6') + T(VX + 8, 175, '—', 'probe strong', 'start', 'sIa'));

    // --- T2 çıkış trafosu ve jaklar ---
    const PX = 1040, SX = 1066;
    s.push(W([[VX, 219], [VX, 196], [PX, 196]]));
    s.push(part('T2', [PX - 22, 86, 70, 122],
      coil(PX, 100, 196, -1) + `<line class="core" x1="${PX + 11}" y1="98" x2="${PX + 11}" y2="198"/><line class="core" x1="${PX + 15}" y1="98" x2="${PX + 15}" y2="198"/>` + coil(SX, 100, 196, 1) +
      T(PX + 13, 90, 'T2', 'ref', 'middle')) + delta(PX + 44, 84, 'K-09'));
    s.push(W([[PX, 100], [PX, 78]]) + rail(PX, 78, 'B+1') + T(PX - 10, 150, '8 kΩ', 'val', 'end') + T(PX - 10, 163, state.otPhase < 0 ? 'FAZ TERS' : '', 'swl bad', 'end'));
    const taps = [['J4', 100, '16 Ω'], ['J3', 132, '8 Ω'], ['J2', 164, '4 Ω']];
    for (const [jid, y, name] of taps) {
      const r = state.loads[jid];
      s.push(part(jid, [1118, y - 12, 130, 24], W([[SX, y], [1126, y]]) + `<circle class="sym" cx="1132" cy="${y}" r="6"/><circle class="jn" cx="1132" cy="${y}" r="2"/>` +
        T(1142, y - 2, `${jid} · ${name}`, 'ref') + T(1142, y + 11, r == null ? 'boş' : `${U.trim(r)} Ω yük`, r == null ? 'val' : 'val strong')));
    }
    s.push(W([[SX, 196], [SX, 208]]) + gnd(SX, 216) + T(SX + 12, 200, 'COM', 'pinl'));
    if (state.nfb) s.push(dot(1096, 164) + W([[1096, 164], [1096, 186]]) + net(1096, 194, 'R12 NFB', 'r'));
    s.push(T(1126, 232, 'ÇIKIŞ', 'tbk') + T(1126, 247, '—', 'probe strong', 'start', 'sOut') + T(1126, 262, '—', 'probe', 'start', 'sLoad'));

    // ============================== BESLEME ==============================
    const RY = 505, BG = 606;
    s.push(T(40, 446, 'BESLEME · 230 VAC → 5Y3GT → B+1 / B+2 / B+3', 'tbk'));
    // Şebeke, sigorta, anahtar
    s.push(`<circle class="sym" cx="62" cy="540" r="20"/><path class="w thin" d="M50 540 q6 -12 12 0 t12 0"/>` + T(62, 578, '—', 'probe', 'middle', 'sMains'));
    s.push(W([[62, 520], [62, 486], [92, 486]]) + part('F1', [92, 468, 44, 30], `<rect class="sym" x="96" y="481" width="30" height="10"/><line class="sym-l" x1="96" y1="486" x2="126" y2="486"/>` + T(111, 474, 'F1', 'ref', 'middle')) + W([[126, 486], [146, 486]]) + delta(111, 508, 'K-13'));
    s.push(part('S5', [142, 462, 56, 36], `<circle class="pin" cx="150" cy="486" r="2.4"/><circle class="pin" cx="186" cy="486" r="2.4"/>` +
      (state.mainsOn ? W([[150, 486], [186, 486]]) : `<line class="sym-l blade" x1="150" y1="486" x2="182" y2="472"/>`) + T(168, 470, 'S5', 'ref', 'middle')) + W([[186, 486], [226, 486]]));
    s.push(W([[62, 560], [62, 594], [226, 594]]));
    // T1
    s.push(part('T1', [212, 452, 96, 204],
      coil(226, 486, 594, -1) + `<line class="core" x1="238" y1="462" x2="238" y2="650"/><line class="core" x1="242" y1="462" x2="242" y2="650"/>` +
      coil(254, 464, 546, 1) + coil(254, 566, 596, 1) + coil(254, 614, 644, 1) + T(240, 456, 'T1', 'ref', 'middle')) + delta(206, 452, 'K-08'));
    s.push(W([[254, 505], [286, 505]]) + gnd(286, 513) + T(262, 500, 'CT', 'pinl'));
    s.push(T(270, 577, '5 V / 2 A', 'val') + T(270, 590, '→ V3 filaman', 'val') +
      part('R14', [266, 612, 112, 44], T(270, 625, '6,3 V / 1,5 A', 'val') + T(270, 638, '→ V1, V2 heater · R14 CT', 'val') + T(270, 651, '—', 'probe', 'start', 'sHeat')) + delta(424, 632, 'K-11'));
    s.push(T(200, 548, '—', 'probe', 'end', 'sSec'));
    // V3 5Y3
    s.push(W([[254, 464], [330, 464], [330, 494], [372, 494]]) + W([[254, 546], [330, 546], [330, 516], [372, 516]]));
    s.push(part('V3', [372, 472, 66, 66],
      `<circle class="sym tube" cx="402" cy="${RY}" r="30"/>` +
      `<line class="sym-l" x1="386" y1="488" x2="386" y2="500"/><line class="sym-l" x1="386" y1="510" x2="386" y2="522"/>` + W([[372, 494], [386, 494]]) + W([[372, 516], [386, 516]]) +
      `<path class="w" d="M414 492 v26"/>` + W([[414, RY], [432, RY]]) + T(402, 466, 'V3 · 5Y3GT', 'ref', 'middle')));
    s.push(T(402, 552, '—', 'probe', 'middle', 'sRect'));
    // Ray: B+1 → R10 → B+2 → R11 → B+3
    s.push(W([[432, RY], [600, RY]]) + dot(480, RY) + capV('C3', 480, RY, 598) + gnd(480, BG));
    s.push(dot(545, RY) + resV('R16', 545, RY, 598, 'r') + gnd(545, BG) + delta(580, 590, 'K-12'));
    s.push(dot(600, RY) + rail(600, 486, 'B+1') + W([[600, RY], [600, 486]]) + T(600, 458, '—', 'probe strong', 'middle', 'sB1') + T(600, 445, 'OT / güç katı', 'pinl', 'middle'));
    s.push(resH('R10', 600, 710, RY, true) + dot(710, RY) + capV('C4', 710, RY, 598) + gnd(710, BG));
    s.push(W([[710, RY], [750, RY]]) + dot(750, RY) + W([[750, RY], [750, 486]]) + rail(750, 486, 'B+2') + T(750, 458, '—', 'probe strong', 'middle', 'sB2') + T(750, 445, 'screen', 'pinl', 'middle'));
    s.push(resH('R11', 750, 860, RY, true) + dot(860, RY) + capV('C5', 860, RY, 598) + gnd(860, BG));
    s.push(W([[860, RY], [900, RY], [900, 486]]) + rail(900, 486, 'B+3') + T(900, 458, '—', 'probe strong', 'middle', 'sB3') + T(900, 445, '12AX7 anotları', 'pinl', 'middle'));
    s.push(delta(655, 478, 'K-01') + delta(790, 590, 'K-10'));
    s.push(T(40, 676, 'KAVRAMSAL ŞEMA · lehimleme / PCB üretim şeması değildir', 'tbk') +
      T(40, 690, 'Kırmızı-mor: açık karar için deneysel profil değeri ya da takılı olmayan opsiyonel parça. Δ: karar günlüğü.', 'revtxt'));

    s.push(titleBlock(meta, { title: D.REVISION.title, rev: 'A', state: profile.id, sheet: '1 / 1' }));
    s.push('</svg>');
    return { svg: s.join(''), ids };
  }

  function sheetFrame() {
    const s = [];
    s.push(`<defs><pattern id="grid5" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" class="gridline"/></pattern>` +
      `<marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0 1 L9 5 L0 9 z" class="arrowhead"/></marker></defs>`);
    s.push(`<rect class="paper" x="0" y="0" width="${VB.w}" height="${VB.h}"/>`);
    s.push(`<rect x="${FRAME.x}" y="${FRAME.y}" width="${FRAME.w}" height="${FRAME.h}" fill="url(#grid5)"/>`);
    s.push(`<rect class="frame-o" x="8" y="8" width="${VB.w - 16}" height="${VB.h - 16}"/><rect class="frame-i" x="${FRAME.x}" y="${FRAME.y}" width="${FRAME.w}" height="${FRAME.h}"/>`);
    for (let c = 0; c < COLS; c++) {
      const cx = FRAME.x + FRAME.w / COLS * (c + .5), bx = FRAME.x + FRAME.w / COLS * c;
      s.push(T(cx, 20, c + 1, 'zone', 'middle') + T(cx, VB.h - 11, c + 1, 'zone', 'middle'));
      if (c) s.push(`<line class="tick" x1="${bx}" y1="8" x2="${bx}" y2="${FRAME.y}"/><line class="tick" x1="${bx}" y1="${VB.h - 8}" x2="${bx}" y2="${VB.h - FRAME.y}"/>`);
    }
    for (let r = 0; r < ROWS; r++) {
      const cy = FRAME.y + FRAME.h / ROWS * (r + .5), by = FRAME.y + FRAME.h / ROWS * r;
      s.push(T(16, cy + 4, 'ABCD'[r], 'zone', 'middle') + T(VB.w - 16, cy + 4, 'ABCD'[r], 'zone', 'middle'));
      if (r) s.push(`<line class="tick" x1="8" y1="${by}" x2="${FRAME.x}" y2="${by}"/><line class="tick" x1="${VB.w - 8}" y1="${by}" x2="${VB.w - FRAME.x}" y2="${by}"/>`);
    }
    return s.join('');
  }

  function titleBlock(meta, f) {
    const TB = { x: 896, y: 610, w: 360, h: 90 };
    return `<g class="titleblock"><rect x="${TB.x}" y="${TB.y}" width="${TB.w}" height="${TB.h}"/>` +
      `<line x1="${TB.x}" y1="${TB.y + 30}" x2="${TB.x + TB.w}" y2="${TB.y + 30}"/><line x1="${TB.x}" y1="${TB.y + 60}" x2="${TB.x + TB.w}" y2="${TB.y + 60}"/>` +
      `<line x1="${TB.x + 290}" y1="${TB.y}" x2="${TB.x + 290}" y2="${TB.y + TB.h}"/><line x1="${TB.x + 196}" y1="${TB.y + 30}" x2="${TB.x + 196}" y2="${TB.y + TB.h}"/>` +
      T(TB.x + 6, TB.y + 11, 'BAŞLIK', 'tbk') + T(TB.x + 6, TB.y + 25, f.title, 'tbv sm') +
      T(TB.x + 296, TB.y + 11, 'REV', 'tbk') + T(TB.x + 296, TB.y + 27, f.rev, 'tbrev') +
      T(TB.x + 6, TB.y + 41, 'TASARIM', 'tbk') + T(TB.x + 6, TB.y + 55, meta.author, 'tbv') +
      T(TB.x + 202, TB.y + 41, 'ETKİN PROFİL', 'tbk') + T(TB.x + 202, TB.y + 55, f.state, 'tbv sm', 'start', 'tbProfile') +
      T(TB.x + 296, TB.y + 41, 'PAFTA', 'tbk') + T(TB.x + 296, TB.y + 55, f.sheet, 'tbv') +
      T(TB.x + 6, TB.y + 71, 'KAYNAK', 'tbk') + T(TB.x + 6, TB.y + 85, meta.source, 'tbv sm') +
      T(TB.x + 202, TB.y + 71, 'DEVRE KİMLİĞİ', 'tbk') + T(TB.x + 202, TB.y + 85, meta.hash || '—', 'tbv sm', 'start', 'tbHash') +
      T(TB.x + 296, TB.y + 71, 'TARİH', 'tbk') + T(TB.x + 296, TB.y + 85, meta.date, 'tbv sm') + `</g>`;
  }

  const api = { build, zone, VB };
  if (node) module.exports = api;
  root.SchematicAmp = api;
})(typeof self !== 'undefined' ? self : this);
