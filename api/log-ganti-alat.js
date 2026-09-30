const { supabaseAdmin } = require('../lib/supabase');
const { requireAdmin, setCors } = require('../lib/auth');
const { formatTimestampIndo, formatTanggalIndo } = require('../lib/tanggal');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('log_ganti_alat')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const logs = data.map((r) => ({
      rowIndex: r.id,
      timestamp: formatTimestampIndo(r.created_at),
      nama: r.nama_pelapor,
      nim: r.nim,
      kelas: r.kelas,
      telp: r.telp,
      alatId: r.id_alat || '',
      alatNama: r.nama_alat,
      jumlah: Number(r.jumlah) || 0,
      keterangan: r.keterangan,
      tanggalLapor: formatTanggalIndo(r.tanggal_lapor),
      batasWaktu: formatTanggalIndo(r.batas_waktu),
      status: r.status,
      signature: r.tanda_tangan_base64,
      pdfLink: r.link_pdf || '',
      tanggalSelesai: r.tanggal_selesai ? formatTanggalIndo(r.tanggal_selesai) : '',
      merk: r.merk_alat || '-'
    }));

    return res.status(200).json(logs);
  }

  if (req.method === 'POST') {
    const payload = req.body;
    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
      return res.status(400).json({ error: 'Belum ada alat yang dipilih.' });
    }

    const { data, error } = await supabaseAdmin.rpc('submit_ganti_alat', { payload });
    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ status: 'Sukses', rows: data });
  }

  if (req.method === 'PATCH') {
    const user = await requireAdmin(req);
    if (!user) return res.status(401).json({ error: 'Anda harus login sebagai admin untuk aksi ini.' });

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id (rowIndex) wajib diisi.' });

    const { data, error } = await supabaseAdmin.rpc('mark_ganti_alat_selesai', { p_id: id });
    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ status: 'Sukses', row: data });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
