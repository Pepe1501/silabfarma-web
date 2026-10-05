async submitRequestMulti(p) {
  if (!p || !p.items || !p.items.length) throw new Error('Keranjang permintaan kosong. Silakan pilih bahan terlebih dahulu.');
  const [res, pdf] = await Promise.all([
    sb.rpc('submit_permintaan', { p }),
    pdfReq(p, p.items.map(i => ({ nama: i.namaBahan, jumlah: i.jumlah, satuan: i.satuan })))
  ]);
  ok(res);
  return pdf;
},
