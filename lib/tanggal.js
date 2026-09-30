const BULAN_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// "2026-08-19" -> "19 Agustus 2026"
function formatTanggalIndo(isoDateStr) {
  if (!isoDateStr) return '-';
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return String(isoDateStr);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${BULAN_INDO[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// created_at (timestamptz) -> "dd/MM/yyyy HH:mm" (zona waktu Asia/Jakarta)
function formatTimestampIndo(isoTimestamp) {
  if (!isoTimestamp) return '-';
  const d = new Date(isoTimestamp);
  if (isNaN(d.getTime())) return String(isoTimestamp);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(d).replace(',', '');
}

module.exports = { formatTanggalIndo, formatTimestampIndo };
