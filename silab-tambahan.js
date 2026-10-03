/* SiLABFarma - tambahan: tampilan 2 langkah, konfirmasi kirim, dan bukti PDF lewat email.
   Dimuat SETELAH silab-supabase.js. Kode HTML asli tidak diubah. */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ================= 1. BUKTI PDF DIKIRIM LEWAT EMAIL (bukan unduh otomatis) =================
  const JENIS = { submitRequestMulti: 'Permintaan Bahan', submitPeminjamanMulti: 'Peminjaman Alat', submitGantiAlatMulti: 'Laporan Alat Rusak' };
  let emailTujuan = null;

  async function kirimEmail(name, args, r) {
    const p = args[0] || {};
    try {
      const res = await fetch('/api/kirim-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: p.email, nama: p.pemohon || p.peminjam || p.nama, jenis: JENIS[name], pdfBase64: r.pdfBase64, pdfName: r.pdfName })
      });
      if (!res.ok) throw new Error('gagal');
      emailTujuan = p.email;
      return { status: 'Sukses' };               // tanpa pdfBase64 => PDF tidak diunduh otomatis
    } catch (e) {
      emailTujuan = null;
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
        : 'Email gagal terkirim, jadi PDF diunduh sebagai cadangan. Mohon simpan filenya.';
      if (/otomatis diunduh/.test(o.text || '')) o.text = info;
      if (/Batas waktu penggantian/.test(o.html || '')) o.html += `<br><small>${info}</small>`;
    }
    return fire(...a);
  };

  // Form Lapor & Ganti Alat Rusak belum punya kolom email: tambahkan
  $('ganti-telp').parentElement.parentElement.insertAdjacentHTML('beforeend',
    '<div class="sm:col-span-2"><label class="block text-xs font-bold text-slate-600 uppercase mb-1">E-mail (bukti PDF dikirim ke sini)</label>' +
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
})();
