const { supabaseAdmin } = require('../lib/supabase');
const { setCors } = require('../lib/auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data, error } = await supabaseAdmin
    .from('master_alat')
    .select('*')
    .order('nama_alat', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const items = data.map((r) => ({
    id: r.id_alat,
    nama: r.nama_alat,
    kategori: r.kategori || '-',
    stok: Number(r.stok) || 0,
    satuan: r.satuan || 'Unit',
    kondisi: r.kondisi || '-'
  }));

  res.status(200).json(items);
};
