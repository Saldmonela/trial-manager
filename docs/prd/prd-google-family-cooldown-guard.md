# Lite PRD — Riwayat & Proteksi Cooldown Pindah Google Family (Akun Pribadi)

- **Status:** Final — Disetujui (Phase 2 & 3 Approved pada 2026-11-20)
- **Mode:** Lite PRD
- **Pemilik Produk:** Owner / Admin Pribadi (`trial-manager`)
- **Parent PRD:** [prd-cockpit-quota-family-sync.md](./prd-cockpit-quota-family-sync.md)
- **Parent Section 1 Reference:**
  - **Pain Point (Bagian 1.1):** Owner kesulitan mengingat penempatan akun pribadi lintas Family secara manual sehingga rawan salah memindahkan/menempatkan akun.
  - **Persona & JTBD (Bagian 1.2):** *Owner / Admin Pribadi* ingin mengelola penempatan dan perpindahan akun pribadi ke Family `PRO` secara cepat dan aman tanpa risiko kehilangan akses `PRO`.
  - **North Star Metric Induk (Bagian 1.4):** *Persentase Akun Pribadi Layak Pakai yang Tersebar di Family PRO Unik* (target `≥ 90%`).
- **Delta As-Is / To-Be (Khusus Fitur Ini):**
  - **As-Is:** Trial Manager hanya menyimpan daftar member aktif saat ini di tiap Family; begitu member pribadi dihapus/dipindahkan, jejak Family sebelumnya hilang. Selain itu, Family `PRO` kadang tiba-tiba turun menjadi `FREE` di tengah jalan, memaksa Owner memindahkan akun pribadi ke Family `PRO` lain. Tanpa riwayat gabung/pindah dan hitungan cooldown 12 bulan Google Family, Owner rawan tanpa sengaja mengeluarkan akun yang jatah pindahnya sudah habis—membuat akun tersebut terjebak di paket `FREE` hingga cooldown 12 bulan berakhir.
  - **To-Be:** Trial Manager mencatat riwayat keanggotaan Family (nama Family, tanggal masuk, tanggal keluar, jenis kejadian) untuk setiap **Akun Pribadi**, menghitung otomatis sisa jatah pindah dan tanggal bebas cooldown 12 bulan, menampilkan peringatan bertingkat + konfirmasi sadar di **Cockpit** maupun **Dashboard Admin** sebelum keluar/pindah, mendukung input/edit riwayat lama secara manual, serta menandai Family yang mendadak turun ke `FREE` lengkap dengan pemilahan akun pribadi mana yang **Aman Dipindah** vs **Terkunci Cooldown**.
- **Metrik Fokus Delta (Validasi terhadap NSM Induk):**
  - **Guardrail / Metrik Utama Fitur:** **Tingkat Perpindahan Aman = 100%** (target: **0 insiden** akun pribadi terjebak cooldown 12 bulan akibat salah keluar/pindah dalam jendela 90 hari sejak penggunaan; denominator: seluruh aksi pemindahan/pengeluaran akun pribadi dari Family). Kontribusi ke NSM Induk: mencegah akun pribadi layak pakai keluar dari `Family PRO Unik` lalu gagal masuk ke Family `PRO` pengganti.

> **Keputusan Terkunci (Disetujui — 2026-11-20):**
> - **OQ-01 (Tanggal acuan mulai cooldown 12 bulan):** Dihitung mulai dari **tanggal masuk Family ke-2 (`joined_at`)** (+ 12 bulan kalender) agar lebih konservatif dan aman dari penolakan Google.
> - **OQ-02 (Keluar lalu masuk kembali ke Family yang sama persis):** **Tidak dihitung sebagai *Switch*** (hanya perpindahan ke Family dengan `family_id` / `owner_email` berbeda yang dihitung *Switch*), namun tetap menampilkan catatan info kecil saat menambahkan.

---

### Glosarium Singkat
| Istilah | Definisi dalam Konteks Fitur Ini |
| :--- | :--- |
| **Akun Pribadi** | Alamat email milik Owner yang tercatat di Halaman Cockpit (`CockpitAccount`) dan/atau terdaftar sebagai member bertipe `pribadi` di salah satu Family. Pencocokan email bersifat *case-insensitive* dan mengabaikan spasi depan/belakang. |
| **Riwayat Family** | Catatan kronologis keanggotaan sebuah Akun Pribadi di suatu Family: identitas Family, tanggal masuk, tanggal keluar (kosong jika masih aktif), sumber pencatatan (`otomatis` / `manual`), dan klasifikasi kejadian. |
| **Perpindahan (*Switch*)** | Kejadian ketika sebuah Akun Pribadi bergabung ke suatu Family **yang berbeda** setelah sebelumnya pernah tergabung di Family lain dalam jendela 12 bulan terakhir. |
| **Jendela 12 Bulan (*Cooldown Window*)** | Masa pembatasan Google Family selama **12 bulan kalender** sejak tanggal masuk Family tujuan pada kejadian *Switch* terakhir (`tanggal_bebas_cooldown = tanggal_switch_joined_at + 12 bulan kalender`). |
| **Status Cooldown** | Status kelayakan pindah akun pribadi saat ini, terdiri dari 4 kondisi: `Belum Pernah Gabung`, `Aman (Sisa 1x Pindah)`, `Siap Masuk Family ke-2 (Jatah Terakhir)`, dan `Cooldown Aktif (0x Pindah)`. |
| **Koreksi Lokal (Non-Switch)** | Penghapusan/perubahan data keanggotaan di Trial Manager karena kesalahan pencatatan lokal (akun sebenarnya tidak pernah keluar/pindah di Google), sehingga **tidak** dihitung sebagai kejadian *Switch* dan tidak memicu cooldown. |
| **Family Turun ke FREE (*Downgraded*)** | Kondisi ketika sebuah Family yang sebelumnya `PRO` kehilangan status `PRO`-nya di tengah masa aktif (baik terdeteksi otomatis dari kapasitas Drive turun `≤ 15 GB` maupun ditandai manual oleh Owner). |

---

# Phase 2: What & If

## 2.1 User Story Inti
```text
Sebagai Owner / Admin Pribadi,
Saya ingin setiap akun pribadi memiliki catatan riwayat keanggotaan Family (Family mana & tanggal masuk/keluarnya), perhitungan status cooldown 12 bulan Google Family, peringatan bertingkat sebelum keluar/pindah, serta penandaan saat Family PRO mendadak turun jadi FREE,
Sehingga saya bisa mengambil keputusan pemindahan akun secara aman tanpa pernah memicu terkuncinya akun di status FREE selama 12 bulan.
Karena jika tidak, saya bisa tanpa sadar mengeluarkan akun pribadi yang sudah menghabiskan jatah pindah 12 bulannya saat panik memindahkan akun dari Family yang tiba-tiba turun ke FREE.
```

---

## 2.2 MoSCoW User Stories & Acceptance Criteria

### Must Have — P0

#### `[US-01]` Pencatatan Otomatis Riwayat Gabung & Keluar Family untuk Akun Pribadi
- **Sebagai** Owner / Admin Pribadi, **saya ingin** setiap kali akun pribadi saya ditambahkan ke, dikeluarkan dari, atau dipindahkan antar Family (baik lewat Cockpit maupun Dashboard Admin), riwayat keanggotaannya otomatis tercatat lengkap dengan tanggal dan nama Family-nya, **sehingga** saya tidak perlu mengingat manual di kepala atau catatan terpisah. **Karena jika tidak**, data jejak family akan bolong dan perhitungan cooldown tidak bisa dipercaya.
- **Acceptance Criteria:**
  - [ ] **AC-01-01 (Happy Path — Gabung & Keluar Otomatis)**
    - **Given** Owner login sebagai admin dan sebuah akun pribadi (`email = "akun1@gmail.com"`) belum berada di Family A,
    - **When** Owner menambahkan akun tersebut ke Family A (melalui Drawer Rekomendasi Cockpit atau Modal Tambah Member dengan tipe `pribadi` di Dashboard Admin), lalu di kemudian hari mengeluarkannya dari Family A sebagai kejadian keluar nyata di Google,
    - **Then** sistem otomatis membuat satu entri Riwayat Family saat bergabung (menyimpan nama Family A, email owner Family A, dan `joined_at`) serta memperbarui entri tersebut dengan `left_at` saat dikeluarkan; pesan sukses tampil: `"Akun akun1@gmail.com tercatat masuk ke [Nama Family A]."` / `"Akun akun1@gmail.com dikeluarkan dari [Nama Family A] dan riwayat tersimpan."`,
    - **And** `BR-01` dan `BR-05` terpenuhi (pencatatan bersifat idempoten untuk klik ganda / submit berulang dalam aksi yang sama).
    - **Field Definitions:**
      - `account_email`: string, required, format email valid, dinormalisasi lowercase + trim, max 254 karakter, contoh: `"akun1@gmail.com"`.
      - `family_id`: string/nullable, conditionally required (wajib terisi untuk pencatatan otomatis dari Family yang ada di sistem).
      - `family_name_snapshot`: string, required, 1–120 karakter, snapshot nama Family saat kejadian agar tetap terbaca walau Family dihapus di masa depan, contoh: `"Family PRO #04"`.
      - `family_owner_email_snapshot`: string/nullable, format email valid, max 254 karakter.
      - `joined_at`: date/timestamp, required, default waktu sekarang, tidak boleh di masa depan lebih dari 1 hari (toleransi zona waktu).
      - `left_at`: date/timestamp, optional/nullable, default `null` (masih aktif), harus `>= joined_at` jika terisi.
      - `source`: enum (`auto_assign`, `auto_admin`, `manual`), required.
      - `counts_for_cooldown`: boolean, required, default `true`.
    - **Verification:** Tambahkan `akun1@gmail.com` sebagai member `pribadi` ke Family A, klik tombol simpan 2x cepat (double click) → pastikan hanya 1 member dan 1 entri riwayat aktif terbentuk. Keluarkan member tersebut (pilih keluar nyata) → pastikan `left_at` terisi dan entri tetap ada walau member sudah hilang dari daftar aktif Family A.
  - [ ] **AC-01-02 (Reverse Flow — Batal atau Koreksi Lokal)**
    - **Given** Owner membuka dialog tambah/hapus member pribadi,
    - **When** Owner menekan `Batal` (atau menutup modal), ATAU memilih opsi **"Koreksi salah input (tidak benar-benar keluar di Google)"** saat menghapus member,
    - **Then** jika `Batal`: tidak ada perubahan keanggotaan maupun entri riwayat baru; jika `Koreksi salah input`: member dihapus dari daftar aktif Family, namun entri riwayat ditandai tidak dihitung untuk cooldown (`counts_for_cooldown = false`, label `Koreksi Lokal`) dengan pesan `"Data dikoreksi secara lokal tanpa mempengaruhi status cooldown."`,
    - **And** `BR-04` terpenuhi.
    - **Field Definitions:** `removal_mode`: enum (`google_leave`, `local_correction`), required saat menghapus member pribadi, default `google_leave`.
    - **Verification:** Hapus member pribadi dengan memilih `Koreksi salah input`; cek timeline akun → status cooldown tidak berubah dan entri bertanda `Koreksi Lokal`.
  - [ ] **AC-01-03 (Error Handling — Gagal Simpan / Offline / Sesi Habis / Konflik)**
    - **Given** Owner menjalankan aksi tambah atau keluarkan akun pribadi saat koneksi terputus, sesi login kedaluwarsa, atau data Family sudah diubah di tab lain (*concurrent edit*),
    - **When** proses penyimpanan gagal,
    - **Then** tidak ada perubahan parsial (keanggotaan tidak berubah jika pencatatan riwayat gagal, atau sistem menampilkan banner gagal sinkronisasi dengan tombol `Coba Lagi`), dan pesan error spesifik tampil:
      - Offline/timeout: `"Koneksi terputus. Perubahan belum tersimpan, silakan coba lagi."`
      - Sesi habis: `"Sesi login kamu sudah berakhir. Silakan masuk ulang untuk melanjutkan."`
      - Akun sudah tercatat aktif di Family yang sama: `"Akun ini sudah tercatat aktif di [Nama Family]."`
    - **And** tombol submit kembali aktif setelah error tampil sehingga tidak mengunci antarmuka.
    - **Field Definitions:** `error_message`: string, wajib non-kosong saat gagal.
    - **Verification:** Simulasikan jaringan offline saat klik konfirmasi keluar; verifikasi pesan error muncul, status member di UI tidak hilang secara palsu, dan setelah online tombol `Coba Lagi` berhasil menyimpan 1 kali saja.

---

#### `[US-02]` Perhitungan Status Jatah Pindah & Tampilan Badge Cooldown 12 Bulan
- **Sebagai** Owner / Admin Pribadi, **saya ingin** langsung melihat status jatah pindah dan sisa masa cooldown 12 bulan untuk setiap akun pribadi di Halaman Cockpit dan di kartu Family pada Dashboard Admin, **sehingga** saya tahu dalam sekejap akun mana yang aman dipindah dan mana yang terkunci. **Karena jika tidak**, saya harus menghitung tanggal secara manual dari riwayat setiap kali ingin mengambil keputusan.
- **Acceptance Criteria:**
  - [ ] **AC-02-01 (Happy Path — Perhitungan 4 Status & Tampilan Konsisten)**
    - **Given** sistem memiliki riwayat keanggotaan akun pribadi yang valid (`counts_for_cooldown = true`),
    - **When** Owner membuka Halaman Cockpit atau melihat daftar member bertipe `pribadi` pada kartu Family di Dashboard Admin,
    - **Then** setiap akun pribadi menampilkan badge status cooldown yang konsisten di kedua halaman berdasarkan `BR-02`:
      1. Belum ada riwayat sama sekali → **`Belum Gabung`** (netral).
      2. Sedang di Family ke-1 (belum ada *Switch* dalam 12 bulan terakhir) → **`Aman · Sisa 1x Pindah`** (hijau/olive).
      3. Sudah keluar dari Family ke-1 (tidak sedang di Family aktif) dan belum ada *Switch* dalam 12 bulan terakhir → **`Siap Masuk Family ke-2`** (amber lembut, keterangan `"Jatah pindah terakhir"`).
      4. Sudah melakukan `>= 1` *Switch* ke Family berbeda dalam 12 bulan terakhir → **`Cooldown · [N]h lagi`** (merah/wine), dengan tooltip/subteks `"Terkunci pindah s.d. [DD MMM YYYY]"` (menggunakan angka `tabular-nums`).
    - **And** tepat pada hari `tanggal_hari_ini >= tanggal_bebas_cooldown` (boundary tepat 12 bulan kalender), status otomatis pulih kembali menjadi aman (`Aman · Sisa 1x Pindah` jika sedang di Family, atau `Siap Gabung` jika sedang tidak di Family) tanpa perlu aksi manual.
    - **Field Definitions:**
      - `cooldown_status`: enum (`never_joined`, `safe_first_family`, `ready_last_switch`, `cooldown_active`), computed, required.
      - `switches_in_last_12m`: integer, computed, `>= 0`, contoh: `1`.
      - `cooldown_ends_at`: date/nullable, computed (`last_switch_joined_at + 12 bulan kalender`), format tampil Indonesia `DD MMM YYYY`, contoh: `"16 Mar 2027"`.
      - `cooldown_days_remaining`: integer/nullable, computed (`>= 0`), satuan: hari.
      - `first_family_name`: string/nullable, contoh: `"Family PRO #01"`.
      - `first_joined_at`: date/nullable, contoh: `"10 Jan 2026"`.
    - **Verification:** Uji 4 akun dengan skenario berbeda + 1 akun pada tanggal `cooldown_ends_at - 1 hari` (harus masih `Cooldown · 1h lagi`) dan `cooldown_ends_at` tepat (harus berubah jadi `Aman · Sisa 1x Pindah`). Bandingkan badge di Cockpit dan di Dashboard Admin untuk email yang sama → keduanya identik.
  - [ ] **AC-02-02 (Reverse Flow)**
    - `N/A (tampilan status bersifat read-only hasil perhitungan otomatis; perubahan data sumber dilakukan melalui US-01, US-04, dan US-05)`.
  - [ ] **AC-02-03 (Error Handling — Riwayat Gagal Dimuat / Data Parsial / Non-Admin)**
    - **Given** data riwayat gagal dimuat saat daftar akun Cockpit atau kartu Family sudah tampil (`partial state`), ATAU pengguna non-admin (`public`) membuka tampilan publik,
    - **When** layar dirender,
    - **Then** untuk `partial state` (admin): daftar akun/Family tetap bisa dibaca, badge status menampilkan **`Status Cooldown Gagal Dimuat`** disertai aksi `Muat Ulang` dan pesan `"Riwayat cooldown gagal dimuat. Harap muat ulang sebelum memindahkan akun."`; untuk role `public`: badge cooldown dan riwayat akun pribadi **tidak ditampilkan sama sekali** (`no-permission`),
    - **And** `BR-07` (RBAC) terpenuhi.
    - **Field Definitions:** `history_load_error`: string/nullable.
    - **Verification:** Blokir respons riwayat saat halaman Cockpit terbuka → tabel akun tetap tampil, badge cooldown menampilkan status gagal muat + tombol `Muat Ulang`. Buka halaman sebagai pengguna `public` → pastikan tidak ada teks/elemen riwayat atau cooldown muncul di DOM.

---

#### `[US-03]` Peringatan Bertingkat & Konfirmasi Sadar saat Mengeluarkan atau Memindahkan Akun Pribadi
- **Sebagai** Owner / Admin Pribadi, **saya ingin** mendapatkan peringatan yang jelas dan bertingkat setiap kali saya hendak mengeluarkan akun pribadi dari Family atau memasukkannya ke Family baru—sesuai kondisi sisa jatah pindah akun tersebut—**sehingga** saya sadar penuh konsekuensi aturan Google Family sebelum mengeksekusi dan tidak pernah salah klik. **Karena jika tidak**, satu klik terburu-buru bisa membuat akun pribadi saya terkunci di paket `FREE` selama 12 bulan.
- **Acceptance Criteria:**
  - [ ] **AC-03-01 (Happy Path — Peringatan Tingkat 1: Jatah Pindah Terakhir)**
    - **Given** akun pribadi berada pada status `Aman · Sisa 1x Pindah` (berada di Family A sejak `[tgl_masuk]`) atau `Siap Masuk Family ke-2`,
    - **When** Owner klik `Keluarkan Member` dari Family A (di Dashboard Admin) ATAU hendak menempatkan akun yang baru keluar dari Family A ke Family B (di `FamilyRecommendationDrawer` Cockpit atau `AddMemberModal` Dashboard Admin),
    - **Then** sistem menampilkan **Peringatan Tingkat 1 (Amber / Waspada)** berisi:
      - Riwayat ringkas: `"Bergabung pertama di [Nama Family A] pada [DD MMM YYYY]."`
      - Teks peringatan eksplisit: `"Peringatan Jatah Pindah: Akun Google hanya boleh pindah Family 1 kali dalam 12 bulan. Jika kamu keluar dari [Nama Family A] dan masuk ke Family lain, akun ini tidak akan bisa pindah ke Family ke-3 selama 12 bulan sejak tanggal pindah."`
      - Opsi alasan keluar (pada modal hapus): `Keluar / Pindah Family di Google` (default) vs `Koreksi salah input (tidak keluar di Google)`.
      - Tombol aksi: **`Batal`** dan **`Lanjutkan & Catat`** (aktif setelah pilihan mode jelas),
    - **And** `BR-03` dan `BR-04` terpenuhi.
    - **Field Definitions:**
      - `warning_level`: enum (`none`, `caution_last_switch`, `critical_cooldown_locked`), computed, required.
      - `acknowledge_checkbox`: boolean, required untuk `critical_cooldown_locked`, opsional untuk `caution_last_switch`.
      - `override_reason_type`: enum (`local_correction`, `family_downgraded_free`, `emergency_other`), required saat `warning_level = critical_cooldown_locked`.
      - `override_note`: string, optional (required jika `override_reason_type = emergency_other`), max 200 karakter, contoh: `"Family lama sudah mati total, sadar risiko tunggu cooldown"`.
    - **Verification:** Klik hapus member pribadi yang masih di Family ke-1 → verifikasi muncul banner Amber dengan nama Family A + tanggal masuk + pesan aturan 12 bulan sebelum aksi dijalankan.
  - [ ] **AC-03-02 (Happy Path — Peringatan Tingkat 2: Kritis saat Cooldown Aktif + Override Sadar)**
    - **Given** akun pribadi berstatus `Cooldown Aktif (0x Pindah)` karena sudah pindah dari Family A ke Family B pada `[tgl_switch]`, dengan tanggal bebas cooldown `[tgl_bebas]` (`[N] hari lagi`),
    - **When** Owner mencoba mengeluarkan akun tersebut dari Family B ATAU mencoba menambahkannya ke Family C (di Cockpit maupun Dashboard Admin),
    - **Then** sistem menampilkan **Peringatan Tingkat 2 (Merah / Kritis)** berisi:
      - Judul: `"STOP — Akun Sedang Cooldown 12 Bulan"`
      - Teks peringatan eksplisit: `"Akun [email] sudah memakai jatah pindah Google Family pada [tgl_switch] (pindah dari [Family A] ke [Family B]). Jika dikeluarkan/dipindah sekarang, Google akan menolak masuk ke Family ke-3 sampai [tgl_bebas] ([N] hari lagi) dan akun akan terjebak di paket FREE."`
      - Tombol paling menonjol (default fokus): **`Batal & Pertahankan di Family`**.
      - Tombol eksekusi (`Tetap Keluarkan / Override` atau `Tetap Catat / Override`) **nonaktif (disabled)** sampai Owner: (1) memilih alasan override, (2) mengisi catatan jika memilih `Lainnya` (min 5 karakter, max 200 karakter), dan (3) mencentang kotak konfirmasi `"Saya paham akun ini berisiko terkunci dari Family lain sampai [tgl_bebas]."`,
    - **And** jika Owner memilih alasan `Koreksi salah input`, sistem memperlakukannya sebagai `local_correction` (tidak menambah catatan switch baru); jika memilih alasan override lain, aksi dicatat beserta alasan override di riwayat (`BR-03`, `BR-04`).
    - **Field Definitions:** sama seperti AC-03-01, ditambah `override_confirmed`: boolean, harus `true` agar tombol override aktif.
    - **Verification:** Coba keluarkan akun yang sedang cooldown → tombol `Tetap Keluarkan` tidak bisa diklik sebelum alasan dipilih & checkbox dicentang. Centang & pilih alasan → aksi berhasil dan alasan tersimpan pada entri riwayat.
  - [ ] **AC-03-03 (Reverse Flow — Membatalkan Aksi dari Dialog Peringatan)**
    - **Given** Dialog Peringatan Tingkat 1 atau Tingkat 2 sedang terbuka,
    - **When** Owner menekan `Batal & Pertahankan di Family`, klik ikon tutup, atau menekan tombol `Esc`,
    - **Then** dialog tertutup, akun tetap berada di Family saat ini tanpa perubahan data apa pun, dan state checkbox/alasan di-reset bersih saat dialog dibuka lagi.
    - **Field Definitions:** `is_open`: boolean → `false`.
    - **Verification:** Isi sebagian form override, tekan `Esc`, buka kembali dialog untuk akun yang sama → form kembali kosong dan tombol override kembali nonaktif.
  - [ ] **AC-03-04 (Error Handling — Validasi Override & Status Riwayat Belum Tersedia)**
    - **Given** Owner memilih alasan `Lainnya` dengan catatan kosong / `> 200` karakter, ATAU data riwayat cooldown gagal dimuat saat mencoba mengeluarkan akun pribadi,
    - **When** Owner mencoba melanjutkan,
    - **Then** untuk catatan tidak valid: tampil pesan validasi inline `"Isi alasan minimal 5 karakter (maksimal 200 karakter)."` dan submit diblokir; untuk riwayat gagal dimuat: dialog menampilkan peringatan `"Status cooldown tidak dapat diverifikasi karena riwayat gagal dimuat. Muat ulang data terlebih dahulu agar tidak salah pindah."` dengan tombol `Muat Ulang Status`,
    - **And** sistem tidak diam-diam menganggap akun "Aman" saat data riwayat gagal dimuat (`fail-safe`).
    - **Field Definitions:** `override_note`: string, length `5..200` saat `override_reason_type = emergency_other`.
    - **Verification:** Uji input 3 karakter dan 201 karakter pada alasan `Lainnya` → pesan error tepat muncul. Uji kondisi fetch riwayat error → muncul peringatan fail-safe, bukan status "Aman".

---

#### `[US-04]` Melihat Timeline Riwayat Family & Menambah Riwayat Lama Secara Manual (*Backfill*)
- **Sebagai** Owner / Admin Pribadi, **saya ingin** membuka timeline riwayat keanggotaan Family dari setiap akun pribadi dan bisa menambahkan riwayat lama secara manual (untuk akun yang sudah pernah bergabung/pindah sebelum fitur ini dibuat), **sehingga** perhitungan cooldown 12 bulan langsung akurat sejak hari pertama dipakai. **Karena jika tidak**, akun lama yang sebenarnya sudah pernah pindah akan terbaca salah sebagai "Aman" oleh sistem.
- **Acceptance Criteria:**
  - [ ] **AC-04-01 (Happy Path — Lihat Timeline & Tambah Riwayat Manual)**
    - **Given** Owner mengklik badge status cooldown atau tombol `Riwayat` pada sebuah akun pribadi (dari baris akun di Cockpit atau dari item member `pribadi` di Dashboard Admin),
    - **When** Drawer Riwayat Family terbuka, lalu Owner klik **`+ Catat Riwayat Lama`**, memilih Family dari daftar yang ada **atau** mengetik nama Family lama (jika Family sudah dihapus), mengisi `Tanggal Masuk` (wajib), `Tanggal Keluar` (opsional, jika sudah keluar), dan `Catatan` (opsional), lalu klik `Simpan Riwayat`,
    - **Then** entri baru muncul di timeline kronologis (urutan kronologis jelas dengan penanda `#1`, `#2`, `#3`), status cooldown akun langsung terhitung ulang secara instan di Drawer, tabel Cockpit, dan Dashboard Admin, serta muncul toast `"Riwayat Family berhasil ditambahkan. Status cooldown diperbarui."`,
    - **And** `BR-02` dan `BR-05` terpenuhi.
    - **Field Definitions:**
      - `family_selection_mode`: enum (`existing_family`, `custom_family`), required, default `existing_family`.
      - `family_id`: string/nullable, conditionally required saat `family_selection_mode = existing_family`.
      - `family_name`: string, required, 1–120 karakter (otomatis terisi jika pilih existing, wajib ketik manual jika `custom_family`), contoh: `"Family Lama Jan 2026"`.
      - `family_owner_email`: string, optional, format email valid jika diisi, max 254 karakter.
      - `joined_at`: date (`YYYY-MM-DD`), required, tidak boleh melebihi tanggal hari ini, contoh: `"2026-01-10"`.
      - `left_at`: date (`YYYY-MM-DD`), optional/nullable, jika diisi wajib `>= joined_at` dan tidak melebihi tanggal hari ini.
      - `leave_reason`: enum (`still_active`, `family_downgraded_free`, `family_expired`, `manual_move`, `other`), optional, default `still_active` jika `left_at` kosong.
      - `counts_for_cooldown`: boolean, required, default `true`.
      - `notes`: string, optional, max 300 karakter.
    - **Verification:** Tambahkan 2 riwayat manual untuk akun lama: Family X (`10 Jan 2026` – `15 Mar 2026`) dan Family Y (`16 Mar 2026` – aktif). Verifikasi status akun langsung berubah menjadi `Cooldown Aktif` dengan tanggal bebas `16 Mar 2027`.
  - [ ] **AC-04-02 (Reverse Flow — Batal Tambah Riwayat)**
    - **Given** form `+ Catat Riwayat Lama` sedang diisi sebagian di dalam Drawer,
    - **When** Owner klik `Batal` atau menutup Drawer,
    - **Then** form ditutup tanpa menyimpan data apa pun, daftar timeline dan status cooldown tetap sama seperti sebelum form dibuka.
    - **Field Definitions:** tidak ada field yang tersimpan.
    - **Verification:** Isi field nama Family dan tanggal, klik `Batal` → jumlah entri timeline tidak bertambah.
  - [ ] **AC-04-03 (Error Handling — Validasi Tanggal, Input Kosong/Panjang, Duplikat Submit)**
    - **Given** Owner mengisi form riwayat manual dengan input tidak valid atau menekan simpan 2x cepat,
    - **When** Owner klik `Simpan Riwayat`,
    - **Then** submit diblokir dengan pesan error spesifik per field:
      - Nama Family kosong / `> 120` karakter: `"Nama Family wajib diisi (maksimal 120 karakter)."`
      - Tanggal masuk kosong: `"Tanggal masuk Family wajib diisi."`
      - Tanggal masuk di masa depan: `"Tanggal masuk tidak boleh melebihi hari ini."`
      - Tanggal keluar `<` tanggal masuk: `"Tanggal keluar tidak boleh lebih awal dari tanggal masuk."`
      - Email owner (jika diisi) format salah: `"Format email owner Family tidak valid."`
      - Catatan `> 300` karakter: `"Catatan maksimal 300 karakter."`
      - Double click / submit ulang: tombol masuk state loading (`Menyimpan...`) dan menonaktifkan klik ganda.
    - **And** tidak ada entri ganda atau tanggal inkonsisten yang masuk ke timeline.
    - **Field Definitions:** sesuai constraint AC-04-01.
    - **Verification:** Uji tiap kondisi error (termasuk `left_at = 2026-01-09` dengan `joined_at = 2026-01-10`, serta `joined_at` besok) → semua menampilkan pesan tepat dan menolak penyimpanan.

---

#### `[US-05]` Mengedit & Menghapus Entri Riwayat Family Akun Pribadi
- **Sebagai** Owner / Admin Pribadi, **saya ingin** bisa mengedit tanggal/keterangan atau menghapus entri riwayat Family yang salah catat di dalam Drawer Riwayat, **sehingga** data cooldown tetap bersih dan akurat jika ada typo atau koreksi. **Karena jika tidak**, kesalahan satu tanggal masuk/keluar akan mengunci status akun secara keliru selama berbulan-bulan.
- **Acceptance Criteria:**
  - [ ] **AC-05-01 (Happy Path — Edit & Hapus Entri Riwayat)**
    - **Given** Drawer Riwayat Family menampilkan minimal 1 entri riwayat,
    - **When** Owner klik `Edit` pada sebuah entri, mengubah `joined_at`, `left_at`, `family_name`, `leave_reason`, `counts_for_cooldown`, atau `notes`, lalu klik `Simpan Perubahan` — ATAU klik `Hapus` lalu mengonfirmasi hapus entri tersebut,
    - **Then** entri terbarui atau terhapus dari timeline, urutan kronologis & perhitungan cooldown langsung diperbarui secara real-time di semua tampilan, dan muncul toast `"Entri riwayat diperbarui."` / `"Entri riwayat dihapus. Status cooldown dihitung ulang."`,
    - **And** `BR-02` terpenuhi (menghapus entri riwayat **tidak** menghapus keanggotaan aktif member di tabel Family; pesan konfirmasi menyatakan: `"Menghapus catatan riwayat ini hanya mempengaruhi histori & hitungan cooldown, bukan keanggotaan aktif saat ini."`).
    - **Field Definitions:** sama seperti `US-04` ditambah `history_id`: string, required (prefill dari entri terpilih).
    - **Verification:** Edit `joined_at` Family ke-2 dari 6 bulan lalu menjadi 13 bulan lalu → status akun otomatis berubah dari `Cooldown Aktif` menjadi `Aman · Sisa 1x Pindah`. Hapus satu entri salah input → status terhitung ulang seketika.
  - [ ] **AC-05-02 (Reverse Flow — Batal Edit / Batal Hapus)**
    - **Given** Owner sedang dalam mode edit entri atau melihat konfirmasi hapus entri,
    - **When** Owner klik `Batal`,
    - **Then** perubahan dibatalkan, nilai asli entri tetap utuh, dan status cooldown tidak berubah.
    - **Field Definitions:** tidak ada field yang diubah.
    - **Verification:** Ubah tanggal pada mode edit, klik `Batal` → tanggal kembali ke nilai awal.
  - [ ] **AC-05-03 (Error Handling — Validasi & Konflik Hapus/Edit)**
    - **Given** Owner mengedit entri dengan `left_at < joined_at` atau entri ternyata sudah dihapus di tab lain (*concurrent edit*) atau koneksi terputus,
    - **When** Owner klik `Simpan Perubahan` atau konfirmasi `Hapus`,
    - **Then** validasi tanggal menolak dengan pesan `"Tanggal keluar tidak boleh lebih awal dari tanggal masuk."`; jika entri tidak lagi ditemukan, muncul pesan `"Entri riwayat ini sudah berubah atau dihapus di sesi lain. Daftar diperbarui."` dan timeline otomatis dimuat ulang.
    - **Field Definitions:** sesuai `US-04`.
    - **Verification:** Simulasikan edit dengan tanggal terbalik & simulasi entri sudah hilang → verifikasi pesan error tampil dan timeline tersinkron ulang.

---

#### `[US-06]` Penandaan Family PRO Turun ke FREE (*Downgraded*) & Panel Dampak Migrasi Akun Pribadi
- **Sebagai** Owner / Admin Pribadi, **saya ingin** bisa menandai sebuah Family sebagai **"PRO Hilang / Turun ke FREE"** (selain deteksi otomatis saat kapasitas Drive turun `≤ 15 GB`) dan langsung melihat daftar akun pribadi di dalamnya terbagi antara yang **Aman Dipindah** dan yang **Terkunci Cooldown**, **sehingga** saat masalah PRO hilang terjadi mendadak, saya bisa menyelamatkan akun yang masih punya jatah pindah tanpa memicu cooldown pada akun yang sudah terkunci. **Karena jika tidak**, saat panik melihat Family turun jadi FREE, saya mudah salah memindahkan semua akun pribadi di dalamnya tanpa sadar mana yang sudah tidak punya jatah pindah.
- **Acceptance Criteria:**
  - [ ] **AC-06-01 (Happy Path — Tandai Downgraded & Tampilkan Dampak Akun Pribadi)**
    - **Given** sebuah Family `PRO` aktif memiliki 1 atau lebih member bertipe `pribadi` (atau email akun Cockpit),
    - **When** Owner menandai Family tersebut sebagai **`PRO Hilang (Turun ke FREE)`** (dari menu aksi kartu Family atau modal Edit Family, dengan alasan/catatan opsional), ATAU sinkronisasi Google Drive otomatis mendeteksi kapasitas pool Family turun menjadi `≤ 15 GB` (`5GB` / `15GB`),
    - **Then**
      1. Family langsung berstatus **`PRO Hilang (FREE)`** (badge merah/wine yang jelas di Dashboard Admin dan Cockpit) dan **otomatis dikeluarkan dari daftar rekomendasi Family PRO tujuan** (`BR-06`).
      2. Akun pribadi di dalam Family tersebut di Halaman Cockpit otomatis berubah status paket terdeteksinya dari `PRO (via Family)` menjadi **`FREE (Family Turun Paket)`** dengan sorotan butuh tindakan.
      3. Pada kartu Family bermasalah & panel dampak, sistem menampilkan ringkasan pemilahan akun pribadi di dalamnya:
         - Kelompok **Aman Dipindah** (`Belum Gabung` / `Aman · Sisa 1x Pindah`) → disertai tombol aksi cepat **`Cari Family PRO Pengganti`** (membuka Drawer Rekomendasi Cockpit untuk akun tersebut).
         - Kelompok **Terkunci Cooldown** (`Cooldown Aktif`) → ditandai **`Tahan · Bebas [DD MMM YYYY]`** tanpa tombol pindah cepat biasa (hanya lewat alur konfirmasi kritis `US-03` jika memang mau override).
      4. Muncul pesan sukses: `"[Nama Family] ditandai PRO Hilang (FREE). [X] akun pribadi aman dipindah, [Y] akun sedang cooldown."`
    - **And** `BR-06` terpenuhi.
    - **Field Definitions:**
      - `plan_status`: enum (`pro_active`, `downgraded_free`), required, default `pro_active`.
      - `downgraded_at`: date/timestamp, optional/nullable (otomatis terisi saat status berubah ke `downgraded_free`).
      - `downgrade_note`: string, optional, max 200 karakter, contoh: `"Langganan Google One tiba-tiba hilang di tengah bulan"`.
    - **Verification:** Buat Family dengan 2 akun pribadi: Akun A (`Sisa 1x Pindah`) dan Akun B (`Cooldown Aktif`). Tandai Family sebagai `PRO Hilang (FREE)` → verifikasi Family hilang dari rekomendasi tujuan, Akun A masuk daftar `Aman Dipindah` dengan tombol cepat, dan Akun B masuk daftar `Tahan · Bebas [tgl]`.
  - [ ] **AC-06-02 (Reverse Flow — Pulihkan Status Family Menjadi PRO Aktif)**
    - **Given** sebuah Family sebelumnya ditandai `PRO Hilang (FREE)`,
    - **When** Owner memilih aksi **`Pulihkan ke PRO Aktif`** dan mengonfirmasi,
    - **Then** status Family kembali ke `pro_active`, `downgraded_at` dikosongkan, Family kembali memenuhi syarat masuk daftar rekomendasi jika syarat lain terpenuhi, dan akun pribadi di dalamnya kembali terbaca `PRO (via Family)` dengan pesan `"[Nama Family] dipulihkan menjadi PRO Aktif."`.
    - **Field Definitions:** `plan_status`: `downgraded_free` → `pro_active`.
    - **Verification:** Pulihkan Family dari `downgraded_free` → verifikasi banner dampak hilang dan Family muncul kembali di rekomendasi jika slot & storage memenuhi.
  - [ ] **AC-06-03 (Error Handling — Family Tanpa Akun Pribadi / Gagal Update)**
    - **Given** Family yang ditandai `PRO Hilang (FREE)` tidak memiliki akun pribadi (hanya pembeli atau kosong), ATAU penyimpanan status gagal karena offline/timeout,
    - **When** aksi dijalankan,
    - **Then** jika tanpa akun pribadi: status tetap tersimpan normal dengan pesan `"[Nama Family] ditandai PRO Hilang (FREE). Tidak ada akun pribadi yang terdampak."`; jika gagal simpan: status tidak berubah dan tampil pesan `"Gagal mengubah status Family. Periksa koneksi dan coba lagi."`.
    - **Field Definitions:** `affected_personal_count`: integer, `>= 0`.
    - **Verification:** Tandai Family tanpa member pribadi → verifikasi pesan tanpa dampak muncul rapi. Simulasikan offline → verifikasi status tetap seperti semula dan muncul pesan error.

---

### Should Have — P1

#### `[US-07]` Prioritas Rekomendasi Family PRO Stabil untuk Akun dengan Sisa Jatah Pindah Terakhir
- **Sebagai** Owner / Admin Pribadi, **saya ingin** saat saya mencari Family PRO tujuan untuk akun pribadi yang tinggal memiliki 1x jatah pindah (atau baru keluar dari Family ke-1), Drawer Rekomendasi otomatis menyoroti Family PRO dengan **masa aktif terlama** dan **storage lega**, **sehingga** nyawa pindah terakhir akun tersebut tidak terbuang ke Family yang sebentar lagi expired atau rawan turun paket.
- **Acceptance Criteria:**
  - [ ] **AC-07-01 (Happy Path)**
    - **Given** Owner membuka `FamilyRecommendationDrawer` untuk akun pribadi yang berstatus `Aman · Sisa 1x Pindah` atau `Siap Masuk Family ke-2`,
    - **When** daftar rekomendasi Family PRO dimuat,
    - **Then** di bagian atas Drawer muncul banner konteks: `"Jatah pindah terakhir dalam 12 bulan — disarankan pilih Family dengan masa aktif paling panjang & storage lega."`, dan daftar rekomendasi mengutamakan Family `PRO` aktif (bukan `downgraded_free`), belum ada akun pribadi prioritas lain, storage lega (`≥ 500 GB`), dan diurutkan dari **sisa masa aktif terlama** (`daysRemaining` terbesar), lengkap dengan tag `Paling Stabil` pada kandidat teratas.
    - **Field Definitions:**
      - `is_last_switch_candidate`: boolean, computed.
      - `stability_rank`: integer, computed (`>= 1`), urutan berdasarkan `isStorageLega DESC`, `daysRemaining DESC`, `slotsAvailable DESC`.
    - **Verification:** Buka drawer untuk akun yang baru keluar dari Family ke-1; pastikan Family PRO dengan sisa 300 hari muncul di atas Family PRO dengan sisa 20 hari (sama-sama storage lega & bebas konflik).
  - [ ] **AC-07-02 (Reverse Flow)**
    - **Given** Owner tetap ingin memilih Family lain di urutan bawah (mis. Family dengan sisa 30 hari),
    - **When** Owner memilih Family tersebut secara manual,
    - **Then** sistem tetap mengizinkan pemilihan dengan catatan kecil `"Masa aktif sisa [N] hari — pastikan Family ini stabil sebelum memakai jatah pindah terakhir."`.
    - **Field Definitions:** `days_remaining`: integer/nullable.
    - **Verification:** Pilih kandidat dengan sisa 20 hari → pilihan diterima dan catatan kehati-hatian tampil.
  - [ ] **AC-07-03 (Error Handling — Tidak Ada Family PRO Stabil yang Tersedia)**
    - **Given** tidak ada Family PRO aktif yang bebas konflik dan punya slot kosong,
    - **When** Drawer Rekomendasi dibuka,
    - **Then** tampil empty state yang jelas: `"Belum ada Family PRO aktif yang aman untuk ditempati saat ini. Jangan keluarkan akun dulu agar jatah pindah tidak terbuang."`.
    - **Field Definitions:** `recommendations_count`: integer (`0`).
    - **Verification:** Tandai semua Family penuh atau `downgraded_free`, buka Drawer → pesan empty state tampil tanpa error.

---

#### `[US-08]` Filter & Ringkasan Status Cooldown di Halaman Cockpit
- **Sebagai** Owner / Admin Pribadi, **saya ingin** menyaring daftar akun pribadi di Halaman Cockpit berdasarkan status cooldown (`Cooldown Aktif`, `Sisa 1x Pindah`, `Family Turun FREE`) dan melihat angka ringkasannya di baris metrik atas, **sehingga** saya bisa mengaudit keamanan seluruh akun dalam satu klik.
- **Acceptance Criteria:**
  - [ ] **AC-08-01 (Happy Path)**
    - **Given** Halaman Cockpit memiliki akun dengan berbagai status cooldown dan/atau Family yang `downgraded_free`,
    - **When** Owner melihat baris metrik ringkasan dan mengklik chip filter `Cooldown Aktif` atau `Family Turun FREE`,
    - **Then** baris metrik menampilkan kartu/angka ringkas jumlah akun `Terkunci Cooldown` dan `Butuh Migrasi (Family FREE)`, dan klik chip filter langsung menyaring tabel hanya ke akun yang cocok dengan hitungan badge yang akurat.
    - **Field Definitions:**
      - `filter_key`: enum tambahan (`cooldown_active`, `family_downgraded`, `safe_to_move`).
      - `cooldown_locked_count`: integer, computed (`>= 0`).
      - `downgraded_affected_count`: integer, computed (`>= 0`).
    - **Verification:** Klik chip `Cooldown Aktif` → hanya baris berstatus `Cooldown · [N]h lagi` yang tampil dan jumlah baris sesuai angka pada chip.
  - [ ] **AC-08-02 (Reverse Flow)**
    - **Given** filter `Cooldown Aktif` sedang aktif,
    - **When** Owner klik chip `Semua` atau tombol `Reset Filter`,
    - **Then** seluruh daftar akun tampil kembali tanpa kehilangan urutan/pencarian.
    - **Field Definitions:** `filter_key` → `'all'`.
    - **Verification:** Klik `Semua` → seluruh akun kembali tampil.
  - [ ] **AC-08-03 (Error Handling — Hasil Filter Kosong)**
    - **Given** tidak ada akun yang sedang `Cooldown Aktif`,
    - **When** Owner mengklik chip `Cooldown Aktif`,
    - **Then** area tabel menampilkan empty state positif: `"Tidak ada akun pribadi yang sedang cooldown 12 bulan. Semua jatah pindah aman."` dengan tombol `Tampilkan Semua Akun`.
    - **Field Definitions:** `visible_rows_count`: integer (`0`).
    - **Verification:** Uji pada dataset tanpa akun cooldown → pesan empty state positif tampil.

---

### Could Have — P2

#### `[US-09]` Pengingat Menjelang Bebas Cooldown (H-14)
- **Sebagai** Owner / Admin Pribadi, **saya ingin** melihat penanda lembut ketika masa cooldown 12 bulan sebuah akun tinggal `≤ 14 hari` lagi, **sehingga** saya bisa merencanakan pemindahan akun yang sebelumnya tertahan.
- **Acceptance Criteria:**
  - [ ] **AC-09-01 (Happy Path)**
    - **Given** sebuah akun pribadi berstatus `Cooldown Aktif` dengan `1 <= cooldown_days_remaining <= 14`,
    - **When** Owner membuka Halaman Cockpit,
    - **Then** badge status akun tersebut menampilkan sublabel `"Bebas [N]h lagi"` berwarna amber-gold dan muncul pengingat ringkas di bagian atas daftar jika ada minimal 1 akun yang hampir bebas cooldown.
    - **Field Definitions:** `soon_unlock_threshold_days`: integer, default `14`, satuan hari.
    - **Verification:** Uji akun dengan `cooldown_days_remaining = 10` → muncul penanda hampir bebas; uji `15` hari → tetap status cooldown standar.
  - [ ] **AC-09-02 (Reverse Flow)** `N/A (indikator pasif otomatis, hilang sendiri setelah tanggal bebas terlewati)`.
  - [ ] **AC-09-03 (Error Handling)** `N/A (mewarisi penanganan error pemuatan riwayat dari AC-02-03)`.

---

### Won't Have — P3 (Rilis Ini)
- **Sinkronisasi Otomatis Riwayat dari Google Family API:** Google tidak menyediakan API publik untuk membaca riwayat gabung/keluar Google Family; pencatatan dilakukan otomatis dari aksi di Trial Manager + input manual riwayat lama. *(Kondisi tinjau ulang: jika Google merilis API resmi atau ekstensi aman di masa depan).*
- **Pelacakan Cooldown untuk Akun Pembeli (`member_type = 'pembeli'`):** Fokus rilis ini khusus melindungi akun pribadi Owner agar tidak menambah beban pencatatan harian pada transaksi pembeli. *(Kondisi tinjau ulang: jika Owner ingin melacak garansi pindah slot pembeli).*
- **Eksekusi Keluar/Invite Google Family Otomatis dari Aplikasi:** Demi keamanan akun Google dari risiko ban/suspensi, tindakan klik keluar & terima undangan di Google tetap dilakukan manual oleh Owner secara terpandu. *(Explicit Won't Do permanen untuk alasan keamanan akun).*
- **Notifikasi Eksternal (WhatsApp / Telegram / Email) saat Cooldown Selesai:** Cukup indikator di dalam aplikasi pada rilis ini. *(Kondisi tinjau ulang: jika jumlah akun pribadi > 50 dan Owner butuh pengingat pasif).*

---

### Traceability Matrix (P0 Wajib)
| Parent Section 1 Anchor (Pain / JTBD / NSM) | P0 Story ID | P0 Story Title | Acceptance Criteria IDs | Section 3 Contract/Constraint Reference |
| :--- | :--- | :--- | :--- | :--- |
| Pain 1.1 (lupa penempatan & jejak akun pribadi) + NSM Induk | `US-01` | Pencatatan Otomatis Riwayat Gabung & Keluar | `AC-01-01`, `AC-01-02`, `AC-01-03` | `account_family_history`, RPC `assign_cockpit_account_to_family` (v2), `add_personal_member_with_history`, `remove_personal_member_with_history`, `NF-03` |
| Pain 1.1 & JTBD 1.2 (keputusan cepat di 1 layar) | `US-02` | Perhitungan Status & Badge Cooldown 12 Bulan | `AC-02-01`, `AC-02-02 (N/A)`, `AC-02-03` | Pure Engine `src/lib/cooldownLogic.ts`, Status Machine Cooldown, RLS Admin-only (`NF-02`), `NF-01` |
| JTBD 1.2 & Guardrail 0 Insiden Terkunci Cooldown | `US-03` | Peringatan Bertingkat & Konfirmasi Sadar (Override) | `AC-03-01`, `AC-03-02`, `AC-03-03`, `AC-03-04` | `CooldownGuardModal` (`Cockpit` + `Admin`), Audit Field `override_reason`, Fail-Safe Guard (`NF-04`) |
| Pain 1.1 (akun lama sudah pernah pindah sebelum fitur ada) | `US-04` | Timeline Riwayat & Input Manual (*Backfill*) | `AC-04-01`, `AC-04-02`, `AC-04-03` | `POST /rest/v1/account_family_history`, DB Constraints Tanggal & Snapshot Family |
| Pain 1.1 (koreksi typo agar hitungan tetap akurat) | `US-05` | Edit & Hapus Entri Riwayat Family | `AC-05-01`, `AC-05-02`, `AC-05-03` | `PATCH` / `DELETE /rest/v1/account_family_history`, Optimistic Concurrency (`updated_at`) |
| Delta Masalah (Family PRO mendadak turun jadi FREE) + NSM Induk | `US-06` | Penandaan Family Turun ke FREE & Panel Dampak Migrasi | `AC-06-01`, `AC-06-02`, `AC-06-03` | Kolom `families.plan_status`, RPC/Update `set_family_plan_status`, Integrasi `low-storage.ts` |

---

## 2.3 Alur Pengguna (User Flow & Use Cases)

### Alur Utama (Happy Path)

#### `UC-CD-001`: Migrasi Darurat Saat Family PRO Mendadak Turun ke FREE
- **Actor:** Owner / Admin Pribadi
- **Trigger:** Owner menyadari salah satu Family PRO turun menjadi FREE (atau Drive Sync mendeteksi storage turun ke `5GB`/`15GB`).
- **Flow:**
  1. Owner menandai Family bermasalah sebagai **`PRO Hilang (Turun ke FREE)`** (atau melihat banner otomatis setelah Drive Sync).
  2. Sistem langsung memetakan semua akun pribadi di dalam Family tersebut dan menampilkannya dalam dua kelompok: **Aman Dipindah** vs **Terkunci Cooldown**.
  3. Untuk akun yang **Aman Dipindah**, Owner klik **`Cari Family PRO Pengganti`** → Drawer Rekomendasi terbuka dengan sorotan Family PRO paling stabil (masa aktif terlama, storage lega, bebas konflik).
  4. Owner melihat **Peringatan Tingkat 1 (Amber)** bahwa perpindahan ini akan menggunakan jatah pindah 12 bulan terakhir akun tersebut → Owner konfirmasi sadar.
  5. Owner melakukan keluar & terima undangan di Google, lalu klik **`Catat Sudah Pindah`** → sistem mencatat `left_at` di Family lama, membuat keanggotaan + `joined_at` di Family baru, dan langsung mengubah status akun menjadi **`Cooldown Aktif (bebas +12 bulan)`**.
  6. Untuk akun yang **Terkunci Cooldown**, Owner melihat label **`Tahan · Bebas [tgl]`** sehingga tidak mengeluarkannya secara sia-sia.
- **Business Rules:** Pre-checks: `BR-02`, `BR-03`, `BR-06`, `BR-07`. Side effects: `BR-01` (pencatatan riwayat atomik), rekomendasi Family lama dinonaktifkan.

#### `UC-CD-002`: Backfill Riwayat Lama Akun Pribadi
- **Actor:** Owner / Admin Pribadi
- **Trigger:** Owner baru pertama kali memakai fitur dan ingin mencatat riwayat lama sebuah akun pribadi yang sebelumnya sudah pernah pindah Family.
- **Flow:**
  1. Owner klik badge status cooldown (atau tombol `Riwayat`) pada baris akun di Halaman Cockpit / kartu Family Admin → `Drawer Riwayat Family` terbuka.
  2. Owner klik **`+ Catat Riwayat Lama`**, memasukkan Family ke-1 (tanggal masuk & tanggal keluar) serta Family ke-2 (tanggal masuk, masih aktif).
  3. Sistem memvalidasi kronologi tanggal, menyimpan entri, dan langsung menghitung ulang status akun menjadi **`Cooldown Aktif`** beserta tanggal bebas cooldown-nya.
- **Business Rules:** Pre-checks: `BR-05`, `BR-07`. Side effects: `BR-02` (rekomputasi status cooldown instan di seluruh UI).

### Alur Balik (Reverse Flow)

#### `UC-CD-003`: Membatalkan Pengeluaran/Pemindahan Setelah Melihat Peringatan Cooldown
- **Trigger:** Owner mengklik hapus/pindah akun pribadi, lalu melihat Peringatan Tingkat 1 (Amber) atau Tingkat 2 (Merah — Terkunci Cooldown).
- **Flow:**
  1. Owner melihat tanggal bebas cooldown yang masih berbulan-bulan lagi → klik **`Batal & Pertahankan di Family`** (atau tekan `Esc`).
  2. Dialog tertutup, tidak ada perubahan data keanggotaan maupun entri riwayat, akun tetap aman di Family semula.
- **Business Rules:** Pre-checks: tidak ada mutasi yang dikirim sebelum konfirmasi eksplisit (`BR-03`).

### Alur Cabang (Branch Flow)

#### `UC-CD-004`: Override Kritis pada Akun yang Sedang Cooldown Aktif
- **Trigger / Condition:** Akun berstatus `Cooldown Aktif`, namun Owner tetap perlu menghapus/mengeluarkan datanya di Trial Manager (baik karena **koreksi salah input** maupun **keadaan darurat dengan kesadaran penuh**).
- **Flow:**
  1. Peringatan Tingkat 2 (Merah) muncul dengan tombol eksekusi dalam keadaan terkunci (`disabled`).
  2. **Cabang A — Koreksi Salah Input:** Owner memilih alasan *"Koreksi salah input (tidak keluar di Google)"* + mencentang konfirmasi → member dihapus dari Family, riwayat ditandai `Koreksi Lokal (Non-Switch)`, status cooldown **tidak berubah**.
  3. **Cabang B — Override Darurat:** Owner memilih alasan darurat (`Family sudah mati / turun FREE` atau `Lainnya` + catatan) + mencentang konfirmasi risiko → member dikeluarkan, `left_at` + catatan override dicatat di riwayat, akun tetap ditandai **`Cooldown Aktif (Terkunci dari Family Baru s.d. [tgl])`**.
- **Business Rules:** `BR-03`, `BR-04`.

### Matriks State Layar & Komponen (Semua Kondisi UI Wajib)
| Layar / Komponen | `Loading` | `Empty` | `Error` | `Success` | `Partial` | `No-Permission` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Badge Status Cooldown (Cockpit & Kartu Family Admin)** | Skeleton pill abu-abu 1 baris (`w-28 h-5`) | Tampil `Belum Gabung` jika belum ada riwayat | Pill **`Gagal Muat`** + aksi `Muat Ulang` (fail-safe: tidak boleh tampil "Aman") | Salah satu dari 4 badge status (`Belum Gabung`, `Aman · Sisa 1x`, `Siap Family ke-2`, `Cooldown · Nh`) | Daftar akun/Family tampil normal, hanya kolom cooldown yang menampilkan `Gagal Muat` + retry | Tidak dirender sama sekali untuk role `public` |
| **Drawer Riwayat Family (`AccountFamilyHistoryDrawer`)** | 3 skeleton item timeline vertikal | Teks tenang: `"Belum ada catatan riwayat Family untuk akun ini."` + CTA utama **`+ Catat Riwayat Lama`** | Banner merah di body Drawer + tombol **`Coba Lagi`** | Header status cooldown + timeline kronologis + tombol `Edit` / `Hapus` / `+ Catat Riwayat Lama` | Timeline tampil dari cache/sebagian, banner kuning jika sinkronisasi Family terbaru gagal | Drawer tidak dapat dibuka; akses langsung diarahkan keluar (admin-only) |
| **Modal Peringatan Keluar / Pindah (`CooldownGuardModal`)** | Spinner ringkas saat memverifikasi status cooldown terbaru (tombol konfirmasi terkunci) | N/A (selalu menampilkan ringkasan akun target) | Banner fail-safe: `"Status cooldown gagal diverifikasi."` + tombol `Muat Ulang Status` | Menampilkan Tingkat 1 (Amber) atau Tingkat 2 (Merah + checkbox + alasan) sesuai status akun | N/A (aksi diblokir jika verifikasi gagal agar fail-safe) | Tidak tersedia untuk `public` |
| **Panel Dampak Family Turun ke FREE** | Skeleton 2 baris ringkasan saat menghitung dampak | Jika 0 akun pribadi terdampak: tidak menampilkan kotak daftar kosong, cukup badge `PRO Hilang (FREE)` + toast ringkas | Pesan inline gagal ubah status + tombol `Coba Lagi` | 2 blok terpisah: **Aman Dipindah** (dengan tombol cari Family PRO) & **Terkunci Cooldown** (dengan tanggal bebas) | Jika riwayat sebagian gagal dimuat: akun yang belum terverifikasi ditaruh di blok **`Perlu Verifikasi Cooldown`** (tidak langsung masuk `Aman Dipindah`) | Badge internal & panel dampak akun pribadi disembunyikan dari tampilan `public` |

---

## 2.4 Aturan Bisnis (Business Rules)

| Kode | Nama Aturan | Trigger | Condition | Outcome | Dipakai di AC |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`BR-01`** | Pencatatan Otomatis Khusus Akun Pribadi | Tambah / keluarkan / pindahkan member di Cockpit atau Dashboard Admin | Email cocok dengan akun di Cockpit **ATAU** `member_type = 'pribadi'` (pencocokan email *case-insensitive* & trimmed) | Otomatis buat entri `joined_at` saat masuk, atau isi `left_at` pada entri aktif saat keluar. Member `pembeli` yang bukan akun Cockpit tidak dibuatkan riwayat cooldown. | `AC-01-01` |
| **`BR-02`** | Formula Perhitungan Switch & Cooldown 12 Bulan | Riwayat akun pribadi dimuat atau berubah (tambah/edit/hapus) | Pertimbangkan hanya entri dengan `counts_for_cooldown = true`, diurutkan kronologis berdasarkan `joined_at`. Satu kejadian **Switch** terhitung setiap kali ada entri `E(i)` dengan identitas Family **berbeda** (`family_id` / `family_owner_email_snapshot` berbeda) dari entri sebelumnya `E(i-1)` dalam jarak `<= 12 bulan kalender`. Tanggal mulai cooldown = `joined_at` pada Family tujuan `E(i)`. | Jika `switches_in_last_12m >= 1` → status = **`Cooldown Aktif`**, `cooldown_ends_at = last_switch_joined_at + 12 bulan kalender`. Jika `switches_in_last_12m = 0` dan ada 1 entri aktif → **`Aman · Sisa 1x Pindah`**. Jika `switches_in_last_12m = 0`, tidak ada entri aktif, namun pernah ada entri keluar dalam 12 bulan → **`Siap Masuk Family ke-2`**. Jika 0 entri → **`Belum Gabung`**. | `AC-02-01`, `AC-04-01`, `AC-05-01` |
| **`BR-03`** | Eskalasi Peringatan Bertingkat & Fail-Safe | Owner memicu aksi keluar atau pindah/tambah ke Family lain untuk Akun Pribadi | Evaluasi `cooldown_status` saat dialog dibuka | `Aman · Sisa 1x Pindah` atau `Siap Masuk Family ke-2` → wajib tampil **Peringatan Tingkat 1 (Amber)**. `Cooldown Aktif` → wajib tampil **Peringatan Tingkat 2 (Merah)** dengan tombol eksekusi `disabled` sampai alasan + checkbox sadar diisi. Data gagal muat → **Fail-Safe** (blokir konfirmasi hingga status termuat). | `AC-03-01`, `AC-03-02`, `AC-03-04` |
| **`BR-04`** | Pengecualian Koreksi Lokal (Non-Switch) | Owner menghapus member pribadi atau menandai entri di timeline | Owner memilih `removal_mode = local_correction` (salah input di Trial Manager, tidak terjadi di Google) | Entri ditandai `counts_for_cooldown = false` dengan label `Koreksi Lokal`, sehingga tidak dihitung dalam `switches_in_last_12m` dan tidak memicu cooldown. | `AC-01-02`, `AC-03-02` |
| **`BR-05`** | Validasi Kronologi & Snapshot Family | Simpan riwayat otomatis maupun manual (`US-01`, `US-04`, `US-05`) | Setiap operasi tulis entri riwayat | `joined_at` wajib `<= hari_ini`, `left_at` (jika ada) wajib `>= joined_at` dan `<= hari_ini`. Nama Family & email owner disimpan sebagai snapshot teks agar riwayat tetap utuh meski data Family dihapus di masa depan. Submit ganda dalam sesi yang sama harus idempoten. | `AC-01-01`, `AC-04-01`, `AC-04-03`, `AC-05-03` |
| **`BR-06`** | Penanganan Family Turun ke FREE (*Downgraded*) | Owner menandai `PRO Hilang (FREE)` **ATAU** Drive Sync mendeteksi storage Family turun ke `≤ 15 GB` | Family berstatus `plan_status = downgraded_free` | Family langsung dikecualikan dari daftar rekomendasi Family PRO tujuan (`isFamilyActiveForPro = false`), akun pribadi di dalamnya ditandai butuh migrasi, dan panel dampak memisahkan akun `Aman Dipindah` vs `Terkunci Cooldown`. | `AC-06-01`, `AC-06-02`, `AC-07-01` |
| **`BR-07`** | Pembatasan Akses Privasi (RBAC) | Permintaan baca atau ubah riwayat akun pribadi & status cooldown | Role pengguna saat ini | Hanya `admin` (Owner terautentikasi) yang boleh melihat, menambah, mengubah, atau menghapus riwayat akun pribadi, status cooldown, dan status `downgraded_free`. Pengguna `public` tidak menerima atau melihat data ini. | `AC-02-03` |

### Authorization / RBAC
| Role | Aksi | Izin | Kondisi |
| :--- | :--- | :---: | :--- |
| **Owner / Admin (`admin`)** | Lihat badge cooldown, buka timeline riwayat, tambah/edit/hapus riwayat manual, override peringatan, tandai/pulihkan Family `PRO Hilang (FREE)` | ✅ | Sesi login admin aktif & pemilik data (`user_id` cocok) |
| **Pengguna Publik (`public`)** | Melihat riwayat akun pribadi, badge cooldown, atau catatan override | ❌ | Disembunyikan total di UI dan ditolak di lapisan data |

### Audit Trail & Source of Truth
- **Audit Trail:** Setiap entri riwayat menyimpan `source` (`auto_assign` / `auto_admin` / `manual`), `counts_for_cooldown`, `leave_reason`, `override_reason`, serta `created_at` dan `updated_at`. Riwayat tidak dihapus otomatis saat Family dihapus (menggunakan snapshot nama Family).
- **Source of Truth:**
  - *Keanggotaan aktif saat ini:* tabel `members` + `families` di Trial Manager.
  - *Riwayat & status cooldown 12 bulan:* entri Riwayat Family milik Owner (gabungan pencatatan otomatis aksi Trial Manager + backfill manual Owner).
  - *Status Family Turun ke FREE:* gabungan deteksi otomatis Drive Sync (`≤ 15 GB`) dan penandaan manual Owner (penandaan manual selalu menang sampai dipulihkan oleh Owner).

---

## 2.5 UX/UI Shape Brief (`/impeccable` — Mode: Operate)

Pendekatan desain untuk antarmuka **Operate** berisiko tinggi (1 klik salah = terkunci 12 bulan), dengan tetap mempertahankan sistem visual editorial Trial Manager ([index.css](../../src/index.css)): Cream `#F5F2EB`, Paper `#FBF9F4`, Charcoal `#1C1917`, Gold `#C6A87C`, Olive `#4A5D23`, Wine `#5D232F`, `Playfair Display` + `DM Sans`, border tajam `1px`, dan `tabular-nums`:

1. **Hierarki Risiko 3 Tingkat (Tenang → Waspada → Stop):**
   - **Tenang (`Belum Gabung` / `Aman · Sisa 1x`):** Badge hairline Olive/Stone tipis agar pemindaian puluhan akun tetap tenang.
   - **Waspada (`Siap Masuk Family ke-2` / Peringatan Tingkat 1):** Garis aksen kiri Amber + ringkasan fakta historis tepat di atas tombol konfirmasi.
   - **Stop (`Cooldown Aktif` / Peringatan Tingkat 2):** Badge Wine/Red kontras tinggi dengan countdown hari `tabular-nums`; pada dialog kritis, tombol aman (`Batal & Pertahankan di Family`) mendapat hierarki utama sementara tombol override terkunci di balik alasan + checkbox sadar.
2. **Integrasi Tanpa Halaman Baru (Zero Clutter):**
   - **Halaman Cockpit (`/cockpit`):** Kolom/badge interaktif `Status Pindah` + chip filter `Cooldown Aktif` & `Family Turun FREE`; klik badge membuka `AccountFamilyHistoryDrawer`.
   - **Dashboard Admin (`/admin`):** Pill status cooldown di sebelah tag `Pribadi` pada kartu Family; live inline warning di `AddMemberModal`; upgrade `DeleteMemberConfirmModal` menjadi `CooldownGuardModal` khusus member `pribadi`; aksi `Tandai PRO Hilang (FREE)` + strip dampak ringkas di kartu Family.
3. **Anatomi `AccountFamilyHistoryDrawer`:** Header lengket (email mono, badge status, tanggal bebas cooldown), timeline vertikal editorial `1px` dengan urutan kronologis + tag kejadian (`Gabung Awal`, `Pindah / Switch`, `Family Turun FREE`, `Koreksi Lokal`), serta form tambah/edit inline di dalam drawer (tanpa modal bertumpuk).
4. **Anti-Goals:** Tidak membuat halaman terpisah baru untuk riwayat cooldown; tidak menampilkan dialog peringatan pada member `pembeli`; tidak menyembunyikan status cooldown di balik klik berulang.

---

# Phase 3: How & Next

## 3.1 Entitas Backend Utama

### Domain Model & Bounded Context
- **Domain Pemilik:** Ekstensi modul **`cockpit`** + domain **`families/members`** yang sudah ada, dengan *bounded context* baru bernama **Family Cooldown Guard** (`cooldown`).
- **Batas Kepemilikan:**
  - Modul `cooldown` memiliki penuh tabel baru **`public.account_family_history`** dan mesin perhitungan deterministik **`src/lib/cooldownLogic.ts`**.
  - Modul `families` menambah 3 kolom status paket (`plan_status`, `downgraded_at`, `downgrade_note`) untuk melacak Family yang mendadak turun ke `FREE` (`US-06`), dan terintegrasi dengan modul `storage` (`supabase/functions/_shared/low-storage.ts`) saat deteksi kapasitas `5GB`/`15GB`.
  - Seluruh mutasi keanggotaan untuk **Akun Pribadi** (tambah dari Cockpit, tambah dari Admin, keluarkan dari Admin) melalui **RPC transaksional PostgreSQL** agar penulisan ke `members` dan `account_family_history` selalu **atomik**.

### Entity / Aggregate (Model Data)

| Entity | Field (`nama`: tipe, wajib/opsional, constraint, default) | Relationships & Indexing |
| :--- | :--- | :--- |
| **`public.account_family_history`** *(Tabel baru — P0)* | `id`: `UUID` PK default `gen_random_uuid()`<br>`user_id`: `UUID` NOT NULL FK → `auth.users(id)` ON DELETE CASCADE<br>`account_email`: `TEXT` NOT NULL — `CHECK (account_email = lower(btrim(account_email)) AND length(account_email) <= 254 AND account_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')`<br>`family_id`: `TEXT` NULL FK → `public.families(id)` ON DELETE SET NULL<br>`family_name_snapshot`: `TEXT` NOT NULL — `CHECK (length(btrim(family_name_snapshot)) BETWEEN 1 AND 120)`<br>`family_owner_email_snapshot`: `TEXT` NULL — `CHECK (family_owner_email_snapshot IS NULL OR (family_owner_email_snapshot = lower(btrim(family_owner_email_snapshot)) AND length(family_owner_email_snapshot) <= 254))`<br>`member_id`: `TEXT` NULL<br>`joined_at`: `TIMESTAMPTZ` NOT NULL — `CHECK (joined_at <= now() + interval '1 day')`<br>`left_at`: `TIMESTAMPTZ` NULL — `CHECK (left_at IS NULL OR (left_at >= joined_at AND left_at <= now() + interval '1 day'))`<br>`source`: `TEXT` NOT NULL DEFAULT `'manual'` — `CHECK (source IN ('auto_assign', 'auto_admin', 'auto_seed', 'manual'))`<br>`leave_reason`: `TEXT` NULL — `CHECK (leave_reason IS NULL OR leave_reason IN ('still_active', 'family_downgraded_free', 'family_expired', 'manual_move', 'local_correction', 'other'))`<br>`counts_for_cooldown`: `BOOLEAN` NOT NULL DEFAULT `true`<br>`override_reason_type`: `TEXT` NULL — `CHECK (override_reason_type IS NULL OR override_reason_type IN ('local_correction', 'family_downgraded_free', 'emergency_other'))`<br>`override_note`: `TEXT` NULL — `CHECK (override_note IS NULL OR length(override_note) <= 200)`<br>`notes`: `TEXT` NULL — `CHECK (notes IS NULL OR length(notes) <= 300)`<br>`created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `now()`<br>`updated_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `now()` *(trigger `public.set_updated_at()`)* | **RLS:** `public.app_is_admin() AND user_id = (SELECT auth.uid())` (`REVOKE ALL FROM anon, PUBLIC`).<br>**Indexes:**<br>1. `idx_afh_user_email_joined (user_id, account_email, joined_at DESC)`<br>2. Partial unique index `uniq_afh_active_member (user_id, account_email, family_id) WHERE left_at IS NULL AND family_id IS NOT NULL AND counts_for_cooldown = true` untuk idempotensi anti double-click (`AC-01-01`). |
| **`public.families`** *(Ekstensi 3 kolom — P0)* | `plan_status`: `TEXT` NOT NULL DEFAULT `'pro_active'` — `CHECK (plan_status IN ('pro_active', 'downgraded_free'))`<br>`downgraded_at`: `TIMESTAMPTZ` NULL<br>`downgrade_note`: `TEXT` NULL — `CHECK (downgrade_note IS NULL OR length(downgrade_note) <= 200)` | Kompatibel dengan seluruh Family lama (default `'pro_active'`). Dibaca oleh `isFamilyActiveForPro()` dan `assign_cockpit_account_to_family`. |
| **`public.members`** *(Sudah ada — tanpa ubah skema)* | Memanfaatkan `id`, `family_id`, `email`, `member_type`, `added_at`. | **Seed Migrasi Awal:** Seluruh member aktif bertipe `'pribadi'` (atau cocok dengan `cockpit_accounts`) otomatis disalin menjadi 1 entri awal (`source = 'auto_seed'`, `joined_at = COALESCE(added_at, now())`) dengan `ON CONFLICT DO NOTHING`. |

### API Contract

Seluruh endpoint membutuhkan `Authorization: Bearer <Admin JWT>` dan diverifikasi oleh `public.app_require_admin()` / RLS admin-only (`BR-07`).

| Method | Endpoint / RPC | Request (field, tipe, wajib?) | Response (field, tipe) | Error Cases & Notes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/rest/v1/account_family_history?order=joined_at.asc` *(P0 — `US-02`, `US-04`)* | Header: Admin JWT | `AccountFamilyHistoryRow[]` | Dilindungi RLS owner-only. Dimuat oleh `useAccountFamilyHistory`. |
| `POST` | `/rest/v1/account_family_history` *(P0 — `US-04`)* | `{ account_email, family_id?, family_name_snapshot, family_owner_email_snapshot?, joined_at, left_at?, leave_reason?, counts_for_cooldown?, notes?, source: 'manual' }` | `201 Created` → `AccountFamilyHistoryRow` | `401` sesi habis; `400/23514` pelanggaran constraint tanggal/panjang; `409/23505` duplikat entri aktif di Family sama. |
| `PATCH` | `/rest/v1/account_family_history?id=eq.<uuid>&updated_at=eq.<expected_ts>` *(P0 — `US-05`)* | Field yang diubah | `200 OK` → `AccountFamilyHistoryRow[]` (1 baris) | Optimistic concurrency via `updated_at`. Jika 0 baris berubah → konflik sesi lain (`AC-05-03`), trigger refetch. |
| `DELETE` | `/rest/v1/account_family_history?id=eq.<uuid>` *(P0 — `US-05`)* | `id=eq.<uuid>` | `200 OK` (1 baris) | Tidak menghapus `public.members`. |
| `POST` | `RPC assign_cockpit_account_to_family` *(v2 — P0 `US-01`, `US-03`, `US-06`)* | `{ p_cockpit_account_id, p_family_id, p_member_name, p_leave_previous_family_id?, p_override_reason_type?, p_override_note? }` | `{ member_id, family_id, email, added_at, history_id }` | Menolak Family `downgraded_free` (`FAMILY_DOWNGRADED`), atomik menutup riwayat Family lama bila pindah + insert `members` + insert `account_family_history`. |
| `POST` | `RPC add_personal_member_with_history` *(Baru — P0 `US-01`, `US-03`)* | `{ p_family_id, p_name, p_email, p_storage_used?, p_member_type, p_expiry_date?, p_override_reason_type?, p_override_note? }` | `{ member_id, family_id, email, added_at, history_id }` | Atomik insert `members` + insert `account_family_history` jika `p_member_type = 'pribadi'` atau email ada di `cockpit_accounts`. |
| `POST` | `RPC remove_personal_member_with_history` *(Baru — P0 `US-01`, `US-03`, `BR-04`)* | `{ p_family_id, p_member_id, p_removal_mode, p_leave_reason?, p_override_reason_type?, p_override_note? }` | `{ removed_member_id, history_id, counts_for_cooldown }` | Atomik hapus `members` + tutup `left_at` (atau tandai `local_correction` dengan `counts_for_cooldown = false`). |
| `POST` | `RPC set_family_plan_status` *(Baru — P0 `US-06`)* | `{ p_family_id, p_plan_status, p_downgrade_note? }` | `{ family_id, plan_status, downgraded_at, downgrade_note }` | Atomik ubah `families.plan_status` + tulis audit log `family_plan_status_changed`. |

### Status Machine

```text
[Belum Gabung] --(Gabung Family ke-1)--> [Aman · Sisa 1x Pindah]
                                              |            ^
                        (Keluar Family ke-1)  v            | (12 bulan kalender terlewati
                                    [Siap Masuk Family ke-2]   & aktif di Family)
                                              |            |
                     (Masuk Family B != A)    v            |
                                    [Cooldown Aktif · 0x Pindah]
                                              |
                    (Override keluar darurat) v
                                    [Cooldown Aktif · Tanpa Family]
```

```text
[PRO Aktif] --(Tandai Manual / Drive Sync <= 15 GB)--> [PRO Hilang (FREE)]
     ^                                                        |
     +------------------(Pulihkan ke PRO Aktif)---------------+
```

---

## 3.2 Halaman Frontend Utama

- **Rute:** Tidak menambah rute URL baru — terintegrasi penuh di `/cockpit` (`CockpitPage.jsx`) dan `/admin` (`Dashboard.jsx`, `FamilyCard.jsx`, `AddMemberModal.jsx`, `DeleteMemberConfirmModal.jsx`).
- **Komponen Baru:** `CooldownStatusBadge.jsx`, `AccountFamilyHistoryDrawer.jsx`, `CooldownGuardNotice.jsx`, `useAccountFamilyHistory.ts`, dan pure engine `src/lib/cooldownLogic.ts`.
- **Skala Data:** 10–200 akun pribadi × 2–10 entri = 20–2.000 baris; pemuatan penuh 1x per sesi + komputasi client-side `< 50 ms` via `useMemo`.

---

## 3.3 Kebutuhan & Batasan Teknis

| ID | Tipe | Requirement |
| :--- | :--- | :--- |
| **NF-01** | Performance | Kalkulasi cooldown + dampak 200 akun / 2.000 entri `< 50 ms`; RPC mutasi `< 400 ms` (p95). |
| **NF-02** | Security & Privacy | RLS `app_is_admin() AND user_id = (SELECT auth.uid())`; `REVOKE ALL FROM anon, PUBLIC`; RPC `SECURITY DEFINER` dengan `SET search_path = ''` dan `app_require_admin()`. |
| **NF-03** | Atomicity & Concurrency | 1 transaksi DB (`FOR UPDATE` pada `families`) untuk member + history; partial unique index anti double-click; optimistic concurrency `updated_at` untuk edit manual. |
| **NF-04** | Fail-Safe Reliability | Bila fetch riwayat gagal, dialog guard masuk mode **Fail-Safe** dan tidak pernah menganggap akun "Aman". |
| **NF-05** | Accessibility | Navigasi keyboard penuh, fokus default pada tombol aman di peringatan kritis, kontras WCAG 2.1 AA (light & dark), teks eksplisit mendampingi warna. |
| **NF-06** | Timezone & Calendar Accuracy | Penambahan 12 bulan kalender konsisten terhadap kalender lokal dengan clamping akhir bulan/tahun kabisat (`29 Feb + 12 bln → 28 Feb`). |

---

## 3.4 Roadmap & Explicit Won't Do
- **v1.0 (PRD ini — P0 + P1 + P2):** `US-01` s.d. `US-09` termasuk migrasi DB `202611200001_add_family_cooldown_guard.sql`, integrasi `low-storage.ts`, UI Cockpit & Dashboard Admin, dan unit test lengkap.
- **Explicit Won't Do:** Otomatisasi keluar/terima undangan di Google Family (keamanan akun); membuka data riwayat/cooldown ke role `public`.

---

## Change Log
- **2026-11-20 — Konsolidasi Final (v1.0 — Phase 2 & 3 Disetujui):**
  - **Input Langsung User (Owner):** Masalah riil pembatasan pindah Google Family (maks 1x pindah / 12 bulan) + kejadian nyata Family PRO tiba-tiba turun menjadi FREE di tengah jalan; pemilihan Lite PRD menginduk ke `prd-cockpit-quota-family-sync.md`; cakupan khusus Akun Pribadi di Cockpit + Dashboard Admin + status Family turun FREE; peringatan bertingkat + konfirmasi sadar (bisa override dengan alasan) + input/edit riwayat lama manual; target metrik **0 insiden akun pribadi terkunci cooldown 12 bulan**.
  - **Disintesis AI & Disetujui Owner:** Penguncian **OQ-01** (cooldown 12 bulan dihitung dari `joined_at` Family ke-2) & **OQ-02** (re-join Family yang sama tidak dihitung *Switch*), pengecualian `Koreksi Lokal (Non-Switch)` (`BR-04`), mode Fail-Safe saat riwayat gagal dimuat (`NF-04`), UX Shape Mode Operate (`AccountFamilyHistoryDrawer`, `CooldownStatusBadge`, `CooldownGuardNotice`), skema DB `account_family_history` + `families.plan_status` + 4 RPC atomik + integrasi `low-storage.ts`.
