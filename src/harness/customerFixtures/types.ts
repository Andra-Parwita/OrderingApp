import type fixtures from './fixtures.json';

export type FixtureProps = Readonly<{
  /** The whole of fixtures.json. */
  data: typeof fixtures;
  /** This screen's overrides from `screenStates` (empty when it has none). */
  state: Readonly<Record<string, unknown>>;
}>;
