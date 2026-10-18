// Release notes for the About page (plan 075, D-100): plain lines for sellers, EN and ID, newest
// first. Written as part of each release's checklist; the owner or builder decides what goes in.

export type ReleaseNote = Readonly<{
  version: string;
  /** ISO date (YYYY-MM-DD); a placeholder such as '2026-10-xx' is shown as written. */
  date: string;
  lines: Readonly<{ en: ReadonlyArray<string>; id: ReadonlyArray<string> }>;
}>;

/** The panel shows at most this many releases. */
export const RELEASES_SHOWN = 5;

export const RELEASES: ReadonlyArray<ReleaseNote> = [
  // Picked by the owner (18 Oct, "A"); plans 098, 100, 103-109
  {
    version: '1.0.42',
    date: '2026-10-19',
    lines: {
      en: ['Faster, tidier seller screens; edit any order; kitchen print and On the day selling.'],
      id: [
        'Layar penjual lebih cepat dan rapi; ubah pesanan apa pun; cetak dapur dan jualan Hari-H.',
      ],
    },
  },
  // Picked by the owner (18 Oct, "B"); plans 094, 095, 096 + root page
  {
    version: '1.0.41',
    date: '2026-10-18',
    lines: {
      en: ['A fresher look for customers and clearer messages.'],
      id: ['Tampilan pelanggan lebih segar dan pesan lebih jelas.'],
    },
  },
  // Plan 093 (banner no longer flashes); same lines as 1.0.39, owner 17 Oct
  {
    version: '1.0.40',
    date: '2026-10-17',
    lines: {
      en: ['Small fixes and polish.'],
      id: ['Perbaikan kecil dan penyempurnaan.'],
    },
  },
  // Picked by the owner (17 Oct, "B"); the date is set on deploy day
  {
    version: '1.0.39',
    date: '2026-10-17',
    lines: {
      en: ['Small fixes and polish.'],
      id: ['Perbaikan kecil dan penyempurnaan.'],
    },
  },
  // Lines picked by the owner (17 Oct, "B", then "A" for the passkey wording); the date is set on deploy day
  {
    version: '1.0.38',
    date: '2026-10-17',
    lines: {
      en: [
        "Remember me: customers can keep their orders on a new phone with a passkey, safely unlocked with their face or fingerprint (no password), and you'll see ✓ on their orders.",
        'Small fixes and polish.',
      ],
      id: [
        'Ingat aku: pelanggan bisa membawa pesanannya ke HP baru dengan passkey, aman dibuka dengan wajah atau sidik jari (tanpa kata sandi), dan kamu melihat tanda ✓ di pesanan mereka.',
        'Perbaikan kecil dan penyempurnaan.',
      ],
    },
  },
  // Lines picked by the owner (17 Oct: "just high level: private orders and bug fixes; and ability to
  // change pickup/delivery by seller; in bug fixes mention print too"); the date is set on deploy day
  {
    version: '1.0.37',
    date: '2026-10-17',
    lines: {
      en: [
        'Private orders: make a one-off order for a party or event, take a deposit, and send the customer their order code.',
        'Change an order between pickup and delivery, and tell the customer if you like.',
        'Bug fixes, including printing labels from a tablet.',
      ],
      id: [
        'Pesanan khusus: buat pesanan sekali untuk acara atau pesta, catat DP, dan kirim kode pesanan ke pelanggan.',
        'Ubah pesanan dari ambil sendiri ke antar (atau sebaliknya), dan kabari pelanggan kalau mau.',
        'Perbaikan bug, termasuk mencetak label dari tablet.',
      ],
    },
  },
  // Lines picked by the owner (16 Oct: "2, 1 and 6"; 17 Oct: dish pictures added); the date is set on deploy day
  {
    version: '1.0.36',
    date: '2026-10-17',
    lines: {
      en: [
        'Add a photo to each dish. Customers see it on the menu and can tap to see it bigger.',
        'Pickup places can show an address, with View on map and Directions for your customers.',
        "A new About page: who we are, how we keep your customers' info safe, and what's new in each version.",
        'Small fixes and polish.',
      ],
      id: [
        'Tambahkan foto untuk tiap hidangan. Pelanggan melihatnya di menu dan bisa ketuk untuk melihatnya lebih besar.',
        'Tempat pengambilan bisa menampilkan alamat, dengan Lihat di peta dan Petunjuk arah untuk pelangganmu.',
        'Halaman Tentang yang baru: siapa kami, cara kami menjaga data pelangganmu, dan apa yang baru di tiap versi.',
        'Perbaikan kecil dan penyempurnaan.',
      ],
    },
  },
];

/** The newest release (the one the About page names). */
export function currentRelease(
  list: ReadonlyArray<ReleaseNote> = RELEASES,
): ReleaseNote | undefined {
  return list[0];
}

/** The releases the panel shows: the newest first, at most RELEASES_SHOWN. */
export function visibleReleases(
  list: ReadonlyArray<ReleaseNote> = RELEASES,
): ReadonlyArray<ReleaseNote> {
  return list.slice(0, RELEASES_SHOWN);
}
