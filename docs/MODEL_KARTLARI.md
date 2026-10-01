# Model kartları

> 5F1 TABANLI MODİFİYE TÜPLÜ GİTAR AMFİSİ · Rev A · profil DENEYSEL-01 · devre kimliği `4bdeedb1`
> Bu dosya `scripts/export-docs.js` ile kanonik tanımdan üretilir; elle düzenlenmez.

## 12AX7-koren · v1.0

- **Tüp:** 12AX7 / ECC83 (genel)
- **Denklem:** `Koren geliştirilmiş triyot: E1 = (Vp/kP)·ln(1 + exp(kP·(1/µ + Vg/√(kVB + Vp²)))); Ip = 2·E1^X / kG1`
- **Parametreler:** `{"mu":100,"x":1.4,"kg1":1060,"kp":600,"kvb":300,"rgi":2000,"cgp":1.7e-12,"cgk":1.6e-12,"cpk":4.6e-13}`
- **Kaynak:** N. Koren, "Improved Vacuum Tube Models for SPICE Simulations", Glass Audio 5/1996; parametreler yaygın 12AX7 uyumu. Elektrotlar arası kapasiteler: tipik 12AX7 veri sayfası değerleri.
- **Lisans:** Yayımlanmış denklem ve parametreler; dosya kopyalanmadı.
- **Geçerli aralık:** Vp 0–450 V, Vg −5…+1 V, Ip 0–5 mA
- **Doğrulama kanıtı:** 250 V / −2 V noktasında model 0,95 mA; tipik veri sayfası 1,2 mA (−%21). Genel uyum; eldeki tüp ölçülmedi.
- **Heater:** 6.3 V / 0.3 A — 6,3 V paralel bağlantı (4+5 / 9)
- **Sınır değerleri:** veri eksik. Eldeki tüpün veri sayfası kaydedilmedi.
- **Isınma (temsilî, kalibre değil):** τ açılış 6 s, kapanış 12 s
- **Modellenmeyen etkiler:**
  - Üretici / varyant farkı
  - Mikrofoni, gürültü, heater–katot kaçağı
  - Grid akımı yalnız basit diyot + 2 kΩ
  - Sıcaklığa bağlı kayma

## 6V6-koren · v1.1

- **Tüp:** 6V6GT (genel)
- **Denklem:** `Koren pentot plaka akımı: E1 = (Vg2/kP)·ln(1 + exp(kP·(1/µ + Vg1/Vg2))); Ip = 2·E1^X/kG1 · atan(Vp/kVB). Ekran: akım korunumlu; Ig2 = (Vg1 + Vg2/µ)^X/kG2 + Ip∞·(1 − (2/π)·atan(Vp/kVB)), Ip∞ = π·E1^X/kG1`
- **Parametreler:** `{"mu":10.7,"x":1.31,"kg1":1672,"kg2":6575,"kp":41.16,"kvb":12.7,"rgi":2000,"cg1":9e-12,"ca":8.5e-12,"cag1":7e-13}`
- **Kaynak:** Plaka akımı: Koren pentot denklemi, 6V6GT için yaygın parametre seti. Ekran akımı: BU PROJEYE ÖZGÜ değişiklik — plakanın almadığı uzay akımı ekrana verilir (katot akımı plaka geriliminden yaklaşık bağımsız kalır); kG2, JJ 6V6S tipik noktasında Ig2 = 5 mA olacak şekilde yeniden uyduruldu. Kapasiteler: JJ 6V6S veri sayfası (Cg1 9 pF, Ca 8,5 pF, Ca/g1 0,7 pF).
- **Lisans:** Yayımlanmış denklem ve parametreler; dosya kopyalanmadı.
- **Geçerli aralık:** Vp 0–500 V, Vg2 0–450 V, Vg1 −40…+2 V
- **Doğrulama kanıtı:** JJ 6V6S tipik nokta 250 V / 250 V / −12,5 V: veri sayfası Ia 45 mA, Ig2 5 mA; model 46,1 mA ve 5,0 mA (tests/run-tests.js MK-02).
- **Heater:** 6.3 V / 0.5 A — JJ 6V6S: 0,5 A. Eski 6V6GT tipik 0,45 A; eldeki tüple doğrulanmalı.
- **Sınır değerleri:** veri eksik. REFERANS (JJ 6V6S, eldeki tüp değil): Ua 500 V, Ug2 450 V, Wa 14 W; grid devresi direnci self-bias ≤ 0,5 MΩ.
- **Isınma (temsilî, kalibre değil):** τ açılış 6 s, kapanış 15 s
- **Modellenmeyen etkiler:**
  - Ekran akımının diz bölgesindeki biçimi ölçülmüş eğrilerle doğrulanmadı: kırpılmadaki ekran gücü ve çıkış gücü yaklaşık değerlerdir
  - Üretici / varyant farkı
  - İkincil emisyon ve demet oluşumu ayrıntısı
  - Isıl kayma

## 5Y3-child · v1.0

- **Tüp:** 5Y3GT (genel)
- **Denklem:** `Plaka başına Child yasası: I = G · V^1,5 (V > 0)`
- **Parametreler:** `{"g":0.000372}`
- **Kaynak:** G, JJ 5Y3S veri sayfasındaki kapasitör girişli tipik noktaya uydurulmuştur: 350 VAC/plaka, C = 20 µF, Rt = 50 Ω, 125 mA → 360 V DC.
- **Lisans:** Kendi uyumumuz.
- **Geçerli aralık:** Plaka başına 0–0,5 A; ileri düşüm 0–90 V
- **Doğrulama kanıtı:** tests/run-tests.js MK-01: aynı koşulda model çıkışı 360 V ± %1.
- **Heater:** 5 V / 2 A — Ayrı 5 V sargı; B+ potansiyelinde yüzer.
- **Sınır değerleri:** veri eksik. REFERANS (JJ 5Y3S tipik çalışma, sınır değil): 350 VAC / 20 µF / 50 Ω / 125 mA. Eldeki 5Y3GT için tepe plaka akımı ve PIV sınırı kaydedilmedi.
- **Isınma (temsilî, kalibre değil):** τ açılış 0.8 s, kapanış 2 s
- **Modellenmeyen etkiler:**
  - Ters kaçak ve ark (flashover)
  - Filaman ısınma ayrıntısı
  - Üretici / varyant farkı
