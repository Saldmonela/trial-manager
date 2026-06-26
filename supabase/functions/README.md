# Cloud Storage — Edge Functions (Connect Google Drive + Sync Quota)

Modul `/storage`: hubungkan akun Google Drive, simpan token terenkripsi server-side,
dan sync kuota asli (total/used/available). Server-side memakai **Supabase Edge Functions**
(folder ini). Token OAuth tidak pernah sampai ke browser.

## Functions

| Function | verify_jwt | Tugas |
|---|---|---|
| `drive-connect-url` | ✅ | Buat `oauth_states` + kembalikan URL consent Google. |
| `drive-oauth-callback` | ❌ | Di-hit redirect Google: tukar code, ambil profil+quota, enkripsi, upsert. |
| `drive-sync-quota` | ✅ | Refresh token bila perlu, panggil Drive `about.get`, update quota. |

## Prasyarat setup (sekali)

### 1. Database
Jalankan `supabase/migrations/20260621_add_connected_accounts.sql` di
Supabase Dashboard → SQL Editor.

### 2. Google Cloud Console
👉 **Panduan lengkap langkah-demi-langkah dari nol ada di
[`GOOGLE_CLOUD_SETUP.md`](./GOOGLE_CLOUD_SETUP.md)** (disarankan kalau baru pertama kali).

Ringkasnya:
1. Enable **Google Drive API**.
2. OAuth consent screen (External, status **Testing**): tambahkan scope
   `openid`, `userinfo.email`, `userinfo.profile`,
   `https://www.googleapis.com/auth/drive.metadata.readonly`.
   Tambahkan tiap akun Google yang akan dihubungkan sebagai **Test users**.
3. Credentials → buat **OAuth client ID (Web application)**.
   Authorized redirect URI:
   `https://<project-ref>.supabase.co/functions/v1/drive-oauth-callback`
   (harus identik byte-per-byte dengan `GOOGLE_OAUTH_REDIRECT_URI`).

### 3. Supabase CLI: secrets + deploy
```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>

supabase secrets set \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..." \
  GOOGLE_OAUTH_REDIRECT_URI="https://<project-ref>.supabase.co/functions/v1/drive-oauth-callback" \
  TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  FRONTEND_URL="https://your-app.vercel.app"
# (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY otomatis tersedia)

supabase functions deploy drive-connect-url
supabase functions deploy drive-sync-quota
supabase functions deploy drive-oauth-callback --no-verify-jwt
```

> ⚠️ `FRONTEND_URL` harus = alamat tempat kamu MEMBUKA app saat connect:
> - Tes lokal (`npm run dev`) → `http://localhost:5173`
> - Produksi Vercel → URL Vercel kamu (mis. `https://trial-manager.vercel.app`)
>
> Salah isi `FRONTEND_URL` (mis. dibiarkan `https://your-app.vercel.app`) bikin
> setelah connect kamu dilempar ke situs yang salah → "halaman storage seolah hilang".
> Sebagai pengaman, callback kini juga memakai **origin asal** tempat tombol Connect
> ditekan, tapi tetap set `FRONTEND_URL` dengan benar.

## Catatan keamanan
- Kolom `*_encrypted` di-`REVOKE SELECT` dari `anon`/`authenticated` → browser tak bisa membacanya.
- Hanya **service role** (di dalam function) yang menulis/membaca token.
- `TOKEN_ENCRYPTION_KEY` = secret Edge Function, **bukan** `VITE_`.
