// One seller's data on D1. The business rules are ported from the retired in-memory store (D-047) and every
// query filters by `seller_id` (D-036). Rules run in TypeScript on rows read from D1; each
// operation that writes several rows sends them as one batch, which D1 runs as one transaction.
import type { SampleOrdersResponse } from '../../shared/devContract';
import type { Seller } from '../../shared/domain';
import type { SellerRepository } from '../repo/Repository';
import { newSampleState, seededRandom, type Deps, type SampleState } from './sellerShared';
import { createSellerContext } from './sellerContext';
import { samplesPart } from './sellerSamples';
import { kitchenPart } from './sellerKitchen';
import { backupPart } from './sellerBackup';
import { ordersPart } from './sellerOrders';

export { newSampleState, seededRandom, type Deps, type SampleState };

export type SellerInternal = {
  repo: SellerRepository;
  addSampleOrders(count: number): Promise<SampleOrdersResponse>;
};

export function createSellerInternal(deps: Deps, seller: Seller): SellerInternal {
  const c = createSellerContext(deps, seller);
  const { addSampleOrders, clearSampleOrders } = samplesPart(c);

  const repo: SellerRepository = {
    seller,
    ...c.handover,
    ...c.dayOps,
    ...c.privateOps,
    ...c.pushOps,
    addDemoSamples: addSampleOrders,
    clearDemoSamples: clearSampleOrders,
    ...kitchenPart(c),
    ...c.menuOps,
    ...backupPart(c),
    ...ordersPart(c),
  };

  return { repo, addSampleOrders };
}
