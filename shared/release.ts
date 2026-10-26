// The release number users see (About, Settings, sign-in footer): "1.0.37", no build code.
// Keep it equal to the newest entry in src/features/seller-about/releaseNotes.ts; release.test.ts
// fails when they differ. (shared/ cannot import src/, and components cannot import features.)
export const RELEASE_VERSION = '1.0.45';
// The hotfix number on top of the release ("1.0.45.1"), or null when there is none. The What's new pill and
// the release notes stay keyed by RELEASE_VERSION, so a hotfix does not pop "What's new" (plan 125).
export const RELEASE_HOTFIX: number | null = 1;

/** What users see as the app version: "1.0.45.1", or "1.0.45" without a hotfix. */
export function versionLabel(
  release: string = RELEASE_VERSION,
  hotfix: number | null = RELEASE_HOTFIX,
): string {
  return hotfix === null ? release : `${release}.${hotfix}`;
}
