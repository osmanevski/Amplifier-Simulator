# Mimari notları

## 1. Katmanlar

```
circuit-5f1.js   kanonik tanım: bileşen / düğüm / anahtar / karar / profil / tedarik
      ▲                         (tek veri kaynağı)
      ├── schematic-amp.js   yalnız koordinat; değer ve durum tanımdan
      ├── bom-amp.js         satırlar tanımdan türetilir
      └── amp-model.js       build(): tanım + profil + durum → netlist
                ▲
mna.js (çözücü) + tubes.js (model kartları) + dsp.js (ölçüm)
                ▲
tests-amp.js · ui-core.js · ui-analysis.js · ui-panels.js · dogrulama.html
```

Arayüz fizik sabiti üretmez ve ikinci bir devre veritabanı tutmaz. UI-01 testi, bir değer değişince netlist, şema ve BOM'un birlikte değiştiğini sınar.

## 2. Kanonik tanım

Her bileşen: kimlik, tip, işlev, düğümler, nominal SI değer, V / W sınırı, durum (`RAPOR` / `ACIK`), tedarik durumu, kaynak, karar kimliği, tedarik adayları. Tolerans, üretici, parça kodu ve paket alanları bilinmediği için `null` → arayüzde "veri eksik".

Açık kararların değeri `null`'dır. Değer, etkin profilden gelir ve `DENEYSEL` olarak etiketlenir: `resolve(id, profile)` → `{ value, status, from }`. Profil değer vermiyorsa `build()` `ProfileError` fırlatır; eksik değerle netlist kurulmaz.

Anahtarlar düğüm birleşimi olarak tanımlıdır (`SWITCHES[sid].join[konum]`). Bileşenlerin düğüm adları sabittir; `build()` birleşimleri uygular. Örnek: S1 High'da `S1A ≡ IN` (R2, R1'e paralel), Low'da `S1A ≡ GND` (R2 bölücünün alt kolu).

Referans adları simülatör referanslarıdır; raporun C3 / C4 / C5 adları korunmuştur.

## 3. Çözücü (`mna.js`)

Değiştirilmiş düğüm analizi. Bilinmeyenler: düğüm gerilimleri + gerilim kaynağı, endüktans ve trafo sargısı akımları + trafo çekirdek değişkeni.

- **Trafo:** her sargı `v(a) − v(b) = n·u`, çekirdek `u = Lm · d(Σ n·i)/dt`. Çıkış trafosunun tapları üç seri sekonder bölümüdür; faz ters çevrilince sekonder `n` işaret değiştirir.
- **Doğrusal olmayan elemanlar:** uç akımları + merkezî farkla Jacobian. Newton–Raphson; büyük adımlar 40 V ile sınırlanır, ilerleme durursa adım katsayısı yarılanır (yalnız yakınsama yolu değişir).
- **Zaman alanı:** sabit adım, BDF2 (ilk adım BE). Newton yakınsamazsa adım 2 … 64 alt adıma bölünür; yine olmazsa `SolverError`.
- **AC:** DC çalışma noktasındaki Jacobian ile karmaşık çözüm.
- Sayısal eklemeler: düğüm başına 1 pS (`GMIN`), pot uç direnci 1 Ω. Hiçbir büyüklük kırpılmaz.

## 4. Üç ritim (`amp-model.js`)

| Ritim | Ne | Adım |
|---|---|---|
| Canlı besleme | `Sim`: trafo + 5Y3 + filtre + tüplerin DC çalışması; ısınma, ripple, açılış, kapanış | 100 µs sabit |
| Ses analizi | `audioGen`: canlı durumdan başlar, sinüs giriş, yerleşme + ham tampon | 1 / 96 kHz |
| Küçük sinyal | `dcOp` + `acSweep` + `loopGain` | frekans noktaları |

Oynatma hızı yalnızca kare başına atılan canlı adım sayısını değiştirir (NU-06). Batarya projesindeki 50 ms adım ve 5 s'lik kayıt burada kullanılmaz.

**Kayıtlar ayrıdır:** (1) ham ses tamponu — FFT / THD yalnız buradan; (2) şebeke periyodu özetleri (`Sim.win`, `Sim.history`) — ortalama / min / maks; (3) grafik için seyreltme — yalnız gösterim.

**Ses analizi** ana iş parçacığında dilimler hâlinde yürür (üreteç). Ayar değişirse sonuç "GEÇERSİZ" olur ve kararlı durum sağlanınca yeniden hesaplanır; iptal edilen ya da yarım kalan analiz sonuç göstermez.

**Isınma:** tüp başına ısınma değişkeni → emisyon çarpanı. Zaman sabitleri temsilîdir (kalibre değil).

## 5. Analiz tanımları

- 6V6: `Ik = Vk / Rk`, `Ia = Ik − Ig2`, `Pa = (Va − Vk)·Ia`, `Pg2 = (Vg2 − Vk)·Ig2`. `Va`, B+1'den OT primer DCR düşümü kadar düşüktür. Sinyal altındaki güçler anlık çarpımın zaman ortalamasıdır.
- Çevrim kazancı: R12 tap ucundan ayrılır, 1 V test kaynağıyla sürülür; `T = −V(S4)/Vtest`. Nyquist değerlendirmesi 20 Hz – 20 kHz ve modellenen fazlarla sınırlıdır.
- THD: Hann penceresi, harmonik çevresindeki ana lob gücü toplamı; temel bileşen sıfıra yakınsa "geçersiz".
- Yük durumu: her jaktaki yük `n²` ile primere yansıtılır; `EŞLEŞMİŞ / YANLIŞ JAK / ÇOKLU YÜK / YÜKSÜZ`.

## 6. Arayüz

- `ui-core.js`: `Bench` ad alanı; `structChanged()` netlisti yeniden kurar ve durumu ada göre taşır (zaman geçmişi korunur); `newSim()` yeni deney başlatır.
- Durumlar: Güç kapalı · Isınma · Geçiş · Kararlı çalışma · Tehlikeli yük koşulu · NFB ters faz · Çözücü hatası · Geçersiz profil.
- Dışa aktarım (Olay günlüğü sekmesi): konfigürasyon JSON, netlist, BOM CSV, ham ses tamponu, besleme özeti — hepsi aynı deney kimliğiyle (`devre kimliği-zaman`). İçe aktarılan profil doğrulanır; sonuçlar taşınmaz, yeniden hesaplanır.

## 7. Yeni senaryo / test eklemek

- Senaryo: `assets/scenarios-amp.js` → `SCENARIOS` dizisine `{ id, start, name, desc, apply?(st, profile), at?, inject?, watch }`.
- Test: `assets/tests-amp.js` → `TESTS` dizisine `{ id, group, title, req, heavy?, run(ctx) }`. Node çalıştırıcısı ve doğrulama sayfası otomatik alır. Beklenen değer kodun çıktısından kopyalanmaz.

## 8. Sonraki adımlar

1. Açık kararları kapatmak (K-01 … K-16) ve kapananları kanonik tanıma `RAPOR` olarak işlemek.
2. Eldeki tüplerin kimliğini kaydetmek; model kartlarını ve sınır değerlerini güncellemek.
3. Bobinajcıdan PT / OT verisi gelince profildeki `T1` / `T2` alanlarını gerçek değerlerle değiştirmek.
4. ngspice ile bağımsız karşılaştırma (NU-03b): `docs/netlist-raw-normal.cir` başlangıç noktasıdır.
5. İsteğe bağlı: hoparlör empedans modeli, canlı ses (AudioWorklet), 3B şasi — elektrik çekirdeği doğrulandıktan sonra.
