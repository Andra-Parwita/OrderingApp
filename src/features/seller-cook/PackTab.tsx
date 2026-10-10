import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Language, Order } from '../../../shared/domain';
import { pickText } from '../../../shared/text';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { packOrder } from '../../api/kitchen';
import { Button, Icon, Segmented, WarningDialog, type SegmentedOption } from '../../ui';
import { COOK_NS } from './i18n/register';
import {
  nextUnpacked,
  sortBags,
  toggledIds,
  withTicks,
  type Bag,
  type PackSort,
} from './packModel';
import { ChefFilterControl, useChefFilter } from './ChefFilterControl';
import { isOwnItem } from './cookModel';
import { selectBags, selectCookMenu } from './cookSelectors';
import { orderReplaced, type CookRootState } from './cookSlice';

const SORTS: ReadonlyArray<PackSort> = ['time', 'place', 'code'];

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
  flex: 1;
  min-height: 0;

  @media (max-width: 52rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
const ListPane = styled.div`
  border-right: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  @media (max-width: 52rem) {
    border-right: 0;
    border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  }
`;
const SortBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const BagList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const BagButton = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: ${({ theme }) => theme.size.rowOrder}px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme, $open }) => ($open ? theme.c.tint : 'transparent')};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: left;
  cursor: pointer;
`;
const Dot = styled.span<{ $on: boolean }>`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ theme, $on }) => ($on ? theme.c.fill : theme.c.ctrl)};
  border-radius: 50%;
  background: ${({ theme, $on }) => ($on ? theme.c.fill : 'transparent')};
  color: ${({ theme }) => theme.c.on};

  svg {
    width: 1rem;
    height: 1rem;
  }
`;
const BagText = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;
const BagName = styled.span`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  font-weight: 600;
`;
const Mono = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.8125rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.c.muted};
`;
const Sub = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const Progress = styled.span<{ $done: boolean }>`
  flex: none;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: ${({ theme, $done }) => ($done ? theme.c.atext : theme.c.text)};
`;
const Detail = styled.section`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;
const DetailHead = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl} 0;
`;
const BigName = styled.h2`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0;
  font-size: 1.75rem;
`;
const BigCode = styled(Mono)`
  font-size: 1.25rem;
`;
const Where = styled.p`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.xl}
    ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.muted};
`;
const Note = styled.p`
  margin: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
`;
const Items = styled.ul`
  margin: 0 ${({ theme }) => theme.spacing.xl};
  padding: 0;
  list-style: none;
`;
const ItemButton = styled.button<{ $on: boolean; $other: boolean }>`
  opacity: ${({ $other }) => ($other ? 0.5 : 1)};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  min-height: ${({ theme }) => theme.size.rowOrder}px;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: ${({ theme, $on }) => ($on ? theme.c.muted : theme.c.text)};
  font: inherit;
  font-size: 1.125rem;
  text-align: left;
  text-decoration: ${({ $on }) => ($on ? 'line-through' : 'none')};
  cursor: ${({ $other }) => ($other ? 'default' : 'pointer')};
`;
const Box = styled.span<{ $on: boolean }>`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: ${({ theme }) => theme.border.focus} solid
    ${({ theme, $on }) => ($on ? theme.c.fill : theme.c.ctrl)};
  border-radius: 0.375rem;
  background: ${({ theme, $on }) => ($on ? theme.c.fill : 'transparent')};
  color: ${({ theme }) => theme.c.on};
`;
const Qty = styled.span`
  min-width: 2.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;
const Footer = styled.footer`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: auto;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Hint = styled.p`
  flex: 1;
  min-width: 12rem;
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
`;
const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Centered = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
`;

/** Kitchen · Pack (D-066): one bag at a time. Ticks and "Packed" are saved on the server. */
export function PackTab() {
  const { t, i18n } = useTranslation(COOK_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const dispatch = useDispatch();
  const chef = useChefFilter();
  const menu = useSelector((state: CookRootState) => selectCookMenu(state));
  const bags = useSelector((state: CookRootState) => selectBags(state, chef.filter));
  const [sort, setSort] = useState<PackSort>('time');
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [warn, setWarn] = useState<{ code: string; count: number } | null>(null);

  const sorted = useMemo(() => sortBags(bags, sort), [bags, sort]);
  const open: Bag | undefined =
    sorted.find((bag) => bag.order.code === openCode) ??
    sorted.find((bag) => !bag.packed) ??
    sorted[0];

  const sortOptions: ReadonlyArray<SegmentedOption<PackSort>> = SORTS.map((value) => ({
    value,
    label: t(`pack.sort.${value}`),
  }));

  const save = useCallback(
    async (order: Order, body: { ticked?: Array<string>; packed?: boolean; force?: boolean }) => {
      const result = await packOrder(order.code, body, undefined, currentSellerSlug());
      if (result.ok) {
        setFailed(false);
        dispatch(orderReplaced(result.data.order));
        return result.data.order;
      }
      return result;
    },
    [dispatch],
  );

  const tick = useCallback(
    async (order: Order, itemId: string) => {
      const ids = toggledIds(order, itemId);
      dispatch(orderReplaced(withTicks(order, ids)));
      const result = await save(order, { ticked: ids });
      if ('ok' in result) {
        dispatch(orderReplaced(order));
        setFailed(true);
      }
    },
    [dispatch, save],
  );

  const goNext = useCallback(
    (fromCode: string) => {
      const next = nextUnpacked(sorted, fromCode);
      if (next) setOpenCode(next.order.code);
    },
    [sorted],
  );

  const markPacked = useCallback(
    async (bag: Bag, force: boolean) => {
      const result = await save(bag.order, { packed: true, ...(force ? { force } : {}) });
      if (!('ok' in result)) {
        setWarn(null);
        goNext(bag.order.code);
        return;
      }
      if (result.status === 409 && result.warning?.code === 'items_unticked') {
        setWarn({
          code: bag.order.code,
          count: result.warning.unticked?.length ?? bag.total - bag.ticked,
        });
      } else {
        setFailed(true);
      }
    },
    [goNext, save],
  );

  const unpack = useCallback(
    async (bag: Bag) => {
      const result = await save(bag.order, { packed: false });
      if ('ok' in result) setFailed(true);
    },
    [save],
  );

  if (sorted.length === 0 || !open) {
    return (
      <>
        <SortBar>
          <ChefFilterControl {...chef} />
        </SortBar>
        <Centered>{t('pack.empty')}</Centered>
      </>
    );
  }

  const untickedCount = open.total - open.ticked;
  const where = open.place
    ? `${open.place}${open.time ? ` · ${t('pack.pickupAt', { time: open.time })}` : ''}`
    : t('pack.delivery');

  return (
    <Layout>
      <ListPane>
        <SortBar>
          <span>{t('pack.orderBy')}</span>
          <Segmented
            compact
            options={sortOptions}
            value={sort}
            onChange={setSort}
            label={t('pack.orderBy')}
          />
          <ChefFilterControl {...chef} />
        </SortBar>
        <BagList aria-label={t('pack.list')}>
          {sorted.map((bag) => (
            <li key={bag.order.id}>
              <BagButton
                type="button"
                $open={bag.order.code === open.order.code}
                aria-current={bag.order.code === open.order.code ? 'true' : undefined}
                onClick={() => setOpenCode(bag.order.code)}
              >
                <Dot $on={bag.packed}>{bag.packed ? <Icon name="check" /> : null}</Dot>
                <BagText>
                  <BagName>
                    {bag.order.firstName} <Mono>{bag.code}</Mono>
                  </BagName>
                  <Sub>
                    {bag.place
                      ? `${bag.place}${bag.time ? ` · ${bag.time}` : ''}`
                      : t('pack.delivery')}
                  </Sub>
                </BagText>
                <Progress $done={bag.packed}>
                  {bag.packed ? t('pack.packed') : `${bag.ticked}/${bag.total}`}
                </Progress>
              </BagButton>
            </li>
          ))}
        </BagList>
      </ListPane>

      <Detail aria-label={`${open.order.firstName} ${open.code}`}>
        <DetailHead>
          <BigName>
            <BigCode>{open.code}</BigCode>
            {open.order.firstName}
          </BigName>
          <Sub>{t('pack.inBag', { ticked: open.ticked, total: open.total })}</Sub>
        </DetailHead>
        <Where>
          <Icon name="bag" />
          {where}
        </Where>
        {open.order.note ? (
          <Note>
            <b>{t('pack.note')}:</b> {open.order.note}
          </Note>
        ) : null}
        <Items>
          {open.order.lines.map((line) => {
            const on = line.ticked === true;
            const other = !isOwnItem(menu, chef.filter, line.itemId);
            return (
              <li key={line.itemId}>
                <ItemButton
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={
                    other ? `${pickText(line.name, lang)} · ${t('pack.otherChef')}` : undefined
                  }
                  disabled={other}
                  $on={on}
                  $other={other}
                  onClick={() => void tick(open.order, line.itemId)}
                >
                  <Box $on={on}>{on ? <Icon name="check" /> : null}</Box>
                  <Qty>{line.qty}×</Qty>
                  <span>
                    {pickText(line.name, lang)} <Sub>· {pickText(line.size, lang)}</Sub>
                  </span>
                </ItemButton>
              </li>
            );
          })}
        </Items>
        <Footer>
          <Hint role="status">
            {failed
              ? t('pack.saveError')
              : open.packed
                ? t('pack.isPacked')
                : untickedCount === 0
                  ? t('pack.allIn')
                  : t('pack.notTicked', { count: untickedCount })}
          </Hint>
          <Actions>
            {open.packed ? (
              <Button variant="quiet" onClick={() => void unpack(open)}>
                {t('pack.unpack')}
              </Button>
            ) : (
              <>
                <Button variant="quiet" onClick={() => goNext(open.order.code)}>
                  {t('pack.skip')}
                </Button>
                <Button variant="primary" onClick={() => void markPacked(open, false)}>
                  <Icon name="check" />
                  {t('pack.packedNext')}
                </Button>
              </>
            )}
          </Actions>
        </Footer>
      </Detail>

      {warn ? (
        <WarningDialog
          title={t('pack.warnTitle', { count: warn.count })}
          cancelLabel={t('pack.warnCancel')}
          continueLabel={t('pack.warnContinue')}
          onCancel={() => setWarn(null)}
          onContinue={() => {
            const bag = sorted.find((candidate) => candidate.order.code === warn.code);
            if (bag) void markPacked(bag, true);
            else setWarn(null);
          }}
        >
          {t('pack.warnBody', { count: warn.count })}
        </WarningDialog>
      ) : null}
    </Layout>
  );
}
