// /api/seller/*: the kitchen itself, its people and its data: settings, preferences, name, chefs and
// invites, team, images, backup, past weeks, and the demo samples. Split out of routes.ts
// (plan 098 C1); roles are the allow-list (C2). Most of this is the owner's alone.
import type { ClearSamplesResponse, SampleOrdersResponse } from '../../shared/devContract';
import { parseBackupFile } from '../../shared/backup';
import { isImageSlot } from '../../shared/imageSlots';
import {
  DISPLAY_NAME_MAX,
  parseChefInviteRequest,
  parseInviteRequest,
  type KeyResponse,
  type MembersResponse,
} from '../../shared/authContract';
import {
  parseUpdatePreferencesRequest,
  type PreferencesResponse,
} from '../../shared/menusContract';
import type { PastWeekResponse, PastWeeksResponse } from '../../shared/pastWeeks';
import { parseSettingsRequest, type SettingsResponse } from '../../shared/sellerContract';
import {
  parseChefNameRequest,
  parseImageStyleRequest,
  parseKitchenNameRequest,
  parseUploadImageRequest,
  type ChefsResponse,
  type ImagesResponse,
  type KitchenNameResponse,
  type RestoreResponse,
} from '../../shared/setupContract';
import { dropUnusedImageRefs, putUploadedImage } from '../images/r2';
import { chefAccess } from './authRoutes';
import { error, readJson } from './respond';
import { chefResult, okResult, signal } from './routeKit';
import {
  EVERYONE,
  OWNER,
  OWNER_CHEF,
  route,
  type SellerCall,
  type SellerRoute,
} from './sellerRoute';

const DEMO_SAMPLE_COUNT = 50;
const signedIn = (call: SellerCall): boolean => call.accountId !== undefined;

/** Plan 013: sample orders on a demo kitchen. A session of this kitchen (seller or chef) is needed. */
async function demoSamples(call: SellerCall): Promise<Response> {
  const { store, request, context, sellerId } = call;
  if (store.seller.demo !== true) return error('forbidden', 'Not a demo kitchen');
  if (request.method === 'DELETE') {
    return Response.json((await store.clearDemoSamples()) satisfies ClearSamplesResponse);
  }
  const result = await store.addDemoSamples(DEMO_SAMPLE_COUNT);
  if (result.added > 0) await signal(context, sellerId, 'order.created');
  return Response.json(result satisfies SampleOrdersResponse);
}

export const SETTINGS_ROUTES: ReadonlyArray<SellerRoute> = [
  // Chefs can't invite people (D-013); the seller invites a chef from the chefs list.
  route('POST', 'chef-invites', OWNER, async ({ repo, store, request, bad }) => {
    const input = parseChefInviteRequest(await readJson(request));
    if (!input) return bad();
    if (!(await store.listChefs()).some((chef) => chef.id === input.chefId)) {
      return error('unknown_chef', 'Unknown chef');
    }
    const chef = (await store.listChefs()).find((row) => row.id === input.chefId);
    const key = await repo.auth.createKey({
      role: 'chef',
      sellerId: store.seller.id,
      chefId: input.chefId,
      displayName: (chef?.name ?? 'Chef').slice(0, DISPLAY_NAME_MAX),
    });
    return Response.json(key satisfies KeyResponse, { status: 201 });
  }),

  // Plan 033: the owner invites a person by name and role (a chef invite may add the cook row).
  route('POST', 'invites', OWNER, async ({ repo, store, request, bad, sellerId }) => {
    const input = parseInviteRequest(await readJson(request));
    if (!input) return bad();
    let chefId = input.chefId;
    if (input.role === 'chef') {
      if (chefId === undefined) {
        const added = await store.addChef(input.displayName);
        if (!added.ok) return error(added.error, added.message);
        chefId = added.value.id;
      } else if (!(await store.listChefs()).some((chef) => chef.id === chefId)) {
        return error('unknown_chef', 'Unknown chef');
      }
    }
    const key = await repo.auth.createKey({
      role: input.role,
      sellerId,
      displayName: input.displayName,
      ...(chefId !== undefined ? { chefId } : {}),
    });
    return Response.json(key satisfies KeyResponse, { status: 201 });
  }),

  // The kitchen's people. Removing one ends their sessions here at once (not for a dev-header call).
  route(
    'GET',
    'team',
    OWNER,
    async ({ repo, sellerId, accountId }) =>
      Response.json({
        members: await repo.auth.members(sellerId, accountId),
      } satisfies MembersResponse),
    { when: signedIn },
  ),
  route(
    'DELETE',
    'team/:id/*',
    OWNER,
    async ({ repo, b, bad, sellerId, accountId }) => {
      if (b === accountId) return bad();
      return (await repo.auth.removeMember(sellerId, b as string))
        ? Response.json({ ok: true })
        : error('not_found', 'Member not found');
    },
    { when: signedIn },
  ),

  // How many devices each chef has signed in (the chefs screen shows it next to the invite).
  route('GET', 'chef-devices', OWNER, async ({ repo, store }) =>
    Response.json(await chefAccess(repo, store)),
  ),

  route('GET', 'settings', OWNER_CHEF, async ({ store, sellerId }) =>
    Response.json({
      sellerId,
      settings: await store.getSettings(),
    } satisfies SettingsResponse),
  ),
  route('PUT', 'settings', OWNER, async ({ store, request, bad, sellerId }) => {
    const input = parseSettingsRequest(await readJson(request));
    return input
      ? Response.json({
          sellerId,
          settings: await store.setSettings(input),
        } satisfies SettingsResponse)
      : bad();
  }),

  route('GET', 'past-weeks', OWNER_CHEF, async ({ store }) =>
    Response.json({ weeks: await store.listPastWeeks() } satisfies PastWeeksResponse),
  ),
  route('GET', 'past-weeks/:id', OWNER_CHEF, async ({ store, b }) => {
    const week = await store.getPastWeek(b as string);
    return week
      ? Response.json({ week } satisfies PastWeekResponse)
      : error('not_found', 'Week not found');
  }),

  // The kitchen's colour theme (D-064) and the defaults a new menu starts from. A helper reads it.
  route('GET', 'preferences', EVERYONE, async ({ store }) =>
    Response.json({ preferences: await store.getPreferences() } satisfies PreferencesResponse),
  ),
  route('PUT', 'preferences', OWNER, async ({ store, request, bad }) => {
    const input = parseUpdatePreferencesRequest(await readJson(request));
    if (!input) return bad();
    return Response.json({
      preferences: await store.setPreferences(input),
    } satisfies PreferencesResponse);
  }),

  // The owner renames the kitchen.
  route('PUT', 'kitchen/name', OWNER, async ({ store, request, bad }) => {
    const input = parseKitchenNameRequest(await readJson(request));
    if (!input) return bad();
    return Response.json({
      name: await store.setKitchenName(input.name),
    } satisfies KitchenNameResponse);
  }),

  route('GET', 'chefs', OWNER_CHEF, async ({ store }) =>
    Response.json({ chefs: await store.listChefs() } satisfies ChefsResponse),
  ),
  route('POST', 'chefs', OWNER, async ({ store, request, bad }) => {
    const input = parseChefNameRequest(await readJson(request));
    return input ? chefResult(await store.addChef(input.name), 201) : bad();
  }),
  route('PATCH', 'chefs/:id/*', OWNER, async ({ store, request, b, bad }) => {
    const input = parseChefNameRequest(await readJson(request));
    return input ? chefResult(await store.renameChef(b as string, input.name)) : bad();
  }),
  route('DELETE', 'chefs/:id/*', OWNER, async ({ repo, store, b }) => {
    const removed = await store.removeChef(b as string);
    if (removed.ok) await repo.auth.revokeChef(store.seller.id, b as string);
    return okResult(removed);
  }),

  route('GET', 'images', OWNER_CHEF, async ({ store }) =>
    Response.json({ images: await store.getImages() } satisfies ImagesResponse),
  ),
  route('PUT', 'images', OWNER, async ({ store, request, bad }) => {
    const input = parseImageStyleRequest(await readJson(request));
    return input
      ? Response.json({ images: await store.setImageStyle(input) } satisfies ImagesResponse)
      : bad();
  }),
  route('PUT', 'images/:slot', OWNER, async ({ store, request, b, bad, context, sellerId }) => {
    const slot = b as string;
    if (!isImageSlot(slot)) return error('not_found', 'Unknown image place');
    const input = parseUploadImageRequest(await readJson(request));
    if (!input) return bad();
    const before = await store.getImages();
    // With a bucket the bytes go to R2 and the store keeps the path; an invalid upload is not
    // stored there, and the store answers it with the usual error.
    const stored = context.images
      ? await putUploadedImage(context.images, sellerId, slot, input.dataUrl)
      : null;
    const result = await store.setImage(slot, input.dataUrl, stored?.ref);
    if (!result.ok) {
      if (stored && context.images) {
        await dropUnusedImageRefs(context.images, store, [stored.ref], sellerId);
      }
      return error(result.error, result.message);
    }
    if (context.images) await dropUnusedImageRefs(context.images, store, [before[slot]], sellerId);
    return Response.json({ images: result.value } satisfies ImagesResponse);
  }),
  route('DELETE', 'images/:slot', OWNER, async ({ store, b, context, sellerId }) => {
    const slot = b as string;
    if (!isImageSlot(slot)) return error('not_found', 'Unknown image place');
    const before = await store.getImages();
    const images = await store.removeImage(slot);
    if (context.images) await dropUnusedImageRefs(context.images, store, [before[slot]], sellerId);
    return Response.json({ images } satisfies ImagesResponse);
  }),

  route('GET', 'backup', OWNER, async ({ store }) => Response.json(await store.exportBackup())),
  route(
    'POST',
    'backup',
    OWNER,
    async ({ repo, store, request, context, sellerId, menuChanged }) => {
      const file = parseBackupFile(await readJson(request));
      if (!file) return error('invalid_backup', 'This is not a valid backup file');
      const owners = await repo.liveOrderOwners(file.orders.map((order) => order.token));
      if ([...owners.values()].some((owner) => owner !== store.seller.id)) {
        return error('invalid_backup', 'An order in this backup belongs to another kitchen');
      }
      const droppedImages = await store.restoreBackup(file);
      await signal(context, sellerId, 'order.changed');
      await menuChanged();
      return Response.json({ ok: true, droppedImages } satisfies RestoreResponse);
    },
  ),

  // Plan 013: sample orders on a demo kitchen (the kitchen must be a demo one). A signed-in person
  // only (never a DEV_TOOLS header call), and not wrapped with the writer's device id, as before.
  route('POST', 'demo/samples', OWNER_CHEF, demoSamples, { bare: true, when: signedIn }),
  route('DELETE', 'demo/samples', OWNER_CHEF, demoSamples, { bare: true, when: signedIn }),
];
