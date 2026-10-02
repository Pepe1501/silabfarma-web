/**
 * =========================================================================
 * SiLAB FARMA — INTEGRASI SUPABASE + VERCEL (menggantikan google.script.run)
 * -------------------------------------------------------------------------
 * CARA PAKAI:
 * 1. Di index.html Anda, tambahkan di dalam <head> (sebelum tag <style>):
 *
 *      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
 *
 * 2. Simpan file ini sebagai /public/frontend-integration.js di proyek Anda
 *    (satu folder dengan index.html), lalu tambahkan SEBELUM tag </body>,
 *    SETELAH <script> besar yang sudah ada:
 *
 *      <script src="frontend-integration.js"></script>
 *
 *    (Urutan ini penting — file ini akan MENIMPA fungsi gsRun, handleLogin,
 *    downloadRequestPdf, dsb. yang lama supaya memanggil API Vercel, bukan
 *    Apps Script lagi.)
 *
 * 3. Isi CONFIG di bawah dengan Project URL & anon key dari Supabase Anda
 *    (Project Settings > API). anon key AMAN ditaruh di sini (bukan rahasia).
 * =========================================================================
 */

const CONFIG = {
  SUPABASE_URL: "https:// lxemgrajsqxuucbcpibp.supabase.co",       // <-- ganti
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZW1ncmFqc3F4dXVjYmNwaWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MDU0ODIsImV4cCI6MjEwNjA4MTQ4Mn0.2aeLx4UmAW1q1liGwmu_Sl0BoqXywXuGbrdvoih829g",     // <-- ganti
  API_BASE: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZW1ncmFqc3F4dXVjYmNwaWJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDUwNTQ4MiwiZXhwIjoyMTA2MDgxNDgyfQ.sgmc0l_XhybKHKU5IV8BhWHe9I0LtiZNTu7-qdHbYxA"  // kosongkan jika index.html & folder /api berada di domain Vercel yang sama
};

const supabaseAuth = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// =========================================================================
// 1. gsRun — sekarang memanggil REST API Vercel, bukan Apps Script
// =========================================================================
async function apiFetch(path, options = {}) {
  const session = (await supabaseAuth.auth.getSession()).data.session;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (session) headers['Authorization'] = 'Bearer ' + session.access_token;

  const resp = await fetch(CONFIG.API_BASE + path, { ...options, headers });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error || ('Request gagal (' + resp.status + ')'));
  return json;
}

// Menimpa gsRun lama supaya seluruh kode UI Anda (yang memanggil gsRun('namaFungsi', ...))
// tetap berjalan tanpa perlu diubah.
window.gsRun = async function gsRun(funcName, ...args) {
  switch (funcName) {
    case 'getInventoryData':
      return apiFetch('/api/inventory');

    case 'getAlatData':
      return apiFetch('/api/alat');

    case 'getLogData':
      return apiFetch('/api/log-permintaan');

    case 'getLogPeminjamanData':
      return apiFetch('/api/log-peminjaman');

    case 'getLogGantiAlatData':
      return apiFetch('/api/log-ganti-alat');

    case 'submitRequestMulti': {
      const payload = args[0];
      const result = await apiFetch('/api/log-permintaan', { method: 'POST', body: JSON.stringify(payload) });
      // PDF sekarang dibuat langsung di browser (lihat bagian 3 di bawah)
      await downloadTandaTerimaBahanClient(payload);
      return result;
    }

    case 'submitPeminjamanMulti': {
      const payload = args[0];
      const result = await apiFetch('/api/log-peminjaman', { method: 'POST', body: JSON.stringify(payload) });
      await downloadPeminjamanAlatClient(payload);
      return result;
    }

    case 'submitGantiAlatMulti': {
      const payload = args[0];
      const result = await apiFetch('/api/log-ganti-alat', { method: 'POST', body: JSON.stringify(payload) });
      await downloadLaporanGantiAlatClient(payload);
      return result;
    }

    case 'markPeminjamanSelesai': {
      const [rowIndex] = args;
      return apiFetch('/api/log-peminjaman', { method: 'PATCH', body: JSON.stringify({ action: 'selesai', id: rowIndex }) });
    }

    case 'markPengembalianSebagian': {
      const [rowIndex, jumlah] = args;
      return apiFetch('/api/log-peminjaman', { method: 'PATCH', body: JSON.stringify({ action: 'partial', id: rowIndex, jumlah }) });
    }

    case 'markGantiAlatSelesai': {
      const [rowIndex] = args;
      return apiFetch('/api/log-ganti-alat', { method: 'PATCH', body: JSON.stringify({ id: rowIndex }) });
    }

    // generatePdfOnTheFly & generateLoanPdfOnTheFly tidak lagi diperlukan:
    // data sudah ada di REQUEST_DATA / LOAN_DATA hasil fetchData(), jadi
    // PDF dibuat ulang langsung di browser tanpa panggilan server (lihat downloadRequestPdf/downloadLoanPdf di bawah).

    default:
      throw new Error('Fungsi "' + funcName + '" belum dipetakan ke API baru.');
  }
};

// =========================================================================
// 2. LOGIN ADMIN — sekarang pakai Supabase Auth (bukan admin/admin123 hardcode)
//    Buat user admin dulu di: Supabase Dashboard > Authentication > Users > Add user
// =========================================================================
window.handleLogin = async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  const { error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error) {
    document.getElementById('login-error').classList.remove('hidden');
    document.getElementById('login-error').innerText = error.message;
    return;
  }

  isAdmin = true;
  closeLoginModal();
  updateAuthUI();
  attemptSwitchTab('dashboard');
  Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Login Berhasil', showConfirmButton: false, timer: 1500 });
};

const _origToggleAuth = window.toggleAuth;
window.toggleAuth = function toggleAuth() {
  if (isAdmin) {
    Swal.fire({
      title: 'Keluar dari Sesi Admin?', icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#0f766e', cancelButtonColor: '#d33', confirmButtonText: 'Ya, Keluar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await supabaseAuth.auth.signOut();
        isAdmin = false; updateAuthUI(); attemptSwitchTab('permintaan');
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Berhasil logout', showConfirmButton: false, timer: 1500 });
      }
    });
  } else {
    document.getElementById('login-modal').classList.add('active');
  }
};

// Pulihkan sesi admin saat halaman dibuka ulang (refresh)
(async function restoreSession() {
  const { data } = await supabaseAuth.auth.getSession();
  if (data.session) {
    isAdmin = true;
    if (typeof updateAuthUI === 'function') updateAuthUI();
  }
})();

// =========================================================================
// 3. PDF DI BROWSER (menggantikan createPdfFromHtml di Code.gs)
//    Memakai html2pdf.js — tidak perlu server sama sekali.
// =========================================================================
const LOGO_BASE64 = "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";

function buildHeaderHtml(judul, warnaAksen) {
  return `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
      <tr>
        <td style="width: 70px; vertical-align: middle; padding-right: 12px;">
          <img src="data:image/png;base64,${LOGO_BASE64}" style="width:60px;height:auto;object-fit:contain;" />
        </td>
        <td style="vertical-align: middle; text-align: center;">
          <h1 style="color: ${warnaAksen}; margin: 0; font-size: 18px;">POLITEKNIK KESEHATAN KEMENKES TASIKMALAYA</h1>
          <p style="margin: 4px 0 0; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; color: #475569;">LABORATORIUM TERPADU PROGRAM STUDI D3 FARMASI</p>
          <p style="margin: 2px 0 0; font-size: 9px; color: #64748b;">Jl Babakan Siliwangi No. 35 Kahuripan Tawang, Kota Tasikmalaya, Jawa Barat, Kode Pos 46115</p>
        </td>
      </tr>
    </table>
    <div style="border-bottom: 2px solid ${warnaAksen}; margin-bottom: 20px;"></div>
    <h2 style="color: ${warnaAksen}; text-align: center; margin-bottom: 20px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">${judul}</h2>
  `;
}

function buildSignatureFooterHtml(label, nama, nim, signatureBase64) {
  return `
    <div style="margin-top: 50px; float: right; width: 200px; text-align: center; font-size: 12px;">
      <p style="margin: 0 0 5px; color: #64748b; font-weight: bold;">${label},</p>
      <div style="border: 1px dashed #cbd5e1; padding: 5px; border-radius: 8px; background-color: #f8fafc; display: inline-block;">
        <img src="${signatureBase64}" style="height: 70px; max-width: 180px; object-fit: contain;" />
      </div>
      <p style="margin: 5px 0 0; font-weight: bold; color: #1e293b; text-decoration: underline;">${nama}</p>
      <p style="margin: 2px 0 0; font-size: 10px; color: #64748b;">NIM. ${nim}</p>
    </div>
  `;
}

function buildItemsTableHtml(items, namaKolom) {
  let html = `
    <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 12px; border-color: #cbd5e1;">
      <tr style="background-color: #f1f5f9; color: #475569; font-weight: bold;">
        <th style="text-align: left; border: 1px solid #cbd5e1;">${namaKolom}</th>
        <th style="text-align: center; width: 120px; border: 1px solid #cbd5e1;">Jumlah</th>
      </tr>`;
  items.forEach(item => {
    html += `
      <tr>
        <td style="border: 1px solid #cbd5e1; color: #334155;">${item.nama}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: #334155;">${item.jumlah} ${item.satuan}</td>
      </tr>`;
  });
  html += `</table>`;
  return html;
}

function formatISOToIndoClient(isoStr) {
  if (!isoStr) return '-';
  const bulanIndo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const parts = String(isoStr).trim().split('-');
  if (parts.length !== 3) return String(isoStr);
  const [y, m, d] = parts.map(p => parseInt(p, 10));
  if (!y || !m || !d) return String(isoStr);
  return `${String(d).padStart(2, '0')} ${bulanIndo[m - 1]} ${y}`;
}

// Merender HTML jadi PDF & langsung memicu unduhan (dipanggil oleh 3 fungsi di bawah)
function downloadPdfFromHtml(htmlBody, filenamePrefix, personName) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'font-family: Arial, sans-serif; padding: 20px; color: #334155; width: 720px;';
  wrapper.innerHTML = htmlBody;
  document.body.appendChild(wrapper);

  const filename = filenamePrefix + '_' + String(personName).replace(/\s+/g, '_') + '.pdf';

  return html2pdf().set({
    margin: 10,
    filename,
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
  }).from(wrapper).save().then(() => {
    document.body.removeChild(wrapper);
  });
}

async function downloadTandaTerimaBahanClient(payload) {
  const tanggalTampil = formatISOToIndoClient(payload.tanggal);
  const htmlBody =
    buildHeaderHtml('Pengajuan Bahan Praktikum', '#0f766e') +
    `<table style="width: 100%; font-size: 12px; margin-bottom: 20px; border-collapse: collapse;">
      <tr><td style="padding:4px 0; width:150px; font-weight:bold; color:#64748b;">NAMA PEMOHON</td><td style="width:10px;">:</td><td style="font-weight:bold; color:#1e293b;">${payload.pemohon}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">NIM</td><td>:</td><td style="color:#334155;">${payload.nim}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">KELAS / PRODI</td><td>:</td><td style="color:#334155;">${payload.kelas}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">TANGGAL PRAKTIKUM</td><td>:</td><td style="color:#334155;">${tanggalTampil}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">DOSEN PJ</td><td>:</td><td style="color:#334155;">${payload.dosen}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">TUJUAN / MODUL</td><td>:</td><td style="color:#334155; line-height:1.4;">${payload.tujuan}</td></tr>
    </table>
    <h4 style="margin: 20px 0 8px; color: #0f766e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Daftar Bahan Yang Diajukan:</h4>` +
    buildItemsTableHtml(payload.items.map(it => ({ nama: it.namaBahan, jumlah: it.jumlah, satuan: it.satuan })), 'Nama Bahan') +
    buildSignatureFooterHtml('Pemohon', payload.pemohon, payload.nim, payload.signature);

  await downloadPdfFromHtml(htmlBody, 'Tanda_Terima', payload.pemohon);
}

async function downloadPeminjamanAlatClient(payload) {
  const tanggalPinjamTampil = formatISOToIndoClient(payload.tanggalPinjam);
  const tanggalKembaliTampil = formatISOToIndoClient(payload.tanggalKembali);
  const htmlBody =
    buildHeaderHtml('Peminjaman Alat Praktikum', '#0f766e') +
    `<table style="width: 100%; font-size: 12px; margin-bottom: 20px; border-collapse: collapse;">
      <tr><td style="padding:4px 0; width:150px; font-weight:bold; color:#64748b;">NAMA PEMINJAM</td><td style="width:10px;">:</td><td style="font-weight:bold; color:#1e293b;">${payload.peminjam}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">NIM</td><td>:</td><td style="color:#334155;">${payload.nim}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">KELAS / PRODI</td><td>:</td><td style="color:#334155;">${payload.kelas}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">TANGGAL PINJAM</td><td>:</td><td style="color:#334155;">${tanggalPinjamTampil}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">TANGGAL KEMBALI</td><td>:</td><td style="color:#334155;">${tanggalKembaliTampil}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">DOSEN PJ</td><td>:</td><td style="color:#334155;">${payload.dosen}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">TUJUAN / MODUL</td><td>:</td><td style="color:#334155; line-height:1.4;">${payload.tujuan}</td></tr>
    </table>
    <h4 style="margin: 20px 0 8px; color: #0f766e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Daftar Alat Yang Dipinjam:</h4>` +
    buildItemsTableHtml(payload.items.map(it => ({ nama: it.namaAlat, jumlah: it.jumlah, satuan: it.satuan })), 'Nama Alat') +
    buildSignatureFooterHtml('Peminjam', payload.peminjam, payload.nim, payload.signature);

  await downloadPdfFromHtml(htmlBody, 'Peminjaman_Alat', payload.peminjam);
}

async function downloadLaporanGantiAlatClient(payload) {
  const merkTampil = (payload.merk && String(payload.merk).trim() !== '') ? payload.merk : '-';
  const now = new Date();
  const batas = new Date();
  batas.setDate(batas.getDate() + 7);
  const bulanIndo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const fmt = (d) => `${String(d.getDate()).padStart(2,'0')} ${bulanIndo[d.getMonth()]} ${d.getFullYear()}`;

  const htmlBody =
    buildHeaderHtml('Laporan & Penggantian Alat Rusak', '#b45309') +
    `<table style="width: 100%; font-size: 12px; margin-bottom: 20px; border-collapse: collapse;">
      <tr><td style="padding:4px 0; width:150px; font-weight:bold; color:#64748b;">NAMA PELAPOR</td><td style="width:10px;">:</td><td style="font-weight:bold; color:#1e293b;">${payload.nama}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">NIM</td><td>:</td><td style="color:#334155;">${payload.nim}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">KELAS / PRODI</td><td>:</td><td style="color:#334155;">${payload.kelas}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">NO. TELP/WA</td><td>:</td><td style="color:#334155;">${payload.telp}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">TANGGAL LAPOR</td><td>:</td><td style="color:#334155;">${fmt(now)}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">MERK ALAT</td><td>:</td><td style="color:#334155;">${merkTampil}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold; color:#64748b;">KETERANGAN</td><td>:</td><td style="color:#334155; line-height:1.4;">${payload.keterangan}</td></tr>
    </table>
    <h4 style="margin: 20px 0 8px; color: #b45309; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Daftar Alat Yang Rusak / Harus Diganti:</h4>` +
    buildItemsTableHtml(payload.items.map(it => ({ nama: it.namaAlat, jumlah: it.jumlah, satuan: it.satuan })), 'Nama Alat') +
    `<div style="background:#fffbeb; border:1px solid #fbbf24; border-radius:8px; padding:12px 16px; margin:15px 0; font-size:13px;">
      <b>Batas Waktu Penggantian:</b> ${fmt(batas)} (maksimal 7 hari sejak laporan dibuat)
    </div>` +
    buildSignatureFooterHtml('Pelapor', payload.nama, payload.nim, payload.signature);

  await downloadPdfFromHtml(htmlBody, 'Laporan_Ganti_Alat', payload.nama);
}

// Menimpa downloadRequestPdf/downloadLoanPdf lama: sekarang membangun ulang PDF
// dari data yang SUDAH ada di REQUEST_DATA / LOAN_DATA (hasil fetchData()),
// tanpa perlu panggilan server tambahan.
window.downloadRequestPdf = function (timestamp, pemohon) {
  const rows = REQUEST_DATA.filter(r => r.timestamp === timestamp && r.pemohon === pemohon);
  if (rows.length === 0) return Swal.fire('Gagal', 'Data pengajuan tidak ditemukan.', 'error');
  const payload = {
    pemohon: rows[0].pemohon, nim: rows[0].nim, tanggal: rows[0].tanggal, dosen: rows[0].dosen,
    kelas: rows[0].kelas, tujuan: rows[0].tujuan, signature: rows[0].signature,
    items: rows.map(r => ({ namaBahan: r.bahan, jumlah: r.jumlah, satuan: r.satuan }))
  };
  downloadTandaTerimaBahanClient(payload);
};

window.downloadLoanPdf = function (timestamp, peminjam) {
  const rows = LOAN_DATA.filter(r => r.timestamp === timestamp && r.peminjam === peminjam);
  if (rows.length === 0) return Swal.fire('Gagal', 'Data peminjaman tidak ditemukan.', 'error');
  const payload = {
    peminjam: rows[0].peminjam, nim: rows[0].nim, tanggalPinjam: rows[0].tanggalPinjam,
    tanggalKembali: rows[0].tanggalKembaliISO, dosen: rows[0].dosen, kelas: rows[0].kelas,
    tujuan: rows[0].tujuan, signature: rows[0].signature,
    items: rows.map(r => ({ namaAlat: r.alat, jumlah: r.jumlah, satuan: r.satuan }))
  };
  downloadPeminjamanAlatClient(payload);
};
