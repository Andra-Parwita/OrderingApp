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
  // Draft lines for the owner to pick before the deploy (D-100)
  {
    version: '1.0.36',
    date: '2026-10-xx',
    lines: {
      en: [
        'A new About page shows what is new in each version.',
        'Pickup places can show an address, with View on map and Directions.',
        'Small fixes.',
      ],
      id: [
        'Halaman Tentang yang baru menunjukkan apa yang baru di tiap versi.',
        'Tempat pengambilan bisa menampilkan alamat, dengan Lihat di peta dan Petunjuk arah.',
        'Perbaikan kecil.',
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
