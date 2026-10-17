// Plan 086 (D-106): the admin's short message. A plain-text note (EN + ID) that shows on a device for
// up to 30 seconds. Each message has an active window (how long new visitors can still get it); it
// can be aimed at some kitchens and at sellers, customers or everyone. Never a phone notification.
import { cutoffAtFor, localDate } from './dates';
import { isOneOf, isRecord } from './parse';
import { DEFAULT_ZONE, isValidZone } from './zone';

export const MESSAGE_MAX = 90;
export const MESSAGE_SHOW_MS = 30_000;
export const MESSAGE_LIST_MAX = 20;
export const MESSAGE_KITCHENS_MAX = 200;
export const MESSAGE_AUDIENCES = ['everyone', 'sellers', 'customers'] as const;
export type MessageAudience = (typeof MESSAGE_AUDIENCES)[number];
export const MESSAGE_WINDOWS = ['15m', '1h', 'today'] as const;
export type MessageWindow = (typeof MESSAGE_WINDOWS)[number];

/** A message as the admin sees it. `sellerIds` null = all kitchens. */
export type ShortMessage = {
  id: string;
  textEn: string;
  textId: string;
  audience: MessageAudience;
  sellerIds: Array<string> | null;
  createdAt: string;
  expiresAt: string;
  stoppedAt: string | null;
};

/** What a device gets: only the texts and the id. */
export type PublicNote = { id: string; textEn: string; textId: string; expiresAt: string };

export type MessageRequest = {
  textEn: string;
  textId: string;
  audience: MessageAudience;
  sellerIds: Array<string> | null;
  window: MessageWindow;
  /** The admin device's zone, for "today" (until midnight). */
  timeZone?: string;
};

export type MessagesResponse = { messages: Array<ShortMessage> };
export type NotesResponse = { notes: Array<PublicNote> };

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Plain text: control characters and line breaks become spaces.
  const text = [...value]
    .map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch))
    .join('')
    .replace(/ {2,}/g, ' ')
    .trim();
  return text !== '' && [...text].length <= MESSAGE_MAX ? text : null;
}

export function parseMessageRequest(input: unknown): MessageRequest | null {
  if (!isRecord(input)) return null;
  const textEn = cleanText(input['textEn']);
  const textId = input['sameText'] === true ? textEn : cleanText(input['textId']);
  if (textEn === null || textId === null) return null;
  if (!isOneOf(MESSAGE_AUDIENCES, input['audience'])) return null;
  if (!isOneOf(MESSAGE_WINDOWS, input['window'])) return null;
  const raw = input['sellerIds'];
  let sellerIds: Array<string> | null = null;
  if (raw !== null) {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MESSAGE_KITCHENS_MAX) return null;
    if (!raw.every((id): id is string => typeof id === 'string' && id !== '' && id.length < 80)) {
      return null;
    }
    sellerIds = [...new Set(raw)];
  }
  const zone = input['timeZone'];
  return {
    textEn,
    textId,
    audience: input['audience'],
    sellerIds,
    window: input['window'],
    ...(isValidZone(zone) ? { timeZone: zone } : {}),
  };
}

/** When a message sent `now` stops being given to new visitors ("today" = midnight in `zone`). */
export function expiryOf(window: MessageWindow, now: Date, zone: string = DEFAULT_ZONE): string {
  if (window === '15m') return new Date(now.getTime() + 15 * 60_000).toISOString();
  if (window === '1h') return new Date(now.getTime() + 60 * 60_000).toISOString();
  const day = localDate(now, zone);
  return new Date(cutoffAtFor(day, -1, '00:00', zone)).toISOString();
}

export function isActive(message: ShortMessage, now: Date): boolean {
  return message.stoppedAt === null && Date.parse(message.expiresAt) > now.getTime();
}

/** What a device with this audience and these kitchens may get. */
export function reaches(
  message: Pick<ShortMessage, 'audience' | 'sellerIds'>,
  audience: 'sellers' | 'customers',
  sellerIds: ReadonlyArray<string>,
): boolean {
  if (message.audience !== 'everyone' && message.audience !== audience) return false;
  return message.sellerIds === null || message.sellerIds.some((id) => sellerIds.includes(id));
}

function isIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function parseShortMessage(input: unknown): ShortMessage | null {
  if (!isRecord(input)) return null;
  const { id, textEn, textId, createdAt, expiresAt, stoppedAt, sellerIds, audience } = input;
  if (typeof id !== 'string' || typeof textEn !== 'string' || typeof textId !== 'string')
    return null;
  if (!isOneOf(MESSAGE_AUDIENCES, audience)) return null;
  if (!isIso(createdAt) || !isIso(expiresAt)) return null;
  if (stoppedAt !== null && !isIso(stoppedAt)) return null;
  const ids =
    sellerIds === null
      ? null
      : Array.isArray(sellerIds) && sellerIds.every((x) => typeof x === 'string')
        ? sellerIds
        : undefined;
  if (ids === undefined) return null;
  return { id, textEn, textId, audience, sellerIds: ids, createdAt, expiresAt, stoppedAt };
}

export function parseMessages(input: unknown): MessagesResponse | null {
  if (!isRecord(input) || !Array.isArray(input['messages'])) return null;
  const messages: Array<ShortMessage> = [];
  for (const item of input['messages']) {
    const parsed = parseShortMessage(item);
    if (!parsed) return null;
    messages.push(parsed);
  }
  return { messages };
}

export function parseNotes(input: unknown): NotesResponse | null {
  if (!isRecord(input) || !Array.isArray(input['notes'])) return null;
  const notes: Array<PublicNote> = [];
  for (const item of input['notes']) {
    if (!isRecord(item)) return null;
    const { id, textEn, textId, expiresAt } = item;
    if (typeof id !== 'string' || typeof textEn !== 'string' || typeof textId !== 'string') {
      return null;
    }
    if (!isIso(expiresAt)) return null;
    notes.push({ id, textEn, textId, expiresAt });
  }
  return { notes };
}

/** The `notice` live event is only a nudge: the page asks for its notes again. */
export const NOTE_NUDGE_EVENT = 'app:notes';
