# SiLAB Farma — Migrasi ke GitHub + Supabase + Vercel

Proyek ini menggantikan backend Google Apps Script + Google Sheets Anda dengan:
- **Supabase** — database (Postgres) + login admin
- **Vercel** — hosting `index.html` Anda + API (folder `/api`)
- **GitHub** — penyimpanan kode, terhubung ke Vercel (auto-deploy tiap push)

PDF sekarang dibuat **langsung di browser** (pakai `html2pdf.js`), jadi tidak butuh
Google Drive / server PDF sama sekali.

---

## STRUKTUR PROYEK

```
silabfarma-web/
├── index.html                  <- taruh index.html Anda di sini (lihat langkah 5)
├── frontend-integration.js     <- SUDAH DIBUAT, jangan diubah kecuali CONFIG di atasnya
├── api/
│   ├── inventory.js            <- GET daftar stok bahan
│   ├── alat.js                 <- GET daftar stok alat
│   ├── log-permintaan.js       <- GET riwayat & POST pengajuan bahan
│   ├── log-peminjaman.js       <- GET riwayat & POST peminjaman & PATCH pengembalian
│   └── log-ganti-alat.js       <- GET riwayat & POST lapor rusak & PATCH selesai
├── lib/
│   ├── supabase.js             <- koneksi Supabase (service role, server-only)
│   ├── auth.js                 <- verifikasi login admin
│   └── tanggal.js              <- format tanggal Indonesia
├── supabase/schema.sql         <- jalankan ini di Supabase SQL Editor
├── package.json
├── vercel.json
└── .env.example
```

---

## LANGKAH 1 — Buat proyek Supabase

1. Buka https://supabase.com → Sign up / Login → **New Project**.
2. Catat: **Project URL**, **anon public key**, **service_role key**
   (Project Settings → API).
3. Buka **SQL Editor** → New Query → tempel seluruh isi `supabase/schema.sql` → **Run**.
   Ini akan membuat semua tabel (`master_bahan`, `master_alat`, `log_permintaan`,
   `log_peminjaman`, `log_ganti_alat`), fungsi-fungsi transaksi, dan data contoh.
4. Buat akun admin: **Authentication → Users → Add user** (isi email & password).
   Ini menggantikan login `admin/admin123` yang lama.

---

## LANGKAH 2 — Push proyek ini ke GitHub

```bash
cd silabfarma-web
git init
git add .
git commit -m "Migrasi SiLAB Farma ke Supabase + Vercel"
git branch -M main
git remote add origin https://github.com/USERNAME/silabfarma-web.git
git push -u origin main
```

(Buat repo kosong dulu di github.com/new sebelum `git push`.)

---

## LANGKAH 3 — Deploy ke Vercel

1. Buka https://vercel.com → **Add New Project** → pilih repo GitHub Anda.
2. Framework preset: pilih **Other** (proyek ini bukan Next.js/React, cukup HTML statis + serverless functions).
3. Di **Environment Variables**, tambahkan:
   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL dari Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key dari Supabase |
4. Klik **Deploy**. Setelah selesai Anda dapat URL seperti `https://silabfarma-web.vercel.app`.

---

## LANGKAH 4 — Sambungkan frontend ke Supabase (untuk login admin)

Buka `frontend-integration.js`, ganti bagian atas:

```js
const CONFIG = {
  SUPABASE_URL: "https://xxxxxxxxxxxx.supabase.co",   // isi punya Anda
  SUPABASE_ANON_KEY: "isi-dengan-anon-public-key",     // isi punya Anda (BUKAN service_role)
  API_BASE: ""
};
```

`anon key` aman ditaruh di file frontend (bukan rahasia). Yang **tidak boleh**
pernah muncul di browser adalah `service_role key` (itu hanya untuk `/api/*.js` di server).

---

## LANGKAH 5 — Pasang `index.html` Anda

1. Salin `index.html` yang sudah Anda buat ke folder root proyek ini.
2. Di dalam `<head>`, tambahkan 2 baris ini (sebelum `<style>`):
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
   ```
3. Sebelum `</body>`, **setelah** tag `<script>` besar yang sudah ada, tambahkan:
   ```html
   <script src="frontend-integration.js"></script>
   ```
   Urutan ini penting: script ini akan menimpa `gsRun`, `handleLogin`, `toggleAuth`,
   `downloadRequestPdf`, dan `downloadLoanPdf` supaya memanggil Supabase/Vercel,
   bukan Apps Script lagi. Semua kode UI lain (tabel, keranjang, tanda tangan, dsb.)
   **tidak perlu diubah sama sekali**.
4. Commit & push ke GitHub → Vercel otomatis deploy ulang.

---

## APA YANG BERUBAH DARI VERSI LAMA

| Fitur lama (Apps Script) | Sekarang |
|---|---|
| Data di Google Sheets | Data di tabel Postgres (Supabase) |
| PDF dibuat di server, disimpan ke Drive | PDF dibuat langsung di browser (html2pdf.js), auto-download |
| Login admin `admin/admin123` hardcode di JS | Login sungguhan lewat Supabase Auth |
| Update stok & log tidak atomik (rawan race condition) | Atomik lewat fungsi Postgres (`for update` row locking) |
| Aksi admin (tandai selesai, dll) tidak diverifikasi server | Diverifikasi lewat token Supabase Auth di setiap request `PATCH` |

## CATATAN

- Tombol "Unduh Draft Pengajuan Restock" & "Berita Acara Pemusnahan" di modal
  Tindak Lanjut pada versi asli memang belum benar-benar menghasilkan PDF nyata
  (hanya notifikasi sukses) — jadi tidak ada yang perlu dipindahkan untuk itu.
  Kalau Anda ingin fitur ini nyata, beri tahu saya, saya bisa buatkan sekalian
  (datanya sudah tersedia dari `INVENTORY_DATA` di browser, bisa langsung
  di-generate PDF dengan cara yang sama seperti `downloadPdfFromHtml`).
- Nomor WhatsApp pengingat keterlambatan tetap jalan seperti sebelumnya (murni
  logic browser, tidak menyentuh backend).
