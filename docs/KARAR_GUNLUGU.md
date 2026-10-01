# Karar günlüğü

> 5F1 TABANLI MODİFİYE TÜPLÜ GİTAR AMFİSİ · Rev A · profil DENEYSEL-01 · devre kimliği `4bdeedb1`
> Bu dosya `scripts/export-docs.js` ile kanonik tanımdan üretilir; elle düzenlenmez.

"Simülasyon varsayımı" deneysel profildir; Revizyon A'nın kesin kararı değildir.

## K-01 · B+ filtre zinciri

- **Öncelik / durum:** P0 · ONAY BEKLİYOR
- **Açık olan:** P1 s.4'teki çizimde 22 kΩ kolunun başlangıcı belirsiz (B+1'den ayrı kol gibi); s.11'de seri zincir açık.
- **Simülasyon varsayımı:** Seri zincir: B+1 → 10 kΩ / 2 W → B+2 → 22 kΩ / 2 W → B+3. B+1: OT / güç katı, B+2: screen, B+3: 12AX7 anodik yükleri.
- **Nasıl kapanır:** Kullanıcı onayı ve tek şemaya aktarım.
- **Parçalar:** R10, R11, C3, C4, C5
- **Kaynak:** P1 s.4, s.11; IR §6.1

## K-02 · Tüp kimlikleri ve çalışma noktası

- **Öncelik / durum:** P0 · AÇIK
- **Açık olan:** Eldeki 12AX7, 6V6GT ve 5Y3GT'nin üreticisi, tam tipi ve veri sayfası kayıtlı değil.
- **Simülasyon varsayımı:** Genel Koren / Child modelleri. Sınır değerleri "veri eksik"; JJ değerleri yalnız referans olarak gösterilir.
- **Nasıl kapanır:** Tüplerin fotoğrafı ve veri sayfası kaydı; model kartlarının güncellenmesi.
- **Parçalar:** V1A, V1B, V2, V3
- **Kaynak:** P1 s.3; IR §7

## K-03 · V1A katot bypass

- **Öncelik / durum:** P0 · AÇIK
- **Açık olan:** Raporda V1A katodu yalnız 1,5 kΩ; bypass kondansatörü tanımlı değil.
- **Simülasyon varsayımı:** Takılı değil (rapordaki tanım). 25 µF varyantı ayrı senaryo olarak denenebilir.
- **Nasıl kapanır:** Kazanç hedefine göre karar; seçilirse değer ve gerilim sınıfı.
- **Parçalar:** C7
- **Kaynak:** P1 s.6; IR §8

## K-04 · V1B katot / NFB düğümü

- **Öncelik / durum:** P0 · AÇIK
- **Açık olan:** Rapor "cathode / NFB node ~1.5k architecture" diyor; düğüm ayrıntısı çizilmemiş.
- **Simülasyon varsayımı:** Bypass'sız 1,5 kΩ katot direnci; 22 kΩ, 4 Ω tapından katoda (özgün 5F1 düzeni).
- **Nasıl kapanır:** Nihai şemada düğümün çizilmesi; NFB polaritesinin OT faz işaretleriyle doğrulanması.
- **Parçalar:** R7, R12
- **Kaynak:** P1 s.6, s.8, s.11

## K-05 · TMB topolojisi ve değerleri

- **Öncelik / durum:** P0 · AÇIK
- **Açık olan:** Yalnız aday aralıklar var: Treble 250 kΩ lin, Bass 1 MΩ, Mid 25 kΩ; 250–500 pF, 20–22 nF, 56–100 kΩ. Bağlantı, pot yönleri ve taper tanımsız.
- **Simülasyon varsayımı:** Anodik çıkıştan sürülen klasik FMV dizilimi; 250 pF / 22 nF / 22 nF / 56 kΩ; Bass log, diğerleri lin.
- **Nasıl kapanır:** Plate-driven simülasyon + dinleme; değerler seçilince PCB footprint.
- **Parçalar:** C8, R13, C9, C10, VR2, VR3, VR4
- **Kaynak:** P1 s.6–7; IR §8.2

## K-06 · EQ / RAW anahtarlama yöntemi

- **Öncelik / durum:** P0 · AÇIK
- **Açık olan:** Kesin bypass yöntemi final şemada belirlenecek.
- **Simülasyon varsayımı:** DPDT: RAW'da ton ağının girişi kuplaj düğümünden ayrılır, volume potu doğrudan C1'e bağlanır ("lift"). Karşılaştırma seçeneği: ağ yük olarak kalır ("tap").
- **Nasıl kapanır:** Topoloji seçimi, kutup sayısı, geçiş anındaki DC referansı.
- **Parçalar:** S2
- **Kaynak:** P1 s.7; IR §8.2

## K-07 · Bright / Dark kapasitör değerleri

- **Öncelik / durum:** P1 · AÇIK
- **Açık olan:** Bright 100–220 pF, Dark 470 pF / 1 nF / 2,2 nF deneme alanı.
- **Simülasyon varsayımı:** Bright 100 pF, Dark 1 nF.
- **Nasıl kapanır:** Gerçek pot + hoparlör ile dinleme.
- **Parçalar:** C11, C12
- **Kaynak:** P1 s.7, s.12

## K-08 · Güç trafosu verisi

- **Öncelik / durum:** P0 · AÇIK
- **Açık olan:** Yüklü / yüksüz gerilim, sargı DCR, regülasyon ve "70 mA"nın (AC sargı akımı mı, DC yük mü) tanımı yok.
- **Simülasyon varsayımı:** 320 VAC yüksüz EMK kabul edilir; plaka başına etkin kaynak direnci 200 Ω.
- **Nasıl kapanır:** Bobinajcıdan yazılı veri (IR §24).
- **Parçalar:** T1
- **Kaynak:** P1 s.3; IR §6.3, §24

## K-09 · Çıkış trafosu verisi

- **Öncelik / durum:** P1 · AÇIK
- **Açık olan:** Primer DCR, endüktans, kaçak endüktans, faz işaretleri ve DC kapasitesi bilinmiyor.
- **Simülasyon varsayımı:** Primer DCR 300 Ω, Lp 15 H, kaçak 30 mH, sekonder bölüm DCR 0,30 / 0,15 / 0,25 Ω. Nüve doyumu modellenmez.
- **Nasıl kapanır:** Bobinajcıdan yazılı veri; faz işaretleri ve kablo renkleri.
- **Parçalar:** T2
- **Kaynak:** P1 s.7–8; IR §9, §24

## K-10 · C3 / C4 / C5 gerilim marjı

- **Öncelik / durum:** P0 · KOŞULLU
- **Açık olan:** 16 µF / 500 V ve eldeki 10 µF / 450 V parçalar; yüksüz ve ısınma geçişinde tepe gerilim incelenmedi.
- **Simülasyon varsayımı:** Soğuk açılış senaryosu tepe değerleri kaydeder ve nominal gerilimle karşılaştırır. Sonuç model tahminidir.
- **Nasıl kapanır:** İlk testte yüksüz ve ısınma B+ tepe ölçümü; satın alma ön koşulu.
- **Parçalar:** C3, C4, C5
- **Kaynak:** P1 s.4, s.12; IR §6.2

## K-11 · Heater orta ucu

- **Öncelik / durum:** P1 · AÇIK
- **Açık olan:** Fiziksel 6,3 V orta uç ya da 2 × 100 Ω yapay orta uç.
- **Simülasyon varsayımı:** Elektrik modeline girmez; ikisi aynı anda eklenmez.
- **Nasıl kapanır:** PT teklifine göre.
- **Parçalar:** R14
- **Kaynak:** P1 s.4; IR §7.3

## K-12 · Bleeder ağı

- **Öncelik / durum:** P1 · AÇIK
- **Açık olan:** Rev A'da yok; PCB finalinde değerlendirilecek.
- **Simülasyon varsayımı:** Takılı değil. 220 kΩ varyantı senaryo olarak denenebilir.
- **Nasıl kapanır:** Değer, güç ve sürekli yük etkisiyle karar.
- **Parçalar:** R16
- **Kaynak:** P1 s.12

## K-13 · Şebeke sigortası

- **Öncelik / durum:** P1 · AÇIK
- **Açık olan:** PT VA ve inrush verisi olmadan seçilemez.
- **Simülasyon varsayımı:** Modelde yok.
- **Nasıl kapanır:** PT verisinden sonra 250 V sigorta seçimi.
- **Parçalar:** F1
- **Kaynak:** P1 s.4, s.12

## K-14 · Volume taper

- **Öncelik / durum:** P2 · GEÇİCİ
- **Açık olan:** Eldeki 1 MΩ lineer pot ilk prototipte kullanılacak.
- **Simülasyon varsayımı:** Lineer. Log profil karşılaştırma için seçilebilir.
- **Nasıl kapanır:** İleride 1 MΩ log / audio.
- **Parçalar:** VR1
- **Kaynak:** P1 s.6

## K-15 · Screen direnci ve 6V6 grid stopper

- **Öncelik / durum:** P2 · TANIMSIZ
- **Açık olan:** Raporda kesin değerli parça olarak yok.
- **Simülasyon varsayımı:** Eklenmedi: screen doğrudan B+2, grid doğrudan C2 / R8 düğümü.
- **Nasıl kapanır:** Gerekçeli tasarım kararı verilirse eklenir.
- **Parçalar:** V2
- **Kaynak:** IR §20

## K-16 · Hoparlör ve giriş kaynağı modeli

- **Öncelik / durum:** P1 · AÇIK
- **Açık olan:** Otomobil hoparlörünün empedans eğrisi, T/S ve hassasiyeti bilinmiyor.
- **Simülasyon varsayımı:** Omik yük direnci (dummy load). Giriş: ideal kaynak ya da temsili manyetik + kablo.
- **Nasıl kapanır:** Hoparlör ölçümü; SPL / kabin tonu iddiası yapılmaz.
- **Parçalar:** J2, J3, J4
- **Kaynak:** P1 s.9; IR §10

## Deneysel profil DENEYSEL-01

Açık kararlar kapanana kadar simülasyonun çalışabilmesi için seçilen ilk deney değerleri.

| Parça | Değer | Gerekçe |
|---|---|---|
| C8 | 250 pF | P1 aday aralığının alt ucu (250–500 pF). |
| R13 | 56 kΩ | P1 aday aralığının alt ucu (56–100 kΩ). |
| C9 | 22 nF | P1 aday sınıfı (20–22 nF); kuplaj kapasitörüyle aynı değer. |
| C10 | 22 nF | P1 aday sınıfı (20–22 nF). |
| VR2 | 250 kΩ | P1 başlangıç referansı. |
| VR3 | 1 MΩ | P1 başlangıç referansı; taper tanımsız, log seçildi. |
| VR4 | 25 kΩ | P1 başlangıç referansı. |
| C11 | 100 pF | P1 aday aralığının alt ucu (100–220 pF). |
| C12 | 1 nF | P1 deneme değerlerinin ortası (470 pF / 1 nF / 2,2 nF). |
| R16 | 220 kΩ (takılı değil) | Opsiyonel varyant değeri. |
| C7 | 25 µF (takılı değil) | Opsiyonel varyant değeri. |
| T1 | 320 VAC yüksüz EMK, Rt 200 Ω / plaka | Üretici verisi yok. Rt = 200 Ω küçük bir 320-0-320 V sargı için temsili etkin kaynak direncidir. |
| T2 | DCR 300 Ω, Lp 15 H, kaçak 30 mH | Üretici verisi yok. P1: "primer DCR birkaç yüz ohm mertebesinde olabilir". |
| RAW yöntemi | lift | K-06 |
| Taper | VR1 lin, VR2 lin, VR3 log, VR4 lin | K-05, K-14 |
