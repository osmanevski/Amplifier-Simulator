/*
 * Kabul testleri (Node):  node tests/run-tests.js [--fast] [--json] [KİMLİK ...]
 *   --fast  ağır (heavy) testleri atlar; atlananlar "çalıştırılmadı" olarak raporlanır
 *   --json  sonuçları JSON olarak yazar (docs/test-sonuclari.json için)
 * Geçen / kalan / çalıştırılmayan ayrı sayılır. Kalan test varsa çıkış kodu 1.
 */
const path = require('path');
const T = require(path.join(__dirname, '..', 'assets', 'tests-amp.js'));
const D = require(path.join(__dirname, '..', 'assets', 'circuit-5f1.js'));

const args = process.argv.slice(2);
const fast = args.includes('--fast'), json = args.includes('--json');
const only = args.filter(a => !a.startsWith('--'));
const ctx = T.makeCtx();
const results = [];
const mark = { pass: '✓', fail: '✕', notrun: '–' };

for (const t of T.TESTS) {
  if (only.length && !only.includes(t.id)) continue;
  let r;
  if (fast && t.heavy) r = { id: t.id, group: t.group, title: t.title, req: t.req, ms: 0, status: 'notrun', measured: '—', expected: '—', note: '--fast ile atlandı.' };
  else r = T.runOne(t, ctx);
  results.push(r);
  if (!json) {
    console.log(`${mark[r.status]} ${r.id.padEnd(7)} ${r.title}  (${r.ms} ms)`);
    console.log(`    ölçülen : ${r.measured}`);
    console.log(`    beklenen: ${r.expected}`);
    if (r.note) console.log(`    not     : ${r.note}`);
  }
}
const n = s => results.filter(r => r.status === s).length;
const summary = { revision: D.REVISION.id, profile: D.PROFILE_DEFAULT.id, hash: D.designHash(D.cloneProfile()), node: process.version, date: new Date().toISOString(), pass: n('pass'), fail: n('fail'), notrun: n('notrun') };
if (json) console.log(JSON.stringify({ summary, results }, null, 2));
else console.log(`\n${summary.pass} geçti · ${summary.fail} kaldı · ${summary.notrun} çalıştırılmadı   [${summary.revision} · ${summary.profile} · ${summary.hash}]`);
process.exit(summary.fail ? 1 : 0);
