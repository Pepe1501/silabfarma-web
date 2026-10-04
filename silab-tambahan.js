/* SiLABFarma - PDF mengikuti format form Word Prodi DIII Farmasi (kop surat, tabel, validasi). */
(function () {
  const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const indo = v => {
    if (!v) return '-';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : new Date(v);
    return isNaN(d) ? String(v) : `${String(d.getDate()).padStart(2, '0')} ${BLN[d.getMonth()]} ${d.getFullYear()}`;
  };
  const X = 25.4, W = 167, PLP = 'Freddy Irwansyah';
  let kopData = null;
  async function kop() {
    if (kopData !== null) return kopData;
    try {
      const blob = await (await fetch('kop.png')).blob();
      kopData = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
    } catch (e) { kopData = ''; }
    return kopData;
  }

  async function build(o) {
    const { jsPDF } = window.jspdf, d = new jsPDF({ unit: 'mm', format: 'a4' });
    const img = await kop();
    const L = (x1, y1, x2, y2) => d.line(x1, y1, x2, y2);
    const fit = (src, bw, bh) => { const p = d.getImageProperties(src), r = Math.min(bw / p.width, bh / p.height); return [p.width * r, p.height * r]; };
    d.setTextColor(0); d.setDrawColor(0); d.setLineWidth(0.25);

    // Kop surat + judul
    if (img) { try { d.addImage(img, 'PNG', 9.4, 7.4, 161, 22.6); } catch (e) {} }
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
    tutupKet(y);

    // Tabel validasi (+ blok pengembalian / penggantian)
    y += 9;
    if (y + (o.blok ? 7 + 17 : 0) + 6 + 34 + 2 > 280) { d.addPage(); y = 20; }
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
      daftar: 'Daftar Bahan Yang Diajukan', kolomNama: 'Nama Bahan', minRows: 10, items,
      keterangan: x.tujuan, peran: 'Pemohon', nama: x.pemohon, signature: x.signature,
      info: [['Nama Pemohon', x.pemohon], ['NIM', x.nim], ['Tingkat/Semester', x.kelas], ['Tanggal Permintaan Bahan', indo(x.tanggal)],
             ['Dosen Pengampu', x.dosen], ['No. Handphone', x.telp]]
    }),
    alat: (x, items) => build({
      judul: 'FORM PEMINJAMAN ALAT PRODI DIII FARMASI', prefix: 'Form_Peminjaman_Alat',
      daftar: 'Daftar Alat Yang Dipinjam', kolomNama: 'Nama Alat', minRows: 20, items,
      keterangan: x.tujuan, peran: 'Pemohon', nama: x.peminjam, signature: x.signature,
      blok: 'Pengembalian Alat', yang: 'Yang Mengembalikan',
      info: [['Nama Pemohon', x.peminjam], ['NIM', x.nim], ['Tingkat/Semester', x.kelas], ['Tanggal Peminjaman Alat', indo(x.tanggalPinjam)],
             ['Tanggal Pengembalian Alat', indo(x.tanggalKembali)], ['Dosen Pengampu', x.dosen], ['No. Handphone', x.telp]]
    }),
    ganti: x => {
      const ket = [...(x.keterangan ? [x.keterangan] : []), ...(x.merk ? ['Merk: ' + x.merk] : [])];
      return build({
        judul: 'FORM PENGGANTIAN ALAT PRODI DIII FARMASI', prefix: 'Form_Penggantian_Alat',
        daftar: 'Daftar Alat Yang Rusak / Harus Diganti', kolomNama: 'Nama Alat', minRows: 10,
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

  // ================= 1. BUKTI PDF DIKIRIM LEWAT EMAIL (bukan unduh otomatis) =================
  const JENIS = { submitRequestMulti: 'Permintaan Bahan', submitPeminjamanMulti: 'Peminjaman Alat', submitGantiAlatMulti: 'Laporan Alat Rusak' };
  let emailTujuan = null, alasan = '';

  async function kirimEmail(name, args, r) {
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
      emailTujuan = p.email;
      return { status: 'Sukses' };               // tanpa pdfBase64 => PDF tidak diunduh otomatis
    } catch (e) {
      emailTujuan = null;
      alasan = e.message;
      console.error('Kirim email gagal:', e);
      return r;                                  // cadangan: bila email gagal, PDF tetap diunduh
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
        asli.withSuccessHandler(async r => {
          if (JENIS[name] && r && r.pdfBase64) r = await kirimEmail(name, args, r);
          onOk && onOk(r);
        }).withFailureHandler(e => onFail && onFail(e))[name](...args);
      };
    } });
  }
  window.google.script.run = bungkus();

  // Ganti teks pemberitahuan "otomatis diunduh" menjadi "dikirim ke email"
  const fire = Swal.fire.bind(Swal);
  Swal.fire = (...a) => {
    const o = a[0];
    if (o && typeof o === 'object') {
      const info = emailTujuan
        ? `Bukti PDF sudah dikirim ke ${esc(emailTujuan)}. Jika belum masuk, cek folder Spam.`
        : `Email gagal terkirim (alasan: ${esc(alasan)}), jadi PDF diunduh sebagai cadangan. Mohon simpan filenya.`;
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
