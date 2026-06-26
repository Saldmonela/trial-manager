# Panduan Setup Google Cloud Console — Connect Google Drive (dari Nol)

Panduan ini buat kamu yang **belum pernah** menyentuh Google Cloud Console.
Ikuti urut dari atas. Tujuannya cuma mendapatkan **3 nilai** ini untuk dipakai
di Supabase nanti:

| Nilai | Contoh | Dipakai untuk |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `8123...apps.googleusercontent.com` | identitas app |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxxxxx` | rahasia app |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://<ref>.supabase.co/functions/v1/drive-oauth-callback` | alamat balik setelah login |

Plus 1 syarat: app berada di mode **Testing** dan akun Google kamu terdaftar sebagai **Test user**.

> ⏱️ Perkiraan waktu: 10–15 menit. Semua gratis.

---

## Langkah 0 — Cari dulu "project-ref" Supabase kamu (buat bikin Redirect URI)

Redirect URI bergantung pada project Supabase kamu, jadi siapkan dulu.

1. Buka https://supabase.com/dashboard → pilih project kamu.
2. Lihat URL browser, bentuknya:
   `https://supabase.com/dashboard/project/abcdefghijklmnopqrst`
   → bagian `abcdefghijklmnopqrst` itulah **project-ref** kamu.
   (Alternatif: **Project Settings → General → Reference ID**.)
3. Maka **Redirect URI** kamu adalah:

   ```
   https://abcdefghijklmnopqrst.supabase.co/functions/v1/drive-oauth-callback
   ```

   Ganti `abcdefghijklmnopqrst` dengan ref milikmu. **Catat nilai ini** — nanti
   dipakai di Langkah 4 dan harus **sama persis**.

---

## Langkah 1 — Buat / pilih Project di Google Cloud

1. Buka https://console.cloud.google.com
2. Di kiri-atas (sebelah tulisan "Google Cloud") ada **dropdown project**. Klik.
3. Klik **"New Project"**.
   - **Name:** bebas, misal `9drive-storage`.
   - **Organization / Location:** biarkan default ("No organization").
4. Klik **Create**, tunggu beberapa detik, lalu **pastikan project baru itu terpilih**
   di dropdown kiri-atas (semua langkah berikut harus di project ini).

---

## Langkah 2 — Aktifkan Google Drive API

1. Menu kiri (☰) → **APIs & Services → Library**.
   (Atau langsung: https://console.cloud.google.com/apis/library)
2. Di kotak pencarian ketik: **Google Drive API**.
3. Klik hasil **"Google Drive API"** → klik tombol **Enable**.
4. Tunggu sampai statusnya aktif. Selesai untuk langkah ini.

---

## Langkah 3 — Konfigurasi "Google Auth Platform" (dulu namanya *OAuth consent screen*)

Ini layar yang dilihat user saat menekan "Connect Google Drive".

Buka menu kiri → **APIs & Services → OAuth consent screen**.
Kalau ini pertama kali, Google akan mengarahkan ke **Google Auth Platform → Get started**.

> ℹ️ Google sempat mengganti tampilan. Kalau kamu lihat menu **Overview / Branding /
> Audience / Clients / Data Access** di kiri, berarti kamu pakai tampilan baru
> (panduan ini mengikuti yang baru). Kalau masih wizard 1 halaman lama, isiannya
> sama saja namanya.

### 3a. Get started

Isi bertahap:
- **App name:** nama yang dilihat user di layar izin, misal `9Drive` atau `Trial Manager Storage`.
- **User support email:** pilih email kamu.
- **Audience:** pilih **External**.
  > "Internal" hanya muncul kalau kamu pakai Google Workspace organisasi. Karena
  > kamu mau menghubungkan akun Gmail pribadi, **harus External**.
- **Contact Information:** isi email kamu (buat notifikasi dari Google).
- Centang **persetujuan kebijakan** → **Create**.

### 3b. Branding (kalau diminta / via menu Branding)

- **App name**, **User support email**: sudah terisi dari 3a.
- **App logo:** boleh dikosongkan.
- **Application home page / Privacy policy / Terms of service:** **opsional** untuk
  mode Testing — boleh dikosongkan dulu.
- **Authorized domains:** boleh dikosongkan untuk Testing.
- Simpan.

### 3c. Audience — pastikan "Testing" + tambah Test users  ⚠️ PENTING

Buka menu **Audience**.
- **Publishing status** harus **"Testing"** (jangan klik "Publish to production" dulu).
- Scroll ke **Test users → + Add users**.
- Tambahkan **SEMUA alamat Gmail yang akan kamu hubungkan** sebagai Drive
  (akun login kamu **dan** akun-akun Drive lain yang storage-nya mau digabung).
- Simpan.

> Tanpa langkah ini, saat connect kamu akan kena error **"access_blocked /
> app is in testing"**. Maksimal 100 test users — lebih dari cukup.

### 3d. Data Access — tambahkan Scopes  ⚠️ PENTING

Buka menu **Data Access** → **Add or remove scopes**. Akan muncul panel daftar scope.
Tambahkan **4 scope** berikut. Cara termudah: tempel satu per satu ke kotak
**"Manually add scopes"** di bawah panel, klik **Add to table**, ulangi:

```
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/drive.metadata.readonly
```

Lalu **Update** → **Save**.

- 3 scope pertama hanya untuk ambil **email, nama, & foto** akun.
- `drive.metadata.readonly` untuk **membaca kuota** Drive (total/terpakai/sisa).
  Scope ini **read-only** — app TIDAK bisa mengubah/menghapus file kamu.

> ⚠️ Google mungkin menandai scope Drive sebagai **"Sensitive"**. Itu **tidak masalah
> selama app di mode Testing** — kamu & test users bisa langsung pakai tanpa proses
> verifikasi. Verifikasi Google baru diperlukan kalau suatu hari kamu **Publish ke
> Production** untuk publik luas.

---

## Langkah 4 — Buat OAuth Client ID (Web application) + Redirect URI  ⚠️ INTI

1. Menu kiri → **APIs & Services → Credentials**
   (atau menu **Clients** di Google Auth Platform).
2. Klik **+ Create Credentials → OAuth client ID**.
3. **Application type:** pilih **Web application**.
4. **Name:** bebas, misal `9drive-web-client`.
5. **Authorized JavaScript origins:** **KOSONGKAN** (arsitektur kita tidak memakainya).
6. **Authorized redirect URIs → + Add URI**, tempel **persis** Redirect URI dari Langkah 0:

   ```
   https://<project-ref>.supabase.co/functions/v1/drive-oauth-callback
   ```

   (ganti `<project-ref>`; jangan ada spasi, jangan ada garis miring `/` di akhir).
7. Klik **Create**.

> 🔑 **Redirect URI harus identik 100%** dengan yang nanti kamu set di
> `GOOGLE_OAUTH_REDIRECT_URI`. Beda satu karakter → error `redirect_uri_mismatch`.

---

## Langkah 5 — Salin Client ID & Client Secret

Setelah klik Create, muncul popup berisi:
- **Client ID** → ini `GOOGLE_CLIENT_ID`
- **Client secret** → ini `GOOGLE_CLIENT_SECRET`

Salin keduanya. (Kalau popup keburu tertutup: **Credentials → klik nama client →**
Client ID terlihat, dan secret bisa dilihat/di-reset di situ.)

---

## Langkah 6 — Masukkan ke Supabase

Sekarang kamu punya 3 nilai. Lanjut ke **`supabase/functions/README.md`**
bagian *"Supabase CLI: secrets + deploy"* dan jalankan:

```bash
supabase secrets set \
  GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="GOCSPX-YOUR_CLIENT_SECRET" \
  GOOGLE_OAUTH_REDIRECT_URI="https://<project-ref>.supabase.co/functions/v1/drive-oauth-callback" \
  TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  FRONTEND_URL="https://your-app.vercel.app/"
```

Lalu deploy ketiga function-nya (lihat README). Selesai 🎉

---

## Troubleshooting (error yang sering muncul)

| Yang kamu lihat | Artinya & solusi |
|---|---|
| **`redirect_uri_mismatch`** | URI di Langkah 4 ≠ `GOOGLE_OAUTH_REDIRECT_URI`. Samakan **persis** (cek `https`, ref, tanpa `/` di akhir). Perubahan di Google Cloud kadang butuh ~1 menit untuk efektif. |
| **"Access blocked: app has not completed verification"** / **app is in testing** | Akun yang kamu pakai belum jadi **Test user**. Tambahkan di **Audience → Test users** (Langkah 3c). |
| **"Google hasn't verified this app"** (layar peringatan) | **Normal** untuk mode Testing. Klik **Advanced → "Go to <app> (unsafe)"** untuk lanjut. Aman karena ini app kamu sendiri. |
| **`invalid_client`** | `GOOGLE_CLIENT_ID`/`SECRET` salah ketik atau ketukar. Salin ulang dari Credentials. |
| **`access_denied`** | Kamu menolak izin di layar consent, atau scope belum ditambahkan (Langkah 3d). |
| **Quota tampil 0 / kosong** | Pastikan **Google Drive API** sudah **Enable** (Langkah 2) dan scope `drive.metadata.readonly` ada (Langkah 3d). |
| **`refresh token` tidak tersimpan / sync gagal setelah beberapa lama** | Pastikan kamu connect lewat tombol di app (flow kita sudah pakai `access_type=offline` + `prompt=consent`). Kalau perlu, **Disconnect lalu Connect ulang**. |

---

## Checklist cepat

- [ ] Project Google Cloud dibuat & terpilih
- [ ] Google Drive API = **Enabled**
- [ ] OAuth consent: **External**, status **Testing**
- [ ] Akun Google kamu (+ akun Drive lain) ditambahkan sebagai **Test users**
- [ ] 4 scope ditambahkan (termasuk `drive.metadata.readonly`)
- [ ] OAuth Client **Web application** dibuat
- [ ] **Redirect URI** = `https://<ref>.supabase.co/functions/v1/drive-oauth-callback`
- [ ] `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` disalin
- [ ] Ketiga nilai + `TOKEN_ENCRYPTION_KEY` + `FRONTEND_URL` di-`supabase secrets set`
