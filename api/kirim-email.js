// Vercel Serverless Function: mengirim bukti PDF ke email mahasiswa (lewat Gmail).
// Pengaturan rahasia diisi di Vercel > Settings > Environment Variables:
//   GMAIL_USER, GMAIL_APP_PASSWORD, SUPABASE_URL, SUPABASE_KEY, (opsional) LAB_EMAIL
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode tidak diizinkan' });
  try {
    const { email, nama, jenis, pdfBase64, pdfName } = req.body || {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '') || !pdfBase64 || pdfBase64.length > 3000000) {
      return res.status(400).json({ error: 'Data tidak valid' });
    }

    // Keamanan: hanya kirim ke email yang BARU SAJA mengajukan (cegah penyalahgunaan)
    const K = process.env.SUPABASE_KEY || '';
    const h = { apikey: K, 'Content-Type': 'application/json' };
    if (K.startsWith('eyJ')) h.Authorization = 'Bearer ' + K;
    const cek = await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/cek_email_pengajuan', {
      method: 'POST', headers: h, body: JSON.stringify({ p_email: email })
    });
    if (!cek.ok || (await cek.json()) !== true) return res.status(403).json({ error: 'Pengajuan tidak ditemukan' });

    const bersih = s => String(s || '').replace(/[\r\n]+/g, ' ').slice(0, 80);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    await transporter.sendMail({
      from: `"SiLABFarma Poltekkes Tasikmalaya" <${process.env.GMAIL_USER}>`,
      to: email,
      bcc: process.env.LAB_EMAIL || undefined,
      subject: `Bukti ${bersih(jenis)} - SiLABFarma`,
      text:
        `Halo ${bersih(nama)},\n\n` +
        `Pengajuan Anda (${bersih(jenis)}) sudah kami terima. Bukti pengajuan terlampir dalam bentuk PDF. ` +
        `Simpan dan tunjukkan kepada laboran saat pengambilan.\n\n` +
        `Terima kasih,\nLaboratorium Farmasi Poltekkes Kemenkes Tasikmalaya\n\n` +
        `(Email ini dikirim otomatis, mohon tidak dibalas.)`,
      attachments: [{
        filename: bersih(pdfName).replace(/[^\w.\-]/g, '_') || 'Bukti_SiLABFarma.pdf',
        content: pdfBase64,
        encoding: 'base64'
      }]
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
