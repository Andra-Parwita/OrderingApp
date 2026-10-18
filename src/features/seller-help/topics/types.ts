// The Help topics (plan 058, D-095). **bold** marks a button or label exactly as the app shows it.
// `pic` is what a picture of the step shows (its alt text); the file, if there is one, is in
// STEP_IMAGES. The app address in step texts is the product's own and does not change per kitchen.

export type HelpStep = Readonly<{ text: string; pic?: string } | { part: string }>;
export type HelpTopicText = Readonly<{
  n: string;
  s: string;
  l: string;
  steps: ReadonlyArray<HelpStep>;
  note: string;
}>;
export type HelpTopic = Readonly<{ en: HelpTopicText; id: HelpTopicText }>;
