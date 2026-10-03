/* SiLABFarma - jembatan Google Apps Script -> Supabase.
   Meniru google.script.run, sehingga kode index.html asli bisa dipakai tanpa diubah. */
(function () {
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const pad = n => String(n).padStart(2, '0');
  const BLN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const ts = iso => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const indo = v => {
    if (!v) return '-';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : new Date(v);
    return isNaN(d) ? String(v) : `${pad(d.getDate())} ${BLN[d.getMonth()]} ${d.getFullYear()}`;
  };
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const n = Number;

  // ---------- PDF (dibuat di browser) ----------
  function buildPdf(o) {
    const { jsPDF } = window.jspdf, d = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210, ac = o.accent;
    const logo = document.querySelector('#sidebar img');
    try { if (logo) d.addImage(logo.src, 'PNG', 15, 12, 18, 18 * 48 / 58); } catch (e) {}
    d.setFont('helvetica', 'bold'); d.setTextColor(...ac); d.setFontSize(13);
    d.text('POLITEKNIK KESEHATAN KEMENKES TASIKMALAYA', W / 2 + 8, 18, { align: 'center' });
    d.setFontSize(8); d.setTextColor(71, 85, 105);
    d.text('LABORATORIUM TERPADU PROGRAM STUDI D3 FARMASI', W / 2 + 8, 23, { align: 'center' });
    d.setFont('helvetica', 'normal'); d.setFontSize(7); d.setTextColor(100, 116, 139);
    d.text('Jl Babakan Siliwangi No. 35 Kahuripan Tawang, Kota Tasikmalaya, Jawa Barat 46115', W / 2 + 8, 27.5, { align: 'center' });
    d.setDrawColor(...ac); d.setLineWidth(0.6); d.line(15, 33, W - 15, 33);
    d.setFont('helvetica', 'bold'); d.setFontSize(12); d.setTextColor(...ac);
    d.text(o.judul.toUpperCase(), W / 2, 42, { align: 'center' });

    let y = 52; d.setFontSize(9);
    o.rows.forEach(([k, v]) => {
      d.setFont('helvetica', 'bold'); d.setTextColor(100, 116, 139); d.text(k, 15, y); d.text(':', 58, y);
      d.setFont('helvetica', 'normal'); d.setTextColor(30, 41, 59);
      const t = d.splitTextToSize(String(v || '-'), W - 77); d.text(t, 62, y); y += 5.2 * t.length + 1.2;
    });

    y += 4; d.setFont('helvetica', 'bold'); d.setTextColor(...ac); d.text(o.itemsTitle.toUpperCase(), 15, y); y += 4;
    d.setFillColor(241, 245, 249); d.rect(15, y, W - 30, 8, 'F'); d.setTextColor(71, 85, 105);
    d.text(o.itemsHead, 18, y + 5.4); d.text('Jumlah', W - 18, y + 5.4, { align: 'right' }); y += 8;
    d.setFont('helvetica', 'normal'); d.setTextColor(51, 65, 85); d.setDrawColor(203, 213, 225); d.setLineWidth(0.2);
    o.items.forEach(it => {
      if (y > 245) { d.addPage(); y = 20; }
      d.rect(15, y, W - 30, 8); d.text(String(it.nama), 18, y + 5.4);
      d.text(`${it.jumlah} ${it.satuan}`, W - 18, y + 5.4, { align: 'right' }); y += 8;
    });
    if (o.note) { y += 6; d.setFont('helvetica', 'bold'); d.setTextColor(...ac); d.text(o.note, 15, y); }

    y += 14; if (y > 230) { d.addPage(); y = 25; }
    const x = W - 65;
    d.setFont('helvetica', 'bold'); d.setFontSize(9); d.setTextColor(100, 116, 139);
    d.text(o.sigLabel + ',', x + 25, y, { align: 'center' });
    try { d.addImage(o.signature, 'PNG', x, y + 2, 50, 22); } catch (e) {}
    d.setTextColor(30, 41, 59); d.text(o.nama, x + 25, y + 30, { align: 'center' });
    d.setFont('helvetica', 'normal'); d.setFontSize(8); d.text('NIM. ' + o.nim, x + 25, y + 34.5, { align: 'center' });
    return {
      status: 'Sukses',
      pdfBase64: d.output('datauristring').split(',')[1],
      pdfName: o.prefix + '_' + String(o.nama).replace(/\s+/g, '_') + '.pdf'
    };
  }
  const GREEN = [15, 118, 110], AMBER = [180, 83, 9];
  const pdfReq = (x, items) => buildPdf({
    judul: 'Pengajuan Bahan Praktikum', accent: GREEN, prefix: 'Tanda_Terima', sigLabel: 'Pemohon',
    nama: x.pemohon, nim: x.nim, signature: x.signature, itemsTitle: 'Daftar Bahan Yang Diajukan:', itemsHead: 'Nama Bahan', items,
    rows: [['NAMA PEMOHON', x.pemohon], ['NIM', x.nim], ['KELAS / PRODI', x.kelas], ['TANGGAL PRAKTIKUM', indo(x.tanggal)],
           ['DOSEN PJ', x.dosen], ['TUJUAN / MODUL', x.tujuan]]
  });
  const pdfLoan = (x, items) => buildPdf({
    judul: 'Peminjaman Alat Praktikum', accent: GREEN, prefix: 'Peminjaman_Alat', sigLabel: 'Peminjam',
    nama: x.peminjam, nim: x.nim, signature: x.signature, itemsTitle: 'Daftar Alat Yang Dipinjam:', itemsHead: 'Nama Alat', items,
    rows: [['NAMA PEMINJAM', x.peminjam], ['NIM', x.nim], ['KELAS / PRODI', x.kelas], ['TANGGAL PINJAM', indo(x.tanggalPinjam)],
           ['TANGGAL KEMBALI', indo(x.tanggalKembali)], ['DOSEN PJ', x.dosen], ['TUJUAN / MODUL', x.tujuan]]
  });

  // ---------- Fungsi server (setara Code.gs) ----------
  const API = {
    async getInventoryData() {
      return ok(await sb.from('master_bahan').select('*').order('id')).map(r => ({
        id: r.id, nama: r.nama, kategori: r.kategori || '-', stok: n(r.stok), satuan: r.satuan || 'Unit', expDate: r.exp_date || '-' }));
    },
    async getAlatData() {
      return ok(await sb.from('master_alat').select('*').order('id')).map(r => ({
        id: r.id, nama: r.nama, kategori: r.kategori || '-', stok: n(r.stok), satuan: r.satuan || 'Unit', kondisi: r.kondisi || '-' }));
    },
    async getLogData() {
      return ok(await sb.from('log_permintaan')
        .select('id,created_at,nama_pemohon,kelas,tujuan,nama_bahan,jumlah,satuan,status')
        .order('created_at', { ascending: false }).order('id', { ascending: false }))
        .map(r => ({ timestamp: ts(r.created_at), pemohon: r.nama_pemohon, kelas: r.kelas, tujuan: r.tujuan, bahan: r.nama_bahan,
                     jumlah: n(r.jumlah), status: r.status, pdfLink: '', satuan: r.satuan || 'Unit' }));
    },
    async getLogPeminjamanData() {
      return ok(await sb.from('log_peminjaman')
        .select('id,created_at,nama_peminjam,kelas,telp,tujuan,nama_alat,id_alat,jumlah,satuan,status,tanggal_kembali,jumlah_dikembalikan')
        .order('created_at', { ascending: false }).order('id', { ascending: false }))
        .map(r => ({ rowIndex: r.id, timestamp: ts(r.created_at), peminjam: r.nama_peminjam, kelas: r.kelas, telp: r.telp || '',
                     tujuan: r.tujuan, alat: r.nama_alat, idAlat: r.id_alat || '', jumlah: n(r.jumlah), status: r.status,
                     tanggalKembali: indo(r.tanggal_kembali), tanggalKembaliISO: r.tanggal_kembali || '', pdfLink: '',
                     jumlahDikembalikan: n(r.jumlah_dikembalikan), satuan: r.satuan || 'Unit' }));
    },
    async getLogGantiAlatData() {
      return ok(await sb.from('log_ganti_alat')
        .select('id,created_at,nama_pelapor,nim,kelas,telp,id_alat,nama_alat,jumlah,keterangan,tanggal_lapor,batas_waktu,status,tanggal_selesai,merk_alat')
        .order('created_at', { ascending: false }).order('id', { ascending: false }))
        .map(r => ({ rowIndex: r.id, timestamp: ts(r.created_at), nama: r.nama_pelapor, nim: r.nim, kelas: r.kelas, telp: r.telp,
                     alatId: r.id_alat, alatNama: r.nama_alat, jumlah: n(r.jumlah), keterangan: r.keterangan,
                     tanggalLapor: r.tanggal_lapor, batasWaktu: r.batas_waktu, status: r.status, signature: '', pdfLink: '',
                     tanggalSelesai: r.tanggal_selesai ? indo(r.tanggal_selesai) : '', merk: r.merk_alat || '-' }));
    },

    async submitRequestMulti(p) {
      if (!p || !p.items || !p.items.length) throw new Error('Keranjang permintaan kosong. Silakan pilih bahan terlebih dahulu.');
      ok(await sb.rpc('submit_permintaan', { p }));
      return pdfReq(p, p.items.map(i => ({ nama: i.namaBahan, jumlah: i.jumlah, satuan: i.satuan })));
    },
    async submitPeminjamanMulti(p) {
      if (!p || !p.items || !p.items.length) throw new Error('Keranjang peminjaman kosong. Silakan pilih alat terlebih dahulu.');
      ok(await sb.rpc('submit_peminjaman', { p }));
      return pdfLoan(p, p.items.map(i => ({ nama: i.namaAlat, jumlah: i.jumlah, satuan: i.satuan })));
    },
    async submitGantiAlatMulti(p) {
      if (!p || !p.items || !p.items.length) throw new Error('Belum ada alat yang dipilih.');
      ok(await sb.rpc('submit_ganti_alat', { p }));
      return buildPdf({
        judul: 'Laporan & Penggantian Alat Rusak', accent: AMBER, prefix: 'Laporan_Ganti_Alat', sigLabel: 'Pelapor',
        nama: p.nama, nim: p.nim, signature: p.signature, itemsTitle: 'Daftar Alat Yang Rusak / Harus Diganti:', itemsHead: 'Nama Alat',
        items: p.items.map(i => ({ nama: i.namaAlat, jumlah: i.jumlah, satuan: i.satuan })),
        note: 'Batas Waktu Penggantian: ' + p.batasWaktu + ' (maks. 7 hari sejak laporan)',
        rows: [['NAMA PELAPOR', p.nama], ['NIM', p.nim], ['KELAS / PRODI', p.kelas], ['NO. TELP/WA', p.telp],
               ['TANGGAL LAPOR', p.tanggalLapor], ['MERK ALAT', p.merk || '-'], ['KETERANGAN', p.keterangan]]
      });
    },

    async generatePdfOnTheFly(t, nama) {
      const rows = ok(await sb.from('log_permintaan').select('*').eq('nama_pemohon', nama)).filter(r => ts(r.created_at) === t);
      if (!rows.length) throw new Error('Data pengajuan tidak ditemukan.');
      const r = rows[0];
      return pdfReq({ pemohon: r.nama_pemohon, nim: r.nim, kelas: r.kelas, tanggal: r.tanggal_praktikum, dosen: r.nama_dosen,
                      tujuan: r.tujuan, signature: r.tanda_tangan },
                    rows.map(x => ({ nama: x.nama_bahan, jumlah: n(x.jumlah), satuan: x.satuan || 'Unit' })));
    },
    async generateLoanPdfOnTheFly(t, nama) {
      const rows = ok(await sb.from('log_peminjaman').select('*').eq('nama_peminjam', nama)).filter(r => ts(r.created_at) === t);
      if (!rows.length) throw new Error('Data peminjaman tidak ditemukan.');
      const r = rows[0];
      return pdfLoan({ peminjam: r.nama_peminjam, nim: r.nim, kelas: r.kelas, tanggalPinjam: r.tanggal_pinjam,
                       tanggalKembali: r.tanggal_kembali, dosen: r.nama_dosen, tujuan: r.tujuan, signature: r.tanda_tangan },
                     rows.map(x => ({ nama: x.nama_alat, jumlah: n(x.jumlah), satuan: x.satuan || 'Unit' })));
    },

    async markPengembalianSebagian(id, jumlah) {
      const r = ok(await sb.rpc('pengembalian_sebagian', { p_id: id, p_jumlah: jumlah }));
      return { status: 'Sukses', sisa: r.sisa };
    },
    async markGantiAlatSelesai(id) {
      ok(await sb.rpc('ganti_alat_selesai', { p_id: id }));
      return { status: 'Sukses' };
    }
  };

  // ---------- Tiruan google.script.run ----------
  function make(onOk, onFail) {
    return new Proxy({}, { get: (_, name) => {
      if (typeof name !== 'string') return undefined;
      if (name === 'withSuccessHandler') return f => make(f, onFail);
      if (name === 'withFailureHandler') return f => make(onOk, f);
      return (...args) => {
        Promise.resolve()
          .then(() => { if (!API[name]) throw new Error('Fungsi tidak tersedia: ' + name); return API[name](...args); })
          .then(r => onOk && onOk(r))
          .catch(e => onFail && onFail(e));
      };
    } });
  }
  window.google = { script: { run: make() } };

  // ---------- Login admin lewat Supabase Auth ----------
  const el = id => document.getElementById(id);
  el('loading-text').textContent = 'Menghubungkan ke database...';
  const u = el('login-username');
  u.type = 'email'; u.placeholder = 'Email admin';
  u.closest('div.relative').previousElementSibling.textContent = 'Email';

  window.handleLogin = async function (e) {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: u.value.trim(), password: el('login-password').value });
    if (error) { el('login-error').classList.remove('hidden'); return; }
    isAdmin = true; closeLoginModal(); updateAuthUI(); fetchData(false); attemptSwitchTab('dashboard');
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Login Berhasil', showConfirmButton: false, timer: 1500 });
  };
  window.toggleAuth = function () {
    if (!isAdmin) { el('login-modal').classList.add('active'); return; }
    Swal.fire({ title: 'Keluar dari Sesi Admin?', icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#0f766e', cancelButtonColor: '#d33', confirmButtonText: 'Ya, Keluar'
    }).then(async r => {
      if (!r.isConfirmed) return;
      await sb.auth.signOut(); isAdmin = false; updateAuthUI(); attemptSwitchTab('permintaan'); fetchData(false);
    });
  };
  sb.auth.getSession().then(({ data }) => { if (data.session) { isAdmin = true; updateAuthUI(); } });
})();
