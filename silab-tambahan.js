/* SiLABFarma - PERCEPATAN. Tempel blok ini di PALING ATAS silab-tambahan.js (sebelum blok "PDF mengikuti format form Word"). */
(function () {
  const $ = id => document.getElementById(id);

  // CSS: overlay memudar cepat, tidak menghalangi klik saat transparan, dan SweetAlert selalu di atas overlay
  const st = document.createElement('style');
  st.textContent =
    '#loading-overlay{transition:opacity .15s ease!important}' +
    '#loading-overlay[style*="opacity: 0;"]{pointer-events:none}' +
    '.swal2-container{z-index:10050!important}';
  document.head.appendChild(st);

  // ===== 1. fetchData: layar loading penuh HANYA saat pertama kali buka. Selanjutnya refresh diam-diam. =====
  let loadedOnce = false, inflight = null, again = false, wantToast = false;

  async function jalankan(showToast) {
    const loader = $('loading-overlay');
    if (!loadedOnce) {
      $('loading-text').innerText = 'Memuat data...';
      loader.style.display = 'flex'; loader.style.opacity = '1';
    }
    let berhasil = true;
    try {
      const [inv, logs, alat, loans, ganti] = await Promise.all([
        gsRun('getInventoryData'), gsRun('getLogData'), gsRun('getAlatData'),
        gsRun('getLogPeminjamanData'), gsRun('getLogGantiAlatData')
      ]);
      INVENTORY_DATA = inv || []; REQUEST_DATA = logs || []; ALAT_DATA = alat || [];
      LOAN_DATA = loans || []; GANTI_DATA = ganti || [];
    } catch (err) {
      berhasil = false;
      console.warn('Gagal ambil data dari server:', err);
      if (!loadedOnce) useMockData();   // data lama TIDAK ditimpa saat refresh berikutnya gagal
      else Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Gagal memperbarui data', showConfirmButton: false, timer: 2500 });
    }
    if (berhasil || !loadedOnce) refreshUI(showToast && berhasil);
    if (!loadedOnce) { loader.style.opacity = '0'; loader.style.display = 'none'; }
    loadedOnce = true;
  }

  window.fetchData = function (showToast = false) {
    if (inflight) { again = true; wantToast = wantToast || showToast; return inflight; }
    inflight = jalankan(showToast).finally(() => {
      inflight = null;
      if (again) { const t = wantToast; again = false; wantToast = false; window.fetchData(t); }
    });
    return inflight;
  };

  // refreshUI versi baru: sama seperti aslinya, tetapi TIDAK menyentuh overlay loading
  window.refreshUI = function (showToast) {
    renderTableStok(); renderTableStokAlat(); renderDashboardStats(); renderKatalogMini();
    renderRiwayat(); renderRiwayatAlat(); renderCart(); renderKatalogAlatMini(); renderCartAlat();
    renderKatalogGantiMini(); renderCartGanti(); renderRiwayatGanti();
    updateBadgeGanti(); updateBadgePinjam(); renderTindakLanjutKeterlambatan();
    if (showToast) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Data Terupdate', showConfirmButton: false, timer: 1500 });
  };

  // ===== 2. Render tabel jauh lebih cepat =====
  // Kode asli memakai  tbody.innerHTML += '<tr>...'  di dalam loop. Tiap putaran browser membongkar & membangun ulang
  // seluruh isi tabel (makin banyak data makin lambat). Di sini tulisan ditampung dulu, lalu dipasang SEKALI di akhir.
  const nGet = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').get;
  const nSet = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
  function tampung(el) {
    if (el.__flush) return;
    let buf = null;
    Object.defineProperty(el, 'innerHTML', {
      configurable: true,
      get() { return buf === null ? nGet.call(this) : buf; },
      set(v) { buf = String(v); }
    });
    el.__flush = () => { delete el.innerHTML; delete el.__flush; if (buf !== null) nSet.call(el, buf); };
  }
  function batched(nama, ids) {
    const asli = window[nama];
    if (typeof asli !== 'function') return;
    window[nama] = function () {
      const els = ids.map($).filter(Boolean);
      els.forEach(tampung);
      try { return asli.apply(this, arguments); }
      finally { els.forEach(e => e.__flush && e.__flush()); }
    };
  }
  batched('renderTableStok', ['stok-table-body', 'stok-menipis-table-body', 'stok-kadaluarsa-table-body']);
  batched('renderTableStokAlat', ['stok-alat-table-body']);
  batched('renderRiwayat', ['recent-requests-table', 'riwayat-table-body']);
  batched('renderRiwayatAlat', ['recent-loans-table', 'riwayat-alat-table-body']);
  batched('renderRiwayatGanti', ['riwayat-ganti-table-body']);
  batched('renderTindakLanjutKeterlambatan', ['list-terlambat-pinjam', 'list-terlambat-ganti']);
  batched('renderKatalogMini', ['katalog-mini']);
  batched('renderKatalogAlatMini', ['katalog-alat-mini']);
  batched('renderKatalogGantiMini', ['katalog-ganti-mini']);
  batched('renderCart', ['keranjang-list']);
  batched('renderCartAlat', ['keranjang-alat-list']);
  batched('renderCartGanti', ['keranjang-ganti-list']);

  // ===== 3. Update tampilan langsung (tanpa menunggu ambil ulang data) =====
  window.__silabPatch = {
    pengembalian(rowIndex, jumlah) {
      const rec = LOAN_DATA.find(x => x.rowIndex === rowIndex); if (!rec) return;
      rec.jumlahDikembalikan = (rec.jumlahDikembalikan || 0) + Number(jumlah);
      const alat = ALAT_DATA.find(a => a.id === rec.idAlat); if (alat) alat.stok += Number(jumlah);
      renderRiwayatAlat(); updateBadgePinjam(); renderTindakLanjutKeterlambatan(); renderTableStokAlat(); renderKatalogAlatMini();
    },
    ganti(rowIndex) {
      const rec = GANTI_DATA.find(x => x.rowIndex === rowIndex); if (!rec) return;
      rec.status = 'Sudah Diganti';
      const alat = ALAT_DATA.find(a => a.id === rec.alatId); if (alat) alat.stok += Number(rec.jumlah);
      renderRiwayatGanti(); updateBadgeGanti(); renderTindakLanjutKeterlambatan(); renderTableStokAlat(); renderKatalogGantiMini();
    }
  };
})();

/* SiLABFarma - PDF mengikuti format form Word Prodi DIII Farmasi (kop surat, tabel, validasi). */
(function () {
  const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const indo = v => {
    if (!v) return '-';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : new Date(v);
    return isNaN(d) ? String(v) : `${String(d.getDate()).padStart(2, '0')} ${BLN[d.getMonth()]} ${d.getFullYear()}`;
  };
  const X = 25.4, W = 167, PLP = 'Freddy Irwansyah';

  // [CEPAT] Kop dimuat sekali, dikecilkan ke ukuran cetak, lalu disimpan sebagai JPEG.
  // JPEG disisipkan langsung oleh jsPDF (jauh lebih cepat daripada PNG besar yang harus diproses ulang tiap PDF).
  let kopP = null;
  function kop() {
    if (kopP) return kopP;
    kopP = (async () => {
      try {
        const blob = await (await fetch('kop.png')).blob();
        const url = URL.createObjectURL(blob);
        const im = await new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ng; i.src = url; });
        const sc = Math.min(1, 1400 / im.naturalWidth);
        const c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
        const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        return c.toDataURL('image/jpeg', 0.95);
      } catch (e) { return ''; }
    })();
    return kopP;
  }
  setTimeout(kop, 300);   // siapkan di latar belakang sejak halaman dibuka

  async function build(o) {
    const { jsPDF } = window.jspdf, d = new jsPDF({ unit: 'mm', format: 'a4' });
    const img = await kop();
    const L = (x1, y1, x2, y2) => d.line(x1, y1, x2, y2);
    const fit = (src, bw, bh) => { const p = d.getImageProperties(src), r = Math.min(bw / p.width, bh / p.height); return [p.width * r, p.height * r]; };
    d.setTextColor(0); d.setDrawColor(0); d.setLineWidth(0.25);

    // Kop surat + judul
    if (img) { try { d.addImage(img, 'JPEG', 9.4, 7.4, 161, 22.6); } catch (e) {} }
    d.setFont('helvetica', 'bold'); d.setFontSize(11);
    d.text(o.judul, 105, 36, { align: 'center' });
    d.text('UNIT LABORATORIUM TERPADU', 105, 40.8, { align: 'center' });

    // Data diri
    d.setFontSize(10); let y = 53;
    o.info.forEach(([k, v]) => {
      d.setFont('helvetica', 'normal'); d.text(k, X, y); d.text(':', 80, y);
      const t = d.splitTextToSize(String(v || '-'), X + W - 83); d.text(t, 83, y); y += 5 * t.length;
    });
    y += 5; d.setFont('helvetica', 'bold'); d.text(o.daftar, X, y); y += 3;

    // Tabel daftar (NO | Nama | Jumlah & Satuan | Keterangan gabungan)
    const cw = [12.4, 70, 42.3, 42.3], cx = [X, X + 12.4, X + 82.4, X + 124.7];
    d.rect(X, y, W, 8); [1, 2, 3].forEach(i => L(cx[i], y, cx[i], y + 8));
    d.setFontSize(9.5);
    d.text('NO', cx[0] + cw[0] / 2, y + 5.3, { align: 'center' });
    d.text(o.kolomNama, cx[1] + cw[1] / 2, y + 5.3, { align: 'center' });
    d.text('Jumlah & Satuan', cx[2] + cw[2] / 2, y + 5.3, { align: 'center' });
    d.text('Keterangan', cx[3] + cw[3] / 2, y + 5.3, { align: 'center' });
    y += 8; d.setFont('helvetica', 'normal');

    const ket = (Array.isArray(o.keterangan) ? o.keterangan : [o.keterangan || '']).flatMap(t => d.splitTextToSize(String(t), cw[3] - 4));
    let segTop = y, ketDone = false;
    const tutupKet = yEnd => {
      d.rect(cx[3], segTop, cw[3], yEnd - segTop);
      if (!ketDone) { d.text(ket.slice(0, Math.max(1, Math.floor((yEnd - segTop - 2) / 4.2))), cx[3] + 2, segTop + 5); ketDone = true; }
    };
    const rows = o.items.slice(); while (rows.length < o.minRows) rows.push(null);
    rows.forEach((it, i) => {
      const nm = it ? d.splitTextToSize(String(it.nama), cw[1] - 4) : [''];
      const jm = it ? d.splitTextToSize(`${it.jumlah} ${it.satuan}`, cw[2] - 4) : [''];
      const h = Math.max(7, Math.max(nm.length, jm.length) * 4.2 + 2.8);
      if (y + h > 280) { tutupKet(y); d.addPage(); y = 20; segTop = y; }
      d.rect(X, y, cw[0] + cw[1] + cw[2], h); L(cx[1], y, cx[1], y + h); L(cx[2], y, cx[2], y + h);
      d.text(String(i + 1), cx[0] + cw[0] / 2, y + 4.9, { align: 'center' });
      d.text(nm, cx[1] + 2, y + 4.9); d.text(jm, cx[2] + 2, y + 4.9);
      y += h;
    });

    // Pastikan tinggi tabel cukup untuk tulisan Keterangan
    const butuh = ket.length * 4.2 + 4;
    if (!ketDone && y - segTop < butuh) {
      const tambah = butuh - (y - segTop);
      d.rect(X, y, cw[0] + cw[1] + cw[2], tambah);
      L(cx[1], y, cx[1], y + tambah); L(cx[2], y, cx[2], y + tambah);
      y += tambah;
    }
    tutupKet(y);

    // Tabel validasi (+ blok pengembalian / penggantian): selalu menempel di bagian bawah halaman
    const tinggiVal = 6 + 17 * 2 + (o.blok ? 7 + 17 : 0);
    if (y + 9 + tinggiVal + 2 > 280) { d.addPage(); y = 20; }
    else y = 280 - tinggiVal;
    const vw = [52.9, 56.8, 57.3], vx = [X, X + 52.9, X + 109.7];
    d.rect(X, y, W, 6); L(vx[1], y, vx[1], y + 6); L(vx[2], y, vx[2], y + 6);
    d.setFont('helvetica', 'bold');
    ['Validasi', 'Nama', 'Tanda Tangan'].forEach((t, i) => d.text(t, vx[i] + vw[i] / 2, y + 4.2, { align: 'center' }));
    y += 6;
    const baris = (a, b, sig, tengah) => {
      d.rect(X, y, W, 17); L(vx[1], y, vx[1], y + 17); L(vx[2], y, vx[2], y + 17);
      d.setFont('helvetica', 'normal');
      d.text(a, vx[0] + 2, y + 5.5);
      d.text(b, tengah ? vx[1] + vw[1] / 2 : vx[1] + 2, y + 5.5, tengah ? { align: 'center' } : undefined);
      if (sig) { try { const [w, h] = fit(sig, 46, 14); d.addImage(sig, 'PNG', vx[2] + (vw[2] - w) / 2, y + (17 - h) / 2, w, h); } catch (e) {} }
      y += 17;
    };
    baris(o.peran, o.nama, o.signature);
    baris('Mengetahui PLP', PLP, null);
    if (o.blok) {
      d.rect(X, y, W, 7); d.setFont('helvetica', 'bold'); d.text(o.blok, X + W / 2, y + 4.9, { align: 'center' }); y += 7;
      baris('Tanggal :', o.yang, null, true);
    }
    return {
      status: 'Sukses',
      pdfBase64: d.output('datauristring').split(',')[1],
      pdfName: o.prefix + '_' + String(o.nama).replace(/\s+/g, '_') + '.pdf'
    };
  }

  window.SILAB_PDF = {
    bahan: (x, items) => build({
      judul: 'FORM PERMINTAAN BAHAN PRODI DIII FARMASI', prefix: 'Form_Permintaan_Bahan',
      daftar: 'Daftar Bahan Yang Diajukan', kolomNama: 'Nama Bahan', minRows: 0, items,
      keterangan: x.tujuan, peran: 'Pemohon', nama: x.pemohon, signature: x.signature,
      info: [['Nama Pemohon', x.pemohon], ['NIM', x.nim], ['Tingkat/Semester', x.kelas], ['Tanggal Permintaan Bahan', indo(x.tanggal)],
             ['Dosen Pengampu', x.dosen], ['No. Handphone', x.telp]]
    }),
    alat: (x, items) => build({
      judul: 'FORM PEMINJAMAN ALAT PRODI DIII FARMASI', prefix: 'Form_Peminjaman_Alat',
      daftar: 'Daftar Alat Yang Dipinjam', kolomNama: 'Nama Alat', minRows: 0, items,
      keterangan: x.tujuan, peran: 'Pemohon', nama: x.peminjam, signature: x.signature,
      blok: 'Pengembalian Alat', yang: 'Yang Mengembalikan',
      info: [['Nama Pemohon', x.peminjam], ['NIM', x.nim], ['Tingkat/Semester', x.kelas], ['Tanggal Peminjaman Alat', indo(x.tanggalPinjam)],
             ['Tanggal Pengembalian Alat', indo(x.tanggalKembali)], ['Dosen Pengampu', x.dosen], ['No. Handphone', x.telp]]
    }),
    ganti: x => {
      const ket = [...(x.keterangan ? [x.keterangan] : []), ...(x.merk ? ['Merk: ' + x.merk] : [])];
      return build({
        judul: 'FORM PENGGANTIAN ALAT PRODI DIII FARMASI', prefix: 'Form_Penggantian_Alat',
        daftar: 'Daftar Alat Yang Rusak / Harus Diganti', kolomNama: 'Nama Alat', minRows: 0,
        items: x.items.map(i => ({ nama: i.namaAlat, jumlah: i.jumlah, satuan: i.satuan })),
        keterangan: ket,
        peran: 'Nama', nama: x.nama, signature: x.signature, blok: 'Penggantian Alat', yang: 'Yang Mengganti',
        info: [['Nama', x.nama], ['NIM', x.nim], ['Tingkat/Semester', x.kelas], ['Tanggal Kejadian', x.tanggalLapor],
               ['Tanggal Maksimal Penggantian', x.batasWaktu], ['No. Handphone', x.telp]]
      });
    }
  };
})();

/* SiLABFarma - tambahan: tampilan 2 langkah, konfirmasi kirim, dan bukti PDF lewat email.
   Dimuat SETELAH silab-supabase.js. Kode HTML asli tidak diubah. */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ================= 1. BUKTI PDF DIKIRIM LEWAT EMAIL (di latar belakang, layar tidak menunggu) =================
  const JENIS = { submitRequestMulti: 'Permintaan Bahan', submitPeminjamanMulti: 'Peminjaman Alat', submitGantiAlatMulti: 'Laporan Alat Rusak' };
  let emailTujuan = null;
  const fire = Swal.fire.bind(Swal);

  function unduhPdf(r) {
    const a = document.createElement('a');
    a.href = 'data:application/pdf;base64,' + r.pdfBase64;
    a.download = r.pdfName || 'Bukti_Pengajuan.pdf';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  // [CEPAT] Tidak di-await: pengajuan langsung dinyatakan berhasil (data sudah tersimpan di database),
  // email dikirim sambil mahasiswa melihat notifikasi. Bila email gagal, PDF diunduh sebagai cadangan.
  async function kirimEmailBg(name, args, r) {
    const p = args[0] || {};
    try {
      const res = await fetch('/api/kirim-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: p.email, nama: p.pemohon || p.peminjam || p.nama, jenis: JENIS[name], pdfBase64: r.pdfBase64, pdfName: r.pdfName })
      });
      if (!res.ok) {
        let d = {};
        try { d = await res.json(); } catch (_) {}
        throw new Error(d.error || ('HTTP ' + res.status));
      }
      fire({ toast: true, position: 'top-end', icon: 'success', title: 'Bukti PDF terkirim ke ' + p.email, showConfirmButton: false, timer: 3500 });
    } catch (e) {
      console.error('Kirim email gagal:', e);
      unduhPdf(r);
      fire({ icon: 'warning', title: 'Email gagal terkirim',
             html: 'Alasan: ' + esc(e.message) + '.<br>PDF diunduh sebagai cadangan, mohon simpan filenya.' });
    }
  }

  const asli = window.google.script.run;
  function bungkus(onOk, onFail) {
    return new Proxy({}, { get: (_, name) => {
      if (typeof name !== 'string') return undefined;
      if (name === 'withSuccessHandler') return f => bungkus(f, onFail);
      if (name === 'withFailureHandler') return f => bungkus(onOk, f);
      return (...args) => {
        if (name === 'submitGantiAlatMulti' && args[0]) args[0].email = $('ganti-email').value.trim();
        asli.withSuccessHandler(r => {
          try {
            if (JENIS[name] && r && r.pdfBase64) {
              emailTujuan = (args[0] || {}).email;
              kirimEmailBg(name, args, r);
              r = { status: 'Sukses' };              // tanpa pdfBase64 => PDF tidak diunduh otomatis
            } else if (name === 'markPengembalianSebagian') {
              window.__silabPatch.pengembalian(args[0], args[1]);   // tampilan langsung berubah
            } else if (name === 'markGantiAlatSelesai') {
              window.__silabPatch.ganti(args[0]);
            }
          } catch (e) { console.error(e); }
          onOk && onOk(r);
        }).withFailureHandler(e => onFail && onFail(e))[name](...args);
      };
    } });
  }
  window.google.script.run = bungkus();

  // Ganti teks pemberitahuan "otomatis diunduh" menjadi "dikirim ke email"
  Swal.fire = (...a) => {
    const o = a[0];
    if (o && typeof o === 'object') {
      const info = `Bukti PDF sedang dikirim ke ${esc(emailTujuan)}. Jika belum masuk beberapa menit lagi, cek folder Spam.`;
      if (/otomatis diunduh/.test(o.text || '')) o.text = info;
      if (/Batas waktu penggantian/.test(o.html || '')) o.html += `<br><small>${info}</small>`;
    }
    return fire(...a);
  };

  // Form Lapor & Ganti Alat Rusak belum punya kolom email: tambahkan
  $('ganti-telp').parentElement.parentElement.insertAdjacentHTML('beforeend',
    '<div class="sm:col-span-2"><label class="block text-xs font-bold text-slate-600 uppercase mb-1">Alamat E-mail (bukti PDF dikirim ke sini)</label>' +
    '<input type="email" id="ganti-email" required placeholder="Contoh: faiza@gmail.com" autocomplete="off" ' +
    'class="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition"></div>');
  document.querySelector('#ganti-form button[type=submit]').innerHTML =
    '<i class="fa-solid fa-paper-plane"></i> Kirim Laporan &amp; Kirim PDF ke Email';

  // ================= 2. KONFIRMASI SEBELUM MENGIRIM PENGAJUAN =================
  const tgl = v => String(v || '').split('-').reverse().join('/');
  const v = id => esc($(id).value.trim());
  const daftar = arr => arr.map(c => `<li>${esc(c.nama)}: <b>${c.qty || 1} ${esc(c.satuan)}</b></li>`).join('');
  const kotak = (head, items, judul) =>
    `<div style="text-align:left;font-size:14px">${head}<p style="margin:10px 0 4px"><b>${judul}</b></p>` +
    `<ul style="padding-left:20px;list-style:disc">${items}</ul>` +
    `<p style="margin-top:12px;font-size:12px;color:#64748b">Periksa kembali data dan jumlahnya. Setelah dikirim, stok langsung berkurang dan bukti PDF dikirim ke email di atas.</p></div>`;

  function konfirmasi(fn, siap, rinci) {
    const asliFn = window[fn];
    window[fn] = function (e) {
      e.preventDefault();
      if (!siap()) return asliFn(e);             // biarkan fungsi asli menampilkan peringatan
      Swal.fire({
        title: 'Kirim pengajuan ini?', html: rinci(), icon: 'question', showCancelButton: true,
        confirmButtonColor: '#0f766e', cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Ya, kirim sekarang', cancelButtonText: 'Periksa lagi'
      }).then(r => { if (r.isConfirmed) asliFn(e); });
    };
  }
  konfirmasi('handleRequestFormSubmit', () => cart.length && !isCanvasBlank(canvas),
    () => kotak(`<b>${v('req-nama')}</b> (${v('req-nim')})<br>Tanggal praktikum: ${tgl($('req-tanggal').value)}<br>Bukti dikirim ke: ${v('req-email')}`,
      daftar(cart), 'Bahan yang diajukan:'));
  konfirmasi('handleLoanFormSubmit', () => cartAlat.length && !isCanvasBlank(canvasAlat),
    () => kotak(`<b>${v('pinjam-nama')}</b> (${v('pinjam-nim')})<br>Pinjam: ${tgl($('pinjam-tanggal-pinjam').value)}, kembali: ${tgl($('pinjam-tanggal-kembali').value)}<br>Bukti dikirim ke: ${v('pinjam-email')}`,
      daftar(cartAlat), 'Alat yang dipinjam:'));

  // ================= 3. TAMPILAN 2 LANGKAH =================
  const css = document.createElement('style');
  css.textContent = '.wiz-collapse{height:0!important;overflow:hidden!important;visibility:hidden;margin:0!important;padding:0!important;border:0!important}';
  document.head.appendChild(css);
  const BTN = 'w-full sm:w-auto font-bold py-3 px-6 rounded-xl transition flex justify-center items-center gap-2 text-sm';

  function wizard(c) {
    const sec = $(c.sec), form = $(c.form), grid = sec.firstElementChild;
    const kat = $(c.cat).parentElement, cartCard = $(c.cart).parentElement;
    form.querySelector('button[type=submit]').remove();

    const ind = document.createElement('div');
    ind.className = 'flex flex-wrap items-center gap-2 text-xs font-bold';
    sec.prepend(ind);

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'w-full mt-4 bg-teal-600 hover:bg-teal-700 text-white ' + BTN;
    next.innerHTML = `${c.next} <i class="fa-solid fa-arrow-right"></i>`;
    form.appendChild(next);

    const s2 = document.createElement('div');
    s2.hidden = true;
    s2.innerHTML =
      `<div class="mb-4"><h3 class="font-bold text-slate-800 text-lg">${c.title}</h3>` +
      `<p class="text-xs text-slate-500 mt-1">Langkah 2 dari 2: tentukan jumlah pada pilihan Anda, lalu kirim.</p></div>` +
      `<div class="grid grid-cols-1 lg:grid-cols-3 gap-6"><div class="lg:col-span-2" data-k></div><div data-c></div></div>` +
      `<div class="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 mt-6">` +
      `<button type="button" data-back class="bg-slate-200 hover:bg-slate-300 text-slate-700 ${BTN}"><i class="fa-solid fa-arrow-left"></i> Kembali ke Data Diri</button>` +
      `<button type="submit" form="${c.form}" class="bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-500/30 ${BTN}"><i class="fa-solid fa-paper-plane"></i> ${c.send}</button></div>`;
    s2.querySelector('[data-k]').appendChild(kat);
    s2.querySelector('[data-c]').appendChild(cartCard);
    sec.appendChild(s2);

    const setStep = n => {
      grid.classList.toggle('wiz-collapse', n === 2);
      s2.hidden = n !== 2;
      const on = 'bg-teal-600 text-white', off = 'bg-slate-200 text-slate-500';
      ind.innerHTML =
        `<span class="px-3 py-1.5 rounded-full ${n === 1 ? on : off}">1. Data Diri &amp; Tanda Tangan</span>` +
        `<i class="fa-solid fa-chevron-right text-slate-400"></i>` +
        `<span class="px-3 py-1.5 rounded-full ${n === 2 ? on : off}">2. ${c.step2}</span>`;
      if (n === 2) sec.closest('main').scrollTo({ top: 0 });
    };
    next.onclick = () => {
      for (const f of form.querySelectorAll('input,textarea')) if (!f.reportValidity()) return;
      if (isCanvasBlank(c.cv())) { Swal.fire('Tanda Tangan Kosong', 'Silakan tanda tangan di dalam kotak yang tersedia.', 'warning'); return; }
      setStep(2);
    };
    s2.querySelector('[data-back]').onclick = () => setStep(1);
    form.addEventListener('reset', () => setStep(1));
    setStep(1);
    return setStep;
  }

  const langkah = {
    'permintaan': wizard({ sec: 'tab-permintaan', form: 'request-form', cat: 'katalog-mini', cart: 'keranjang-list',
      title: 'Pilih Bahan Praktikum', step2: 'Pilih Bahan', next: 'Lanjut: Pilih Bahan', send: 'Kirim Pengajuan Bahan', cv: () => canvas }),
    'peminjaman-alat': wizard({ sec: 'tab-peminjaman-alat', form: 'loan-form', cat: 'katalog-alat-mini', cart: 'keranjang-alat-list',
      title: 'Pilih Alat Praktikum', step2: 'Pilih Alat', next: 'Lanjut: Pilih Alat', send: 'Kirim Pengajuan Peminjaman', cv: () => canvasAlat })
  };
  // Setiap kali menu dibuka, mulai lagi dari langkah 1
  const asliTab = window.attemptSwitchTab;
  window.attemptSwitchTab = function (id) { asliTab(id); if (langkah[id]) langkah[id](1); };

  // ================= 4. NAMA LABEL FORM =================
  const lab = (id, teks, ph) => {
    const el = $(id); if (!el) return;
    const l = el.parentElement.querySelector('label'); if (l) l.textContent = teks;
    if (ph) el.placeholder = ph;
  };
  ['req', 'pinjam', 'ganti'].forEach(p => {
    lab(p + '-kelas', 'Tingkat/Semester', 'Contoh: Tingkat 2 / Semester 3');
    lab(p + '-telp', 'No. Handphone');
  });
  lab('req-email', 'Alamat E-mail');
  lab('pinjam-email', 'Alamat E-mail');
  lab('pinjam-nama', 'Nama Pemohon');
  lab('pinjam-tanggal-pinjam', 'Tanggal Peminjaman');

  // ================= 5. MERK ALAT RUSAK: satu kolom, muncul setelah alat dipilih =================
  const merkAda = document.querySelectorAll('#ganti-merk');
  if (merkAda.length > 1) merkAda[0].parentElement.remove();      // buang kolom ganda yang di atas
  const merkBox = $('ganti-merk').parentElement;
  merkBox.hidden = true;
  const asliCartGanti = window.renderCartGanti;
  window.renderCartGanti = function () {
    asliCartGanti();
    merkBox.hidden = !cartGanti.length;
    if (!cartGanti.length) $('ganti-merk').value = '';
  };
})();

/* SiLABFarma - kelola data master: tambah / ubah / hapus bahan dan alat (menggantikan tombol "Atur Bahan" & "Atur Alat"). */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Sesi login admin tersimpan di browser, jadi koneksi ini otomatis ikut memakai login admin.
  const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const IZIN = 'Perubahan ditolak oleh database (izin belum diatur). Jalankan SQL izin di Supabase SQL Editor, lalu coba lagi.';

  const CFG = {
    bahan: { tabel: 'master_bahan', awalan: 'B', label: 'Bahan', data: () => INVENTORY_DATA, tbody: 'stok-table-body', tab: 'tab-stok' },
    alat:  { tabel: 'master_alat',  awalan: 'A', label: 'Alat',  data: () => ALAT_DATA,      tbody: 'stok-alat-table-body', tab: 'tab-stok-alat' }
  };

  const idBerikut = (arr, awalan) => {
    let max = 0;
    arr.forEach(x => { const m = /(\d+)\s*$/.exec(String(x.id)); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return awalan + String(max + 1).padStart(3, '0');
  };

  const kolom = (id, label, tipe, nilai, o = {}) =>
    `<div style="text-align:left;margin-bottom:10px"><label style="display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:3px">${label}</label>` +
    `<input id="kl-${id}" type="${tipe}" value="${esc(nilai)}" ${o.ro ? 'readonly' : ''} ${o.list ? 'list="' + o.list + '"' : ''} ${o.attr || ''} ` +
    `style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:8px 12px;font-size:14px;${o.ro ? 'background:#f1f5f9;color:#64748b;' : ''}"></div>`;
  const daftarPilihan = (id, arr) => `<datalist id="${id}">${arr.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;

  function pesanError(e) {
    const m = (e && e.message) || String(e);
    return /row-level security|permission denied/i.test(m) ? IZIN : m;
  }

  async function simpan(jenis, baru, id, row) {
    const c = CFG[jenis];
    const q = baru
      ? db.from(c.tabel).insert({ id, ...row }).select()
      : db.from(c.tabel).update(row).eq('id', id).select();
    const { data, error } = await q;
    if (error) throw new Error(pesanError(error));
    if (!data || !data.length) throw new Error(IZIN);
  }

  async function formulir(jenis, item) {
    const c = CFG[jenis], baru = !item;
    const uniq = k => [...new Set(c.data().map(x => x[k]).filter(v => v && v !== '-'))];
    const id = baru ? idBerikut(c.data(), c.awalan) : item.id;
    const bersih = v => (v && v !== '-' ? v : '');

    let html = kolom('id', 'ID (otomatis)', 'text', id, { ro: true }) +
      kolom('nama', 'Nama ' + c.label, 'text', baru ? '' : item.nama, { attr: 'placeholder="Contoh: ' + (jenis === 'bahan' ? 'Paracetamol' : 'Tabung Reaksi') + '"' }) +
      kolom('kategori', 'Kategori', 'text', baru ? '' : bersih(item.kategori), { list: 'kl-dl-kat', attr: 'placeholder="Contoh: ' + (jenis === 'bahan' ? 'Padat/Serbuk' : 'Gelas') + '"' }) +
      kolom('stok', 'Stok', 'number', baru ? '' : item.stok, { attr: 'min="0" step="any" placeholder="0"' }) +
      kolom('satuan', 'Satuan', 'text', baru ? '' : bersih(item.satuan), { list: 'kl-dl-sat', attr: 'placeholder="Contoh: ' + (jenis === 'bahan' ? 'Gram, Ml' : 'Buah, Unit') + '"' });
    if (jenis === 'bahan') {
      const exp = !baru && /^\d{4}-\d{2}-\d{2}/.test(item.expDate) ? item.expDate.slice(0, 10) : '';
      html += kolom('exp', 'Tanggal Kadaluarsa (boleh dikosongkan)', 'date', exp);
    } else {
      html += kolom('kondisi', 'Kondisi', 'text', baru ? 'Baik' : (bersih(item.kondisi) || 'Baik'), { list: 'kl-dl-kon' });
    }
    html += daftarPilihan('kl-dl-kat', uniq('kategori')) + daftarPilihan('kl-dl-sat', uniq('satuan')) +
      daftarPilihan('kl-dl-kon', [...new Set(['Baik', 'Rusak Ringan', 'Rusak Berat', ...uniq('kondisi')])]);

    const r = await Swal.fire({
      title: (baru ? 'Tambah ' : 'Ubah ') + c.label, html, showCancelButton: true, focusConfirm: false,
      confirmButtonColor: '#0f766e', cancelButtonColor: '#94a3b8', confirmButtonText: 'Simpan', cancelButtonText: 'Batal',
      preConfirm: () => {
        const g = k => { const e = $('kl-' + k); return e ? e.value.trim() : ''; };
        if (!g('nama')) return Swal.showValidationMessage('Nama wajib diisi.');
        const stok = Number(g('stok'));
        if (g('stok') === '' || isNaN(stok) || stok < 0) return Swal.showValidationMessage('Stok harus berupa angka 0 atau lebih.');
        if (!g('satuan')) return Swal.showValidationMessage('Satuan wajib diisi.');
        const row = { nama: g('nama'), kategori: g('kategori') || '-', stok, satuan: g('satuan') };
        if (jenis === 'bahan') row.exp_date = g('exp') || null;
        else row.kondisi = g('kondisi') || 'Baik';
        return row;
      }
    });
    if (!r.isConfirmed || !r.value) return;

    try {
      Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await simpan(jenis, baru, id, r.value);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: c.label + (baru ? ' ditambahkan' : ' diperbarui'), showConfirmButton: false, timer: 1800 });
      fetchData(false);
    } catch (e) {
      Swal.fire('Gagal Menyimpan', pesanError(e), 'error');
    }
  }

  async function hapus(jenis, id) {
    const c = CFG[jenis], item = c.data().find(x => x.id === id);
    if (!item) return;
    const r = await Swal.fire({
      title: 'Hapus ' + c.label.toLowerCase() + ' ini?',
      html: `<b>${esc(item.nama)}</b> (${esc(item.id)}) akan dihapus permanen dari daftar stok. Tindakan ini tidak bisa dibatalkan.`,
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, hapus', cancelButtonText: 'Batal'
    });
    if (!r.isConfirmed) return;
    try {
      const { data, error } = await db.from(c.tabel).delete().eq('id', id).select();
      if (error) throw new Error(pesanError(error));
      if (!data || !data.length) throw new Error(IZIN);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: c.label + ' dihapus', showConfirmButton: false, timer: 1800 });
      fetchData(false);
    } catch (e) {
      Swal.fire('Gagal Menghapus', pesanError(e), 'error');
    }
  }

  // Tambahkan kolom "Aksi" (Ubah / Hapus) di setiap baris tabel stok
  function tambahAksi(jenis) {
    const tb = $(CFG[jenis].tbody); if (!tb) return;
    const head = tb.closest('table').querySelector('thead tr');
    if (head && !head.querySelector('[data-aksi]')) head.insertAdjacentHTML('beforeend', '<th class="p-4" data-aksi>Aksi</th>');
    tb.querySelectorAll('tr').forEach(tr => {
      if (tr.cells.length !== 6) return;
      const id = esc(tr.cells[0].textContent.trim());
      tr.insertAdjacentHTML('beforeend',
        '<td class="p-4 whitespace-nowrap">' +
        `<button type="button" data-kl="ubah" data-id="${id}" class="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-lg text-[10px] font-bold transition mr-1"><i class="fa-solid fa-pen mr-1"></i>Ubah</button>` +
        `<button type="button" data-kl="hapus" data-id="${id}" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg text-[10px] font-bold transition"><i class="fa-solid fa-trash-can mr-1"></i>Hapus</button></td>`);
    });
  }

  ['bahan', 'alat'].forEach(jenis => {
    const c = CFG[jenis];
    // klik tombol Ubah / Hapus pada baris tabel
    $(c.tbody).addEventListener('click', e => {
      const b = e.target.closest('button[data-kl]'); if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.kl === 'hapus') hapus(jenis, id);
      else { const item = c.data().find(x => x.id === id); if (item) formulir(jenis, item); }
    });
    // tombol di atas tabel: "Atur ..." menjadi "Tambah ..."
    const tombol = document.querySelector(`#${c.tab} button.bg-teal-600`);
    if (tombol) {
      tombol.removeAttribute('onclick');
      tombol.onclick = () => formulir(jenis, null);
      tombol.innerHTML = `<i class="fa-solid fa-plus mr-1"></i> Tambah ${c.label}`;
    }
  });

  // Setelah tabel digambar ulang, pasang kolom Aksi lagi
  const asliBahan = window.renderTableStok;
  window.renderTableStok = function () { asliBahan(); tambahAksi('bahan'); };
  const asliAlat = window.renderTableStokAlat;
  window.renderTableStokAlat = function () { asliAlat(); tambahAksi('alat'); };
})();

/* SiLABFarma - tombol "Unduh Excel" untuk Stok Bahan & Stok Alat (data diambil terbaru dari database saat tombol diklik). */
(function () {
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const sekarang = () => { const d = new Date(); return `${pad(d.getDate())} ${BLN[d.getMonth()]} ${d.getFullYear()} pukul ${pad(d.getHours())}.${pad(d.getMinutes())}`; };
  const cap = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const WARNA = {            // [warna latar, warna tulisan]
    Aman: ['FFD1FAE5', 'FF047857'], Tersedia: ['FFD1FAE5', 'FF047857'],
    Menipis: ['FFFEF3C7', 'FFB45309'], Kadaluarsa: ['FFFFE4E6', 'FFBE123C'], Habis: ['FFE2E8F0', 'FF334155']
  };

  // Pustaka Excel dimuat otomatis (sekali) dari cdnjs
  let libP = null;
  function muatExcelJS() {
    if (window.ExcelJS) return Promise.resolve();
    if (libP) return libP;
    libP = new Promise((ok, ng) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
      s.onload = ok;
      s.onerror = () => { libP = null; ng(new Error('Gagal memuat pustaka Excel. Periksa koneksi internet lalu coba lagi.')); };
      document.head.appendChild(s);
    });
    return libP;
  }
  setTimeout(() => muatExcelJS().catch(() => {}), 2500);   // siapkan di latar belakang

  //#BEGIN
  function buatWorkbook(cfg, ExcelJS, waktu) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SiLABFarma'; wb.created = new Date();
    const ws = wb.addWorksheet(cfg.sheet, {
      views: [{ state: 'frozen', ySplit: 4 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    const n = cfg.kolom.length;
    ws.columns = cfg.kolom.map(k => ({ width: k.width }));
    const last = ws.getColumn(n).letter;
    const garis = { style: 'thin', color: { argb: 'FFCBD5E1' } };
    const kotak = { top: garis, left: garis, bottom: garis, right: garis };

    ws.mergeCells(`A1:${last}1`); ws.mergeCells(`A2:${last}2`); ws.mergeCells(`A3:${last}3`);
    const t = ws.getCell('A1'); t.value = cfg.judul; t.font = { bold: true, size: 14, color: { argb: 'FF0F766E' } };
    t.alignment = { vertical: 'middle' }; ws.getRow(1).height = 26;
    const w = ws.getCell('A2'); w.value = 'Data diperbarui: ' + waktu; w.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    const r3 = ws.getCell('A3'); r3.value = cfg.ringkasan; r3.font = { bold: true, size: 10, color: { argb: 'FF334155' } };

    const hr = ws.getRow(4); hr.height = 24;
    cfg.kolom.forEach((k, i) => {
      const c = hr.getCell(i + 1);
      c.value = k.header;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = kotak;
    });

    if (!cfg.baris.length) {
      ws.mergeCells(`A5:${last}5`);
      const c = ws.getCell('A5'); c.value = 'Belum ada data.'; c.alignment = { horizontal: 'center' };
    }
    cfg.baris.forEach((b, idx) => {
      const r = ws.getRow(5 + idx);
      b.forEach((v, i) => {
        const k = cfg.kolom[i], c = r.getCell(i + 1);
        c.value = v; c.border = kotak;
        c.alignment = { horizontal: k.align || 'left', vertical: 'middle', wrapText: !!k.wrap };
        if (k.fmt) c.numFmt = k.fmt;
        if (idx % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
      const st = WARNA[b[n - 1]];
      if (st) {
        const c = r.getCell(n);
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st[0] } };
        c.font = { bold: true, color: { argb: st[1] } };
      }
    });
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: n } };
    return wb;
  }
  //#END

  const statusBahan = i => isExpired(i.expDate) ? 'Kadaluarsa' : i.stok === 0 ? 'Habis' : i.stok <= STOK_CRITICAL ? 'Menipis' : 'Aman';
  const tglExp = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : '-'; };

  const KONFIG = {
    bahan: () => {
      const baris = INVENTORY_DATA.map((i, x) => [x + 1, i.id, i.nama, i.kategori, i.stok, i.satuan, tglExp(i.expDate), statusBahan(i)]);
      const hit = s => baris.filter(b => b[7] === s).length;
      return {
        file: `Stok_Bahan_SiLABFarma_${cap()}.xlsx`, sheet: 'Stok Bahan', judul: 'STOK BAHAN PRAKTIKUM - Laboratorium Terpadu Prodi DIII Farmasi',
        ringkasan: `Total ${baris.length} bahan  |  Aman: ${hit('Aman')}  |  Menipis: ${hit('Menipis')}  |  Kadaluarsa: ${hit('Kadaluarsa')}  |  Habis: ${hit('Habis')}`,
        kolom: [
          { header: 'No', width: 6, align: 'center' }, { header: 'ID', width: 10, align: 'center' },
          { header: 'Nama Bahan', width: 50, wrap: true }, { header: 'Kategori', width: 18 },
          { header: 'Stok', width: 12, align: 'right', fmt: '#,##0.##' }, { header: 'Satuan', width: 12, align: 'center' },
          { header: 'Tanggal Kadaluarsa', width: 20, align: 'center', fmt: 'dd/mm/yyyy' }, { header: 'Status', width: 14, align: 'center' }
        ], baris
      };
    },
    alat: () => {
      const baris = ALAT_DATA.map((i, x) => [x + 1, i.id, i.nama, i.kategori, i.stok, i.satuan, i.kondisi, i.stok === 0 ? 'Habis' : 'Tersedia']);
      const unit = ALAT_DATA.reduce((s, i) => s + i.stok, 0);
      return {
        file: `Stok_Alat_SiLABFarma_${cap()}.xlsx`, sheet: 'Stok Alat', judul: 'STOK ALAT PRAKTIKUM - Laboratorium Terpadu Prodi DIII Farmasi',
        ringkasan: `Total ${baris.length} jenis alat  |  Total unit tersedia: ${unit}  |  Alat habis: ${baris.filter(b => b[7] === 'Habis').length}`,
        kolom: [
          { header: 'No', width: 6, align: 'center' }, { header: 'ID', width: 10, align: 'center' },
          { header: 'Nama Alat', width: 50, wrap: true }, { header: 'Kategori', width: 18 },
          { header: 'Stok Tersedia', width: 15, align: 'right', fmt: '#,##0.##' }, { header: 'Satuan', width: 12, align: 'center' },
          { header: 'Kondisi', width: 16, align: 'center' }, { header: 'Status', width: 14, align: 'center' }
        ], baris
      };
    }
  };

  async function unduh(jenis, btn) {
    const asli = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan...';
    try {
      await Promise.all([window.fetchData(false), muatExcelJS()]);    // ambil data TERBARU dulu
      const cfg = KONFIG[jenis]();
      const wb = buatWorkbook(cfg, window.ExcelJS, sekarang());
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href = url; a.download = cfg.file;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Excel berhasil diunduh', showConfirmButton: false, timer: 2000 });
    } catch (e) {
      Swal.fire('Gagal Mengunduh', (e && e.message) || String(e), 'error');
    } finally {
      btn.disabled = false; btn.innerHTML = asli;
    }
  }

  [['bahan', 'tab-stok'], ['alat', 'tab-stok-alat']].forEach(([jenis, tab]) => {
    const tombol = document.querySelector(`#${tab} button.bg-teal-600`);
    if (!tombol) return;
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-col sm:flex-row gap-2 w-full sm:w-auto';
    tombol.parentElement.insertBefore(wrap, tombol);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md w-full sm:w-auto flex items-center justify-center gap-2 disabled:opacity-60';
    btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Unduh Excel';
    btn.onclick = () => unduh(jenis, btn);
    wrap.appendChild(btn); wrap.appendChild(tombol);
  });
})();

/* SiLABFarma - PERBAIKAN: tanda tangan tidak lagi terhapus sendiri di HP.
   Penyebab: saat keyboard HP muncul (mis. mengetik jumlah bahan) atau bilah alamat browser naik-turun, browser mengirim
   kejadian "resize". Kode lama menanggapinya dengan membuat ulang kanvas tanda tangan, sehingga gambarnya hilang.
   Di sini gambar disimpan sebelum kanvas dibuat ulang, lalu dipulihkan setelahnya. */
(function () {
  const ids = ['signature-pad', 'signature-pad-alat', 'signature-pad-ganti'];
  const tunggu = {};
  const salin = cv => {
    const s = document.createElement('canvas');
    s.width = cv.width; s.height = cv.height;
    s.getContext('2d').drawImage(cv, 0, 0);
    return s;
  };
  // Didaftarkan lebih dulu daripada pendengar milik index.html, jadi berjalan SEBELUM kanvas dibuat ulang.
  window.addEventListener('resize', () => {
    ids.forEach(id => {
      const cv = document.getElementById(id);
      if (!cv || tunggu[id] || !cv.offsetWidth || isCanvasBlank(cv)) return;
      tunggu[id] = salin(cv);
    });
    setTimeout(() => ids.forEach(id => {
      const s = tunggu[id]; if (!s) return;
      tunggu[id] = null;
      const cv = document.getElementById(id);
      if (!cv || !cv.offsetWidth) return;
      cv.getContext('2d').drawImage(s, 0, 0, cv.offsetWidth, cv.offsetHeight);
    }), 0);
  });
})();
/* SiLABFarma - Penggunaan Laboratorium (pilihan lab di form peminjaman + rekap di menu admin). */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const TABEL = 'log_penggunaan_lab';
  const LABS = ['Laboratorium Kimia', 'Laboratorium Teknologi Solid', 'Laboratorium Farmakologi',
                'Laboratorium Farmasetika', 'Laboratorium Mikrobiologi', 'Laboratorium Farmakognosi'];
  const INP = 'w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition';
  const LBL = 'block text-xs font-bold text-slate-600 uppercase mb-1';

  // ---------- helper waktu ----------
  const det = t => { const [h, m, s] = String(t || '0:0:0').split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };
  const durasi = (a, b) => {
    const d = Math.max(0, det(b) - det(a));
    return [Math.floor(d / 3600), Math.floor(d % 3600 / 60), d % 60].map(n => String(n).padStart(2, '0')).join(':');
  };
  const tgl = iso => String(iso || '').split('-').reverse().join('/');
  const jam = t => String(t || '').slice(0, 8);

  // ================= 1. FORM PEMINJAMAN: pilihan laboratorium + jam =================
  $('pinjam-tujuan').parentElement.insertAdjacentHTML('beforebegin',
    `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-teal-50/60 border border-teal-100 rounded-xl p-4">
       <div class="sm:col-span-2">
         <label class="${LBL}">Laboratorium yang Digunakan Praktikum</label>
         <select id="pinjam-lab" class="${INP}">
           <option value="">-- Pilih laboratorium --</option>
           ${LABS.map(l => `<option value="${l}">${l}</option>`).join('')}
         </select>
       </div>
       <div>
         <label class="${LBL}">Jam Mulai</label>
         <input type="time" id="pinjam-jam-mulai" required class="${INP}">
       </div>
       <div>
         <label class="${LBL}">Jam Selesai</label>
         <input type="time" id="pinjam-jam-selesai" required class="${INP}">
       </div>
       <p class="sm:col-span-2 text-xs text-teal-800">Jumlah jam penggunaan: <b id="pinjam-durasi">-</b></p>
     </div>`);

  const hitungDurasi = () => {
    const a = $('pinjam-jam-mulai').value, b = $('pinjam-jam-selesai').value;
    $('pinjam-durasi').textContent = a && b && b > a ? durasi(a + ':00', b + ':00') : '-';
  };
  $('pinjam-jam-mulai').addEventListener('input', hitungDurasi);
  $('pinjam-jam-selesai').addEventListener('input', hitungDurasi);
  $('loan-form').addEventListener('reset', () => setTimeout(hitungDurasi, 0));

  // Validasi sebelum pindah ke langkah 2 (dipasang di fase capture agar berjalan lebih dulu)
  const tombolLanjut = document.querySelector('#loan-form > button[type=button]');
  if (tombolLanjut) tombolLanjut.addEventListener('click', e => {
    const a = $('pinjam-jam-mulai').value, b = $('pinjam-jam-selesai').value;
    let pesan = '';
    if (!$('pinjam-lab').value) pesan = 'Silakan pilih laboratorium yang akan digunakan.';
    else if (a && b && b <= a) pesan = 'Jam selesai harus lebih besar dari jam mulai.';
    if (pesan) { e.stopImmediatePropagation(); Swal.fire('Data Belum Lengkap', pesan, 'warning'); }
  }, true);

  // ================= 2. SIMPAN CATATAN LAB SETELAH PEMINJAMAN BERHASIL =================
  async function simpanLab(row) {
    const { error } = await db.from(TABEL).insert(row);
    if (error) {
      console.error('Gagal mencatat penggunaan lab:', error);
      Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Peminjaman tersimpan, tetapi catatan lab gagal', showConfirmButton: false, timer: 3500 });
    }
  }
  const prev = window.google.script.run;
  function bungkus(onOk, onFail) {
    return new Proxy({}, { get: (_, name) => {
      if (typeof name !== 'string') return undefined;
      if (name === 'withSuccessHandler') return f => bungkus(f, onFail);
      if (name === 'withFailureHandler') return f => bungkus(onOk, f);
      return (...args) => {
        let snap = null;
        if (name === 'submitPeminjamanMulti' && args[0]) {
          const p = args[0];
          snap = { tanggal_penggunaan: p.tanggalPinjam, nama: p.peminjam, nim: p.nim, tingkat: p.kelas,
                   nama_praktikum: p.tujuan, nama_dosen: p.dosen, laboratorium: $('pinjam-lab').value,
                   jam_mulai: $('pinjam-jam-mulai').value, jam_selesai: $('pinjam-jam-selesai').value };
        }
        prev.withSuccessHandler(r => { if (snap) simpanLab(snap); onOk && onOk(r); })
            .withFailureHandler(e => onFail && onFail(e))[name](...args);
      };
    } });
  }
  window.google.script.run = bungkus();

  // ================= 3. MENU ADMIN: PENGGUNAAN LABORATORIUM =================
  const navClass = document.getElementById('btn-riwayat-ganti').className;
  document.getElementById('btn-riwayat-ganti').insertAdjacentHTML('afterend',
    `<button onclick="attemptSwitchTab('penggunaan-lab')" id="btn-penggunaan-lab" class="${navClass}">
       <div class="flex items-center gap-3"><i class="fa-solid fa-microscope text-base w-5 text-teal-400"></i><span>Penggunaan Lab</span></div>
     </button>`);
  tabTitles['penggunaan-lab'] = 'Penggunaan Laboratorium';

  $('tab-riwayat-ganti').insertAdjacentHTML('afterend',
    `<section id="tab-penggunaan-lab" class="tab-content space-y-6">
       <div class="bg-teal-50 border border-teal-200 rounded-2xl p-6 shadow-sm">
         <h3 class="font-bold text-teal-900 text-lg"><i class="fa-solid fa-microscope mr-2"></i>Rekap Penggunaan Laboratorium</h3>
         <p class="text-sm text-teal-800 mt-1">Tercatat otomatis dari Form Peminjaman Alat Praktikum.</p>
       </div>
       <div id="lab-ringkasan" class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3"></div>
       <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-3 lg:items-end">
         <div><label class="${LBL}">Bulan</label><input type="month" id="lab-f-bulan" class="${INP}"></div>
         <div><label class="${LBL}">Laboratorium</label>
           <select id="lab-f-lab" class="${INP}"><option value="">Semua laboratorium</option>${LABS.map(l => `<option>${l}</option>`).join('')}</select></div>
         <div class="flex-1"><label class="${LBL}">Cari</label><input type="text" id="lab-f-cari" placeholder="Nama, dosen, atau kegiatan..." class="${INP}"></div>
         <button type="button" id="lab-btn-muat" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold"><i class="fa-solid fa-rotate-right mr-1"></i>Segarkan</button>
         <button type="button" id="lab-btn-csv" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold"><i class="fa-solid fa-file-excel mr-1"></i>Unduh CSV</button>
       </div>
       <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div class="overflow-x-auto">
         <table class="w-full text-left border-collapse">
           <thead><tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
             <th class="p-4">No</th><th class="p-4">Tanggal Penggunaan</th><th class="p-4">Nama</th><th class="p-4">Tingkat</th>
             <th class="p-4">Praktikum/Kegiatan</th><th class="p-4">Nama Dosen</th><th class="p-4">Jam Mulai</th>
             <th class="p-4">Jam Selesai</th><th class="p-4">Jumlah Jam</th><th class="p-4">Laboratorium</th><th class="p-4">Aksi</th>
           </tr></thead>
           <tbody id="lab-tbody" class="text-sm divide-y divide-slate-100"></tbody>
         </table></div></div>
     </section>`);

  let DATA = [];
  const tersaring = () => {
    const b = $('lab-f-bulan').value, l = $('lab-f-lab').value, q = $('lab-f-cari').value.trim().toLowerCase();
    return DATA.filter(r => (!b || String(r.tanggal_penggunaan).startsWith(b)) && (!l || r.laboratorium === l) &&
      (!q || [r.nama, r.nama_dosen, r.nama_praktikum, r.nim].join(' ').toLowerCase().includes(q)));
  };

  function render() {
    const rows = tersaring();
    $('lab-ringkasan').innerHTML = LABS.map(l => {
      const x = rows.filter(r => r.laboratorium === l);
      const jamTotal = x.reduce((s, r) => s + Math.max(0, det(r.jam_selesai) - det(r.jam_mulai)), 0) / 3600;
      return `<div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <p class="text-[10px] font-extrabold text-slate-400 uppercase leading-tight">${esc(l)}</p>
        <p class="text-2xl font-black text-teal-700 mt-1">${x.length}<span class="text-xs font-semibold text-slate-400"> sesi</span></p>
        <p class="text-[11px] text-slate-500">${jamTotal.toFixed(1)} jam</p></div>`;
    }).join('');
    $('lab-tbody').innerHTML = rows.length ? rows.map((r, i) => `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-4 text-xs text-slate-500">${i + 1}</td>
        <td class="p-4 text-xs text-slate-600">${tgl(r.tanggal_penggunaan)}</td>
        <td class="p-4 font-semibold text-slate-700">${esc(r.nama)}<br><span class="text-[11px] text-slate-400 font-normal">${esc(r.nim)}</span></td>
        <td class="p-4 text-xs text-slate-600">${esc(r.tingkat)}</td>
        <td class="p-4 text-xs text-slate-600 max-w-[220px]">${esc(r.nama_praktikum)}</td>
        <td class="p-4 text-xs text-slate-600">${esc(r.nama_dosen)}</td>
        <td class="p-4 text-xs text-slate-600">${jam(r.jam_mulai)}</td>
        <td class="p-4 text-xs text-slate-600">${jam(r.jam_selesai)}</td>
        <td class="p-4 text-xs font-bold text-teal-700">${durasi(r.jam_mulai, r.jam_selesai)}</td>
        <td class="p-4"><span class="bg-teal-100 text-teal-700 px-2 py-1 rounded-md text-[10px] font-bold">${esc(r.laboratorium)}</span></td>
        <td class="p-4"><button type="button" data-hapus="${r.id}" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg text-[10px] font-bold"><i class="fa-solid fa-trash-can mr-1"></i>Hapus</button></td>
      </tr>`).join('')
      : '<tr><td colspan="11" class="p-4 text-center text-slate-500 text-xs">Belum ada data penggunaan laboratorium.</td></tr>';
  }

  async function muat() {
    $('lab-tbody').innerHTML = '<tr><td colspan="11" class="p-4 text-center text-slate-400 text-xs">Memuat data...</td></tr>';
    const { data, error } = await db.from(TABEL).select('*')
      .order('tanggal_penggunaan', { ascending: false }).order('jam_mulai', { ascending: false });
    if (error) {
      $('lab-tbody').innerHTML = `<tr><td colspan="11" class="p-4 text-center text-rose-500 text-xs">Gagal memuat: ${esc(error.message)}</td></tr>`;
      return;
    }
    DATA = data || []; render();
  }

  $('lab-btn-muat').onclick = muat;
  ['lab-f-bulan', 'lab-f-lab', 'lab-f-cari'].forEach(id => $(id).addEventListener('input', render));

  $('lab-tbody').addEventListener('click', async e => {
    const b = e.target.closest('button[data-hapus]'); if (!b) return;
    const r = await Swal.fire({ title: 'Hapus catatan ini?', text: 'Catatan penggunaan lab akan dihapus permanen.', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#e11d48', cancelButtonColor: '#94a3b8', confirmButtonText: 'Ya, hapus', cancelButtonText: 'Batal' });
    if (!r.isConfirmed) return;
    const { data, error } = await db.from(TABEL).delete().eq('id', b.dataset.hapus).select();
    if (error || !data || !data.length) { Swal.fire('Gagal Menghapus', error ? error.message : 'Izin database belum diatur.', 'error'); return; }
    muat();
  });

  $('lab-btn-csv').onclick = () => {
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const head = ['No', 'Tanggal Penggunaan', 'Nama', 'NIM', 'Tingkat', 'Nama Praktikum/Kegiatan', 'Nama Dosen', 'Jam Mulai', 'Jam Selesai', 'Jumlah Jam Penggunaan', 'Laboratorium'];
    const baris = tersaring().map((r, i) => [i + 1, tgl(r.tanggal_penggunaan), r.nama, r.nim, r.tingkat, r.nama_praktikum, r.nama_dosen,
      jam(r.jam_mulai), jam(r.jam_selesai), durasi(r.jam_mulai, r.jam_selesai), r.laboratorium]);
    const csv = '\ufeff' + [head, ...baris].map(r => r.map(q).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'Penggunaan_Laboratorium_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  };

  // Tab ini khusus admin; data dimuat setiap kali dibuka
  const asliTab = window.attemptSwitchTab;
  window.attemptSwitchTab = function (id) {
    if (id === 'penggunaan-lab') {
      if (!isAdmin) { $('login-modal').classList.add('active'); return; }
      asliTab(id); muat(); return;
    }
    asliTab(id);
  };
})();
