# PRD — Integrasi Pantau Kuota Cockpit & Penempatan Family PRO

- **Status:** Final — Disetujui (Phase 1, 2, & 3 Approved pada 2026-11-19)
- **Mode:** Full PRD
- **Pemilik Produk:** Owner / Admin Pribadi (`trial-manager`)
- **Repositori Terkait:** `trial-manager` & integrasi data dari `jlcodes99/cockpit-tools`

---

# Phase 1: Why & Who

### Glosarium Singkat
| Istilah | Definisi dalam Konteks Fitur Ini |
| :--- | :--- |
| **Akun Pribadi (Akun Cockpit)** | Akun email milik sendiri yang terdaftar di aplikasi pemantau kuota (Cockpit Tools) dan dipakai bergantian untuk kebutuhan AI harian. |
| **Family PRO** | Grup langganan aktif di Trial Manager yang dimiliki oleh satu *Family Owner*, memiliki batas slot anggota, batas masa aktif (*expiry*), kapasitas penyimpanan Google Drive, dan satu *pool* kuota AI bersama. |
| **Pool Kuota Bersama** | Batas pemakaian AI yang dibagi rata untuk semua akun di dalam satu *Family Owner* yang sama. Jika satu akun menghabiskan kuota, akun lain di *Family Owner* yang sama ikut menjadi 0%. |
| **Konflik Family Ganda** | Kondisi ketika lebih dari satu **Akun Pribadi** aktif masuk ke dalam **Family PRO** milik *Family Owner* yang sama, sehingga perpindahan antar akun tersebut tidak menambah kuota efektif. |

---

## 1.1 Masalah & Konteks (Context)

### As-Is / To-Be
- **Kondisi Saat Ini (As-Is):**
  Owner mengelola cukup banyak akun pribadi yang tersebar di dua tempat terpisah: **Cockpit Tools** (untuk melihat status paket `PRO`/`FREE`, status kelayakan `bisa`/`ban`, dan sisa kuota AI per model) serta **Trial Manager** (untuk melihat daftar family, slot anggota kosong, masa aktif, dan sisa penyimpanan Google Drive). Saat ingin memakai akun atau meng-upgrade akun `FREE` agar masuk ke paket `PRO`, owner harus memeriksa dan mencocokkan dua aplikasi secara manual: mencari akun mana yang masih `FREE` dan layak pakai, lalu memeriksa satu per satu family di Trial Manager untuk mencari family `PRO` yang masih punya slot kosong, sisa penyimpanan Google Drive yang lega, **dan belum ditempati oleh akun pribadi lain**. Proses manual ini lambat, rawan terlewat (akun `FREE` menganggur tidak masuk `PRO`), dan berisiko memasukkan dua akun pribadi ke *Family Owner* yang sama sehingga kuota langsung habis bersamaan saat berpindah akun.
- **Kondisi yang Diinginkan (To-Be):**
  Trial Manager menjadi satu pusat kendali terpadu untuk seluruh akun pribadi dan family. Owner dapat langsung melihat status paket (`PRO`/`FREE`), status kelayakan (`bisa`/`ban`), dan sisa kuota AI dari akun-akun Cockpit Tools berdampingan dengan data family & sisa penyimpanan Google Drive. Sistem secara otomatis menyoroti akun `FREE` yang layak di-upgrade, mendeteksi jika ada **Konflik Family Ganda**, serta merekomendasikan daftar **Family PRO** yang masih punya slot kosong, penyimpanan Google Drive lega, dan **belum diisi akun pribadi lain**—sehingga keputusan pindah akun atau penempatan family bisa diambil dalam hitungan detik dari satu layar.

### Kenapa Sekarang? (Why Now?)
Jumlah akun pribadi yang dikelola sudah makin banyak sehingga pengorganisasian manual lintas dua aplikasi tidak lagi praktis. Owner mulai membutuhkan sistem penyortiran yang rapi agar:
1. Perpindahan akun saat kuota habis menjadi jauh lebih cepat dan terarah.
2. Tidak ada lagi akun pribadi berstatus `FREE` yang terbuang percuma padahal masih ada slot `PRO` dan penyimpanan Google Drive yang tersedia.
3. Sebaran akun pribadi ke berbagai *Family Owner* yang berbeda bisa terjaga konsisten.

### Proposisi Nilai / Why Us?
Aplikasi Cockpit Tools hanya fokus pada pemantauan kuota lokal per akun dan tidak mengetahui struktur family, slot anggota, tanggal kedaluwarsa, maupun sisa penyimpanan Google Drive. Sebaliknya, Trial Manager sudah menyimpan seluruh data family dan integrasi kuota Google Drive. Menggabungkan konteks keduanya di dalam Trial Manager menghasilkan kemampuan yang tidak dimiliki masing-masing aplikasi secara terpisah: **rekomendasi penempatan akun `FREE` ke Family `PRO` yang bebas konflik kuota bersama dan memiliki penyimpanan Drive yang lega**.

---

## 1.2 Persona & Stakeholders

### Persona & Kebutuhan
| Role | JTBD (When / Want / So I can) | Internal (Mindset / Beban Kognitif) | External (Dinamika / Batasan) | Result (Tanggung Jawab / Risiko) |
| :--- | :--- | :--- | :--- | :--- |
| **Owner / Admin Pribadi** *(Pengguna Tunggal)* | **Ketika** saya ingin berpindah akun karena kuota habis atau ingin memasukkan akun `FREE` saya ke paket `PRO`, **saya ingin** melihat status `PRO`/`FREE`, status `bisa`/`ban`, sisa kuota AI, serta rekomendasi Family `PRO` yang slot & penyimpanan Drive-nya lega tanpa konflik family yang sama di satu layar, **sehingga saya bisa** memaksimalkan seluruh kuota & penyimpanan tanpa salah menempatkan akun ke family yang sama. | Lelah mengingat manual akun mana masuk family mana, mana yang kena `ban`, dan mana yang masih `FREE`. Ingin tampilan yang cepat disortir tanpa bolak-balik aplikasi. | Dibatasi oleh aturan *pool* kuota bersama per *Family Owner* (1 family dipakai 2 akun pribadi = sia-sia) serta ketergantungan data kuota dari aplikasi pihak ketiga (Cockpit Tools). | Bertanggung jawab penuh atas distribusi akun pribadi. Risiko jika salah kelola: kuota AI & slot `PRO` hangus sebelum masa aktif berakhir, atau akun pribadi bentrok di satu family yang sama. |

*(Tidak ada persona sekunder/pembeli/publik karena fitur ini khusus penggunaan internal/pribadi oleh Owner).*

---

## 1.3 Nilai Bisnis (Business Value)

### Usage Value / Time-to-Value (TTV)
- **Momen Aktivasi:** Begitu data akun dari Cockpit Tools pertama kali tersinkron ke Trial Manager, owner langsung melihat daftar akun pribadi yang sudah dikelompokkan berdasarkan status (`PRO`/`FREE`, `bisa`/`ban`, sisa kuota) beserta daftar rekomendasi Family `PRO` yang aman untuk ditempati (slot kosong + penyimpanan Drive lega + belum ada akun pribadi lain).
- **Nilai Langsung:** Menghemat waktu pencocokan manual setiap kali pindah akun atau mengatur penempatan family, sekaligus meningkatkan total kapasitas kuota AI efektif yang bisa dipakai secara paralel.

### Packaging / Pricing & Monetization
- **N/A** — Fitur ini murni untuk efisiensi dan pemakaian pribadi oleh Owner (bukan produk komersial dan tidak dibuka untuk pengguna publik).

### Opportunity Cost / Switching Cost
- **Opportunity Cost jika tidak dibangun:** Akun `FREE` terus terlewat tidak dimasukkan ke slot `PRO` yang kosong, kapasitas penyimpanan Google Drive dan masa aktif family terbuang percuma, serta waktu owner habis untuk cek manual dua aplikasi dan memperbaiki salah penempatan akun pada family yang sama.
- **Switching Cost:** Rendah untuk mulai mengadopsi karena dibangun langsung di dalam Trial Manager yang memang sudah dipakai owner sehari-hari.

---

## 1.4 Metrik Keberhasilan (Success Metrics)

### Arah NSM (Problem-First)
- **Masalah yang diselesaikan:** Akun pribadi tidak terorganisir (ada yang masih `FREE` menganggur, ada yang berisiko menumpuk di satu *Family Owner* yang sama sehingga kuota bentrok, dan sulit memilih family yang penyimpanan Google Drive-nya masih lega).
- **Perubahan perilaku yang diharapkan pertama kali:** Owner tidak lagi mencocokkan Cockpit Tools dan Trial Manager secara manual, melainkan langsung memakai daftar rekomendasi & filter di Trial Manager untuk menempatkan akun `FREE` ke Family `PRO` yang unik serta memilih akun aktif saat berpindah.
- **North Star Metric (tepat 1):** **Persentase Akun Pribadi Layak Pakai yang Tersebar di Family PRO Unik**.
- **Kenapa NSM ini (bukan vanity metric):** Metrik ini tidak sekadar menghitung seberapa sering data disinkronkan, melainkan langsung mengukur hasil nyata dari tujuan utama owner: semakin tinggi angkanya, semakin banyak akun pribadi yang benar-benar aktif di paket `PRO` **tanpa bentrok kuota bersama** dalam satu family.

### Kontrak Metrik Wajib (Required Metric Contract)
| Type | Metric | Definition | Denominator | Baseline Window | Target | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **NSM** *(wajib, tepat 1)* | Persentase Akun Pribadi Layak Pakai di Family PRO Unik | `(Jumlah akun pribadi berstatus "bisa" yang tergabung di Family PRO aktif dengan maksimal 1 akun pribadi per Family Owner) / (Total akun pribadi berstatus "bisa" yang tercatat)` × 100% | Seluruh akun pribadi berstatus `bisa` (tidak `ban`) | 7 hari sebelum fitur dipakai *(diukur saat sinkronisasi pertama)* `[Asumsi]` | **≥ 90%** dalam 14 hari setelah penggunaan | Owner |

### Metrik Opsional (Guardrail / Pendukung)
| Type | Metric | Definition | Denominator | Baseline Window | Target | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Counter (Guardrail)** | Jumlah Konflik Family Ganda | Jumlah Family `PRO` aktif yang menampung **> 1** akun pribadi berstatus `bisa` secara bersamaan | Seluruh Family `PRO` aktif | Saat sinkronisasi pertama | **0 konflik** | Owner |
| **Leading** | Waktu Identifikasi Akun / Family Target | Rata-rata waktu yang dibutuhkan owner dari membuka Trial Manager hingga menemukan akun siap pakai atau Family `PRO` target untuk akun `FREE` | Setiap sesi pengecekan/pemindahan akun | 7 hari sebelum fitur (manual) | **< 30 detik** | Owner |

### Validasi Hipotesis
| Field | Content |
| :--- | :--- |
| **Hypothesis** | Jika kita menyatukan status akun Cockpit (`PRO`/`FREE`, `bisa`/`ban`, sisa kuota) dengan data Family & sisa penyimpanan Google Drive di Trial Manager serta menampilkan peringatan konflik family ganda, maka persentase akun pribadi layak pakai yang tersebar di Family `PRO` unik akan meningkat dan konflik family turun ke 0, karena owner tidak lagi kesulitan mencocokkan dua aplikasi secara manual. |
| **In Scope** | Pemantauan status & kuota akun pribadi, pencocokan otomatis akun pribadi dengan Family di Trial Manager, deteksi konflik family ganda, dan panduan rekomendasi Family `PRO` dengan slot kosong & penyimpanan Google Drive lega. |
| **Out of Scope** | Pembelian/pembuatan akun otomatis, otomatisasi invite/accept Google Family, perpindahan akun otomatis di dalam aplikasi Cockpit Tools dari jarak jauh, serta akses untuk pengguna publik/pelanggan. |
| **Success Signal** | Owner rutin memakai Trial Manager sebagai acuan utama untuk menempatkan akun `FREE` ke Family `PRO` dan jumlah konflik family ganda menjadi 0. |
| **Failure Signal** | Owner tetap harus membuka dan mencocokkan Cockpit Tools + Trial Manager secara manual karena data kuota sering usang atau aturan pencocokan family tidak akurat. |

---

# Phase 2: What & If

> **Keputusan Terkunci (Disetujui — 2026-11-19, Diperbarui sesuai Format Ekspor Asli):**
> - **Format Ekspor Asli Cockpit Tools:** Array JSON berisi `{ email, refresh_token, tags? }` (tanpa field `PRO`/`FREE` dan tanpa angka kuota model). Field `refresh_token` wajib dibuang di browser sebelum dikirim (`BR-05`).
> - **Sumber Status Paket (`PRO`/`FREE`) di v1.0:** Diturunkan otomatis dari pemetaan email ke Family aktif di Trial Manager (cocok dengan Family aktif & tidak banned → **`PRO (via Family)`**; belum masuk Family aktif mana pun → kandidat **`FREE / Belum Masuk Family`**), dengan opsi override manual `PRO`/`FREE` jika akun berlangganan di luar daftar Family Trial Manager.
> - **Status Kelayakan Akun:** Mendukung 4 status nyata dari tag Cockpit Tools: `bisa`, `ban`, `need_verif` (dari tag `"need verif"`), dan `untagged` (tanpa tag). Akun aktif yang ikut dihitung dalam Konflik Family Ganda & rekomendasi adalah akun yang **tidak** berstatus `ban` dan **tidak** berstatus `need_verif` (yaitu `bisa` atau `untagged`).
> - **Mekanisme Masuk Data Cockpit:** Opsi C (Hybrid Bertahap) — P0 menggunakan Impor Snapshot Manual di Web (daftar akun + tag), P1 menambah Sinkronisasi Otomatis dari PC lokal (termasuk angka kuota AI jika tersedia via layanan lokal resmi Cockpit Tools).
> - **Alur Penempatan Akun `FREE` ke Family `PRO`:** Terpandu (*Assisted*) — proses kirim undangan dari akun Owner dan terima (*accept*) undangan di akun `FREE` tetap dilakukan manual oleh Owner di Google demi keamanan akun; Trial Manager menyediakan rekomendasi bebas konflik, alat bantu cepat (salin email & tautan Google Family), dan pencatatan setelah *accept*.
> - **Ambang Batas "Storage Lega":** Sisa kapasitas Google Drive `≥ 500 GB`.

## 2.1 User Story Inti
```text
Sebagai Owner / Admin Pribadi,
Saya ingin menggabungkan data status & kuota akun dari Cockpit Tools dengan data Family & sisa penyimpanan Google Drive di Trial Manager,
Sehingga saya bisa langsung melihat akun mana yang layak dipakai, mendeteksi konflik family ganda, dan memandu penempatan akun FREE ke Family PRO yang unik dan lega penyimpanannya.
Karena jika tidak, saya harus bolak-balik mengecek dua aplikasi secara manual, akun FREE terbuang percuma, dan berisiko memasukkan dua akun pribadi ke Family Owner yang sama sehingga kuotanya habis bersamaan.
```

---

## 2.2 MoSCoW User Stories & Acceptance Criteria

### Must Have — P0

#### `[US-01]` Impor Snapshot Akun dari Cockpit Tools
- **Story:** Sebagai **Owner**, saya ingin **mengimpor daftar akun beserta status (`PRO`/`FREE`, `bisa`/`ban`) dan sisa kuotanya dari Cockpit Tools ke Trial Manager**, sehingga **seluruh data akun pribadi saya tersimpan terpusat tanpa input satu per satu**. Karena jika tidak, saya tidak punya data kuota dan status terbaru untuk dicocokkan dengan daftar Family.
- **Definisi Field (Input Impor & Entitas Akun Cockpit):**

| Nama Field | Tipe | Wajib/Opsional | Batasan & Validasi | Default | Contoh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `berkas_snapshot` | Berkas / Teks terstruktur | Wajib | Format teks terstruktur yang valid; ukuran maksimal `5 MB`; minimal berisi 1 akun | — | `antigravity-accounts.json` |
| `email` | Teks (Email) | Wajib | Format email valid, maks `254` karakter, dinormalisasi huruf kecil & tanpa spasi pinggir (`BR-01`) | — | `qulhu09@gmail.com` |
| `tier_paket` | Pilihan (`PRO` / `FREE` / `AUTO_FAMILY`) | Opsional | File ekspor bawaan Cockpit Tools tidak membawa field ini; default `AUTO_FAMILY` (diturunkan otomatis dari keanggotaan Family aktif di Trial Manager), dapat di-override manual oleh Owner | `AUTO_FAMILY` | `FREE` |
| `status_kelayakan` | Pilihan (`bisa` / `ban` / `need_verif` / `untagged`) | Otomatis dari `tags` | Dipetakan dari array `tags` (case-insensitive): `"ban"` → `ban`, `"need verif"` → `need_verif`, `"bisa"` → `bisa`, tanpa tag/kosong → `untagged` | `untagged` | `need_verif` |
| `is_current` | Boolean | Opsional | Maksimal 1 akun bernilai `true` (opsional di v1.0 karena tidak ada di file ekspor; aktif jika dikirim via sync v1.1) | `false` | `true` |
| `kuota_model` | Daftar Objek | Opsional | Opsional di v1.0 (kosong `[]` untuk file ekspor bawaan; tampil otomatis jika tersedia di payload v1.1). Item: `nama_model`, `persen_sisa` (`0`–`100` / `null`), `waktu_reset` | `[]` | `Claude (5h): 100%` |
| `catatan_cockpit` | Teks | Opsional | Maks `500` karakter | `""` | `"Akun cadangan"` |
| `waktu_sinkronisasi` | Tanggal-Waktu | Otomatis | Diisi waktu saat impor berhasil diselesaikan | Waktu saat ini | `2026-11-19 17:30` |

- **Pesan Pengguna (Bahasa Indonesia):**
  - Sukses penuh: `"Berhasil memperbarui {N} akun dari Cockpit Tools ({baru} baru, {diperbarui} diperbarui)."`
  - Sukses parsial: `"Berhasil memperbarui {N} akun. {M} baris dilewati karena format email tidak valid."`
  - Galat format: `"Berkas tidak dapat dibaca. Pastikan Anda memilih berkas ekspor yang valid dari Cockpit Tools."`
  - Galat ukuran: `"Ukuran berkas melebihi batas maksimal 5 MB."`
  - Galat kosong: `"Tidak ada data akun yang ditemukan di dalam berkas ini."`
  - Galat koneksi/timeout: `"Gagal menyimpan data karena koneksi terputus. Tidak ada perubahan yang disimpan, silakan coba lagi."`
  - Galat sesi habis: `"Sesi admin Anda telah berakhir. Silakan masuk kembali untuk mengimpor data."`

- **Acceptance Criteria:**
  - [ ] **AC-01-01 (Happy Path — Impor & Pratinjau):**
    **Given** Owner sudah masuk sebagai admin di Trial Manager dan memiliki berkas ekspor valid dari Cockpit Tools berisi 8 akun (termasuk data rahasia/kredensial di dalam berkas ekspor bawaan),
    **When** Owner mengunggah atau menempelkan berkas pada modal Impor Cockpit lalu mengonfirmasi tombol **"Simpan Snapshot"**,
    **Then** sistem menampilkan pratinjau jumlah akun (`baru` & `diperbarui`), menyimpan hanya metadata & angka kuota tanpa menyimpan kredensial/token rahasia (`BR-05`), menormalkan email menjadi huruf kecil (`BR-01`), memperbarui daftar akun seketika, dan menampilkan pesan sukses penuh.
    - *Verification:* Unggah berkas uji berisi 8 akun (2 baru, 6 lama, disertai field rahasia dummy). Pastikan 8 akun tampil dengan angka kuota benar, field rahasia tidak tersimpan/tidak muncul di mana pun, dan toast sukses muncul dengan hitungan tepat.
  - [ ] **AC-01-02 (Reverse Flow — Batal Impor & Hapus Akun dari Daftar Pantauan):**
    **Given** Owner sudah mengunggah berkas di modal Impor dan berada di layar pratinjau,
    **When** Owner menekan **"Batal"** atau menutup modal sebelum menekan **"Simpan Snapshot"**,
    **Then** tidak ada data akun yang diubah atau ditambahkan, dan daftar akun tetap menggunakan snapshot sebelumnya. Jika Owner menghapus satu akun dari daftar pantauan Cockpit, sistem meminta konfirmasi `"Hapus {email} dari daftar pantauan Cockpit? Data Family di Trial Manager tidak akan terhapus."` lalu menghapusnya tanpa memengaruhi data Family.
    - *Verification:* Klik Batal pada pratinjau lalu cek daftar akun tidak berubah; uji hapus 1 akun Cockpit lalu cek kartu Family terkait tetap utuh.
  - [ ] **AC-01-03 (Error Handling & Edge Cases):**
    **Given** Owner mencoba mengimpor berkas rusak, berkas kosong (`0` akun), berkas `> 5 MB`, mengklik tombol **"Simpan Snapshot"** dua kali berturut-turut, atau mengimpor saat sesi habis / koneksi terputus,
    **Then** sistem menolak berkas tidak valid dengan pesan galat yang sesuai, menonaktifkan tombol simpan selama proses berlangsung untuk mencegah duplikasi klik ganda, serta menjaga data lama tetap utuh bila koneksi terputus atau sesi berakhir (`BR-07`).
    - *Verification:* Uji masing-masing kasus (berkas rusak, 0 akun, >5 MB, double-click, offline, sesi habis) dan pastikan pesan galat persis sesuai spesifikasi serta tidak ada data ganda/korup.

---

#### `[US-02]` Dashboard Terpadu Status Akun Cockpit, Kuota AI, dan Pemetaan Family
- **Story:** Sebagai **Owner**, saya ingin **melihat seluruh akun Cockpit beserta paket (`PRO`/`FREE`), status (`bisa`/`ban`), sisa kuota AI, posisi Family Owner-nya, dan filter/urutan cepat di satu layar**, sehingga **saya bisa memilih akun siap pakai atau menemukan akun `FREE` yang belum masuk `PRO` dalam hitungan detik**. Karena jika tidak, saya harus membuka dua aplikasi dan mencocokkan daftar panjang secara manual.
- **Definisi Field (Filter, Pencarian, & Tampilan Daftar):**

| Nama Field | Tipe | Wajib/Opsional | Batasan & Validasi | Default | Contoh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `kata_kunci_cari` | Teks | Opsional | Maks `100` karakter; mencocokkan potongan email akun atau nama Family | `""` | `qulhu` |
| `filter_status` | Pilihan Tunggal | Opsional | `Semua` / `Belum Masuk Family (Kandidat PRO)` / `Sudah di Family PRO` / `Konflik Family` / `Need Verif` / `Kena Ban` / `Belum Ditandai` | `Semua` | `Belum Masuk Family (Kandidat PRO)` |
| `urutan_daftar` | Pilihan Tunggal | Opsional | `Prioritas Aksi (Konflik & Kandidat PRO dulu)` / `Masa Aktif Family Terdekat` / `Sisa Kuota Tertinggi` *(jika ada)* / `Email A-Z` | `Prioritas Aksi` | `Masa Aktif Family Terdekat` |
| `label_family_terkait` | Teks (Terhitung) | Otomatis | Nama Family & peran (`Owner` / `Member`) hasil pencocokan email (`BR-01`), atau `"Belum masuk Family"` | — | `Family 3 (Member)` |
| `indikator_usang` | Lencana (Terhitung) | Otomatis | Muncul jika `waktu_sinkronisasi` > `24 jam` (`BR-06`) | Tidak tampil | `"Data > 24 jam lalu"` |

- **Pesan Pengguna (Bahasa Indonesia):**
  - Kosong (belum pernah impor): `"Belum ada data akun Cockpit. Impor snapshot dari Cockpit Tools untuk mulai memantau kuota dan penempatan Family."`
  - Kosong (hasil filter/cari): `"Tidak ada akun yang cocok dengan filter atau pencarian ini."`
  - Peringatan data usang: `"Data kuota terakhir diperbarui lebih dari 24 jam lalu. Impor ulang untuk angka terbaru."`
  - Galat muat data: `"Gagal memuat daftar akun Cockpit. Periksa koneksi Anda lalu coba muat ulang."`
  - Tanpa izin: `"Halaman ini hanya dapat diakses oleh Admin."`

- **Acceptance Criteria:**
  - [ ] **AC-02-01 (Happy Path — Pemetaan Otomatis & Filter Cepat):**
    **Given** sudah ada akun Cockpit tersimpan dan data Family di Trial Manager,
    **When** Owner membuka panel/tab **"Akun Cockpit"** di dashboard admin dan memilih filter **"FREE Layak Upgrade"**,
    **Then** sistem mencocokkan setiap email akun Cockpit secara otomatis (tanpa membedakan huruf besar/kecil) terhadap email Owner dan Member di seluruh Family (`BR-01`), menampilkan paket (`PRO`/`FREE`), status (`bisa`/`ban`), lencana `Current`, bar sisa kuota per model + waktu reset, nama Family terkait, dan hanya menampilkan akun berstatus `FREE` + `bisa` pada filter tersebut.
    - *Verification:* Cocokkan 1 email berhuruf kapital berbeda (`Qulhu09@gmail.com` vs `qulhu09@gmail.com`); pastikan tetap terpetakan ke Family yang benar dan filter `FREE Layak Upgrade` menyembunyikan akun `PRO` maupun `ban`.
  - [ ] **AC-02-02 (Reverse Flow — Reset Filter & Pencarian):**
    **Given** Owner sedang mengaktifkan filter `"Kena Ban"` dan mengetik kata kunci `"salman"`,
    **When** Owner menekan tombol **"Reset Filter"**,
    **Then** kata kunci pencarian dikosongkan, filter kembali ke `"Semua"`, dan urutan kembali ke default (`Prioritas Aksi`).
    - *Verification:* Klik Reset Filter dan pastikan seluruh akun tampil kembali sesuai jumlah total snapshot.
  - [ ] **AC-02-03 (Error Handling & Edge Cases):**
    **Given** data snapshot terakhir berumur > `24 jam`, atau hasil pencarian kosong, atau koneksi gagal saat memuat, atau halaman diakses tanpa sesi admin,
    **Then** sistem menampilkan lencana peringatan data usang (`BR-06`), pesan kosong yang jelas beserta tombol **"Reset Filter"**, tombol **"Coba Lagi"** saat galat jaringan, serta memblokir akses bagi pengguna non-admin (`BR-07`).
    - *Verification:* Simulasikan timestamp `25 jam` lalu → lencana usang muncul; akses tanpa login admin → ditolak dengan pesan tanpa izin.

---

#### `[US-03]` Deteksi Konflik Family Ganda & Panduan Penempatan Akun `FREE` ke Family `PRO` Unik
- **Story:** Sebagai **Owner**, saya ingin **sistem mendeteksi jika ada lebih dari satu akun pribadi di Family Owner yang sama, merekomendasikan daftar Family `PRO` yang masih punya slot kosong, penyimpanan Google Drive lega (`≥ 500 GB`), dan belum berisi akun pribadi lain, serta menyediakan alat bantu cepat untuk proses invite manual di Google sebelum saya mencatatnya di Trial Manager**, sehingga **saya bisa menyebar akun `FREE` ke Family `PRO` berbeda tanpa bentrok *pool* kuota bersama**. Karena jika tidak, dua akun pribadi di satu Family akan menghabiskan kuota bersama dan sia-sia saat berpindah akun.
- **Definisi Field (Rekomendasi, Alat Bantu Manual, & Pencatatan):**

| Nama Field | Tipe | Wajib/Opsional | Batasan & Validasi | Default | Contoh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `akun_target_email` | Teks (Email) | Wajib | Akun Cockpit berstatus `FREE` dan `bisa` | Dipilih dari kartu akun | `qulhu09@gmail.com` |
| `daftar_family_rekomendasi` | Daftar (Terhitung) | Otomatis | Hanya Family yang memenuhi seluruh syarat `BR-03` dan diurutkan berdasarkan `BR-04` | — | `Family A — Sisa Drive 1.4 TB, 2/5 slot` |
| `ambang_storage_lega` | Angka (GB) | Sistem | Ambang minimal sisa Google Drive untuk mendapat label **"Storage Lega"** (`BR-04`) | `500 GB` *(Terkunci)* | `500 GB` |
| `checklist_panduan_manual` | Informasi & Aksi Cepat | Otomatis | Menampilkan: (1) tombol **Salin Email Akun FREE**, (2) info **Email Owner Family** + akses lihat sandi jika dibutuhkan, (3) tautan **Buka Google Family** (`families.google.com`) di tab baru | — | — |
| `nama_member_baru` | Teks | Wajib saat simpan | Maks `80` karakter, tidak boleh kosong/spasi saja | Bagian depan email sebelum `@` | `qulhu09` |
| `family_tujuan_id` | Pilihan Tunggal | Wajib saat simpan | Harus berasal dari Family yang valid & lolos `BR-02` dan `BR-03` | — | `Family A` |

- **Pesan Pengguna (Bahasa Indonesia):**
  - Peringatan konflik ganda: `"Konflik Family Ganda: {N} akun pribadi aktif berada di {nama_family} ({daftar_email}). Kuota AI akan habis bersamaan — pindahkan salah satu ke Family lain."`
  - Salin email sukses: `"Email {email} berhasil disalin. Tempelkan di halaman undangan Google Family."`
  - Sukses catat penempatan: `"{email} berhasil dicatat masuk ke {nama_family}."`
  - Kosong (tidak ada family memenuhi syarat): `"Belum ada Family PRO yang memenuhi syarat (slot kosong, belum kedaluwarsa, dan bebas akun pribadi lain)."`
  - Peringatan jika storage Drive belum terhubung: `"Data penyimpanan Google Drive belum terhubung — menampilkan sisa kapasitas manual."`
  - Galat konflik saat simpan (edit bersamaan): `"Gagal mencatat akun: {nama_family} sudah terisi akun pribadi lain atau slot-nya baru saja penuh."`
  - Galat nama kosong: `"Nama anggota wajib diisi (maksimal 80 karakter)."`

- **Acceptance Criteria:**
  - [ ] **AC-03-01 (Happy Path — Deteksi Konflik, Panduan Invite Manual, & Pencatatan):**
    **Given** terdapat 1 akun Cockpit berstatus `FREE` + `bisa` (`qulhu09@gmail.com`) yang belum masuk Family, serta terdapat 3 Family `PRO` aktif:
    - Family A: 2/5 slot, belum ada akun Cockpit lain, sisa Google Drive `1.4 TB` (terhubung)
    - Family B: 3/5 slot, belum ada akun Cockpit lain, sisa Google Drive `200 GB` (terhubung)
    - Family C: 1/5 slot, **sudah berisi** akun Cockpit aktif lain (`qulhu463@gmail.com`), sisa Drive `1.8 TB`
    **When** Owner menekan **"Cari Family PRO"** pada akun `qulhu09@gmail.com`, memilih Family A, menggunakan alat bantu salin email & tautan Google Family untuk melakukan invite + accept secara manual di Google, lalu menekan **"Catat Sudah Masuk Family"**,
    **Then** sistem menampilkan hanya **Family A dan Family B** di daftar rekomendasi (Family C disembunyikan karena melanggar `BR-02`), mengurutkan **Family A di urutan #1** dengan lencana **"Storage Lega"** (`≥ 500 GB`, `BR-04`), menyalin email dengan 1 klik + membuka `families.google.com` di tab baru, dan setelah dikonfirmasi mencatat `qulhu09@gmail.com` sebagai anggota Family A dengan pesan sukses. Jika pada data awal ditemukan ≥ 2 akun Cockpit aktif (`bisa`) di satu Family yang sama, banner/lencana **"Konflik Family Ganda"** tampil jelas (`BR-02`).
    - *Verification:* Uji dengan 3 Family skenario di atas; pastikan Family C tidak muncul di rekomendasi, tombol Salin Email menyalin teks yang benar ke clipboard, tautan Google Family terbuka di tab baru, dan setelah disimpan Family A tidak lagi muncul di rekomendasi untuk akun `FREE` berikutnya.
  - [ ] **AC-03-02 (Reverse Flow — Batal Penempatan):**
    **Given** Owner sudah membuka panel rekomendasi untuk `qulhu09@gmail.com` dan memilih Family A (belum sempat menyelesaikan accept di Google),
    **When** Owner menekan **"Batal"** sebelum menekan **"Catat Sudah Masuk Family"**,
    **Then** panel rekomendasi tertutup dan daftar anggota Family A tidak berubah.
    - *Verification:* Klik Batal lalu cek jumlah anggota Family A tetap `2/5`.
  - [ ] **AC-03-03 (Error Handling & Edge Cases):**
    **Given** semua Family `PRO` sudah penuh / sudah ditempati akun Cockpit lain / sudah kedaluwarsa, ATAU saat Owner menekan **"Catat Sudah Masuk Family"** terjadi perubahan bersamaan sehingga slot Family tujuan sudah penuh / baru diisi akun Cockpit lain, ATAU Owner mengosongkan `nama_member_baru`, ATAU menekan tombol simpan dua kali,
    **Then** sistem menampilkan pesan kosong yang jelas saat tidak ada rekomendasi, menolak penyimpanan dengan pesan galat spesifik tanpa membuat data ganda atau konflik family (`BR-02`, `BR-03`), dan menonaktifkan tombol saat proses penyimpanan berlangsung.
    - *Verification:* Uji saat 0 family tersedia, saat nama dikosongkan, saat klik ganda, dan saat slot penuh di tab lain sebelum klik simpan.

---

### Should Have — P1

#### `[US-04]` Sinkronisasi Otomatis Berkala dari PC Lokal *(Opsi C — Tahap 2)*
- **Story:** Sebagai **Owner**, saya ingin **mengaktifkan kunci akses sinkronisasi agar PC lokal tempat Cockpit Tools berjalan dapat mengirim pembaruan status & kuota secara otomatis ke Trial Manager**, sehingga **saya tidak perlu mengunggah file ekspor secara manual setiap hari**.
- **Definisi Field:**
  - `kunci_sinkronisasi`: Teks acak rahasia, dibuat otomatis oleh sistem, hanya ditampilkan penuh 1 kali saat dibuat, dapat dibuat ulang (*regenerate*) atau dicabut (*revoke*).
  - `status_auto_sync`: Pilihan (`Aktif` / `Nonaktif`), default `Nonaktif`.
  - `waktu_terakhir_diterima`: Tanggal-waktu otomatis saat pembaruan terakhir diterima.
- **Pesan Pengguna:**
  - Kunci dibuat: `"Kunci sinkronisasi berhasil dibuat. Simpan kunci ini di pengirim lokal Anda — kunci tidak akan ditampilkan penuh lagi setelah jendela ini ditutup."`
  - Kunci dicabut: `"Kunci sinkronisasi telah dicabut. Pengiriman otomatis dari PC lokal kini dihentikan."`
  - Galat kunci tidak valid (di log status): `"Permintaan sinkronisasi ditolak karena kunci tidak valid atau sudah dicabut."`
- **Acceptance Criteria:**
  - [ ] **AC-04-01 (Happy Path):** **Given** Owner berada di pengaturan Sinkronisasi Cockpit, **When** Owner menekan **"Buat Kunci Sinkronisasi"** dan pengirim lokal mengirimkan snapshot valid memakai kunci tersebut, **Then** daftar akun Cockpit di Trial Manager terbarui otomatis sesuai `BR-01` dan `BR-05`, dan `waktu_terakhir_diterima` terbarui.
  - [ ] **AC-04-02 (Reverse Flow):** **Given** kunci sinkronisasi sedang aktif, **When** Owner menekan **"Cabut Kunci"** dan mengonfirmasi, **Then** status berubah menjadi `Nonaktif` dan pengiriman selanjutnya dengan kunci lama langsung ditolak.
  - [ ] **AC-04-03 (Error Handling):** **Given** pengiriman datang dengan kunci salah/dicabut atau format data rusak, **Then** data akun yang sudah ada di Trial Manager tidak terpengaruh dan status galat dicatat.

#### `[US-05]` Indikator Ringkas Cockpit & Peringatan `ban` pada Kartu Family (Admin)
- **Story:** Sebagai **Owner**, saya ingin **melihat indikator ringkas akun Cockpit (status `PRO`/`FREE`, `Current`, sisa kuota utama, serta peringatan jika akun ditandai `ban` di Cockpit)** langsung pada kartu Family di dashboard admin, sehingga **saya bisa memantau kondisi Family dan akun Cockpit sekaligus dari tampilan utama**.
- **Definisi Field:**
  - `lencana_cockpit_kartu`: Ringkasan otomatis (`PRO`/`FREE`, `Current`, persentase kuota terendah/utama, dan peringatan `ban` / `Konflik Family Ganda`) — hanya tampil di mode admin (`BR-07`).
- **Pesan Pengguna:**
  - Peringatan mismatch `ban`: `"Akun ini ditandai 'ban' di Cockpit Tools, tetapi Family ini belum ditandai Banned."`
- **Acceptance Criteria:**
  - [ ] **AC-05-01 (Happy Path):** **Given** sebuah Family di dashboard admin memiliki email owner atau anggota yang cocok dengan akun Cockpit (`BR-01`), **When** Owner melihat kartu Family tersebut, **Then** lencana ringkas Cockpit tampil tanpa merusak tampilan penyimpanan Google Drive; jika akun ditandai `ban` di Cockpit namun Family belum `is_banned`, peringatan mismatch muncul.
  - [ ] **AC-05-02 (Reverse Flow):** **Given** akun Cockpit dihapus dari daftar pantauan, **When** kartu Family dimuat ulang, **Then** lencana Cockpit tidak lagi ditampilkan dan kartu kembali normal.
  - [ ] **AC-05-03 (Error Handling):** **Given** tampilan dibuka dalam mode non-admin/read-only, **Then** seluruh lencana dan aksi Cockpit disembunyikan sepenuhnya (`BR-07`).

---

### Could Have — P2

#### `[US-06]` Sorotan Prioritas "Hampir Kedaluwarsa tapi Kuota Masih Penuh"
- **Story:** Sebagai **Owner**, saya ingin **melihat sorotan khusus untuk akun `PRO` yang masa aktif Family-nya tinggal `≤ 3 hari` tetapi sisa kuota mingguannya masih `≥ 50%`**, sehingga **saya bisa menghabiskan kuota akun tersebut lebih dulu sebelum masa aktifnya hangus**.
- **Acceptance Criteria:**
  - [ ] **AC-06-01 (Happy Path):** **Given** ada akun Cockpit `PRO` + `bisa` yang tergabung di Family dengan sisa masa aktif `≤ 3 hari` dan minimal satu kuota mingguan `≥ 50%`, **When** Owner membuka daftar Akun Cockpit, **Then** akun tersebut menampilkan lencana **"Pakai Dulu (Hampir Habis Masa Aktif)"**.
  - [ ] **AC-06-02 (Reverse Flow):** `N/A (label terhitung otomatis berdasarkan data tanggal & kuota; hilang otomatis jika kuota turun < 50% atau masa aktif diperpanjang)`.
  - [ ] **AC-06-03 (Error Handling):** **Given** Family tidak memiliki tanggal kedaluwarsa, **Then** akun tidak ditandai sebagai hampir kedaluwarsa.

---

### Won't Have — P3 (Di Luar Ruang Lingkup Rilis Ini)
1. **Perpindahan akun otomatis (*remote switch account*) di Cockpit Tools dari web Trial Manager** — Membutuhkan layanan kontrol dua arah yang selalu aktif di PC lokal dan menambah risiko keamanan. *Kondisi tinjau ulang:* Dipertimbangkan di v2 jika owner merasa berpindah akun manual di Cockpit Tools masih menjadi hambatan utama.
2. **Otomatisasi kirim undangan (*invite*) atau terima (*accept*) Google Family** — *Explicit Won't Do*. Google tidak menyediakan API resmi untuk aksi ini dan otomasi browser berisiko tinggi memicu verifikasi/pembatasan akun Google. Proses invite & accept tetap dilakukan manual oleh Owner di Google dengan bantuan checklist di Trial Manager.
3. **Akses publik / tampilan untuk pengguna selain Owner** — *Explicit Won't Do* karena fitur ini 100% alat produktivitas pribadi.

---

### Traceability Matrix (P0 Wajib)
| Section 1 Pain Point / JTBD | P0 Story ID | P0 Story Title | Acceptance Criteria IDs | Section 3 Contract/Constraint Reference |
| :--- | :--- | :--- | :--- | :--- |
| Data akun terpisah di 2 aplikasi (Cockpit vs Trial Manager) | `US-01` | Impor Snapshot Akun dari Cockpit Tools | `AC-01-01`, `AC-01-02`, `AC-01-03` | `POST /functions/v1/cockpit-import`, `DELETE /rest/v1/cockpit_accounts`, tabel `cockpit_accounts`, `NF-01`, `NF-02` (`BR-05`) |
| Sulit menyortir mana `PRO`/`FREE`, `bisa`/`ban`, sisa kuota, & posisi Family-nya | `US-02` | Dashboard Terpadu Status Akun Cockpit, Kuota AI, dan Pemetaan Family | `AC-02-01`, `AC-02-02`, `AC-02-03` | `GET /rest/v1/cockpit_accounts` (RLS `auth.uid() = user_id`), halaman `/cockpit` (`AdminRoute`), `NF-01`, `NF-04` (`BR-06`), `NF-05` |
| Risiko 2 akun pribadi di 1 Family Owner (kuota habis barengan) & cari Family `PRO` dengan Drive lega | `US-03` | Deteksi Konflik Family Ganda & Panduan Penempatan Akun `FREE` ke Family `PRO` Unik | `AC-03-01`, `AC-03-02`, `AC-03-03` | RPC `assign_cockpit_account_to_family` (`FOR UPDATE`), `FamilyRecommendationDrawer`, integrasi `connected_accounts`, `NF-03` (`BR-02`, `BR-03`, `BR-04`) |

---

## 2.3 Alur Pengguna (User Flow & Use Cases)

### Alur Utama (Happy Path)

#### `UC-CKP-001`: Impor Snapshot Cockpit & Pemantauan Akun
- **Actor:** Owner / Admin Pribadi
- **Trigger:** Owner ingin memperbarui status & sisa kuota akun Cockpit di Trial Manager.
- **Flow:**
  1. Owner membuka halaman **Akun Cockpit** (`/cockpit`) di dashboard admin → sistem menampilkan daftar akun terakhir beserta waktu sinkronisasi terakhir.
  2. Owner menekan **"Impor Snapshot"** → modal impor terbuka.
  3. Owner memilih berkas ekspor Cockpit Tools (atau menempelkan isinya) → sistem memvalidasi format, menyaring field rahasia (`BR-05`), lalu menampilkan ringkasan pratinjau (`{baru} baru, {diperbarui} diperbarui`).
  4. Owner menekan **"Simpan Snapshot"** → sistem menyimpan data, mencocokkan setiap email ke data Family (`BR-01`), menghitung ulang konflik family ganda (`BR-02`), menutup modal, dan menampilkan pesan sukses.
- **Business Rules:**
  - *Pre-checks:* Pengguna terautentikasi sebagai Admin (`BR-07`); berkas valid, `≤ 5 MB`, minimal 1 akun valid.
  - *Side effects:* Pembaruan lencana Cockpit pada kartu Family terkait (`US-05`) dan evaluasi ulang daftar Konflik Family Ganda (`BR-02`).

#### `UC-CKP-002`: Penempatan Terpandu Akun `FREE` ke Family `PRO` Unik dengan Storage Drive Lega
- **Actor:** Owner / Admin Pribadi
- **Trigger:** Owner melihat akun `FREE` + `bisa` pada filter **"FREE Layak Upgrade"** dan ingin memasukkannya ke Family `PRO`.
- **Flow:**
  1. Owner menekan **"Cari Family PRO"** pada kartu/baris akun `FREE` tersebut → sistem membuka panel rekomendasi.
  2. Sistem menyaring seluruh Family yang memenuhi syarat (`BR-03`: aktif, belum kedaluwarsa, tidak banned, slot kosong, dan **0 akun Cockpit aktif lain**) lalu mengurutkannya dari sisa penyimpanan Google Drive terbesar (`BR-04`).
  3. Owner memilih 1 Family tujuan (prioritas yang berlabel **"Storage Lega"** `≥ 500 GB`), lalu menggunakan alat bantu cepat: salin email akun `FREE`, cek email Owner Family tujuan, dan buka Google Family (`families.google.com`) untuk melakukan kirim undangan (*invite*) dan terima (*accept*) secara manual di Google.
  4. Setelah undangan diterima di Google, Owner kembali ke Trial Manager, memverifikasi `nama_member_baru`, dan menekan **"Catat Sudah Masuk Family"**.
  5. Sistem memverifikasi ulang slot & aturan bebas konflik (`BR-02`, `BR-03`), menambahkan akun sebagai anggota Family tujuan (`member_type = 'pribadi'`), memperbarui tampilan akun menjadi terpetakan ke Family tersebut, dan menampilkan pesan sukses.
- **Business Rules:**
  - *Pre-checks:* Akun target berstatus `FREE` + `bisa`; Family tujuan lolos `BR-02` dan `BR-03`.
  - *Side effects:* Slot tersedia pada Family tujuan berkurang 1; Family tujuan tidak lagi muncul sebagai rekomendasi untuk akun `FREE` lain (karena kini sudah memiliki 1 akun Cockpit aktif).

---

### Alur Balik (Reverse Flow)

#### `UC-CKP-003`: Pembatalan Impor atau Pembatalan Penempatan Family
- **Trigger:** Owner menekan **"Batal"** pada modal Impor atau panel Rekomendasi Family sebelum konfirmasi akhir.
- **Flow:**
  1. Owner menekan **"Batal"** / ikon tutup → sistem menutup modal/panel.
  2. Sistem membuang data pratinjau sementara dan mempertahankan state sebelumnya tanpa perubahan apa pun.
- **Business Rules:**
  - *Pre-checks:* Proses penyimpanan belum selesai dijalankan.
  - *Side effects:* Tidak ada perubahan pada data akun Cockpit maupun daftar anggota Family.

---

### Alur Cabang (Branch Flow)

#### `UC-CKP-004`: Deteksi Konflik Family Ganda
- **Trigger / Condition:** Setelah impor atau perubahan anggota Family, ditemukan `≥ 2` akun Cockpit berstatus `bisa` berada di dalam satu Family Owner yang sama (`BR-02`).
- **Flow:**
  1. Sistem menandai Family dan seluruh akun Cockpit yang bentrok dengan lencana **"Konflik Family Ganda"**.
  2. Banner peringatan muncul di bagian atas daftar Akun Cockpit menyebutkan nama Family dan daftar email yang bentrok.
  3. Owner dapat mengklik filter **"Konflik Family"** untuk melihat daftar konflik dan memindahkan/mengeluarkan salah satu akun dari Family tersebut.
- **Business Rules:**
  - *Pre-checks:* Hanya menghitung akun Cockpit dengan status `bisa` (akun berstatus `ban` tidak dihitung sebagai konflik kuota aktif).
  - *Side effects:* Menjadi penghitung langsung untuk Counter Metric *"Jumlah Konflik Family Ganda"*.

#### `UC-CKP-005`: Tidak Ada Family `PRO` yang Memenuhi Syarat Rekomendasi
- **Trigger / Condition:** Owner menekan **"Cari Family PRO"**, namun tidak ada satu pun Family yang memenuhi seluruh syarat `BR-03`.
- **Flow:**
  1. Panel rekomendasi menampilkan pesan kosong yang menjelaskan alasan (mis. semua Family aktif sudah penuh slotnya atau sudah ditempati akun pribadi lain).
  2. Owner menutup panel dan mengetahui perlu menambah Family `PRO` baru atau menunggu slot/family baru tersedia.

---

### Matriks State Layar & Komponen (Wajib Lengkap)
| Layar / Komponen | Loading | Empty | Error | Success | Partial | No-Permission |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Halaman Akun Cockpit (`/cockpit`)** | Skeleton kartu/baris daftar + tombol aksi nonaktif | Pesan belum ada data + tombol utama **"Impor Snapshot"** | Banner galat koneksi + tombol **"Coba Lagi"** | Daftar akun tampil lengkap dengan filter, urutan, dan status Family | Daftar tampil, tetapi ada banner **"Data > 24 jam lalu"** atau sebagian Family belum terhubung Google Drive | Redirect/blokir dengan pesan `"Halaman ini hanya dapat diakses oleh Admin."` |
| **Modal Impor Snapshot** | Indikator proses pada tombol **"Simpan Snapshot"** (tombol nonaktif) | Area unggah/tempel siap menerima berkas | Pesan validasi spesifik (format rusak / kosong / >5 MB / sesi habis) | Modal tutup + toast sukses penuh | Toast sukses parsial (`N berhasil, M baris dilewati`) | Modal tidak dapat dibuka (tombol tersembunyi) |
| **Panel Rekomendasi Family PRO** | Skeleton daftar rekomendasi Family | Pesan tidak ada Family memenuhi syarat `BR-03` | Pesan galat saat gagal muat atau konflik slot bersamaan saat simpan | Daftar Family urut sisa Drive terbesar + alat bantu invite manual + konfirmasi simpan berhasil | Sebagian Family tampil dengan kuota Drive asli, sebagian fallback ke angka manual dengan catatan | Panel tidak dapat diakses |
| **Indikator Cockpit di Kartu Family** | Tidak memblokir render kartu (lencana muncul begitu data siap) | Tidak tampil jika tidak ada email yang cocok | Tidak memecahkan kartu Family (fallback diam-diam tanpa lencana) | Lencana `PRO`/`FREE`, `Current`, sisa kuota, atau peringatan `ban`/konflik tampil rapi | Tampil tanpa angka kuota jika akun Cockpit belum punya data kuota model | Disembunyikan total pada mode publik / non-admin |

---

## 2.4 Aturan Bisnis (Business Rules)

### Daftar Aturan Bisnis Teruji (`BR-01` – `BR-07`)
| ID | Trigger | Condition | Outcome | Direferensikan Oleh |
| :--- | :--- | :--- | :--- | :--- |
| **BR-01** | Impor akun Cockpit atau pemuatan daftar | Membandingkan email akun Cockpit dengan `owner_email` atau `members.email` pada Family | Pencocokan selalu mengabaikan huruf besar/kecil dan spasi di awal/akhir email | `AC-01-01`, `AC-02-01`, `AC-04-01`, `AC-05-01` |
| **BR-02** | Evaluasi sebaran akun atau aksi penempatan akun ke Family | Sebuah Family Owner menampung `> 1` akun Cockpit aktif (`bisa` atau `untagged`, tidak termasuk `ban` dan `need_verif`) dari gabungan peran owner + member | Sistem memicu peringatan **Konflik Family Ganda** dan melarang Family tersebut muncul di daftar rekomendasi penempatan baru | `AC-03-01`, `AC-03-03`, `UC-CKP-004` |
| **BR-03** | Permintaan daftar rekomendasi Family `PRO` | Mengevaluasi setiap Family di Trial Manager | Hanya Family yang: (1) belum kedaluwarsa, (2) tidak `is_banned`, (3) jumlah anggota `< batas_slot`, dan (4) memiliki `0` akun Cockpit aktif (`bisa` atau `untagged`) yang boleh masuk daftar rekomendasi | `AC-03-01`, `AC-03-03`, `UC-CKP-002` |
| **BR-04** | Pengurutan daftar rekomendasi Family `PRO` | Terdapat ≥ 1 Family lolos `BR-03` | Urutkan dari sisa penyimpanan Google Drive terbesar; Family dengan Google Drive terhubung didahulukan di atas Family manual; Family dengan sisa Drive `≥ 500 GB` mendapat label **"Storage Lega"** | `AC-03-01`, `UC-CKP-002` |
| **BR-05** | Impor atau sinkronisasi snapshot Cockpit | Berkas input mengandung field sensitif (token, sandi, kuki, refresh token) | Sistem hanya mengambil field metadata & kuota yang diizinkan dan membuang seluruh field sensitif sebelum penyimpanan | `AC-01-01`, `AC-04-01` |
| **BR-06** | Menampilkan data kuota akun Cockpit | Selisih waktu sekarang dengan `waktu_sinkronisasi` > `24 jam` | Sistem menampilkan indikator **"Data > 24 jam lalu"** agar owner sadar angka kuota mungkin sudah berubah | `AC-02-03` |
| **BR-07** | Mengakses, mengimpor, atau mengubah data Cockpit | Pengguna bukan Admin terautentikasi | Akses ditolak sepenuhnya; seluruh UI & data Cockpit tidak pernah tampil di mode publik/read-only | `AC-01-03`, `AC-02-03`, `AC-05-03` |

### Authorization / RBAC
| Role | Action | Permission | Condition |
| :--- | :--- | :--- | :--- |
| **Owner / Admin** | Melihat daftar Akun Cockpit & kuota | ✅ | Terautentikasi sebagai pemilik data |
| **Owner / Admin** | Mengimpor snapshot / menghapus akun pantauan | ✅ | Terautentikasi sebagai pemilik data |
| **Owner / Admin** | Mencatat penempatan akun `FREE` ke Family `PRO` | ✅ | Terautentikasi + Family milik sendiri + lolos `BR-02` & `BR-03` |
| **Owner / Admin** | Membuat / mencabut kunci sinkronisasi otomatis | ✅ | Terautentikasi sebagai pemilik data |
| **Publik / Non-Admin** | Melihat atau mengakses data/UI Cockpit | ❌ | Dilarang mutlak (`BR-07`) |

### Audit Trail & Versioning
- **Snapshot Terbaru (Latest State):** Untuk data kuota per akun, cukup menyimpan *snapshot* kondisi terkini + `waktu_sinkronisasi` terakhir (tidak perlu menyimpan riwayat perubahan kuota per menit agar ringkas).
- **Riwayat Penempatan:** Pencatatan penambahan akun `FREE` ke dalam Family mengikuti catatan standar anggota Family (`added_at` di Trial Manager).

### Source of Truth & Data Export
- **Sumber Kebenaran (*Source of Truth*):**
  - Status `PRO`/`FREE`, status `bisa`/`ban`, status `Current`, dan sisa kuota AI → **Cockpit Tools** (eksternal; ekspektasi kesegaran `≤ 24 jam`, jika lebih tampil indikator usang `BR-06`).
  - Daftar Family, batas slot anggota, masa aktif (*expiry*), dan status `is_banned` Family → **Trial Manager**.
  - Sisa kapasitas penyimpanan Google Drive → **Integrasi Google Drive di Trial Manager** (fallback ke angka manual jika belum terhubung).
- **Ekspor Data:** Tidak diperlukan ekspor ulang dari Trial Manager pada rilis ini (fokus konsumsi di dashboard).

---

# Phase 3: How & Next

## 3.1 Entitas Backend Utama

### Domain Model & Bounded Context
- **Domain Pemilik:** Modul baru `cockpit` (sejajar dengan modul `storage` / Google Drive yang sudah ada).
- **Batas Kepemilikan:**
  - Modul `cockpit` memiliki & mengelola tabel `cockpit_accounts` (P0) dan `cockpit_sync_tokens` (P1).
  - Modul `cockpit` **hanya membaca** `families`, `members`, dan `connected_accounts` (kuota Google Drive) untuk pencocokan email (`BR-01`), deteksi konflik (`BR-02`), dan perhitungan rekomendasi (`BR-03`, `BR-04`).
  - Penambahan anggota baru hasil rekomendasi (`US-03`) menulis ke tabel `members` (dengan `member_type = 'pribadi'`) melalui fungsi transaksional khusus agar validasi slot & bebas konflik terjaga secara atomik.

### Entity / Aggregate (Model Data) `[Usulan - perlu konfirmasi engineering]`

| Entity | Field (`nama`: tipe, wajib/opsional, constraint, default) | Relationships |
| :--- | :--- | :--- |
| **`cockpit_accounts`** *(P0 — tabel baru)* | `id`: `UUID` PK default `gen_random_uuid()`<br>`user_id`: `UUID` NOT NULL FK → `auth.users(id)` ON DELETE CASCADE<br>`email`: `TEXT` NOT NULL (simpan huruf kecil + trim, `<= 254` char)<br>`plan_tier`: `TEXT` NOT NULL CHECK (`'AUTO_FAMILY'`, `'PRO'`, `'FREE'`) default `'AUTO_FAMILY'`<br>`eligibility_status`: `TEXT` NOT NULL CHECK (`'bisa'`, `'ban'`, `'need_verif'`, `'untagged'`) default `'untagged'`<br>`raw_tags`: `JSONB` NOT NULL default `'[]'::jsonb`<br>`is_current`: `BOOLEAN` NOT NULL default `false`<br>`switch_time`: `TIMESTAMPTZ` NULL<br>`quotas`: `JSONB` NOT NULL default `'[]'::jsonb` *(opsional di v1.0; array objek `{ model: string, remaining_pct: number \| null, reset_at: string \| null }`)*<br>`available_ai_credits`: `NUMERIC` NULL<br>`notes`: `TEXT` NULL (`<= 500` char)<br>`last_synced_at`: `TIMESTAMPTZ` NOT NULL default `now()`<br>`created_at`: `TIMESTAMPTZ` NOT NULL default `now()`<br>`updated_at`: `TIMESTAMPTZ` NOT NULL default `now()`<br>**Constraint:** `UNIQUE (user_id, email)` | Dimiliki oleh `auth.users` (RLS `auth.uid() = user_id`). Dicocokkan secara logis (*case-insensitive*) dengan `families.owner_email` dan `members.email`. |
| **`cockpit_sync_tokens`** *(P1 — tabel baru untuk Auto-Sync)* | `id`: `UUID` PK default `gen_random_uuid()`<br>`user_id`: `UUID` NOT NULL FK → `auth.users(id)` ON DELETE CASCADE<br>`token_hash`: `TEXT` NOT NULL UNIQUE *(SHA-256 hex dari kunci rahasia — plaintext tidak pernah disimpan)*<br>`label`: `TEXT` NULL (`<= 80` char, mis. `"PC Rumah"`)<br>`is_active`: `BOOLEAN` NOT NULL default `true`<br>`last_used_at`: `TIMESTAMPTZ` NULL<br>`last_error`: `TEXT` NULL<br>`created_at`: `TIMESTAMPTZ` NOT NULL default `now()`<br>`revoked_at`: `TIMESTAMPTZ` NULL | Dimiliki oleh `auth.users` (RLS `auth.uid() = user_id`; kolom `token_hash` di-`REVOKE SELECT` dari `anon`/`authenticated`). |
| **`families`, `members`, `connected_accounts`** *(Sudah ada — tanpa ubah skema)* | Memanfaatkan kolom yang sudah tersedia: `families.owner_email`, `families.expiry_date`, `families.is_banned`, `families.storage_used`, `members.email`, `members.member_type` (`'pribadi'`), `connected_accounts.available_bytes`, `connected_accounts.total_bytes`. | Dibaca oleh modul `cockpit` untuk pemetaan & rekomendasi; `members` menerima insert baru saat penempatan (`US-03`). |

### API Contract `[Usulan - perlu konfirmasi engineering]`

| Method | Endpoint / RPC | Request (field, tipe, wajib?) | Response (field, tipe) | Error Cases & Notes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/functions/v1/cockpit-import` *(P0 — `US-01`)* | Header: `Authorization: Bearer <Admin JWT>`<br>Body: `{ accounts: Array<{ email: string (wajib), plan_tier?: string, tags?: string[], is_current?: boolean, switch_time?: string, quotas?: Array<{ model, remaining_pct, reset_at }>, available_ai_credits?: number, notes?: string }> }` *(maks payload `5 MB`)* | `{ imported: number, created: number, updated: number, skipped: Array<{ index: number, reason: string }>, synced_at: string }` | `401` sesi habis (`BR-07`); `413` payload > 5 MB; `422` format rusak / 0 akun valid. Server menerapkan **strict allowlist** agar field sensitif (token/cookie/password) langsung dibuang (`BR-05`). |
| `GET` | Supabase PostgREST `/rest/v1/cockpit_accounts` *(P0 — `US-02`)* | Header: `Authorization: Bearer <Admin JWT>` | `CockpitAccount[]` | Dilindungi RLS `auth.uid() = user_id`. Pencocokan Family & perhitungan rekomendasi dilakukan di client-side hook (`useCockpitAccounts`) dari data `families`, `members`, dan `connected_accounts` yang sudah dimuat. |
| `DELETE` | Supabase PostgREST `/rest/v1/cockpit_accounts?id=eq.<uuid>` *(P0 — `US-01` Reverse)* | Header: `Authorization: Bearer <Admin JWT>` | `204 No Content` | Hanya menghapus baris di `cockpit_accounts`; tidak menyentuh `families` maupun `members`. |
| `POST` | RPC `assign_cockpit_account_to_family` *(P0 — `US-03`)* | Header: `Authorization: Bearer <Admin JWT>`<br>Params: `{ p_cockpit_account_id: uuid (wajib), p_family_id: text (wajib), p_member_name: text (wajib, 1..80 char) }` | `{ member_id: text, family_id: text, email: text, added_at: timestamptz }` | Menjalankan transaksi atomik dengan `SELECT ... FOR UPDATE` pada baris `families` untuk memverifikasi ulang `BR-02` (0 akun Cockpit `bisa` lain di family tersebut) dan `BR-03` (belum kedaluwarsa, tidak banned, slot < batas maksimal). Mengembalikan kode galat terstruktur: `FAMILY_CONFLICT`, `FAMILY_FULL`, `FAMILY_INVALID`, `UNAUTHORIZED`. |
| `POST` | `/functions/v1/cockpit-sync-token` *(P1 — `US-04`)* | Header: `Authorization: Bearer <Admin JWT>`<br>Body: `{ action: 'create' \| 'revoke', label?: string, token_id?: uuid }` | Create: `{ token_id: uuid, plain_token: string, created_at: string }`<br>Revoke: `{ revoked: true }` | `plain_token` hanya dikembalikan 1 kali saat `create`; di DB hanya tersimpan SHA-256 hash. |
| `POST` | `/functions/v1/cockpit-sync-push` *(P1 — `US-04`)* | Header: `X-Cockpit-Sync-Key: <plain_token>`<br>Body: sama dengan `cockpit-import` | Sama dengan `cockpit-import` | Memverifikasi hash kunci terhadap `cockpit_sync_tokens` aktif; menggunakan modul sanitizer & upsert yang sama dengan `cockpit-import`. |

### Status Machine (Status Penempatan Akun Cockpit)
```text
[Belum Terpantau] --(Impor / Sync Snapshot)--> [Terpantau: FREE + bisa (Belum Masuk Family)]
                                                        |
                  +-------------------------------------+------------------------------------+
                  | (Owner invite+accept manual di Google &                                  | (Sync terbaru: tag 'ban')
                  |  klik "Catat Sudah Masuk Family" lolos BR-02/03)                         v
                  v                                                                   [Kena Ban (Dikecualikan)]
[Terpetakan: PRO Unik (1 Akun / Family Owner)]                                        (Tidak dihitung konflik,
                  |                                                                    tidak direkomendasikan)
                  | (Ditemukan ≥ 2 akun 'bisa' di Family Owner yang sama)
                  v
[Konflik Family Ganda] --(Pindahkan / keluarkan akun berlebih)--> [Terpetakan: PRO Unik]
```

---

## 3.2 Halaman Frontend Utama

### Key Pages & Komponen
| Page / Komponen | Purpose | Key Actions |
| :--- | :--- | :--- |
| **`/cockpit` (`CockpitPage`)** *(P0)* | Pusat kendali daftar akun Cockpit, status `PRO`/`FREE`/`bisa`/`ban`, bar kuota AI + waktu reset, pemetaan Family, dan deteksi Konflik Family Ganda | Filter cepat, cari email/family, urutkan daftar, buka **Modal Impor Snapshot**, klik **"Cari Family PRO"** pada akun `FREE`, hapus akun pantauan |
| **Modal Impor Snapshot (`CockpitImportModal`)** *(P0)* | Unggah berkas atau tempel teks ekspor Cockpit Tools, validasi & pratinjau sebelum simpan | Pilih file / paste teks → lihat pratinjau (`baru`/`diperbarui`) → **Simpan Snapshot** atau **Batal** |
| **Panel Rekomendasi Family PRO (`FamilyRecommendationDrawer`)** *(P0)* | Panduan penempatan akun `FREE` ke Family `PRO` unik dengan storage Drive lega (`≥ 500 GB`) | Pilih Family rekomendasi → **Salin Email Akun FREE** → cek email/sandi Owner → buka `families.google.com` → isi nama → **Catat Sudah Masuk Family** |
| **Lencana Cockpit di `FamilyCard` (`/admin`)** *(P1)* | Menampilkan ringkasan status Cockpit & peringatan mismatch `ban` langsung di kartu Family | Tampilan read-only ringkas + tautan cepat menuju akun terkait di `/cockpit` |

### UI States & Permission Visibility
| Surface | Loading | Empty | Error | Success | Visibility Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`/cockpit`** | Skeleton kartu daftar | Ilustrasi kosong + CTA **"Impor Snapshot"** | Banner galat + tombol **"Coba Lagi"** | Grid/list akun + filter + banner konflik/usang (jika ada) | Hanya Admin (`AdminRoute`, `BR-07`) |
| **`CockpitImportModal`** | Spinner pada tombol simpan (disabled) | Dropzone + textarea paste siap isi | Pesan validasi spesifik (format/ukuran/kosong/sesi) | Modal tutup + toast sukses / parsial | Hanya Admin di `/cockpit` |
| **`FamilyRecommendationDrawer`** | Skeleton daftar Family | Pesan tidak ada Family memenuhi `BR-03` | Pesan galat validasi/konflik bersamaan | Daftar Family urut sisa Drive terbesar + alat bantu invite manual | Hanya Admin di `/cockpit` |
| **Lencana di `FamilyCard`** | Non-blocking | Tidak dirender jika email tidak cocok | Silent fallback (kartu Family tetap normal) | Badge `PRO`/`FREE`, `Current`, kuota utama, peringatan `ban` | Hanya Admin (`!readOnly`, `BR-07`) |

### Data Scale Assumption
- Skala penggunaan pribadi: diperkirakan **10–200 akun Cockpit** dan **5–100 Family**.
- Pada skala ini, tidak diperlukan paginasi server di v1.0; seluruh pemfilteran, pencarian, pengurutan, dan pencocokan Family dapat berjalan instan di sisi client (`useMemo`).

### Sitemap URLs
```text
/login                  (Sudah ada)
/admin                  (Sudah ada — ditambah tombol navigasi ke /cockpit & lencana P1 di FamilyCard)
/storage                (Sudah ada — Google Drive Storage)
/cockpit                (Baru — Dashboard Pantau Akun Cockpit & Penempatan Family PRO)
```

---

## 3.3 Kebutuhan & Batasan Teknis (Technical Requirements & Constraints)

### Non-Functional Requirements (NFR)
| ID | Type | Requirement |
| :--- | :--- | :--- |
| **NF-01** | Performance | Proses impor snapshot hingga `100` akun selesai dalam **`< 1.5 detik` (p95)**; pemfilteran, pengurutan, dan penyusunan daftar rekomendasi Family di browser selesai dalam **`< 100 ms`**. |
| **NF-02** | Security & Privacy | Sanitasi **strict allowlist** di sisi client *sebelum* kirim **dan** di sisi server *sebelum* simpan (`BR-05`) sehingga token/cookie/refresh_token dari Cockpit Tools tidak pernah keluar dari browser maupun tersimpan di database. Seluruh tabel baru wajib mengaktifkan **RLS (`auth.uid() = user_id`)**. Kunci auto-sync P1 wajib disimpan sebagai hash SHA-256. |
| **NF-03** | Concurrency & Data Integrity | Aksi **"Catat Sudah Masuk Family"** (`US-03`) wajib menggunakan transaksi atomik + row lock (`FOR UPDATE` pada baris `families`) untuk mencegah dua klik/tab bersamaan melanggar batas slot anggota atau aturan `BR-02` (maks 1 akun Cockpit aktif per Family). |
| **NF-04** | Reliability & Freshness | Ketidaktersediaan Cockpit Tools lokal tidak mengganggu pembacaan data terakhir di Trial Manager. Indikator data usang aktif otomatis jika `now() - last_synced_at > 24 jam` (`BR-06`). |
| **NF-05** | Accessibility | Seluruh modal & drawer dapat dinavigasi dengan keyboard (`Esc` tutup, focus trap), dan setiap indikator status (`PRO`, `FREE`, `ban`, `Konflik Family Ganda`, `Storage Lega`) selalu disertai teks label eksplisit dengan rasio kontras minimal WCAG 2.1 AA. |

### System Boundary / Dependencies & Integrations
1. **Cockpit Tools (`jlcodes99/cockpit-tools`) — Eksternal, Pihak Ketiga:**
   - Menjadi sumber struktur file ekspor (dan nanti sumber data skrip pengirim lokal di P1).
   - *Risiko & Mitigasi:* Karena aplikasi pihak ketiga bisa mengubah nama field ekspor di versi baru, parser impor dibuat defensif (*adapter layer* terpisah di `src/lib/cockpitParser.ts`) agar mudah diperbarui tanpa menyentuh UI maupun database.
2. **Supabase (Auth, PostgreSQL, Edge Functions, Realtime) — Internal:**
   - Menyediakan autentikasi Admin, penyimpanan tabel baru + RLS, dan eksekusi fungsi impor/penempatan atomik.
3. **Modul Google Drive (`connected_accounts`) — Internal:**
   - Menyediakan `available_bytes` dan `total_bytes` asli untuk mengurutkan Family rekomendasi (`BR-04`). Jika suatu Family belum terhubung Google Drive, sistem tetap berfungsi dengan fallback ke `storage_used` manual dan menempatkannya di bawah Family yang sudah terhubung Drive.

### Trade-offs & Consequences
- **Sanitasi Allowlist di Client + Server (bukan simpan mentah JSON):** Mengorbankan sebagian field tak dikenal dari Cockpit Tools jika suatu saat ada fitur baru, tetapi menjamin **nol risiko kebocoran token/session Antigravity** ke cloud.
- **P0 Impor Manual dulu, P1 Auto-Sync:** Mempercepat rilis v1.0 dan langsung memvalidasi manfaat rekomendasi Family & deteksi konflik tanpa membuat user terjebak setup skrip lokal di awal; konsekuensinya user perlu klik impor manual sampai v1.1 hadir.
- **Bantuan Manual Invite Google Family (bukan otomasi):** Menghindari risiko *ban*/verifikasi akun Google; konsekuensinya status `PRO` di Cockpit baru berubah setelah user menyelesaikan *accept* manual di Google dan melakukan impor ulang.

---

## 3.4 Roadmap

### Capability Roadmap & Scalability
| Phase | Scope | Notes |
| :--- | :--- | :--- |
| **v1.0 (P0 — PRD ini)** | `US-01` (Impor Snapshot + sanitasi privasi), `US-02` (Halaman `/cockpit` + pemetaan Family + filter), `US-03` (Deteksi Konflik Family Ganda + Panel Rekomendasi Family PRO terpandu dengan `≥ 500 GB` Storage Lega) | Langsung menggerakkan NSM & Counter Metric `0 konflik`. |
| **v1.1 (P1 + P2)** | `US-04` (Skrip pengirim lokal PC + manajemen kunci auto-sync), `US-05` (Lencana Cockpit & peringatan mismatch `ban` di `FamilyCard` `/admin`), `US-06` (Sorotan hampir kedaluwarsa tapi kuota masih penuh) | Menghilangkan repetisi impor manual harian. |
| **v2.0 (Eksplorasi)** | Analitik tren penggunaan kuota antar Family & opsi *pending invite tracking* jika diperlukan | Hanya jika volume akun tumbuh signifikan. |

### Explicit Won't Do
- **Otomatisasi kirim/terima undangan Google Family** — Berisiko melanggar kebijakan/keamanan akun Google dan tidak didukung API resmi.
- **Akses publik / non-admin** — Seluruh fitur ini murni alat operasional pribadi Owner.

---

## Open Questions
| # | Question | Owner | Due Date | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Seperti apa struktur persis file ekspor JSON dari versi Cockpit Tools yang terpasang di PC saat ini? | Owner | 2026-11-19 | **Closed** *(Terkonfirmasi: array JSON `[{ email, refresh_token, tags? }]` tanpa `plan_tier` & tanpa `quotas`; tag nyata mencakup `bisa`, `ban`, `need verif`, atau tanpa tag)* |
| 2 | Apakah batas maksimal slot anggota per Family di Trial Manager selalu **5 member** (total 6 termasuk Owner), atau ada jenis Family tertentu dengan batas berbeda? | Owner | Sebelum mulai implementasi v1.0 | Open |
| 3 | Konfirmasi desain tabel `cockpit_accounts` + RPC `assign_cockpit_account_to_family` (`[Usulan - perlu konfirmasi engineering]`) untuk migrasi manual di Supabase SQL Editor. | Owner / Engineering | Sebelum migrasi DB v1.0 | Open |

---

## Appendix
- **Repositori Cockpit Tools:** `https://github.com/jlcodes99/cockpit-tools`
- **Referensi Integrasi Existing di Repo:**
  - `INTEGRATION_PLAN_drive_in_cards.md` (pola pencocokan email owner *case-insensitive* & tampilan kuota Google Drive pada `FamilyCard`)
  - `supabase/migrations/20260621_add_connected_accounts.sql` (pola RLS owner-only & keamanan kolom sensitif)
  - `src/types/index.ts` (definisi `Member.member_type = 'pribadi' | 'pembeli'`)
  - `src/App.jsx` (pola routing internal berbasis `AdminRoute`: `/admin`, `/storage`, dan rencana `/cockpit`)

---

## Change Log
- **2026-11-19 — Revisi v1.1 (Penyesuaian Format Ekspor Asli Cockpit Tools):**
  - Menutup Open Question #1 setelah memverifikasi struktur ekspor asli Cockpit Tools: `[{ email, refresh_token, tags? }]` (tanpa field `PRO`/`FREE` dan tanpa angka kuota model).
  - Menambahkan dukungan 4 status kelayakan nyata: `bisa`, `ban`, `need_verif` (dari tag `"need verif"`), dan `untagged` (tanpa tag — tetap dihitung sebagai akun aktif pada deteksi Konflik Family Ganda karena akun aktif seperti `qulhu463@gmail.com` tidak memiliki tag).
  - Mengubah default `plan_tier` menjadi `AUTO_FAMILY` (diturunkan otomatis dari keanggotaan Family aktif di Trial Manager, dengan opsi override manual `PRO`/`FREE`) dan menjadikan `quotas` & `is_current` opsional di v1.0 (siap diisi pada tahap v1.1 Auto-Sync).
- **2026-11-19 — Konsolidasi Final (v1.0):**
  - **Input Langsung dari User (Owner):** Masalah pengorganisasian banyak akun pribadi (`PRO`/`FREE`, `bisa`/`ban`, sisa kuota, storage Google Drive), aturan krusial *pool* kuota bersama per *Family Owner* (wajib disebar ke Family berbeda), konfirmasi penggunaan 100% pribadi (bukan komersial), penjelasan alur nyata invite→accept manual di Google Family, pemilihan Opsi C (Hybrid), dan penguncian ambang batas Storage Lega `≥ 500 GB`.
  - **Disintesis / Diusulkan AI & Disetujui Owner:** Struktur NSM (*Persentase Akun Pribadi Layak Pakai di Family PRO Unik* ≥ 90%) + Counter Metric (`0 konflik`), desain alur penempatan terpandu (`US-03`), aturan privasi strict allowlist (`BR-05`), matriks state UI, serta usulan model data & kontrak API Supabase (`cockpit_accounts`, `cockpit-import`, RPC `assign_cockpit_account_to_family`).
  - **Open Questions Tersisa:** 3 item (sampel struktur ekspor JSON Cockpit Tools, konfirmasi batas slot member per family, konfirmasi final migrasi DB) — seluruhnya ditugaskan ke Owner / Engineering sebelum coding dimulai.
