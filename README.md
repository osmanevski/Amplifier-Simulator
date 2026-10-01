# Amfi tezgâhı — 5F1 Modifiye (Rev A)

5F1 tabanlı modifiye tüplü gitar amfisi (12AX7 + 6V6GT + 5Y3GT, single-ended) için çevrimdışı simülatör. `index.html` dosyasını tarayıcıda açmak yeterli; internet ve kurulum gerekmez (fontlar `assets/fonts/` içinde gömülü). İstenirse `start_server.command` yerel sunucu açar (http://localhost:8090).

Laboratuvar arayüzü ve doğrulama yaklaşımı Battery Lab Simulator'dan uyarlandı; **elektrik modeli sıfırdan yazıldı** (batarya, BMS, XL4015 ya da firmware modeli taşınmadı). Girdi belgeleri üst klasörde: `../Kaynaklar/`.

> **Bu bir simülasyondur.** Üretim şeması, güvenlik onayı ya da canlı devrede çalışma talimatı değildir. Amfide birkaç yüz volt DC bulunur; filtre kapasitörleri fiş çekildikten sonra da şarj tutabilir.

## Sayfalar

| Sayfa | İçerik |
|---|---|
| `index.html` | **Amfi tezgâhı.** Ön panel (giriş, Hi/Lo, Bass / Mid / Treble, EQ/RAW, Bright, Dark, Volume) ve arka panel (üç jak, şebeke); canlı kavramsal şema; B+1 / B+2 / B+3 zaman grafiği; osiloskop, spektrum, frekans cevabı ve NFB çevrimi; senaryolar, bileşen denetçisi, çalışma noktası, tasarım kontrolleri, açık kararlar, profil, olay günlüğü + dışa aktarım, malzeme / tedarik, model kartları. |
| `dogrulama.html` | **Doğrulama raporu.** Kabul testleri (EL / NU / UI / MK), soğuk açılış eğrisi ve kapasitör marjı bulgusu, EQ ↔ RAW karşılaştırması, model sınırları, açık kararlar. Açılışta yeniden hesaplanır. |

## Kısayollar (index.html)

| Tuş | İşlev |
|---|---|
| `Boşluk` | Duraklat / devam et |
| `P` | Şebekeyi kes / ver |
| `E` | Kararlı duruma git (zaman geçmişi silinmez) |
| `R` | Soğuk açılış (yeni deney: t = 0, tüpler soğuk, kapasitörler boş) |

Kontrol değiştirmek zaman geçmişini silmez; kapasitör yükleri korunur. Senaryolar ve "Soğuk açılış" yeni deney başlatır. Oynatma hızı elektrik sonucunu değiştirmez.

## Okurken dikkat

- **Deneysel profil (`DENEYSEL-01`).** Raporda açık kalan kararlar (TMB topolojisi ve değerleri, EQ/RAW anahtarlaması, Bright / Dark kapasitörleri, V1A bypass, V1B / NFB düğümü, trafo verileri) için ilk deney değerleri kullanılır. Şemada kırmızı-mor görünür; Δ işaretleri karar günlüğünü açar. Bunlar Rev A'nın kesin kararı değildir.
- **Genel tüp modelleri.** Eldeki tüplerin üreticisi bilinmiyor; sınır değerleri "veri eksik" gösterilir, JJ değerleri yalnız referanstır.
- **Tek veri kaynağı.** Bir parça değeri tek yerden değişir (denetçi ya da profil); şema, netlist, denetçi ve BOM birlikte izler. Değişen profil "değiştirilmiş" olarak işaretlenir ve doğrulama sonuçları onun için geçersizdir.
- **Dürüst hata.** Çözücü yakınsamazsa açık hata verir; bu fiziksel arıza ya da koruma olarak sunulmaz. Simülatör yüksüz çıkışta amfiyi durdurmaz: gerçek devrede koruma yoktur.

## Dosyalar

```
assets/circuit-5f1.js    KANONİK DEVRE TANIMI: bileşenler, düğümler, anahtarlar, karar günlüğü, deneysel profil, tedarik
assets/units.js          SI ayrıştırma / gösterim ("22n" = "22 nF" = "0,022 µF")
assets/mna.js            Çözücü: DC, zaman alanı (BE / BDF2), küçük sinyal AC; Newton + alt adımlama
assets/tubes.js          Tüp model kartları (kaynak, sürüm, geçerli aralık, eksik etkiler) ve elemanları
assets/amp-model.js      Netlist kurucu, canlı simülasyon, kararlı durum, AC / çevrim kazancı, ses analizi, tasarım kontrolleri
assets/dsp.js            RMS / tepe, pencereli FFT, harmonik ve THD
assets/bom-amp.js        Malzeme listesi (kanonik tanımdan türetilir) ve CSV
assets/schematic-amp.js  Kavramsal şema: yalnız yerleşim; değerler kanonik tanımdan
assets/scenarios-amp.js  Senaryolar ve canlı müdahaleler
assets/tests-amp.js      Kabul testleri (Node ve tarayıcı ortak)
assets/ui-core.js        Tezgâh çekirdeği: durum, döngü, kontroller, okuma şeridi, dışa / içe aktarım
assets/ui-analysis.js    Grafikler ve analiz yürütücüsü (dilimli, iptal edilebilir)
assets/ui-panels.js      Alt çekmece panelleri
assets/charts.js         Grafik çizici (doğrusal + logaritmik x)
assets/amp.css           Stiller
tests/run-tests.js       node tests/run-tests.js [--fast] [--json] [KİMLİK …]
scripts/export-docs.js   Kanonik tanımdan docs/ üretir
docs/                    Karar günlüğü, BOM, model kartları, netlist, varsayılan konfigürasyon, test sonuçları, doğrulama notu
```

Model dosyaları hem tarayıcıda hem Node'da çalışır.

```
node tests/run-tests.js                                  # tüm testler (~30 s)
node tests/run-tests.js --json > docs/test-sonuclari.json
node scripts/export-docs.js                              # docs/ altını yeniden üretir
```

[Mimari](ARCHITECTURE.md) · [Doğrulama notu](docs/DOGRULAMA.md) · [Karar günlüğü](docs/KARAR_GUNLUGU.md) · [BOM](docs/BOM.md) · [Model kartları](docs/MODEL_KARTLARI.md)
