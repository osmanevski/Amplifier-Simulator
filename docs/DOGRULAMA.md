# Doğrulama notu

> 5F1 Modifiye · Rev A · profil DENEYSEL-01 · devre kimliği `4bdeedb1` · 01.10.2026
> Ham sonuçlar: `docs/test-sonuclari.json` (`node tests/run-tests.js --json`).

## Özet

| | Sayı |
|---|---|
| Geçti | 24 |
| Kaldı | 0 |
| Çalıştırılmadı | 2 (NU-03b ngspice karşılaştırması · UI-02 otomatik takım dışı) |

Testler simülatörün kendi içinde tutarlı ve doğru hesap yaptığını sınar. **Amfinin fiziksel doğruluğu ya da güvenliği için kanıt değildir**: eldeki tüpler, trafolar ve prototip ölçülmedi; bağımsız bir SPICE çözücüsüyle karşılaştırma yapılmadı.

## Kanıt katmanları

| Katman | Durum |
|---|---|
| Analitik (bölücüler, yansıyan yük, empedanslar) | Yapıldı: EL-02, EL-10, NU-01 |
| Bağımsız kod, aynı topoloji (TMB el türetimi; yük doğrusu ikiye bölme) | Yapıldı: NU-02, NU-03 |
| Üretici veri sayfası noktası (JJ 5Y3S, JJ 6V6S) | Yapıldı: MK-01, MK-02 — tek nokta; eldeki tüp değil |
| Sayısal yakınsama ve tekrar | Yapıldı: NU-04, NU-05, NU-06 |
| Bağımsız çözücü (ngspice) | **Çalıştırılmadı** (kurulu değil) |
| Donanım ölçümü | **Yok** |

## Geliştirme sırasında düzeltilen iki test

Her ikisinde de kod değil, testin beklentisi yanlıştı; beklenti koda uydurulmadı, fiziksel gerekçeyle düzeltildi.

- **EL-12:** kapalı çevrim kazancı, R12 sökülerek ölçülen kazançla karşılaştırılıyordu. R12'yi sökmek V1B katot yükünü de değiştirdiği için bu, 1/(1+T) bağıntısının açık çevrim kazancı değildir (fark %3,5). Açık çevrim artık R12 katotta bırakılıp tap ucu topraklanarak ölçülüyor; öngörü 0,01 dB içinde tutuyor.
- **EL-14:** sıcak kapatmada da B+'nın kalacağı beklenmişti. Sıcak tüpler kapasitörleri ~0,5 s'de boşaltır; tehlikeli durum tüpler iletimde değilken kapatmaktır. Test bunu sınayacak biçimde yeniden yazıldı (açılıştan 3 s sonra kapatma: bleeder yokken 40 s sonra hâlâ ≈ 444 V).

## Tasarım bulguları (model tahmini; ölçüm değil)

Bunlar test sonucu değil, amfinin kendisi hakkındaki bulgulardır. Hepsi deneysel PT verisine (320 VAC yüksüz EMK, 200 Ω) ve genel tüp modellerine dayanır.

1. **C4 / C5 (10 µF / 450 V) soğuk açılışta nominal gerilimine dayanıyor.** 5Y3 ~1 s'de iletir, yük ~6 s sonra gelir; arada B+1 ≈ B+2 ≈ B+3 ≈ 450 V (ideal tepe 452,5 V). C3 (500 V) %90'da. Şebeke +%10 varsayımında tepe ≈ 495 V: C4 / C5 aşılır, C3 sınırda. Yalnız C3'ü yükseltmek riski çözmez (K-10).
2. **Kapasitörler, tüpler iletimde değilken kapatılırsa dolu kalır** (bleeder yok): açılıştan 3 s sonra kapatmada 40 s sonra ≈ 444 V. 220 kΩ bleeder ile ≈ 3 V.
3. **6V6 anodik güç kaybı ≈ 12,3 W** (Va 349 V, Ia 37,4 mA, Vk 19,1 V). Eldeki tüpün sınırı bilinmiyor; JJ 6V6S referansı 14 W.
4. **OT primer DC akımı ≈ 37 mA; sinyal altında ortalama yükselir.** Şartnamedeki "en az ~40 mA, tercihen ~50 mA" bu çalışma noktasıyla teyit edilmeli.
5. **NFB ≈ 6,2 dB** (|T| ≈ 1,05 @ 1 kHz). OT fazı ters bağlanırsa çevrim, modelin kapsadığı aralıkta kararsızdır (osilasyon beklenir).
6. **Ton ağı devredeyken kazanç 11–20 dB düşer** ve kayıp frekansa bağlıdır; RAW yalnız "daha yüksek kazanç" değildir.
7. **Low giriş, sonlu kaynak empedansında −6 dB'de sabit kalmaz** (temsili manyetikle 100 Hz'de −6,4 dB, 5 kHz'de −9,7 dB).
8. **Temiz çıkış ≈ 3,6 W** (50 mV tepe giriş, volume %50, THD %6). Aşırı sürüşteki güç (≈ 10 W) yaklaşık bir değerdir: 6V6 ekran akımı modeli eğrilerle doğrulanmadı.

## Elle tarayıcı kontrolü (UI-02 yerine geçmez)

01.10.2026, Chrome (masaüstü, 1600 px; başsız 500 px ve `file://`):

- `index.html` ve `dogrulama.html` konsol hatasız açıldı; `file://` üzerinden de çalıştı.
- Senaryolar (kararlı, EQ, aşırı sürüş, yüksüz, yanlış jak, NFB ters), dört analiz görünümü, bütün alt sekmeler çalıştı.
- Bileşen denetçisinde `-5n`, `abc`, `22 V` reddedildi; `0,047 µF` kabul edildi ve şema, netlist, BOM birlikte değişti; profil "değiştirilmiş" işaretlendi; zaman geçmişi silinmedi.
- Güç kapatma, soğuk açılış ve "kararlı durum bekleniyor" analiz durumu doğru göründü.

Yapılmayanlar: klavye ile tam gezinme denetimi, Safari / Firefox, dokunmatik cihaz, gerçek 1× oynatma hızının farklı makinelerde ölçümü, profil içe aktarımının dosya seçiciyle uçtan uca denemesi (doğrulama mantığı UI-03 ile sınandı).
