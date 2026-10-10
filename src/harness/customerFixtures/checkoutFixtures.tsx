import { useMemo, type ComponentType } from 'react';
import type { Fulfilment } from '../../../shared/domain';
import type { BasketNotice } from '../../features/customer-menu/customerSlice';
import { BasketView, PickupPlaceView, YourNameView, useLang } from '../../features/customer-menu';
import type { BasketLine } from '../../features/customer-menu/selectors';
import { menuFrom } from './menuFixtures';
import type { FixtureProps } from './types';

// The checkout screens (plan 004 stage 3) fed from fixtures.json: the real presentational views
// with the design's basket, a first name and a note. Nothing is stored or sent.

const noop = () => undefined;

/** The fixture basket as the basket lines the store would give. */
function useCheckout(props: FixtureProps) {
  const data = useMemo(() => menuFrom(props), [props]);
  const basket = props.state['basket'] ?? props.data.basket;
  return useMemo(() => {
    const lines: Array<BasketLine> = [];
    for (const entry of basket as ReadonlyArray<{ dishId: string; qty: number }>) {
      const item = data.items.find((candidate) => candidate.id === entry.dishId);
      if (item) {
        lines.push({
          item,
          qty: entry.qty,
          lineCents: item.priceCents * entry.qty,
          max: item.remaining ?? undefined,
        });
      }
    }
    const totalCents = lines.reduce((sum, line) => sum + line.lineCents, 0);
    const count = lines.reduce((sum, line) => sum + line.qty, 0);
    const fulfilment: Fulfilment = props.state['fulfilment'] === 'delivery' ? 'delivery' : 'pickup';
    return { data, lines, totalCents, count, fulfilment };
  }, [data, basket, props.state]);
}

function Basket(props: FixtureProps) {
  const lang = useLang();
  const { data, lines, totalCents, fulfilment } = useCheckout(props);
  // "d5 sold out after it was added": the banner of basket-delivery-error.
  const soldOut = (typeof props.state['notice'] === 'string' ? props.state['notice'] : '').split(
    ' ',
  )[0];
  const dish = data.items.find((item) => item.id === soldOut);
  const notices: Array<BasketNotice> = dish
    ? [{ kind: 'sold_out', itemId: dish.id, name: dish.name, qty: 0 }]
    : [];
  return (
    <BasketView
      data={data}
      lang={lang}
      lines={lines}
      totalCents={totalCents}
      fulfilment={fulfilment}
      pickupId="p1"
      editing={false}
      notices={notices}
      closed={null}
      stockProblem={false}
      onQty={noop}
      onFulfilment={noop}
      onChangePlace={noop}
      onNext={noop}
      onBack={noop}
    />
  );
}

function PickupPlace(props: FixtureProps) {
  const lang = useLang();
  const { data } = useCheckout(props);
  return (
    <PickupPlaceView
      data={data}
      lang={lang}
      selectedId="p1"
      onSelect={noop}
      onDone={noop}
      onBack={noop}
    />
  );
}

function YourName({ placing, ...props }: FixtureProps & Readonly<{ placing?: boolean }>) {
  const lang = useLang();
  const { data, totalCents, count, fulfilment } = useCheckout(props);
  const order = props.data.orders[0];
  return (
    <YourNameView
      data={data}
      lang={lang}
      editing={false}
      firstName={order?.firstName ?? ''}
      note={order?.note ?? ''}
      count={count}
      totalCents={totalCents}
      fulfilment={fulfilment}
      pickupId="p1"
      placing={placing === true}
      onFirstName={noop}
      onNote={noop}
      onSubmit={noop}
      onBack={noop}
    />
  );
}

function Placing(props: FixtureProps) {
  return <YourName {...props} placing />;
}

export const CHECKOUT_FIXTURE_SCREENS: Readonly<Record<string, ComponentType<FixtureProps>>> = {
  basket: Basket,
  'pickup-place': PickupPlace,
  'your-name': YourName,
  placing: Placing,
  'basket-delivery-error': Basket,
};
