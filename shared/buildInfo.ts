// The app version (plan 020, D-079): `<major>.<minor>.<commit count> · <commit>`, " · draft" when
// the build had uncommitted changes. vite.config.ts computes it and defines it for the client and
// the Worker; this file only formats it and reads it back.

/** Replaced at build time by vite.config.ts (the same define reaches the Worker). */
declare const __APP_VERSION__: string;

export type BuildParts = Readonly<{
  /** package.json `version`: only major and minor are used. */
  packageVersion: string;
  /** `git rev-list --count HEAD`, or null without git. */
  count: number | null;
  /** `git rev-parse --short HEAD`, or null without git. */
  commit: string | null;
  /** The working tree had uncommitted changes. */
  draft: boolean;
}>;

export function formatVersion({ packageVersion, count, commit, draft }: BuildParts): string {
  const [major = '0', minor = '0'] = packageVersion.split('.');
  return `${major}.${minor}.${count ?? 0} · ${commit ?? 'unknown'}${draft ? ' · draft' : ''}`;
}

/** The version this build carries; "dev" where no build define exists (unit tests). */
export function appVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
}
