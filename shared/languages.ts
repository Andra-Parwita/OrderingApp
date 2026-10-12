import type { Language, Languages } from './domain';

/** Plan 056: the values of the kitchen's "Languages for customers" setting. */
export const LANGUAGES: ReadonlyArray<Languages> = ['both', 'en', 'id'];

/** Plan 060: the values of "Customers see first". */
export const FIRST_LANGUAGES: ReadonlyArray<Language> = ['en', 'id'];
