# Malzeme listesi

> 5F1 TABANLI MODİFİYE TÜPLÜ GİTAR AMFİSİ · Rev A · profil DENEYSEL-01 · devre kimliği `4bdeedb1`
> Bu dosya `scripts/export-docs.js` ile kanonik tanımdan üretilir; elle düzenlenmez.

Satın alma onayı değildir. Tedarik kaynakları 01.10.2026 tarihinde kontrol edilen adaylardır; stok, fiyat ve teslimat teyit edilmedi. Tolerans, üretici, parça kodu ve paket alanları henüz boştur (veri eksik).

## Tüpler

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| V3 | Doğrultucu | 5Y3GT | 1 | RAPOR KARARI · K-02 | ELDE | P1 s.3 |  |
| V1 | Ön yükselteç tüpü (V1A + V1B) | 12AX7 / ECC83 | 1 | RAPOR KARARI · K-02 | ELDE | P1 s.3 |  |
| V2 | Güç tüpü | 6V6GT | 1 | RAPOR KARARI · K-02 | ELDE | P1 s.3 |  |

## Trafolar

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| T1 | Güç trafosu | 230 VAC 50 Hz → 320-0-320 VAC (orta uçlu, ~70 mA) · 5 VAC / 2 A ayrı · 6,3 VAC / 1,5 A | 1 | RAPOR KARARI · K-08 | ÖZEL SARIM | P1 s.3; IR §24 | S1 |
| T2 | Çıkış trafosu | Single-ended, tek 6V6GT · 8 kΩ primer · COM + 4 / 8 / 16 Ω · air-gap'li · ≥ 40 mA DC (tercihen ~50 mA) | 1 | RAPOR KARARI · K-09 | ÖZEL SARIM | P1 s.7–8; IR §24 | S1 |

## Besleme filtresi

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| C3 | İlk filtre (reservoir) | 16 µF / 500 V | 1 | RAPOR KARARI · K-10 | SATIN AL | P1 s.4 | S2 |
| R10 | B+1 → B+2 düşürme | 10 kΩ / 2 W | 1 | RAPOR KARARI · K-01 | ELDE | P1 s.4, s.11 |  |
| C4 | Screen filtresi | 10 µF / 450 V | 1 | RAPOR KARARI · K-10 | ELDE | P1 s.4 |  |
| R11 | B+2 → B+3 düşürme | 22 kΩ / 2 W | 1 | RAPOR KARARI · K-01 | ELDE | P1 s.11 |  |
| C5 | Ön yükselteç filtresi | 10 µF / 450 V | 1 | RAPOR KARARI · K-10 | ELDE | P1 s.4 |  |
| R16 | Bleeder (opsiyonel) | 220 kΩ | 1 | DENEYSEL · K-12 | OPSİYONEL · takılı değil | P1 s.12 |  |

## Giriş

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| R1 | Grid stopper / Low bölücü üst | 68 kΩ | 1 | RAPOR KARARI | ELDE | P1 s.5 |  |
| R2 | Grid stopper / Low bölücü alt | 68 kΩ | 1 | RAPOR KARARI | ELDE | P1 s.5 |  |
| R3 | High giriş referansı | 1 MΩ | 1 | RAPOR KARARI | ELDE | P1 s.5 |  |

## Sinyal katları

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| R4 | V1A anodik yük | 100 kΩ | 1 | RAPOR KARARI | ELDE | P1 s.6 |  |
| R5 | V1A katot | 1,5 kΩ | 1 | RAPOR KARARI | ELDE | P1 s.6 |  |
| C7 | V1A katot bypass (tanımsız) | 25 µF / 25 V | 1 | DENEYSEL · K-03 | OPSİYONEL · takılı değil | IR §8 |  |
| C1 | V1A → ton / volume kuplaj | 22 nF / 630 V | 1 | RAPOR KARARI | SATIN AL | P1 s.6, s.10 | S3 S4 |
| R6 | V1B anodik yük | 100 kΩ | 1 | RAPOR KARARI | ELDE | P1 s.6 |  |
| R7 | V1B katot / NFB düğümü | 1,5 kΩ | 1 | RAPOR KARARI · K-04 | ELDE | P1 s.6 |  |
| R12 | Negatif geri besleme | 22 kΩ | 1 | RAPOR KARARI · K-04 | ELDE | P1 s.8 |  |
| C2 | V1B → 6V6 kuplaj | 22 nF / 630 V | 1 | RAPOR KARARI | SATIN AL | P1 s.6, s.10 | S3 S4 |
| R8 | 6V6 grid leak | 220 kΩ | 1 | RAPOR KARARI | ELDE | P1 s.6 |  |
| R9 | 6V6 katot (cathode bias) | 470 Ω / 5 W | 1 | RAPOR KARARI | ELDE | P1 s.5–6 |  |
| C6 | 6V6 katot bypass | 22 µF / 50 V | 1 | RAPOR KARARI | ELDE | P1 s.4 |  |

## Ton ağı

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| C8 | TMB treble kapasitörü | 250 pF / 630 V | 1 | DENEYSEL · K-05 | DEĞER ONAYI BEKLİYOR | P1 s.6 |  |
| R13 | TMB slope direnci | 56 kΩ | 1 | DENEYSEL · K-05 | DEĞER ONAYI BEKLİYOR | P1 s.6 |  |
| C9 | TMB bass kapasitörü | 22 nF / 630 V | 1 | DENEYSEL · K-05 | DEĞER ONAYI BEKLİYOR | P1 s.6 |  |
| C10 | TMB mid kapasitörü | 22 nF / 630 V | 1 | DENEYSEL · K-05 | DEĞER ONAYI BEKLİYOR | P1 s.6 |  |
| VR2 | Treble potu | 250 kΩ lin | 1 | DENEYSEL · K-05 | SATIN AL | P1 s.6 | S6 |
| VR3 | Bass potu (reosta) | 1 MΩ log | 1 | DENEYSEL · K-05 | SATIN AL | P1 s.6 | S6 |
| VR4 | Mid potu (reosta) | 25 kΩ lin | 1 | DENEYSEL · K-05 | SATIN AL | P1 s.6 | S6 |

## Volume / voicing

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| VR1 | Volume potu | 1 MΩ lin | 1 | RAPOR KARARI · K-14 | ELDE | P1 s.6 |  |
| C11 | Bright kapasitörü | 100 pF / 630 V | 1 | DENEYSEL · K-07 | DEĞER ONAYI BEKLİYOR | P1 s.7 |  |
| C12 | Dark kapasitörü | 1 nF / 630 V | 1 | DENEYSEL · K-07 | DEĞER ONAYI BEKLİYOR | P1 s.7 |  |

## Anahtarlar

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| S1 | High / Low seçici | DPDT ON-ON mini toggle | 1 | RAPOR KARARI | SATIN AL | P1 s.5 | S7 |
| S2 | EQ / RAW seçici | — | 1 | AÇIK KARAR · K-06 | ŞARTNAME BEKLİYOR | P1 s.7 | S7 |
| S3 | Bright anahtarı | Tutmalı ON/OFF (SPST) | 1 | RAPOR KARARI | SATIN AL | P1 s.7 | S7 |
| S4 | Dark anahtarı | Tutmalı ON/OFF (SPST) | 1 | RAPOR KARARI | SATIN AL | P1 s.7 | S7 |

## Bağlantı

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| J1 | Giriş jakı | 6,35 mm mono; kısa devreli kontak seçeneği | 1 | RAPOR KARARI | SATIN AL | P1 s.5 | S9 |
| J2 | 4 Ω hoparlör çıkışı | 4 Ω tap | 1 | RAPOR KARARI | SATIN AL | P1 s.8 | S9 |
| J3 | 8 Ω hoparlör çıkışı | 8 Ω tap | 1 | RAPOR KARARI | SATIN AL | P1 s.8 | S9 |
| J4 | 16 Ω hoparlör çıkışı | 16 Ω tap | 1 | RAPOR KARARI | SATIN AL | P1 s.8 | S9 |
| — | Tüp soketleri | 1 noval + 2 octal; şasi montaj, lehim kulaklı (PCB soketi değil) | 3 | RAPOR KARARI | SATIN AL | P1 s.8; IR §21 | S5 |
| — | Kabin jakı + hoparlör kablosu | Ayrı kabin için; enstrüman kablosuyla karıştırılmaz | 1 | RAPOR KARARI | SATIN AL | IR §21 | S9 S11 |

## Şebeke

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| F1 | Şebeke sigortası + yuva | — | 1 | AÇIK KARAR · K-13 | ŞARTNAME BEKLİYOR | P1 s.4, s.12 | S10 |
| S5 | Neon ışıklı güç anahtarı | 230–250 VAC, DPST hedef | 1 | RAPOR KARARI | SATIN AL | P1 s.4 | S8 |
| — | Şebeke girişi ve kablo | IEC ya da seçili giriş yöntemi | 1 | RAPOR KARARI | SATIN AL | IR §21 | S10 S11 |
| — | PE bağlantı donanımı | Bağımsız şasi cıvatası, terminal, kilitleme | 1 | RAPOR KARARI | SATIN AL | P1 s.9, s.12 |  |

## Heater

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| R14 | Yapay heater orta ucu (koşullu) | 100 Ω | 2 | AÇIK KARAR · K-11 | KOŞULLU | P1 s.4 |  |

## Mekanik

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| — | Pot düğmeleri | Mil tipi, çapı ve panel aralığıyla uyumlu | 4 | RAPOR KARARI | SATIN AL | IR §21 | S6 |
| — | Tek yüz FR-4 bakır levha | Spacer / vida / test noktalarıyla | 1 | RAPOR KARARI | SATIN AL | P1 s.8 | S12 |
| — | İç bağlantı kabloları | HV sınıfı kablo, heater çifti (twisted), ekranlı sinyal kablosu, makaron | 1 | RAPOR KARARI | SATIN AL | P1 s.8–9 | S11 |
| — | Metal şasi | Büküm sac; ölçü trafo boyutlarından sonra | 1 | RAPOR KARARI | YEREL TEKLİF | P1 s.9 |  |
| — | 3B baskı açık arkalı kabin | 4–6 mm duvar, kaburgalı; ölçü hoparlörden sonra | 1 | RAPOR KARARI | YEREL TEKLİF | P1 s.10 |  |
| LS1 | Prototip hoparlör | 4 Ω tercih; 6,5 ya da 8 inç; midbass / full-range; ≥ 10 W | 1 | RAPOR KARARI | YEREL TEKLİF | P1 s.9–10 | S14 |

## Test

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| — | Dummy load (test) | Örn. ≥ 20 W yük direnci; soğutma koşulu veri sayfasından | 1 | RAPOR KARARI | TEST EKİPMANI | IR §21 | S13 |

## Yedek / deneysel

| Ref | İşlev | Değer / özellik | Adet | Karar | Tedarik | Kaynak | Aday |
|---|---|---|---|---|---|---|---|
| — | Yedek: 22 µF / 450 V | İlk filtre için final tercih değil | 1 | RAPOR KARARI | ELDE (YEDEK) | P1 s.10 |  |
| — | Yedek: 27 nF / 400 V film | Final 22 nF / 630 V yerine otomatik kullanılmaz | 2 | RAPOR KARARI | ELDE (YEDEK) | P1 s.10 |  |

## Tedarik kaynakları

| Kod | Kaynak | Ne için | Bağlantı | Dikkat |
|---|---|---|---|---|
| S1 | Ekol Trafo (TR, üretici) | Özel sarım PT ve SE çıkış trafosu | https://www.ekoltrafo.com/lambali.html | Yazılı teklif alınmalı; uygunluk henüz onaylı değil. Sipariş verilmedi. |
| S2 | Tube Amp Doctor · Jupiter V-JC16500 (DE, ürün) | 16 µF / 500 V | https://www.tubeampdoctor.com/en/jupiter-cosmos-wet-electrolytic-capacitors-16uf-500v | Axial; radial PCB'ye doğrudan muadil değil. Isı / ripple / ölçü ve Türkiye teslimatı doğrulanmalı. |
| S3 | Direnç.net (TR, ürün) | 22 nF / 630 V %5 | https://www.direnc.net/22nf-630v-5-damla-tipi-polyester-kondansator-7 | Başlık 7,5 mm; ölçü alanı karışık. Footprint gerçek parçayla seçilmeli. |
| S4 | Motorobit (TR, ürün) | 22 nF / 630 V, 15 mm | https://www.motorobit.com/22nf-630v-15mm-polyester-kondansator | Alternatif fiziksel paket; stok / üretici / ölçü teyidi gerekli. |
| S5 | Tube Amp Doctor · Belton VTB9-ST-1 / S8M-1 (DE, ürün) | 1 noval + 2 octal soket | https://www.tubeampdoctor.com/en/belton-vtb9-st-1-noval-9-pin-socket-gold-plated-solder-lugs | Şasi montaj, lehim kulaklı. Octal sayfada malzeme alanı tutarsız; satıcıdan teyit. |
| S6 | TAD Pots & Knobs (DE, kategori) | TMB potları, log volume, düğmeler | https://www.tubeampdoctor.com/en/parts-for-amplifiers/passive-components/pots-knobs/ | Ohm, lin/log, mil / diş ölçüsü; "A/B" harfinden taper çıkarılmaz. |
| S7 | Direnç.net Toggle Switch (TR, kategori) | Hi/Low, RAW, voicing anahtarları | https://www.direnc.net/toggle-switch | Kutup sayısı, ON-ON / ON-OFF, gerçek uç haritası. |
| S8 | Direnç.net Rocker Switch (TR, kategori) | Neon güç anahtarı | https://www.direnc.net/rocker-switch | DPST, şebeke AC gerilimi, akım ve onay bilgisi. |
| S9 | Direnç.net Stereo / Mono Jak (TR, kategori) | Giriş, üç çıkış ve kabin jakı | https://www.direnc.net/stereo-mono-jak | Mono tip, panel izolasyonu, shorting kontağının gerçek işlevi. |
| S10 | TAD Fuses + Holder (DE, kategori) | Sigorta / yuva | https://www.tubeampdoctor.com/en/parts-for-amplifiers/amp-parts/fuses-holder/ | 250 V sınıfı; akım PT'ye göre. |
| S11 | TAD Wire & Cable (DE, kategori) | İç bağlantı ve kablolar | https://www.tubeampdoctor.com/en/parts-for-amplifiers/cables-jacks-plugs/wire-stranded-wire-cable/ | İzolasyon gerilimi / sıcaklık sınıfı ayrıca kontrol edilir. |
| S12 | Direnç.net Epoxy Plaket (TR, kategori) | PCB ham levhası | https://www.direnc.net/epoxy-plaketler | Tek yüz, FR-4 teyidi; delikli pertinaksla karıştırılmaz. |
| S13 | TAD Resistors (DE, kategori) | Direnç ve güç direnci alternatifleri | https://www.tubeampdoctor.com/en/parts-for-amplifiers/passive-components/resistors/ | Dummy load için endüktans / soğutma bilgisi gerekir. |
| S14 | TAD Jensen (DE, kategori) | Gitar hoparlörü alternatifi | https://www.tubeampdoctor.com/en/speakers-cabinets-more/speakers/jensen-guitar-bass/ | Yalnız alternatif; otomobil hoparlörü kararı değişmez. |
