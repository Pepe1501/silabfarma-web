-- =========================================================================
-- SiLAB FARMA — SKEMA SUPABASE (Postgres)
-- Jalankan file ini di: Supabase Dashboard > SQL Editor > New Query > Run
-- =========================================================================

-- ------------------------------------------------------------------
-- 1. TABEL MASTER
-- ------------------------------------------------------------------
create table if not exists master_bahan (
  id_bahan   text primary key,
  nama_bahan text not null,
  kategori   text,
  stok       numeric not null default 0,
  satuan     text not null default 'Unit',
  exp_date   date
);

create table if not exists master_alat (
  id_alat   text primary key,
  nama_alat text not null,
  kategori  text,
  stok      numeric not null default 0,
  satuan    text not null default 'Unit',
  kondisi   text
);

-- ------------------------------------------------------------------
-- 2. TABEL LOG (riwayat transaksi — 1 baris per item, seperti sheet asli)
-- ------------------------------------------------------------------
create table if not exists log_permintaan (
  id                   bigserial primary key,
  created_at           timestamptz not null default now(),
  nama_pemohon         text not null,
  nim                  text,
  tanggal_praktikum    date,
  nama_dosen           text,
  kelas                text,
  telp                 text,
  email                text,
  tujuan_modul         text,
  id_bahan             text references master_bahan(id_bahan),
  nama_bahan           text,
  jumlah               numeric,
  satuan               text default 'Unit',
  status               text default 'Menunggu Persetujuan',
  tanda_tangan_base64  text,
  link_pdf             text
);

create table if not exists log_peminjaman (
  id                   bigserial primary key,
  created_at           timestamptz not null default now(),
  nama_peminjam        text not null,
  nim                  text,
  tanggal_pinjam       date,
  tanggal_kembali      date,
  nama_dosen           text,
  kelas                text,
  telp                 text,
  email                text,
  tujuan_modul         text,
  id_alat              text references master_alat(id_alat),
  nama_alat            text,
  jumlah               numeric,
  satuan               text default 'Unit',
  status               text default 'Menunggu Persetujuan',
  jumlah_dikembalikan  numeric default 0,
  tanda_tangan_base64  text,
  link_pdf             text
);

create table if not exists log_ganti_alat (
  id                   bigserial primary key,
  created_at           timestamptz not null default now(),
  nama_pelapor         text not null,
  nim                  text,
  kelas                text,
  telp                 text,
  id_alat              text references master_alat(id_alat),
  nama_alat            text,
  merk_alat            text,
  jumlah               numeric,
  keterangan           text,
  tanggal_lapor        date default current_date,
  batas_waktu          date,
  status               text default 'Menunggu Penggantian',
  tanda_tangan_base64  text,
  link_pdf             text,
  tanggal_selesai      date
);

create index if not exists idx_log_permintaan_created on log_permintaan(created_at desc);
create index if not exists idx_log_peminjaman_created on log_peminjaman(created_at desc);
create index if not exists idx_log_ganti_alat_created  on log_ganti_alat(created_at desc);

-- ------------------------------------------------------------------
-- 3. FUNGSI RPC (transaksi atomik — menggantikan logika di Code.gs)
--    Dipanggil lewat supabase.rpc(...) dari API di Vercel (pakai service role,
--    jadi aman dari RLS / race condition karena pakai row locking "for update").
-- ------------------------------------------------------------------

-- Ajukan permintaan bahan (validasi + potong stok + insert log, atomik)
create or replace function submit_permintaan(payload jsonb)
returns setof log_permintaan
language plpgsql
as $$
declare
  item jsonb;
  cur_stok numeric;
  new_row log_permintaan;
begin
  -- validasi semua item dulu (kunci baris supaya tidak race condition)
  for item in select * from jsonb_array_elements(payload->'items')
  loop
    select stok into cur_stok from master_bahan where id_bahan = item->>'idBahan' for update;
    if cur_stok is null then
      raise exception 'Bahan dengan ID "%" tidak ditemukan.', item->>'idBahan';
    end if;
    if cur_stok - (item->>'jumlah')::numeric < 0 then
      raise exception 'Stok "%" tersisa %, tidak cukup.', item->>'namaBahan', cur_stok;
    end if;
  end loop;

  for item in select * from jsonb_array_elements(payload->'items')
  loop
    update master_bahan set stok = stok - (item->>'jumlah')::numeric
      where id_bahan = item->>'idBahan';

    insert into log_permintaan (
      nama_pemohon, nim, tanggal_praktikum, nama_dosen, kelas, telp, email, tujuan_modul,
      id_bahan, nama_bahan, jumlah, satuan, tanda_tangan_base64
    ) values (
      payload->>'pemohon', payload->>'nim', nullif(payload->>'tanggal','')::date, payload->>'dosen',
      payload->>'kelas', payload->>'telp', payload->>'email', payload->>'tujuan',
      item->>'idBahan', item->>'namaBahan', (item->>'jumlah')::numeric, coalesce(item->>'satuan','Unit'),
      payload->>'signature'
    ) returning * into new_row;

    return next new_row;
  end loop;
  return;
end;
$$;

-- Ajukan peminjaman alat
create or replace function submit_peminjaman(payload jsonb)
returns setof log_peminjaman
language plpgsql
as $$
declare
  item jsonb;
  cur_stok numeric;
  new_row log_peminjaman;
begin
  for item in select * from jsonb_array_elements(payload->'items')
  loop
    select stok into cur_stok from master_alat where id_alat = item->>'idAlat' for update;
    if cur_stok is null then
      raise exception 'Alat dengan ID "%" tidak ditemukan.', item->>'idAlat';
    end if;
    if cur_stok - (item->>'jumlah')::numeric < 0 then
      raise exception 'Stok "%" tersisa %, tidak cukup.', item->>'namaAlat', cur_stok;
    end if;
  end loop;

  for item in select * from jsonb_array_elements(payload->'items')
  loop
    update master_alat set stok = stok - (item->>'jumlah')::numeric
      where id_alat = item->>'idAlat';

    insert into log_peminjaman (
      nama_peminjam, nim, tanggal_pinjam, tanggal_kembali, nama_dosen, kelas, telp, email, tujuan_modul,
      id_alat, nama_alat, jumlah, satuan, tanda_tangan_base64
    ) values (
      payload->>'peminjam', payload->>'nim', nullif(payload->>'tanggalPinjam','')::date,
      nullif(payload->>'tanggalKembali','')::date, payload->>'dosen',
      payload->>'kelas', payload->>'telp', payload->>'email', payload->>'tujuan',
      item->>'idAlat', item->>'namaAlat', (item->>'jumlah')::numeric, coalesce(item->>'satuan','Unit'),
      payload->>'signature'
    ) returning * into new_row;

    return next new_row;
  end loop;
  return;
end;
$$;

-- Lapor alat rusak (stok langsung dikurangi, sama seperti versi Apps Script)
create or replace function submit_ganti_alat(payload jsonb)
returns setof log_ganti_alat
language plpgsql
as $$
declare
  item jsonb;
  found_id text;
  new_row log_ganti_alat;
begin
  for item in select * from jsonb_array_elements(payload->'items')
  loop
    select id_alat into found_id from master_alat where id_alat = item->>'idAlat' for update;
    if found_id is null then
      raise exception 'Alat dengan ID "%" tidak ditemukan.', item->>'idAlat';
    end if;
  end loop;

  for item in select * from jsonb_array_elements(payload->'items')
  loop
    update master_alat set stok = greatest(0, stok - (item->>'jumlah')::numeric)
      where id_alat = item->>'idAlat';

    insert into log_ganti_alat (
      nama_pelapor, nim, kelas, telp, id_alat, nama_alat, merk_alat, jumlah, keterangan,
      batas_waktu, tanda_tangan_base64
    ) values (
      payload->>'nama', payload->>'nim', payload->>'kelas', payload->>'telp',
      item->>'idAlat', item->>'namaAlat', nullif(payload->>'merk',''), (item->>'jumlah')::numeric,
      payload->>'keterangan', (current_date + interval '7 day')::date, payload->>'signature'
    ) returning * into new_row;

    return next new_row;
  end loop;
  return;
end;
$$;

-- Tandai peminjaman selesai (semua unit dianggap kembali)
create or replace function mark_peminjaman_selesai(p_id bigint)
returns log_peminjaman
language plpgsql
as $$
declare
  rec log_peminjaman;
  sisa numeric;
begin
  select * into rec from log_peminjaman where id = p_id for update;
  if rec is null then raise exception 'Data peminjaman tidak ditemukan.'; end if;
  if rec.status = 'Sudah Dikembalikan' then return rec; end if;

  sisa := rec.jumlah - coalesce(rec.jumlah_dikembalikan,0);
  if sisa > 0 then
    update master_alat set stok = stok + sisa where id_alat = rec.id_alat;
  end if;

  update log_peminjaman set status = 'Sudah Dikembalikan', jumlah_dikembalikan = jumlah
    where id = p_id returning * into rec;
  return rec;
end;
$$;

-- Pengembalian alat sebagian (partial return)
create or replace function mark_pengembalian_sebagian(p_id bigint, p_jumlah numeric)
returns log_peminjaman
language plpgsql
as $$
declare
  rec log_peminjaman;
  sisa numeric;
begin
  select * into rec from log_peminjaman where id = p_id for update;
  if rec is null then raise exception 'Data peminjaman tidak ditemukan.'; end if;
  if rec.status = 'Sudah Dikembalikan' then return rec; end if;

  sisa := rec.jumlah - coalesce(rec.jumlah_dikembalikan,0);
  if p_jumlah is null or p_jumlah <= 0 then
    raise exception 'Jumlah yang dikembalikan harus lebih dari 0.';
  end if;
  if p_jumlah > sisa then
    raise exception 'Jumlah melebihi sisa alat yang masih dipinjam (sisa saat ini: %).', sisa;
  end if;

  update master_alat set stok = stok + p_jumlah where id_alat = rec.id_alat;

  update log_peminjaman
    set jumlah_dikembalikan = coalesce(jumlah_dikembalikan,0) + p_jumlah,
        status = case when coalesce(jumlah_dikembalikan,0) + p_jumlah >= jumlah
                       then 'Sudah Dikembalikan' else 'Sebagian Dikembalikan' end
    where id = p_id
    returning * into rec;

  return rec;
end;
$$;

-- Tandai laporan ganti alat selesai (stok dikembalikan)
create or replace function mark_ganti_alat_selesai(p_id bigint)
returns log_ganti_alat
language plpgsql
as $$
declare
  rec log_ganti_alat;
begin
  select * into rec from log_ganti_alat where id = p_id for update;
  if rec is null then raise exception 'Data tidak ditemukan.'; end if;
  if rec.status = 'Sudah Diganti' then return rec; end if;

  update master_alat set stok = stok + rec.jumlah where id_alat = rec.id_alat;
  update log_ganti_alat set status = 'Sudah Diganti', tanggal_selesai = current_date
    where id = p_id returning * into rec;
  return rec;
end;
$$;

-- ------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--    Semua akses tabel dilakukan lewat API di Vercel memakai
--    SERVICE ROLE KEY (bypass RLS). Browser TIDAK PERNAH bicara langsung
--    ke Supabase untuk data ini, jadi RLS dikunci total (aman by default).
-- ------------------------------------------------------------------
alter table master_bahan    enable row level security;
alter table master_alat     enable row level security;
alter table log_permintaan  enable row level security;
alter table log_peminjaman  enable row level security;
alter table log_ganti_alat  enable row level security;
-- (sengaja tidak dibuat policy apa pun -> default: semua akses via anon/publik ditolak)

-- ------------------------------------------------------------------
-- 5. DATA AWAL (contoh, sama seperti default Code.gs lama)
-- ------------------------------------------------------------------
insert into master_bahan (id_bahan, nama_bahan, kategori, stok, satuan, exp_date) values
  ('B001', 'Paracetamol',   'Padat/Serbuk', 500, 'Gram',   '2028-12-31'),
  ('B002', 'Nesler',        'Cairan',       100, 'Ml',     '2027-05-10'),
  ('B003', 'NAOH',          'Padat/Serbuk', 500, 'Gram',   '2028-01-15'),
  ('B004', 'Kertas Saring', 'Alat',           9, 'Lembar', '2026-10-20')
on conflict (id_bahan) do nothing;

insert into master_alat (id_alat, nama_alat, kategori, stok, satuan, kondisi) values
  ('A001', 'Tabung Reaksi',        'Gelas',      30, 'Buah', 'Baik'),
  ('A002', 'Timbangan Analitik',   'Elektronik',  3, 'Unit', 'Baik'),
  ('A003', 'Mortir & Stamper',     'Alat Tumbuk',10, 'Set',  'Baik')
on conflict (id_alat) do nothing;
