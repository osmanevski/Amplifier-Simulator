/*
 * Senaryolar: başlangıç koşulu + (varsa) zamanlı olay + beklenen gözlem.
 * Her senaryo varsayılan durumdan ve varsayılan deneysel profilden başlar; apply(st, profile) ile değiştirir.
 *   start: 'hot'  → tüpler ısınmış, periyodik kararlı durumdan
 *          'cold' → t = 0, tüpler soğuk, kapasitörler boş
 *   at / inject: simülasyon zamanı at (s) olduğunda bir kez uygulanır
 * Yeni senaryo eklemek için bu diziye bir nesne eklemek yeterlidir.
 */
(function (root) {
  'use strict';

  const SCENARIOS = [
    { id: 'base', start: 'hot', name: 'RAW / NORMAL · kararlı çalışma', desc: 'Başlangıç profili: ton ağı devre dışı, 4 Ω eşleşmiş yük',
      watch: 'B+1 ≈ 360 V, 6V6 ≈ 37 mA. Temiz çıkış gücü birkaç watt.' },
    { id: 'cold', start: 'cold', name: 'Soğuk açılış', desc: 'Tüpler soğuk; 5Y3 önce iletir, yük geç gelir',
      watch: 'İlk saniyelerde B+ tepe yapar: C4 / C5 nominal 450 V\'a dayanır (K-10). Sonra tüpler ısınır ve gerilim oturur.' },
    { id: 'eq', start: 'hot', name: 'EQ devrede', desc: 'TMB ton ağı, bütün potlar ortada', apply: st => { st.sw.S2 = 'EQ'; },
      watch: 'Ton ağı pasif: kazanç 11–18 dB düşer ve V1A\'nın yükü değişir. "Frekans cevabı" sekmesinde RAW ile karşılaştırın.' },
    { id: 'low', start: 'hot', name: 'Low giriş, gitar manyetiğiyle', desc: '68k + 68k bölücü; temsili manyetik + kablo', apply: st => { st.sw.S1 = 'LOW'; st.src.kind = 'pickup'; },
      watch: 'Zayıflama sabit −6 dB değildir: kaynak empedansı arttıkça ve frekans yükseldikçe büyür.' },
    { id: 'bright', start: 'hot', name: 'Bright, düşük volume', desc: 'Volume %25, C11 devrede', apply: st => { st.sw.S3 = 'ON'; st.pots.VR1 = 0.25; },
      watch: 'Tizler potun üst yarısını atlar. Volume tam açıldığında fark kaybolur.' },
    { id: 'dark', start: 'hot', name: 'Dark', desc: 'C12, V1B girişinden toprağa', apply: st => { st.sw.S4 = 'ON'; },
      watch: 'Kesim frekansı potun o andaki çıkış empedansına bağlıdır; sabit bir tiz azaltma değildir.' },
    { id: 'od', start: 'hot', name: 'Aşırı sürüş', desc: '0,5 V tepe giriş, volume tam', apply: st => { st.src.amp = 0.5; st.pots.VR1 = 1; },
      watch: 'Asimetrik kırpılma, güçlü çift harmonikler, grid iletimi. Çıkış ve ekran gücü yaklaşık değerdir (6V6 model kartı).' },
    { id: 'mains', start: 'cold', name: 'Şebeke +%10, soğuk açılış', desc: '253 VAC varsayımı', apply: st => { st.mainsV = 253; },
      watch: 'Açılış tepesi C3\'ün 500 V nominaline yaklaşır; C4 / C5 450 V\'u aşar. +%10 bir test varsayımıdır.' },
    { id: 'v325', start: 'hot', name: '325 VAC sargı', desc: 'PT yarım sargısı 325 V olsaydı', apply: (st, p) => { p.T1.vSec = 325; },
      watch: 'Bütün düğümler yeniden çözülür; fark her düğümde aynı sabit değildir.' },
    { id: 'bypass', start: 'hot', name: 'V1A bypass 25 µF varyantı', desc: 'C7 takılı (raporda tanımlı değil)', apply: (st, p) => { p.fitted.C7 = true; },
      watch: 'V1A kazancı artar. Bu bir deneysel varyanttır; Rev A kararı değildir (K-03).' },
    { id: 'noload', start: 'hot', fault: true, name: 'Yüksüz çıkış', desc: 'Hiçbir jakta hoparlör yok', apply: st => { st.loads = { J2: null, J3: null, J4: null }; },
      watch: 'Tehlikeli yük koşulu. Simülatör amfiyi durdurmaz; gerçek devrede koruma yoktur. Ark ve izolasyon: model değerlendiremez.' },
    { id: 'wrong', start: 'hot', fault: true, name: 'Yanlış jak', desc: '4 Ω kabin 16 Ω jakta', apply: st => { st.loads = { J2: null, J3: null, J4: 4 }; },
      watch: 'Primere 2 kΩ yansır (hedef 8 kΩ). NFB yine 4 Ω tapından alınır.' },
    { id: 'multi', start: 'hot', fault: true, name: 'İki kabin birden', desc: '4 Ω jakta 4 Ω + 8 Ω jakta 8 Ω', apply: st => { st.loads = { J2: 4, J3: 8, J4: null }; },
      watch: 'Yansıyan yük 4 kΩ\'a düşer. Varsayılan kullanım tek kabindir.' },
    { id: 'nfbrev', start: 'hot', fault: true, name: 'NFB ters faz', desc: 'OT primer uçları ters bağlı', apply: st => { st.otPhase = -1; },
      watch: 'Geri besleme pozitife döner. "NFB çevrimi" sekmesi çevrim kazancını ve Nyquist değerlendirmesini gösterir.' },
    { id: 'coldoff', start: 'cold', fault: true, name: 'Açılıştan 3 s sonra kapat', desc: 'Bleeder yok; tüpler henüz iletimde değil', at: 3, inject: st => { st.mainsOn = false; },
      watch: 'Kapasitörler dolu kalır: yük yok. Fiş çekili olması devrenin güvenli olduğunu göstermez.' },
    { id: 'bleeder', start: 'cold', name: 'Aynısı, 220 kΩ bleeder ile', desc: 'R16 takılı varyant', apply: (st, p) => { p.fitted.R16 = true; }, at: 3, inject: st => { st.mainsOn = false; },
      watch: 'B+ onlarca saniyede boşalır. Bleeder olsa bile boşaldığı ölçülmelidir.' },
  ];

  /** Çalışırken müdahale: zaman geçmişi silinmez. */
  const LIVE = [
    { id: 'spk', name: 'Hoparlörü çek / tak', desc: '4 Ω jaktaki yük', act: st => { st.loads.J2 = st.loads.J2 == null ? 4 : null; return st.loads.J2 == null ? 'Hoparlör çekildi (4 Ω jak boş).' : '4 Ω yük takıldı.'; }, struct: true },
    { id: 'phase', name: 'OT fazını çevir', desc: 'Primer uçlarını değiştir', act: st => { st.otPhase = -st.otPhase; return st.otPhase < 0 ? 'OT fazı ters çevrildi: NFB pozitife döner.' : 'OT fazı düzeltildi.'; }, struct: true },
    { id: 'nfb', name: 'NFB direncini sök / tak', desc: 'R12 (22 kΩ)', act: st => { st.nfb = !st.nfb; return st.nfb ? 'R12 takıldı.' : 'R12 söküldü: geri besleme yok.'; }, struct: true },
    { id: 'pwr', name: 'Şebekeyi kes / ver', desc: 'S5', act: st => { st.mainsOn = !st.mainsOn; return st.mainsOn ? 'Şebeke verildi.' : 'Şebeke kesildi.'; } },
  ];

  const api = { SCENARIOS, LIVE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ScenariosAmp = api;
})(typeof self !== 'undefined' ? self : this);
