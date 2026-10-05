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

  // Rentang 1 menit dari teks "dd/mm/yyyy hh:mm" -> dipakai agar unduh ulang PDF hanya mengambil baris yang diperlukan
  function rentangMenit(t) {
    const m = /^(\d+)\/(\d+)\/(\d+) (\d+):(\d+)$/.exec(String(t));
    if (!m) return null;
    const a = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
    return isNaN(a) ? null : [a.toISOString(), new Date(a.getTime() + 60000).toISOString()];
  }

  // Format PDF mengikuti form Word Prodi DIII Farmasi (dibuat di silab-tambahan.js)
  const pdfReq = (x, items) => window.SILAB_PDF.bahan(x, items);
  const pdfLoan = (x, items) => window.SILAB_PDF.alat(x, items);

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

    // [CEPAT] Simpan ke database dan buat PDF BERSAMAAN (sebelumnya berurutan: simpan dulu, baru buat PDF).
    // Bila penyimpanan gagal, PDF dibuang dan error ditampilkan seperti biasa.
    async submitRequestMulti(p) {
      if (!p || !p.items || !p.items.length) throw new Error('Keranjang permintaan kosong. Silakan pilih bahan terlebih dahulu.');
      const [res, pdf] = await Promise.all([
        sb.rpc('submit_permintaan', { p }),
        pdfReq(p, p.items.map(i => ({ nama: i.namaBahan, jumlah: i.jumlah, satuan: i.satuan })))
      ]);
      ok(res);
      return pdf;
    },
    async submitPeminjamanMulti(p) {
      if (!p || !p.items || !p.items.length) throw new Error('Keranjang peminjaman kosong. Silakan pilih alat terlebih dahulu.');
      const [res, pdf] = await Promise.all([
        sb.rpc('submit_peminjaman', { p }),
        pdfLoan(p, p.items.map(i => ({ nama: i.namaAlat, jumlah: i.jumlah, satuan: i.satuan })))
      ]);
      ok(res);
      return pdf;
    },
    async submitGantiAlatMulti(p) {
      if (!p || !p.items || !p.items.length) throw new Error('Belum ada alat yang dipilih.');
      const [res, pdf] = await Promise.all([
        sb.rpc('submit_ganti_alat', { p }),
        window.SILAB_PDF.ganti(p)
      ]);
      ok(res);
      return pdf;
    },

    // [CEPAT] Hanya ambil kolom yang dipakai dan hanya baris pada menit yang dimaksud.
    async generatePdfOnTheFly(t, nama) {
      let q = sb.from('log_permintaan')
        .select('created_at,nama_pemohon,nim,kelas,tanggal_praktikum,nama_dosen,tujuan,telp,tanda_tangan,nama_bahan,jumlah,satuan')
        .eq('nama_pemohon', nama);
      const rg = rentangMenit(t);
      if (rg) q = q.gte('created_at', rg[0]).lt('created_at', rg[1]);
      const rows = ok(await q).filter(r => ts(r.created_at) === t);
      if (!rows.length) throw new Error('Data pengajuan tidak ditemukan.');
      const r = rows[0];
      return pdfReq({ pemohon: r.nama_pemohon, nim: r.nim, kelas: r.kelas, tanggal: r.tanggal_praktikum, dosen: r.nama_dosen,
                      tujuan: r.tujuan, telp: r.telp, signature: r.tanda_tangan },
                    rows.map(x => ({ nama: x.nama_bahan, jumlah: n(x.jumlah), satuan: x.satuan || 'Unit' })));
    },
    async generateLoanPdfOnTheFly(t, nama) {
      let q = sb.from('log_peminjaman')
        .select('created_at,nama_peminjam,nim,kelas,tanggal_pinjam,tanggal_kembali,nama_dosen,tujuan,telp,tanda_tangan,nama_alat,jumlah,satuan')
        .eq('nama_peminjam', nama);
      const rg = rentangMenit(t);
      if (rg) q = q.gte('created_at', rg[0]).lt('created_at', rg[1]);
      const rows = ok(await q).filter(r => ts(r.created_at) === t);
      if (!rows.length) throw new Error('Data peminjaman tidak ditemukan.');
      const r = rows[0];
      return pdfLoan({ peminjam: r.nama_peminjam, nim: r.nim, kelas: r.kelas, tanggalPinjam: r.tanggal_pinjam,
                       tanggalKembali: r.tanggal_kembali, dosen: r.nama_dosen, tujuan: r.tujuan, telp: r.telp, signature: r.tanda_tangan },
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
