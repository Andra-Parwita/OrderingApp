// Sending "New menu is out" to the browsers that opted in (plan 112, D-113). Called by the owner's
// Send, inside the request; logs hold counts only: never an endpoint, a key or a name.
import { formatCookingDate } from '../../shared/dates';
import { iconPath } from '../../shared/kitchenManifest';
import {
  MENU_NOTICE_FREE_SENDS,
  type MenuNoticeSend,
  type MenuNoticeStatus,
  type MenuNoticeSubscribeRequest,
} from '../../shared/menuNoticeContract';
import type { PushPayload } from '../../shared/pushContract';
import { menuNoticeBody } from '../../shared/pushText';
import type { Db } from '../db/d1';
import {
  countNoticePhones,
  dropNoticeEndpoints,
  readNoticeMenu,
  readNoticeSends,
  readNoticeTargets,
  recordNoticeSend,
  subscribeMenuNotice,
  unsubscribeMenuNotice,
  type SubscribeOutcome,
} from '../db/menuNotices';
import type { PushSender } from './sender';

export type SendOutcome =
  | { kind: 'sent'; status: MenuNoticeStatus }
  | { kind: 'not_open' }
  | { kind: 'sent_twice'; sends: Array<MenuNoticeSend> };

export type MenuNoticeService = {
  subscribe(sellerId: string, request: MenuNoticeSubscribeRequest): Promise<SubscribeOutcome>;
  unsubscribe(sellerId: string, endpoint: string): Promise<void>;
  status(sellerId: string): Promise<MenuNoticeStatus>;
  send(sellerId: string, again: boolean): Promise<SendOutcome>;
};

/** Sends in small parallel groups so a big kitchen does not open hundreds of connections at once. */
const PARALLEL = 10;

const consoleLog = (line: string): void => {
  console.log(line);
};

export function createMenuNoticeService(options: {
  db: Db;
  now: () => Date;
  /** Absent when push is not configured: nothing is sent (the send is still recorded, reaching 0). */
  sender?: PushSender | undefined;
  log?: (line: string) => void;
}): MenuNoticeService {
  const { db, now, sender } = options;
  const log = options.log ?? consoleLog;

  async function status(sellerId: string): Promise<MenuNoticeStatus> {
    const menu = await readNoticeMenu(db, sellerId);
    const phones = await countNoticePhones(db, sellerId);
    if (!menu) return { phones, sends: [], canSend: false, kitchenName: '', cookingDate: '' };
    const sends = await readNoticeSends(db, sellerId, menu.id);
    const open = menu.live && menu.takingOrders && now().getTime() < Date.parse(menu.cutoffAt);
    return {
      phones,
      sends,
      canSend: open,
      kitchenName: menu.kitchenName,
      cookingDate: menu.cookingDate,
    };
  }

  return {
    subscribe: (sellerId, request) => subscribeMenuNotice(db, sellerId, request, now()),
    unsubscribe: (sellerId, endpoint) => unsubscribeMenuNotice(db, sellerId, endpoint),
    status,

    async send(sellerId, again) {
      const before = await status(sellerId);
      if (!before.canSend) return { kind: 'not_open' };
      if (before.sends.length >= MENU_NOTICE_FREE_SENDS && !again) {
        return { kind: 'sent_twice', sends: before.sends };
      }
      const menu = await readNoticeMenu(db, sellerId);
      if (!menu) return { kind: 'not_open' };
      const targets = sender ? await readNoticeTargets(db, sellerId) : [];
      const dead: Array<string> = [];
      let reached = 0;
      let failed = 0;
      for (let from = 0; from < targets.length; from += PARALLEL) {
        const group = targets.slice(from, from + PARALLEL);
        const outcomes = await Promise.allSettled(
          group.map((target): Promise<number> => {
            const day = formatCookingDate(menu.cookingDate, target.language);
            const payload: PushPayload = {
              title: menu.kitchenName,
              body: menuNoticeBody(target.language, day),
              icon: iconPath(menu.slug, 192),
              data: { url: `/${menu.slug}` },
            };
            return (sender as PushSender)(target, payload);
          }),
        );
        outcomes.forEach((outcome, index) => {
          const endpoint = group[index]?.endpoint;
          if (outcome.status === 'rejected') failed += 1;
          else if (outcome.value === 404 || outcome.value === 410) {
            if (endpoint) dead.push(endpoint);
          } else if (outcome.value >= 200 && outcome.value < 300) reached += 1;
          else failed += 1;
        });
      }
      await dropNoticeEndpoints(db, sellerId, dead);
      await recordNoticeSend(db, sellerId, menu.id, now(), reached);
      log(
        `menu notice: ${String(reached)} sent, ${String(dead.length)} expired, ${String(failed)} failed`,
      );
      return { kind: 'sent', status: await status(sellerId) };
    },
  };
}
