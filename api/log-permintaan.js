const { supabaseAdmin } = require('../lib/supabase');
const { setCors } = require('../lib/auth');
const { formatTimestampIndo } = require('../lib/tanggal');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('log_permintaan')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const logs = data.map((r) => ({
      timestamp: formatTimestampIndo(r.created_at),
      pemohon: r.nama_pemohon,
      nim: r.nim,
      kelas: r.kelas,
      tujuan: r.tujuan_modul,
      bahan: r.nama_bahan,
      jumlah: Number(r.jumlah) || 0,
      status: r.status,
      pdfLink: r.link_pdf || '',
      satuan: r.satuan || 'Unit',
      // dipakai untuk regenerasi PDF di sisi browser (tidak butuh call server lagi)
      tanggal: r.tanggal_praktikum,
      dosen: r.nama_dosen,
      signature: r.tanda_tangan_base64
    }));

    return res.status(200).json(logs);
  }

  if (req.method === 'POST') {
    const payload = req.body;
    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
      return res.status(400).json({ error: 'Keranjang permintaan kosong. Silakan pilih bahan terlebih dahulu.' });
    }

    const { data, error } = await supabaseAdmin.rpc('submit_permintaan', { payload });
    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ status: 'Sukses', rows: data });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
