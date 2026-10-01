/*
 * 5F1 Modifiye — KANONİK DEVRE TANIMI (tek veri kaynağı).
 *
 * Şema çizimi, çözücü netlisti, bileşen denetçisi ve malzeme listesi yalnızca bu dosyadan beslenir.
 * Bir parça değeri tek noktadan (bu tanım ya da etkin profil) değişir; diğerleri kendiliğinden izler.
 *
 * Durum etiketleri (inceleme raporu §02):
 *   RAPOR    Kullanıcının Rev A raporunda açıkça seçilmiş karar; gerekçesiz değiştirilmez.
 *   ACIK     Henüz belli olmayan bağlantı / değer / üretici verisi. value = null.
 *   DENEYSEL Açık bir karar için deneysel profilin seçtiği değer. Rev A kararı DEĞİLDİR.
 *   ONERI    İnceleme raporunun önerisi; otomatik proje kararı sayılmaz.
 *
 * Referans adları (R1, C1 …) SİMÜLATÖR referanslarıdır; nihai şema numarası değildir.
 * Raporun kendi adları (C3, C4, C5) korunmuştur; diğerleri "rapor" alanında eşlenir.
 * Kaynak kısaltmaları: P1 = 5F1_Modifiye_Proje_Raporu.pdf, IR = inceleme ve tedarik raporu.
 */
(function (root) {
  'use strict';

  const REVISION = { id: 'Rev A', date: '01.10.2026', schema: 1, title: '5F1 TABANLI MODİFİYE TÜPLÜ GİTAR AMFİSİ' };

  // id, tip, işlev, düğümler, değer (SI), birim, + ek alanlar
  const c = (id, type, fn, nodes, value, unit, x) => Object.assign({ id, type, fn, nodes, value, unit, tol: null, rating: {}, status: 'RAPOR', stock: null, src: '', rapor: null, note: '', supply: [], group: '' }, x);

  const COMPONENTS = [
    // --- Şebeke ve besleme --------------------------------------------------------
    c('F1', 'MECH', 'Şebeke sigortası + yuva', [], null, 'A', { status: 'ACIK', stock: 'ŞARTNAME BEKLİYOR', src: 'P1 s.4, s.12', group: 'Şebeke', supply: ['S10'], decision: 'K-13',
      note: '250 V sınıfı. Değer PT\'nin VA ve inrush verisinden sonra seçilir; 120 V 5F1 değeri kopyalanmaz.' }),
    c('S5', 'MECH', 'Neon ışıklı güç anahtarı', [], null, '', { stock: 'SATIN AL', src: 'P1 s.4', group: 'Şebeke', supply: ['S8'], spec: '230–250 VAC, DPST hedef',
      note: 'Işık uçları ve şebeke kontakları belgeli olmalı. PE hiçbir anahtar / sigortadan geçmez.' }),
    c('T1', 'PT', 'Güç trafosu', ['HA', 'HB', 'GND'], null, '', { stock: 'ÖZEL SARIM', src: 'P1 s.3; IR §24', group: 'Trafolar', supply: ['S1'], decision: 'K-08',
      spec: '230 VAC 50 Hz → 320-0-320 VAC (orta uçlu, ~70 mA) · 5 VAC / 2 A ayrı · 6,3 VAC / 1,5 A',
      note: 'Yüklü / yüksüz gerilim, sargı DCR, regülasyon ve "70 mA"nın tanımı üreticiden yazılı alınmalı. Model bu veriler yerine deneysel profil varsayımı kullanır.' }),
    c('V3', 'RECT', 'Doğrultucu', ['HA', 'HB', 'B1'], null, '', { stock: 'ELDE', src: 'P1 s.3', group: 'Tüpler', model: '5Y3-child', decision: 'K-02', spec: '5Y3GT',
      pins: 'Pin 4 ve 6: HV AC plakalar · Pin 2 ve 8: 5 V filaman; B+ filaman / katot tarafından (pin 8) alınır',
      note: 'Üretici / varyant kaydedilmedi. Genel model kullanılır.' }),
    c('C3', 'C', 'İlk filtre (reservoir)', ['B1', 'GND'], 16e-6, 'F', { rating: { V: 500 }, stock: 'SATIN AL', src: 'P1 s.4', rapor: 'C3', group: 'Besleme filtresi', supply: ['S2'], decision: 'K-10', polar: true,
      note: 'Türkiye içinde radial 16 µF / 500 V doğrulanamadı; S2 adayı axial. Eldeki 22 µF / 450 V final tercih değildir (yedek).' }),
    c('R10', 'R', 'B+1 → B+2 düşürme', ['B1', 'B2'], 10e3, 'Ω', { rating: { W: 2 }, stock: 'ELDE', src: 'P1 s.4, s.11', group: 'Besleme filtresi', decision: 'K-01' }),
    c('C4', 'C', 'Screen filtresi', ['B2', 'GND'], 10e-6, 'F', { rating: { V: 450 }, stock: 'ELDE', src: 'P1 s.4', rapor: 'C4', group: 'Besleme filtresi', decision: 'K-10', polar: true,
      note: 'ELDE / KOŞULLU: yüksüz ve açılış tepe gerilimi incelenmeden güvenli sayılmaz.' }),
    c('R11', 'R', 'B+2 → B+3 düşürme', ['B2', 'B3'], 22e3, 'Ω', { rating: { W: 2 }, stock: 'ELDE', src: 'P1 s.11', group: 'Besleme filtresi', decision: 'K-01',
      note: 'NFB direnci R12 ile aynı değerde ama farklı işlevde; ayrı BOM satırı.' }),
    c('C5', 'C', 'Ön yükselteç filtresi', ['B3', 'GND'], 10e-6, 'F', { rating: { V: 450 }, stock: 'ELDE', src: 'P1 s.4', rapor: 'C5', group: 'Besleme filtresi', decision: 'K-10', polar: true,
      note: 'ELDE / KOŞULLU: ısınma sırasında B+1\'e yaklaşır.' }),
    c('R16', 'R', 'Bleeder (opsiyonel)', ['B1', 'GND'], null, 'Ω', { status: 'ACIK', stock: 'OPSİYONEL', src: 'P1 s.12', group: 'Besleme filtresi', decision: 'K-12', optional: true, candidates: [220e3, 470e3],
      note: 'Rev A\'da yok. PCB finalinde değerlendirilecek. Takılırsa sürekli yük ve boşalma modeli değişir.' }),
    c('R14', 'MECH', 'Yapay heater orta ucu (koşullu)', [], 100, 'Ω', { status: 'ACIK', stock: 'KOŞULLU', src: 'P1 s.4', group: 'Heater', qty: 2, decision: 'K-11',
      note: 'Yalnız 6,3 V sargıda fiziksel orta uç yoksa: 2 × ~100 Ω. Güç ve arıza koşulu ayrıca seçilir. Elektrik modeline girmez.' }),

    // --- Giriş --------------------------------------------------------------------
    c('J1', 'MECH', 'Giriş jakı', [], null, '', { stock: 'SATIN AL', src: 'P1 s.5', group: 'Bağlantı', supply: ['S9'], spec: '6,35 mm mono; kısa devreli kontak seçeneği' }),
    c('S1', 'SW', 'High / Low seçici', [], null, '', { stock: 'SATIN AL', src: 'P1 s.5', group: 'Anahtarlar', supply: ['S7'], spec: 'DPDT ON-ON mini toggle',
      note: 'Gerçek kontak diyagramı ve geçiş anındaki DC referansı parça elde edilince doğrulanır.' }),
    c('R1', 'R', 'Grid stopper / Low bölücü üst', ['IN', 'G1'], 68e3, 'Ω', { stock: 'ELDE', src: 'P1 s.5', group: 'Giriş' }),
    c('R2', 'R', 'Grid stopper / Low bölücü alt', ['S1A', 'G1'], 68e3, 'Ω', { stock: 'ELDE', src: 'P1 s.5', group: 'Giriş',
      note: 'High: R1 ile paralel (≈ 34 kΩ). Low: G1 ile toprak arasında (bölücü).' }),
    c('R3', 'R', 'High giriş referansı', ['S1B', 'GND'], 1e6, 'Ω', { stock: 'ELDE', src: 'P1 s.5', group: 'Giriş', note: 'DPDT\'nin ikinci kutbu High\'da devreye alır, Low\'da çıkarır.' }),

    // --- V1A ----------------------------------------------------------------------
    c('V1A', 'TRIODE', 'Giriş katı (12AX7 1. yarı)', ['PA', 'G1', 'KA'], null, '', { stock: 'ELDE', src: 'P1 s.3', group: 'Tüpler', model: '12AX7-koren', decision: 'K-02', spec: '12AX7 / ECC83',
      pins: 'Pin 1 plaka · Pin 2 grid · Pin 3 katot · Heater 4+5 / 9 (6,3 V)' }),
    c('R4', 'R', 'V1A anodik yük', ['B3', 'PA'], 100e3, 'Ω', { stock: 'ELDE', src: 'P1 s.6', group: 'Sinyal katları' }),
    c('R5', 'R', 'V1A katot', ['KA', 'GND'], 1.5e3, 'Ω', { stock: 'ELDE', src: 'P1 s.6', group: 'Sinyal katları' }),
    c('C7', 'C', 'V1A katot bypass (tanımsız)', ['KA', 'GND'], null, 'F', { status: 'ACIK', stock: null, src: 'IR §8', group: 'Sinyal katları', decision: 'K-03', optional: true, candidates: [25e-6, 22e-6], polar: true, rating: { V: 25 },
      note: 'Raporda tanımlı değil. Başka bir 5F1 çiziminden 25 µF kopyalamak onaylı karar sayılmaz.' }),
    c('C1', 'C', 'V1A → ton / volume kuplaj', ['PA', 'CO1'], 22e-9, 'F', { rating: { V: 630 }, stock: 'SATIN AL', src: 'P1 s.6, s.10', group: 'Sinyal katları', supply: ['S3', 'S4'],
      note: 'Film. Eldeki 27 nF / 400 V final yerine otomatik kullanılmaz (yedek / deneysel).' }),

    // --- Ton ağı (TMB) ve EQ/RAW ---------------------------------------------------
    c('S2', 'SW', 'EQ / RAW seçici', [], null, '', { status: 'ACIK', stock: 'ŞARTNAME BEKLİYOR', src: 'P1 s.7', group: 'Anahtarlar', supply: ['S7'], decision: 'K-06',
      note: 'Kutup sayısı bypass topolojisinden sonra belli olur; şimdiden SPST varsayılmaz.' }),
    c('C8', 'C', 'TMB treble kapasitörü', ['TSI', 'TT'], null, 'F', { status: 'ACIK', src: 'P1 s.6', group: 'Ton ağı', decision: 'K-05', candidates: [250e-12, 330e-12, 470e-12], rating: { V: 630 } }),
    c('R13', 'R', 'TMB slope direnci', ['TSI', 'SJ'], null, 'Ω', { status: 'ACIK', src: 'P1 s.6', group: 'Ton ağı', decision: 'K-05', candidates: [56e3, 68e3, 100e3] }),
    c('C9', 'C', 'TMB bass kapasitörü', ['SJ', 'TB'], null, 'F', { status: 'ACIK', src: 'P1 s.6', group: 'Ton ağı', decision: 'K-05', candidates: [20e-9, 22e-9], rating: { V: 630 } }),
    c('C10', 'C', 'TMB mid kapasitörü', ['SJ', 'MT'], null, 'F', { status: 'ACIK', src: 'P1 s.6', group: 'Ton ağı', decision: 'K-05', candidates: [20e-9, 22e-9], rating: { V: 630 } }),
    c('VR2', 'POT', 'Treble potu', ['TT', 'TW', 'TB'], null, 'Ω', { status: 'ACIK', stock: 'SATIN AL', src: 'P1 s.6', group: 'Ton ağı', supply: ['S6'], decision: 'K-05', candidates: [250e3], ctl: 'TREBLE' }),
    c('VR3', 'POT', 'Bass potu (reosta)', ['MT', 'MT', 'TB'], null, 'Ω', { status: 'ACIK', stock: 'SATIN AL', src: 'P1 s.6', group: 'Ton ağı', supply: ['S6'], decision: 'K-05', candidates: [1e6], ctl: 'BASS' }),
    c('VR4', 'POT', 'Mid potu (reosta)', ['MT', 'MT', 'GND'], null, 'Ω', { status: 'ACIK', stock: 'SATIN AL', src: 'P1 s.6', group: 'Ton ağı', supply: ['S6'], decision: 'K-05', candidates: [25e3], ctl: 'MID' }),

    // --- Volume ve voicing ---------------------------------------------------------
    c('VR1', 'POT', 'Volume potu', ['VT', 'G2', 'GND'], 1e6, 'Ω', { stock: 'ELDE', src: 'P1 s.6', group: 'Volume / voicing', decision: 'K-14', ctl: 'VOLUME', taper: 'lin',
      note: 'GEÇİCİ: eldeki 1 MΩ lineer. İleride 1 MΩ log / audio ayrı karar.' }),
    c('S3', 'SW', 'Bright anahtarı', [], null, '', { stock: 'SATIN AL', src: 'P1 s.7', group: 'Anahtarlar', supply: ['S7'], spec: 'Tutmalı ON/OFF (SPST)' }),
    c('C11', 'C', 'Bright kapasitörü', ['S3X', 'G2'], null, 'F', { status: 'ACIK', src: 'P1 s.7', group: 'Volume / voicing', decision: 'K-07', candidates: [100e-12, 220e-12], rating: { V: 630 },
      note: 'Volume potunun giriş – wiper uçları arasında.' }),
    c('S4', 'SW', 'Dark anahtarı', [], null, '', { stock: 'SATIN AL', src: 'P1 s.7', group: 'Anahtarlar', supply: ['S7'], spec: 'Tutmalı ON/OFF (SPST)' }),
    c('C12', 'C', 'Dark kapasitörü', ['S4X', 'GND'], null, 'F', { status: 'ACIK', src: 'P1 s.7', group: 'Volume / voicing', decision: 'K-07', candidates: [470e-12, 1e-9, 2.2e-9], rating: { V: 630 },
      note: 'V1B giriş bölgesinden toprağa.' }),

    // --- V1B ve güç katı -----------------------------------------------------------
    c('V1B', 'TRIODE', 'Sürücü katı (12AX7 2. yarı)', ['PB', 'G2', 'KB'], null, '', { stock: 'ELDE', src: 'P1 s.3', group: 'Tüpler', model: '12AX7-koren', decision: 'K-02', spec: '12AX7 / ECC83', sameAs: 'V1A',
      pins: 'Pin 6 plaka · Pin 7 grid · Pin 8 katot' }),
    c('R6', 'R', 'V1B anodik yük', ['B3', 'PB'], 100e3, 'Ω', { stock: 'ELDE', src: 'P1 s.6', group: 'Sinyal katları' }),
    c('R7', 'R', 'V1B katot / NFB düğümü', ['KB', 'GND'], 1.5e3, 'Ω', { stock: 'ELDE', src: 'P1 s.6', group: 'Sinyal katları', decision: 'K-04',
      note: 'Rapor: "≈1,5k mimarisi". Bypass\'sız kabul edilmiştir (geri besleme düğümü).' }),
    c('R12', 'R', 'Negatif geri besleme', ['S4', 'KB'], 22e3, 'Ω', { stock: 'ELDE', src: 'P1 s.8', group: 'Sinyal katları', decision: 'K-04',
      note: 'Sabit 4 Ω tapından V1B katoduna. Kabin 8 / 16 Ω jaka taşınınca kaynak tapı değişmez.' }),
    c('C2', 'C', 'V1B → 6V6 kuplaj', ['PB', 'G6'], 22e-9, 'F', { rating: { V: 630 }, stock: 'SATIN AL', src: 'P1 s.6, s.10', group: 'Sinyal katları', supply: ['S3', 'S4'] }),
    c('R8', 'R', '6V6 grid leak', ['G6', 'GND'], 220e3, 'Ω', { stock: 'ELDE', src: 'P1 s.6', group: 'Sinyal katları' }),
    c('V2', 'PENTODE', 'Güç tüpü', ['A6', 'B2', 'G6', 'K6'], null, '', { stock: 'ELDE', src: 'P1 s.3', group: 'Tüpler', model: '6V6-koren', decision: 'K-02', spec: '6V6GT',
      pins: 'Pin 2/7 heater · Pin 3 plaka · Pin 4 screen · Pin 5 kontrol gridi · Pin 8 katot',
      note: 'Screen doğrudan B+2\'ye: raporda screen direnci ve grid stopper tanımlı değil (K-15).' }),
    c('R9', 'R', '6V6 katot (cathode bias)', ['K6', 'GND'], 470, 'Ω', { rating: { W: 5 }, stock: 'ELDE', src: 'P1 s.5–6', group: 'Sinyal katları', note: 'Karttan birkaç mm yükseltilerek monte edilir.' }),
    c('C6', 'C', '6V6 katot bypass', ['K6', 'GND'], 22e-6, 'F', { rating: { V: 50 }, stock: 'ELDE', src: 'P1 s.4', group: 'Sinyal katları', polar: true, note: '25 µF yerine 22 µF. Polarite, ESR ve gerçek katot gerilimi kontrol edilir.' }),
    c('T2', 'OT', 'Çıkış trafosu', ['B1', 'A6', 'S4', 'S8', 'S16'], null, '', { stock: 'ÖZEL SARIM', src: 'P1 s.7–8; IR §24', group: 'Trafolar', supply: ['S1'], decision: 'K-09',
      spec: 'Single-ended, tek 6V6GT · 8 kΩ primer · COM + 4 / 8 / 16 Ω · air-gap\'li · ≥ 40 mA DC (tercihen ~50 mA)',
      note: '8 kΩ primerin DC direnci değil, yansıtılmış AC yüktür. Push-pull trafo ve 3,2 Ω taplı muadil kabul edilmez.' }),
    c('J2', 'JACK', '4 Ω hoparlör çıkışı', ['S4'], 4, 'Ω', { stock: 'SATIN AL', src: 'P1 s.8', group: 'Bağlantı', supply: ['S9'], spec: '6,35 mm mono; kısa devre kontaksız' }),
    c('J3', 'JACK', '8 Ω hoparlör çıkışı', ['S8'], 8, 'Ω', { stock: 'SATIN AL', src: 'P1 s.8', group: 'Bağlantı', supply: ['S9'], spec: '6,35 mm mono; kısa devre kontaksız' }),
    c('J4', 'JACK', '16 Ω hoparlör çıkışı', ['S16'], 16, 'Ω', { stock: 'SATIN AL', src: 'P1 s.8', group: 'Bağlantı', supply: ['S9'], spec: '6,35 mm mono; kısa devre kontaksız',
      note: 'Boş tapları toprağa kapatan shorting jak YANLIŞ olur.' }),
  ];

  /** Anahtarlar: her konum, hangi düğümlerin birleştiğini söyler. */
  const SWITCHES = {
    S1: { label: 'Giriş', positions: ['HIGH', 'LOW'], join: { HIGH: [['S1A', 'IN'], ['S1B', 'IN']], LOW: [['S1A', 'GND']] } },
    S2: { label: 'Ton', positions: ['EQ', 'RAW'], join: { EQ: [['TSI', 'CO1'], ['VT', 'TW']], RAW: [['VT', 'CO1']], 'RAW:tap': [['TSI', 'CO1'], ['VT', 'CO1']] } },
    S3: { label: 'Bright', positions: ['OFF', 'ON'], join: { OFF: [], ON: [['S3X', 'VT']] } },
    S4: { label: 'Dark', positions: ['OFF', 'ON'], join: { OFF: [], ON: [['S4X', 'G2']] } },
  };

  // --- Karar günlüğü -----------------------------------------------------------------
  const DECISIONS = [
    { id: 'K-01', pri: 'P0', title: 'B+ filtre zinciri', state: 'ONAY BEKLİYOR', parts: ['R10', 'R11', 'C3', 'C4', 'C5'],
      open: 'P1 s.4\'teki çizimde 22 kΩ kolunun başlangıcı belirsiz (B+1\'den ayrı kol gibi); s.11\'de seri zincir açık.',
      sim: 'Seri zincir: B+1 → 10 kΩ / 2 W → B+2 → 22 kΩ / 2 W → B+3. B+1: OT / güç katı, B+2: screen, B+3: 12AX7 anodik yükleri.',
      close: 'Kullanıcı onayı ve tek şemaya aktarım.', src: 'P1 s.4, s.11; IR §6.1' },
    { id: 'K-02', pri: 'P0', title: 'Tüp kimlikleri ve çalışma noktası', state: 'AÇIK', parts: ['V1A', 'V1B', 'V2', 'V3'],
      open: 'Eldeki 12AX7, 6V6GT ve 5Y3GT\'nin üreticisi, tam tipi ve veri sayfası kayıtlı değil.',
      sim: 'Genel Koren / Child modelleri. Sınır değerleri "veri eksik"; JJ değerleri yalnız referans olarak gösterilir.',
      close: 'Tüplerin fotoğrafı ve veri sayfası kaydı; model kartlarının güncellenmesi.', src: 'P1 s.3; IR §7' },
    { id: 'K-03', pri: 'P0', title: 'V1A katot bypass', state: 'AÇIK', parts: ['C7'],
      open: 'Raporda V1A katodu yalnız 1,5 kΩ; bypass kondansatörü tanımlı değil.',
      sim: 'Takılı değil (rapordaki tanım). 25 µF varyantı ayrı senaryo olarak denenebilir.',
      close: 'Kazanç hedefine göre karar; seçilirse değer ve gerilim sınıfı.', src: 'P1 s.6; IR §8' },
    { id: 'K-04', pri: 'P0', title: 'V1B katot / NFB düğümü', state: 'AÇIK', parts: ['R7', 'R12'],
      open: 'Rapor "cathode / NFB node ~1.5k architecture" diyor; düğüm ayrıntısı çizilmemiş.',
      sim: 'Bypass\'sız 1,5 kΩ katot direnci; 22 kΩ, 4 Ω tapından katoda (özgün 5F1 düzeni).',
      close: 'Nihai şemada düğümün çizilmesi; NFB polaritesinin OT faz işaretleriyle doğrulanması.', src: 'P1 s.6, s.8, s.11' },
    { id: 'K-05', pri: 'P0', title: 'TMB topolojisi ve değerleri', state: 'AÇIK', parts: ['C8', 'R13', 'C9', 'C10', 'VR2', 'VR3', 'VR4'],
      open: 'Yalnız aday aralıklar var: Treble 250 kΩ lin, Bass 1 MΩ, Mid 25 kΩ; 250–500 pF, 20–22 nF, 56–100 kΩ. Bağlantı, pot yönleri ve taper tanımsız.',
      sim: 'Anodik çıkıştan sürülen klasik FMV dizilimi; 250 pF / 22 nF / 22 nF / 56 kΩ; Bass log, diğerleri lin.',
      close: 'Plate-driven simülasyon + dinleme; değerler seçilince PCB footprint.', src: 'P1 s.6–7; IR §8.2' },
    { id: 'K-06', pri: 'P0', title: 'EQ / RAW anahtarlama yöntemi', state: 'AÇIK', parts: ['S2'],
      open: 'Kesin bypass yöntemi final şemada belirlenecek.',
      sim: 'DPDT: RAW\'da ton ağının girişi kuplaj düğümünden ayrılır, volume potu doğrudan C1\'e bağlanır ("lift"). Karşılaştırma seçeneği: ağ yük olarak kalır ("tap").',
      close: 'Topoloji seçimi, kutup sayısı, geçiş anındaki DC referansı.', src: 'P1 s.7; IR §8.2' },
    { id: 'K-07', pri: 'P1', title: 'Bright / Dark kapasitör değerleri', state: 'AÇIK', parts: ['C11', 'C12'],
      open: 'Bright 100–220 pF, Dark 470 pF / 1 nF / 2,2 nF deneme alanı.',
      sim: 'Bright 100 pF, Dark 1 nF.', close: 'Gerçek pot + hoparlör ile dinleme.', src: 'P1 s.7, s.12' },
    { id: 'K-08', pri: 'P0', title: 'Güç trafosu verisi', state: 'AÇIK', parts: ['T1'],
      open: 'Yüklü / yüksüz gerilim, sargı DCR, regülasyon ve "70 mA"nın (AC sargı akımı mı, DC yük mü) tanımı yok.',
      sim: '320 VAC yüksüz EMK kabul edilir; plaka başına etkin kaynak direnci 200 Ω.',
      close: 'Bobinajcıdan yazılı veri (IR §24).', src: 'P1 s.3; IR §6.3, §24' },
    { id: 'K-09', pri: 'P1', title: 'Çıkış trafosu verisi', state: 'AÇIK', parts: ['T2'],
      open: 'Primer DCR, endüktans, kaçak endüktans, faz işaretleri ve DC kapasitesi bilinmiyor.',
      sim: 'Primer DCR 300 Ω, Lp 15 H, kaçak 30 mH, sekonder bölüm DCR 0,30 / 0,15 / 0,25 Ω. Nüve doyumu modellenmez.',
      close: 'Bobinajcıdan yazılı veri; faz işaretleri ve kablo renkleri.', src: 'P1 s.7–8; IR §9, §24' },
    { id: 'K-10', pri: 'P0', title: 'C3 / C4 / C5 gerilim marjı', state: 'KOŞULLU', parts: ['C3', 'C4', 'C5'],
      open: '16 µF / 500 V ve eldeki 10 µF / 450 V parçalar; yüksüz ve ısınma geçişinde tepe gerilim incelenmedi.',
      sim: 'Soğuk açılış senaryosu tepe değerleri kaydeder ve nominal gerilimle karşılaştırır. Sonuç model tahminidir.',
      close: 'İlk testte yüksüz ve ısınma B+ tepe ölçümü; satın alma ön koşulu.', src: 'P1 s.4, s.12; IR §6.2' },
    { id: 'K-11', pri: 'P1', title: 'Heater orta ucu', state: 'AÇIK', parts: ['R14'],
      open: 'Fiziksel 6,3 V orta uç ya da 2 × 100 Ω yapay orta uç.', sim: 'Elektrik modeline girmez; ikisi aynı anda eklenmez.',
      close: 'PT teklifine göre.', src: 'P1 s.4; IR §7.3' },
    { id: 'K-12', pri: 'P1', title: 'Bleeder ağı', state: 'AÇIK', parts: ['R16'],
      open: 'Rev A\'da yok; PCB finalinde değerlendirilecek.', sim: 'Takılı değil. 220 kΩ varyantı senaryo olarak denenebilir.',
      close: 'Değer, güç ve sürekli yük etkisiyle karar.', src: 'P1 s.12' },
    { id: 'K-13', pri: 'P1', title: 'Şebeke sigortası', state: 'AÇIK', parts: ['F1'],
      open: 'PT VA ve inrush verisi olmadan seçilemez.', sim: 'Modelde yok.', close: 'PT verisinden sonra 250 V sigorta seçimi.', src: 'P1 s.4, s.12' },
    { id: 'K-14', pri: 'P2', title: 'Volume taper', state: 'GEÇİCİ', parts: ['VR1'],
      open: 'Eldeki 1 MΩ lineer pot ilk prototipte kullanılacak.', sim: 'Lineer. Log profil karşılaştırma için seçilebilir.',
      close: 'İleride 1 MΩ log / audio.', src: 'P1 s.6' },
    { id: 'K-15', pri: 'P2', title: 'Screen direnci ve 6V6 grid stopper', state: 'TANIMSIZ', parts: ['V2'],
      open: 'Raporda kesin değerli parça olarak yok.', sim: 'Eklenmedi: screen doğrudan B+2, grid doğrudan C2 / R8 düğümü.',
      close: 'Gerekçeli tasarım kararı verilirse eklenir.', src: 'IR §20' },
    { id: 'K-16', pri: 'P1', title: 'Hoparlör ve giriş kaynağı modeli', state: 'AÇIK', parts: ['J2', 'J3', 'J4'],
      open: 'Otomobil hoparlörünün empedans eğrisi, T/S ve hassasiyeti bilinmiyor.',
      sim: 'Omik yük direnci (dummy load). Giriş: ideal kaynak ya da temsili manyetik + kablo.',
      close: 'Hoparlör ölçümü; SPL / kabin tonu iddiası yapılmaz.', src: 'P1 s.9; IR §10' },
  ];

  /**
   * Deneysel profil: açık kararlar için İLK DENEY değerleri. Rev A'nın kesin kararı değildir.
   * Her değer kendi kaynağını ve gerekçesini taşır.
   */
  const PROFILE_DEFAULT = {
    id: 'DENEYSEL-01', schema: 1, base: 'Rev A', approved: false,
    name: 'RAW / NORMAL başlangıç profili',
    why: 'Açık kararlar kapanana kadar simülasyonun çalışabilmesi için seçilen ilk deney değerleri.',
    values: { C8: 250e-12, R13: 56e3, C9: 22e-9, C10: 22e-9, VR2: 250e3, VR3: 1e6, VR4: 25e3, C11: 100e-12, C12: 1e-9, R16: 220e3, C7: 25e-6 },
    fitted: { C7: false, R16: false },
    tapers: { VR1: 'lin', VR2: 'lin', VR3: 'log', VR4: 'lin' },
    rawMethod: 'lift',
    T1: { vSec: 320, rt: 200, noLoadRisePct: 0, mainsNom: 230, freq: 50 },
    T2: { zp: 8000, rp: 300, lp: 15, lleak: 0.03, rs: [0.30, 0.15, 0.25] },
    models: { V1A: '12AX7-koren', V1B: '12AX7-koren', V2: '6V6-koren', V3: '5Y3-child' },
    reasons: {
      C8: 'P1 aday aralığının alt ucu (250–500 pF).', R13: 'P1 aday aralığının alt ucu (56–100 kΩ).',
      C9: 'P1 aday sınıfı (20–22 nF); kuplaj kapasitörüyle aynı değer.', C10: 'P1 aday sınıfı (20–22 nF).',
      VR2: 'P1 başlangıç referansı.', VR3: 'P1 başlangıç referansı; taper tanımsız, log seçildi.', VR4: 'P1 başlangıç referansı.',
      C11: 'P1 aday aralığının alt ucu (100–220 pF).', C12: 'P1 deneme değerlerinin ortası (470 pF / 1 nF / 2,2 nF).',
      T1: 'Üretici verisi yok. Rt = 200 Ω küçük bir 320-0-320 V sargı için temsili etkin kaynak direncidir.',
      T2: 'Üretici verisi yok. P1: "primer DCR birkaç yüz ohm mertebesinde olabilir".',
    },
  };

  // --- Tedarik kaynakları (inceleme raporu §22–23, §27; kontrol tarihi 01.10.2026) ----
  const SUPPLIERS = {
    S1: { name: 'Ekol Trafo', what: 'Özel sarım PT ve SE çıkış trafosu', url: 'https://www.ekoltrafo.com/lambali.html', country: 'TR', kind: 'üretici', note: 'Yazılı teklif alınmalı; uygunluk henüz onaylı değil. Sipariş verilmedi.' },
    S2: { name: 'Tube Amp Doctor · Jupiter V-JC16500', what: '16 µF / 500 V', url: 'https://www.tubeampdoctor.com/en/jupiter-cosmos-wet-electrolytic-capacitors-16uf-500v', country: 'DE', kind: 'ürün', note: 'Axial; radial PCB\'ye doğrudan muadil değil. Isı / ripple / ölçü ve Türkiye teslimatı doğrulanmalı.' },
    S3: { name: 'Direnç.net', what: '22 nF / 630 V %5', url: 'https://www.direnc.net/22nf-630v-5-damla-tipi-polyester-kondansator-7', country: 'TR', kind: 'ürün', note: 'Başlık 7,5 mm; ölçü alanı karışık. Footprint gerçek parçayla seçilmeli.' },
    S4: { name: 'Motorobit', what: '22 nF / 630 V, 15 mm', url: 'https://www.motorobit.com/22nf-630v-15mm-polyester-kondansator', country: 'TR', kind: 'ürün', note: 'Alternatif fiziksel paket; stok / üretici / ölçü teyidi gerekli.' },
    S5: { name: 'Tube Amp Doctor · Belton VTB9-ST-1 / S8M-1', what: '1 noval + 2 octal soket', url: 'https://www.tubeampdoctor.com/en/belton-vtb9-st-1-noval-9-pin-socket-gold-plated-solder-lugs', url2: 'https://www.tubeampdoctor.com/en/octal-socket-micalex-solder-lugs-one-piece-with-m3-thread', country: 'DE', kind: 'ürün', note: 'Şasi montaj, lehim kulaklı. Octal sayfada malzeme alanı tutarsız; satıcıdan teyit.' },
    S6: { name: 'TAD Pots & Knobs', what: 'TMB potları, log volume, düğmeler', url: 'https://www.tubeampdoctor.com/en/parts-for-amplifiers/passive-components/pots-knobs/', country: 'DE', kind: 'kategori', note: 'Ohm, lin/log, mil / diş ölçüsü; "A/B" harfinden taper çıkarılmaz.' },
    S7: { name: 'Direnç.net Toggle Switch', what: 'Hi/Low, RAW, voicing anahtarları', url: 'https://www.direnc.net/toggle-switch', country: 'TR', kind: 'kategori', note: 'Kutup sayısı, ON-ON / ON-OFF, gerçek uç haritası.' },
    S8: { name: 'Direnç.net Rocker Switch', what: 'Neon güç anahtarı', url: 'https://www.direnc.net/rocker-switch', country: 'TR', kind: 'kategori', note: 'DPST, şebeke AC gerilimi, akım ve onay bilgisi.' },
    S9: { name: 'Direnç.net Stereo / Mono Jak', what: 'Giriş, üç çıkış ve kabin jakı', url: 'https://www.direnc.net/stereo-mono-jak', country: 'TR', kind: 'kategori', note: 'Mono tip, panel izolasyonu, shorting kontağının gerçek işlevi.' },
    S10: { name: 'TAD Fuses + Holder', what: 'Sigorta / yuva', url: 'https://www.tubeampdoctor.com/en/parts-for-amplifiers/amp-parts/fuses-holder/', country: 'DE', kind: 'kategori', note: '250 V sınıfı; akım PT\'ye göre.' },
    S11: { name: 'TAD Wire & Cable', what: 'İç bağlantı ve kablolar', url: 'https://www.tubeampdoctor.com/en/parts-for-amplifiers/cables-jacks-plugs/wire-stranded-wire-cable/', country: 'DE', kind: 'kategori', note: 'İzolasyon gerilimi / sıcaklık sınıfı ayrıca kontrol edilir.' },
    S12: { name: 'Direnç.net Epoxy Plaket', what: 'PCB ham levhası', url: 'https://www.direnc.net/epoxy-plaketler', country: 'TR', kind: 'kategori', note: 'Tek yüz, FR-4 teyidi; delikli pertinaksla karıştırılmaz.' },
    S13: { name: 'TAD Resistors', what: 'Direnç ve güç direnci alternatifleri', url: 'https://www.tubeampdoctor.com/en/parts-for-amplifiers/passive-components/resistors/', country: 'DE', kind: 'kategori', note: 'Dummy load için endüktans / soğutma bilgisi gerekir.' },
    S14: { name: 'TAD Jensen', what: 'Gitar hoparlörü alternatifi', url: 'https://www.tubeampdoctor.com/en/speakers-cabinets-more/speakers/jensen-guitar-bass/', country: 'DE', kind: 'kategori', note: 'Yalnız alternatif; otomobil hoparlörü kararı değişmez.' },
  };
  const SUPPLY_CHECKED = '01.10.2026';

  /** Elektrik modeline girmeyen, yalnız malzeme listesinde yer alan kalemler. */
  const BOM_EXTRA = [
    { ref: '—', fn: 'Tüp soketleri', spec: '1 noval + 2 octal; şasi montaj, lehim kulaklı (PCB soketi değil)', qty: 3, stock: 'SATIN AL', supply: ['S5'], src: 'P1 s.8; IR §21', group: 'Bağlantı' },
    { ref: '—', fn: 'Pot düğmeleri', spec: 'Mil tipi, çapı ve panel aralığıyla uyumlu', qty: 4, stock: 'SATIN AL', supply: ['S6'], src: 'IR §21', group: 'Mekanik' },
    { ref: '—', fn: 'Kabin jakı + hoparlör kablosu', spec: 'Ayrı kabin için; enstrüman kablosuyla karıştırılmaz', qty: 1, stock: 'SATIN AL', supply: ['S9', 'S11'], src: 'IR §21', group: 'Bağlantı' },
    { ref: '—', fn: 'Şebeke girişi ve kablo', spec: 'IEC ya da seçili giriş yöntemi', qty: 1, stock: 'SATIN AL', supply: ['S10', 'S11'], src: 'IR §21', group: 'Şebeke' },
    { ref: '—', fn: 'PE bağlantı donanımı', spec: 'Bağımsız şasi cıvatası, terminal, kilitleme', qty: 1, stock: 'SATIN AL', supply: [], src: 'P1 s.9, s.12', group: 'Şebeke' },
    { ref: '—', fn: 'Tek yüz FR-4 bakır levha', spec: 'Spacer / vida / test noktalarıyla', qty: 1, stock: 'SATIN AL', supply: ['S12'], src: 'P1 s.8', group: 'Mekanik' },
    { ref: '—', fn: 'İç bağlantı kabloları', spec: 'HV sınıfı kablo, heater çifti (twisted), ekranlı sinyal kablosu, makaron', qty: 1, stock: 'SATIN AL', supply: ['S11'], src: 'P1 s.8–9', group: 'Mekanik' },
    { ref: '—', fn: 'Metal şasi', spec: 'Büküm sac; ölçü trafo boyutlarından sonra', qty: 1, stock: 'YEREL TEKLİF', supply: [], src: 'P1 s.9', group: 'Mekanik' },
    { ref: '—', fn: '3B baskı açık arkalı kabin', spec: '4–6 mm duvar, kaburgalı; ölçü hoparlörden sonra', qty: 1, stock: 'YEREL TEKLİF', supply: [], src: 'P1 s.10', group: 'Mekanik' },
    { ref: 'LS1', fn: 'Prototip hoparlör', spec: '4 Ω tercih; 6,5 ya da 8 inç; midbass / full-range; ≥ 10 W', qty: 1, stock: 'YEREL TEKLİF', supply: ['S14'], src: 'P1 s.9–10', group: 'Mekanik' },
    { ref: '—', fn: 'Dummy load (test)', spec: 'Örn. ≥ 20 W yük direnci; soğutma koşulu veri sayfasından', qty: 1, stock: 'TEST EKİPMANI', supply: ['S13'], src: 'IR §21', group: 'Test' },
    { ref: '—', fn: 'Yedek: 22 µF / 450 V', spec: 'İlk filtre için final tercih değil', qty: 1, stock: 'ELDE (YEDEK)', supply: [], src: 'P1 s.10', group: 'Yedek / deneysel' },
    { ref: '—', fn: 'Yedek: 27 nF / 400 V film', spec: 'Final 22 nF / 630 V yerine otomatik kullanılmaz', qty: 2, stock: 'ELDE (YEDEK)', supply: [], src: 'P1 s.10', group: 'Yedek / deneysel' },
  ];

  const BY_ID = {}; COMPONENTS.forEach(x => { BY_ID[x.id] = x; });

  // --- Profil yardımcıları -----------------------------------------------------------
  function cloneProfile(p) { return JSON.parse(JSON.stringify(p || PROFILE_DEFAULT)); }

  /** Etkin değer: kesin değer, yoksa profil değeri. Kaynağıyla birlikte döner. */
  function resolve(id, profile) {
    const comp = BY_ID[id];
    if (!comp) throw new Error(`Bilinmeyen bileşen: ${id}`);
    const pv = profile && profile.values ? profile.values[id] : undefined;
    const override = profile && profile.overrides ? profile.overrides[id] : undefined;
    if (override != null) return { value: override, status: 'DENEYSEL', from: 'kullanıcı değişikliği' };
    if (comp.value != null) return { value: comp.value, status: comp.status, from: comp.src };
    if (pv != null) return { value: pv, status: 'DENEYSEL', from: `profil ${profile.id}` };
    return { value: null, status: 'ACIK', from: null };
  }
  function isFitted(id, profile) {
    const comp = BY_ID[id];
    if (!comp.optional) return true;
    return !!(profile && profile.fitted && profile.fitted[id]);
  }

  /** Profil doğrulaması: geçersiz veri sessizce kabul edilmez. */
  function validateProfile(p) {
    const err = [];
    if (!p || typeof p !== 'object') return ['Profil nesne değil.'];
    if (p.schema !== PROFILE_DEFAULT.schema) err.push(`Profil şema sürümü ${p.schema}; beklenen ${PROFILE_DEFAULT.schema}.`);
    const pos = (v, n) => { if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) err.push(`${n}: pozitif sonlu sayı olmalı (verilen: ${v}).`); };
    for (const grp of ['values', 'overrides']) {
      for (const [k, v] of Object.entries(p[grp] || {})) {
        if (!BY_ID[k]) { err.push(`${grp}.${k}: bilinmeyen bileşen.`); continue; }
        pos(v, `${grp}.${k}`);
      }
    }
    for (const k of Object.keys(p.fitted || {})) if (!BY_ID[k] || !BY_ID[k].optional) err.push(`fitted.${k}: opsiyonel bileşen değil.`);
    for (const [k, v] of Object.entries(p.tapers || {})) if (!['lin', 'log'].includes(v)) err.push(`tapers.${k}: "lin" ya da "log" olmalı.`);
    if (!['lift', 'tap'].includes(p.rawMethod)) err.push('rawMethod: "lift" ya da "tap" olmalı.');
    if (!p.T1) err.push('T1 trafo verisi yok.'); else { pos(p.T1.vSec, 'T1.vSec'); pos(p.T1.rt, 'T1.rt'); pos(p.T1.mainsNom, 'T1.mainsNom'); pos(p.T1.freq, 'T1.freq'); if (!(p.T1.noLoadRisePct >= 0)) err.push('T1.noLoadRisePct ≥ 0 olmalı.'); }
    if (!p.T2) err.push('T2 trafo verisi yok.'); else { pos(p.T2.zp, 'T2.zp'); pos(p.T2.rp, 'T2.rp'); pos(p.T2.lp, 'T2.lp'); pos(p.T2.lleak, 'T2.lleak'); if (!Array.isArray(p.T2.rs) || p.T2.rs.length !== 3) err.push('T2.rs: üç bölüm direnci gerekir.'); else p.T2.rs.forEach((v, i) => pos(v, `T2.rs[${i}]`)); }
    for (const t of ['V1A', 'V1B', 'V2', 'V3']) if (!p.models || !p.models[t]) err.push(`models.${t}: tüp modeli eksik.`);
    return err;
  }

  /** Kısa, kararlı özet (FNV-1a): profil + devre revizyonu. Deney kimliğinde kullanılır. */
  function hash(obj) {
    const s = JSON.stringify(obj, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  function designHash(profile) {
    return hash({ rev: REVISION.id, comps: COMPONENTS.map(x => [x.id, x.type, x.nodes, x.value]), sw: SWITCHES, profile });
  }

  const STATUS_TR = { RAPOR: 'RAPOR KARARI', ACIK: 'AÇIK KARAR', DENEYSEL: 'DENEYSEL', ONERI: 'ÖNERİ' };

  const api = { REVISION, COMPONENTS, BY_ID, SWITCHES, DECISIONS, PROFILE_DEFAULT, SUPPLIERS, SUPPLY_CHECKED, BOM_EXTRA, STATUS_TR,
    cloneProfile, resolve, isFitted, validateProfile, hash, designHash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Design = api;
})(typeof self !== 'undefined' ? self : this);
