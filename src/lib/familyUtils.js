/**
 * Family-related utility functions.
 * Extracted from useLocalStorage.js to keep hooks focused.
 */
import { translations } from '../constants/translations';

export const MAX_FAMILY_SLOTS = 5;
export const MAX_STORAGE_GB = 5120;

const GB_BYTES = 1_000_000_000;
const GIB_BYTES = 1024 * 1024 * 1024;

/**
 * Mendeteksi apakah kuota total Google Drive berada di tier bermasalah (5 GB atau 15 GB).
 * Mengembalikan '5GB', '15GB', atau null bila kuota normal atau unlimited.
 */
export function detectLowStorageTier(totalBytes) {
  if (totalBytes === null || totalBytes === undefined) return null;
  const n = Number(totalBytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 4.9 * GB_BYTES && n <= 5.1 * GIB_BYTES) return '5GB';
  if (n >= 14.9 * GB_BYTES && n <= 15.1 * GIB_BYTES) return '15GB';
  return null;
}

/**
 * Merangkum hasil sinkronisasi yang terdeteksi bermasalah (5 GB / 15 GB)
 * beserta family yang baru diubah menjadi expired.
 */
export function getLowStorageAlerts(results = [], { onlyNewlyExpired = false } = {}) {
  if (!Array.isArray(results)) return [];
  const alerts = [];
  for (const item of results) {
    if (!item?.ok || !item.lowStorageTier) continue;
    const expiredFamilies = Array.isArray(item.expiredFamilies) ? item.expiredFamilies : [];
    if (onlyNewlyExpired && expiredFamilies.length === 0) continue;
    const familyNames = expiredFamilies.map((f) => f.name).filter(Boolean);
    const label = item.email || 'Google Drive';
    const message = expiredFamilies.length > 0
      ? `Storage ${label} turun ke ${item.lowStorageTier}! Masa berlaku ${familyNames.join(', ')} otomatis diubah menjadi EXPIRED.`
      : `Storage ${label} terdeteksi ${item.lowStorageTier} (akun bermasalah).`;
    alerts.push({
      id: item.id,
      email: item.email || null,
      tier: item.lowStorageTier,
      expiredFamilies,
      hasNewlyExpired: expiredFamilies.length > 0,
      message,
    });
  }
  return alerts;
}

export function generateId() {
  return crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15);
}

export function getSlotsUsed(family) {
  return family.members?.length || 0;
}

export function getSlotsAvailable(family) {
  return Math.max(0, MAX_FAMILY_SLOTS - getSlotsUsed(family));
}

export function isFamilyFull(family) {
  return getSlotsUsed(family) >= MAX_FAMILY_SLOTS;
}

export function getDaysRemaining(expiryDate) {
  if (!expiryDate) return null;
  const diff = new Date(expiryDate) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Pilihan paket langganan untuk tombol preset di modal member. */
export const EXPIRY_PRESETS = [
  { label: '1 Bulan', months: 1 },
  { label: '3 Bulan', months: 3 },
  { label: '6 Bulan', months: 6 },
  { label: '1 Tahun', months: 12 },
  { label: '1.5 Tahun', months: 18 },
];

/** Pilihan paket masa aktif langganan untuk tombol preset di modal family. */
export const FAMILY_EXPIRY_PRESETS = [
  { label: '+6 Bulan', months: 6 },
  { label: '+1 Tahun', months: 12 },
  { label: '+1.5 Tahun', months: 18 },
  { label: '+2 Tahun', months: 24 },
];

/**
 * Awal periode langganan yang sedang berjalan — basis tombol preset paket.
 * Masih aktif (atau expiry belum diisi) → tanggal member ditambahkan, supaya
 * salah pilih paket bisa dikoreksi kapan saja tanpa geser tanggal mulai.
 * Sudah lewat → hari ini, karena itu perpanjangan (periode baru).
 */
export function getPresetBaseDate(addedAt, expiryDate, now = new Date()) {
  if (expiryDate) {
    const expiry = new Date(expiryDate);
    if (!Number.isNaN(expiry.getTime()) && expiry < now) return now;
  }
  const added = addedAt ? new Date(addedAt) : null;
  return added && !Number.isNaN(added.getTime()) ? added : now;
}

/**
 * base + N bulan sebagai string `YYYY-MM-DD` (format value <input type="date">).
 * Tanggal di-clamp ke akhir bulan: 31 Jan + 1 bulan = 28/29 Feb, bukan 2/3 Mar
 * seperti hasil setMonth mentah.
 */
export function addMonthsISODate(base, months) {
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfMonth));
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${String(d.getDate()).padStart(2, '0')}`;
}

// Bulan disederhanakan jadi 30 hari supaya cocok dengan paket yang dijual per-bulan
// (309 hari = "10 BULAN 9 HARI"), bukan selisih kalender asli yang panjang bulannya beda-beda.
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

function expiryUnits(lang) {
  return (translations[lang] || translations.id).common.expiry;
}

/**
 * Sisa hari jadi teks yang gampang dibaca: "1 TAHUN 5 BULAN", "10 BULAN 9 HARI", "15 HARI".
 * Satuan terkecil dibuang kalau nol, jadi 330 hari = "11 BULAN" bukan "11 BULAN 0 HARI".
 */
export function formatDuration(days, lang = 'id') {
  const u = expiryUnits(lang);
  const unit = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

  if (days >= DAYS_PER_YEAR) {
    const years = Math.floor(days / DAYS_PER_YEAR);
    const months = Math.floor((days % DAYS_PER_YEAR) / DAYS_PER_MONTH);
    const head = unit(years, u.year, u.years);
    return months > 0 ? `${head} ${unit(months, u.month, u.months)}` : head;
  }

  if (days >= DAYS_PER_MONTH) {
    const months = Math.floor(days / DAYS_PER_MONTH);
    const rest = days % DAYS_PER_MONTH;
    const head = unit(months, u.month, u.months);
    return rest > 0 ? `${head} ${unit(rest, u.day, u.days)}` : head;
  }

  return unit(days, u.day, u.days);
}

export function getExpiryStatus(daysRemaining, lang = 'id') {
  const u = expiryUnits(lang);
  if (daysRemaining === null || daysRemaining === undefined) return { text: u.none, color: 'gray' };
  if (daysRemaining < 0) return { text: u.expired, color: 'gray' };

  const text = formatDuration(daysRemaining, lang);
  if (daysRemaining <= 3) return { text, color: 'red' };
  if (daysRemaining <= 7) return { text, color: 'yellow' };
  return { text, color: 'green' };
}
