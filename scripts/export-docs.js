/*
 * Kanonik tanımdan belge üretir:  node scripts/export-docs.js
 *   docs/KARAR_GUNLUGU.md, docs/BOM.md, docs/bom.csv, docs/MODEL_KARTLARI.md,
 *   docs/netlist-raw-normal.cir, docs/config-varsayilan.json
 * Test sonuçları ayrıca:  node tests/run-tests.js --json > docs/test-sonuclari.json
 * Belgeler elle düzenlenmez; devre tanımı değişince yeniden üretilir.
 */
const fs = require('fs'), path = require('path');
const A = p => path.join(__dirname, '..', p);
const D = require(A('assets/circuit-5f1.js')), Amp = require(A('assets/amp-model.js')), Bom = require(A('assets/bom-amp.js')), Tubes = require(A('assets/tubes.js')), U = require(A('assets/units.js'));
const P = D.cloneProfile(), st = Amp.defaultState(), hash = D.designHash(P);
const head = t => `# ${t}\n\n> ${D.REVISION.title} · ${D.REVISION.id} · profil ${P.id} · devre kimliği \`${hash}\`\n> Bu dosya \`scripts/export-docs.js\` ile kanonik tanımdan üretilir; elle düzenlenmez.\n`;
const w = (f, s) => { fs.writeFileSync(A('docs/' + f), s); console.log('docs/' + f); };

w('KARAR_GUNLUGU.md', head('Karar günlüğü') + `\n"Simülasyon varsayımı" deneysel profildir; Revizyon A'nın kesin kararı değildir.\n\n` +
  D.DECISIONS.map(d => `## ${d.id} · ${d.title}\n\n- **Öncelik / durum:** ${d.pri} · ${d.state}\n- **Açık olan:** ${d.open}\n- **Simülasyon varsayımı:** ${d.sim}\n- **Nasıl kapanır:** ${d.close}\n- **Parçalar:** ${d.parts.join(', ')}\n- **Kaynak:** ${d.src}\n`).join('\n') +
  `\n## Deneysel profil ${P.id}\n\n${P.why}\n\n| Parça | Değer | Gerekçe |\n|---|---|---|\n` +
  Object.entries(P.values).map(([k, v]) => `| ${k} | ${U.fmt(v, D.BY_ID[k].unit)}${D.BY_ID[k].optional ? (P.fitted[k] ? ' (takılı)' : ' (takılı değil)') : ''} | ${P.reasons[k] || 'Opsiyonel varyant değeri.'} |`).join('\n') +
  `\n| T1 | ${P.T1.vSec} VAC yüksüz EMK, Rt ${P.T1.rt} Ω / plaka | ${P.reasons.T1} |\n| T2 | DCR ${P.T2.rp} Ω, Lp ${P.T2.lp} H, kaçak ${P.T2.lleak * 1000} mH | ${P.reasons.T2} |\n| RAW yöntemi | ${P.rawMethod} | K-06 |\n| Taper | ${Object.entries(P.tapers).map(([k, v]) => k + ' ' + v).join(', ')} | K-05, K-14 |\n`);

const rows = Bom.rows(P);
let md = head('Malzeme listesi') + `\nSatın alma onayı değildir. Tedarik kaynakları ${D.SUPPLY_CHECKED} tarihinde kontrol edilen adaylardır; stok, fiyat ve teslimat teyit edilmedi. Tolerans, üretici, parça kodu ve paket alanları henüz boştur (veri eksik).\n`;
let g = null;
for (const r of rows) {
  if (r.group !== g) { g = r.group; md += `\n## ${g}\n\n| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |\n|---|---|---|---|---|---|---|---|\n`; }
  md += `| ${r.ref} | ${r.fn} | ${r.value} | ${r.qty} | ${D.STATUS_TR[r.status] || r.status}${r.decision ? ' · ' + r.decision : ''} | ${r.stock} | ${r.src} | ${r.supply.join(' ')} |\n`;
}
md += `\n## Tedarik kaynakları\n\n| Kod | Kaynak | Ne için | Bağlantı | Dikkat |\n|---|---|---|---|---|\n` + Object.entries(D.SUPPLIERS).map(([k, s]) => `| ${k} | ${s.name} (${s.country}, ${s.kind}) | ${s.what} | ${s.url} | ${s.note} |`).join('\n') + '\n';
w('BOM.md', md);
w('bom.csv', Bom.csv(P, hash));

w('MODEL_KARTLARI.md', head('Model kartları') + '\n' + Array.from(new Set(Object.values(P.models))).map(k => { const c = Tubes.CARDS[k]; return `## ${c.id} · v${c.version}\n\n- **Tüp:** ${c.tube}\n- **Denklem:** \`${c.eq}\`\n- **Parametreler:** \`${JSON.stringify(c.p)}\`\n- **Kaynak:** ${c.source}\n- **Lisans:** ${c.license}\n- **Geçerli aralık:** ${c.range}\n- **Doğrulama kanıtı:** ${c.evidence}\n- **Heater:** ${c.heater.v} V / ${c.heater.a} A — ${c.heater.note}\n- **Sınır değerleri:** veri eksik. ${c.limitsRef}\n- **Isınma (temsilî, kalibre değil):** τ açılış ${c.warm.tauUp} s, kapanış ${c.warm.tauDown} s\n- **Modellenmeyen etkiler:**\n${c.missing.map(m => '  - ' + m).join('\n')}\n`; }).join('\n'));

w('netlist-raw-normal.cir', Amp.netlistText(Amp.build(P, st), `5F1 Modifiye ${D.REVISION.id} · profil ${P.id} · RAW / NORMAL · ${hash}`) + '\n');
w('config-varsayilan.json', JSON.stringify({ kind: '5f1-amp-lab-config', schema: 1, revision: D.REVISION.id, designHash: hash, solver: { liveStepS: Amp.LIVE_H, method: 'bdf2', audio: Amp.AUDIO_DEFAULTS }, state: st, profile: P }, null, 2) + '\n');
