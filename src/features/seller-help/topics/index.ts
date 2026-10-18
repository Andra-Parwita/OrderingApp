import { DAY_TOPICS } from './dayToDay';
import { EXTRA_TOPICS } from './extras';
import { GETTING_STARTED_TOPICS } from './gettingStarted';
import { MENU_TOPICS } from './menuAndSharing';
import type { HelpTopic } from './types';

export type { HelpStep, HelpTopic, HelpTopicText } from './types';

export const TOPICS: ReadonlyArray<HelpTopic> = [
  ...GETTING_STARTED_TOPICS,
  ...MENU_TOPICS,
  ...DAY_TOPICS,
  ...EXTRA_TOPICS,
];
