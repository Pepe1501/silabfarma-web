const { supabaseAdmin } = require('../lib/supabase');
const { requireAdmin, setCors } = require('../lib/auth');
const { formatTimestampIndo, formatTanggalIndo } = require('../lib/tanggal');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('log_peminjaman')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const logs = data.map((r) => ({
      rowIndex: r.id, // dipakai sebagai identifier baris, sama fungsinya seperti rowIndex di sheet lama
      timestamp: formatTimestampIndo(r.created_at),
      peminjam: r.nama_peminjam,
      nim: r.nim,
      kelas: r.kelas,
      telp: r.telp || '',
      tujuan: r.tujuan_modul,
      alat: r.nama_alat,
      idAlat: r.id_alat || '',
      jumlah: Number(r.jumlah) || 0,
      status: r.status,
      tanggalKembali: formatTanggalIndo(r.tanggal_kembali),
      tanggalKembaliISO: r.tanggal_kembali || '',
      pdfLink: r.link_pdf || '',
      jumlahDikembalikan: Number(r.jumlah_dikembalikan) || 0,
      satuan: r.satuan || 'Unit',
      // untuk regenerasi PDF di browser
      tanggalPinjam: r.tanggal_pinjam,
      dosen: r.nama_dosen,
      signature: r.tanda_tangan_base64
    }));

    return res.status(200).json(logs);
  }

  if (req.method === 'POST') {
    const payload = req.body;
    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
      return res.status(400).json({ error: 'Keranjang peminjaman kosong. Silakan pilih alat terlebih dahulu.' });
    }

    const { data, error } = await supabaseAdmin.rpc('submit_peminjaman', { payload });
    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ status: 'Sukses', rows: data });
  }

  if (req.method === 'PATCH') {
    // Aksi admin: perlu login (Supabase Auth) — kirim header Authorization: Bearer <access_token>
    const user = await requireAdmin(req);
    if (!user) return res.status(401).json({ error: 'Anda harus login sebagai admin untuk aksi ini.' });

    const { action, id, jumlah } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id (rowIndex) wajib diisi.' });

    try {
      if (action === 'selesai') {
        const { data, error } = await supabaseAdmin.rpc('mark_peminjaman_selesai', { p_id: id });
        if (error) throw error;
        return res.status(200).json({ status: 'Sukses', row: data });
      }
      if (action === 'partial') {
        const { data, error } = await supabaseAdmin.rpc('mark_pengembalian_sebagian', { p_id: id, p_jumlah: jumlah });
        if (error) throw error;
        const sisa = Number(data.jumlah) - Number(data.jumlah_dikembalikan);
        return res.status(200).json({ status: 'Sukses', sisa, totalSudahDikembalikan: data.jumlah_dikembalikan, row: data });
      }
      return res.status(400).json({ error: 'action tidak dikenal (gunakan "selesai" atau "partial").' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
