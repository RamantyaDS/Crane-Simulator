# Simulator Crane Link-Belt RTC-80160 Series II

Simulator 3D **rough terrain crane Link-Belt RTC-80160 Series II (145 t)** di proyek pabrik. Kapasitasnya memakai **load chart resmi Link-Belt** (Technical Data 5825, tabel 85% metrik) yang dibaca langsung dari PDF ke `src/sim/charts.json`.

Live: https://ramantyads.github.io/Crane-Simulator/

Bagian dari seri simulator Traknus: [forklift](https://ramantyads.github.io/Forklif-Simulator/) → crane → [genset](https://ramantyads.github.io/Genset-Simulator/) → [traktor](https://ramantyads.github.io/Tractor-Simulator/).

## Yang disimulasikan
- **Carrier 6x6** dengan empat mode setir (depan, belakang, semua roda, crab), gigi tinggi 25 km/j dan rendah, serta aturan jalan (beam masuk, boom pendek, pick & carry hanya merayap).
- **Outrigger** penuh/setengah/masuk dengan jack per kaki dan auto-level. Tekanan pontoon dihitung dari momen crane dan dibandingkan dengan daya dukung tanah (kerikil padat, urug lunak, lantai beton). Pontoon bisa **amblas**, crane jadi miring, dan chart tidak berlaku lagi di atas 1%. Ada pilihan matras.
- **Boom pin & latch 6 seksi** (12,9–59,5 m), hanya boleh bekerja di panjang terkunci pin. Tidak bisa di-telescope saat membawa beban. Boom melendut menurut beban.
- **Fly jib** 9,4 / 16,8 m dengan offset 2°, 15°, 30°, 45° (hanya di boom penuh 59,5 m).
- **Counterweight** 15,9 t / 26,7 t / lepas (sistem hidraulik).
- **Winch dan reeving**: enam pilihan hook block, 1–15 jalur tali, beban izin tali 9.809 kg per jalur, tarikan winch 115 kN, kecepatan hook = kecepatan tali dibagi jumlah jalur. Hook ikut tertarik saat boom di-telescope keluar, dan ada **anti two-block**.
- **RCL**: kapasitas dari chart (radius di antara baris memakai baris yang lebih besar), juga dibatasi tali dan hook block. Beban dibaca dari tegangan tali, jadi gerakan kasar ikut terbaca. Di 100% fungsi yang menambah momen (boom turun, telescope keluar, hoist naik) dikunci. Ada bypass darurat.
- **Stabilitas**: momen semua massa terhadap tepi poligon tumpuan. Model dikalibrasi supaya chart ≈ 85% beban guling di daerah stabilitas. Di radius dekat batasnya **struktur**, dan kelebihan beban membuat **boom patah**. Di radius jauh crane bisa **terguling**.
- **Beban berayun** sebagai pendulum pada tali: swing kasar membuat beban berayun keluar, ada tarikan samping saat angkat, angin, tag line, tabrakan dengan gedung, dan pendaratan keras.
- **Rigging** pilihan pemain: sling 2/4 kaki dan spreader bar. Sudut, tegangan per kaki dibanding WLL, dan kemiringan beban dihitung. Rigging yang salah bisa gagal.
- **Bahaya**: jaringan SUTM 20 kV (jarak aman 3,05 m), galian, tanah lunak, kolom dan rangka gedung.

## Beban
Genset Traknus 2250 kVA 14,8 t (model dari Genset Simulator), trafo 45 t, chiller 9,2 t (atap annex 8 m), pelat precast 12 t (mezzanine), bundel balok WF 7,4 t, tangki 60 t, dan **mesin press 100 t**. Press adalah beban maksimal: dengan hook block 7 sheave dan spreader berat totalnya ±104 t, atau 97,6% chart di radius 3,5 m, jadi hanya bisa dilakukan dari titik lift plan.

## Kontrol
- **Mode crane**: A/D swing, W/S boom, E/Q telescope, R/F hoist (Shift = cepat), Spasi rem swing, L swing lock, Z/X tag line.
- **Mode jalan**: W/S gas/rem, A/D setir, Q/E maju/mundur, 1–4 mode setir, H gigi, P rem parkir.
- **Umum**: Tab ganti mode, I mesin, V kamera, mouse untuk memutar dan zoom kamera.
- **Gamepad**: dua stik seperti kabin crane. **HP**: dua joystick virtual.
- **Grafis**: mode ringan secara default (resolusi 1×, tanpa ambient occlusion, model tetap detail). Mode penuh ada di tab Tampilan.

## Sumber
- Link-Belt RTC-80160 Series II Technical Data 5825: load chart, boom, fly, winch, mesin Cummins QSL, outrigger, carrier. Ada juga halaman produk Traknus.
- Ukuran yang tidak tercantum (posisi pin boom, pembagian massa) diperkirakan dan dikalibrasi terhadap chart (lihat `src/sim/crane.test.ts`).
- Suara: rekaman diesel dan pompa hidrolik dari Wikimedia Commons (lihat panel Tombol), plus sintesis.

## Pengembangan
```bash
npm install
npm run dev
npm test
```
