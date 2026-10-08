import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, MenuItemView } from '../../../shared/domain';
import { LOW_STOCK, MAX_QTY } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Pill, Stepper } from '../../ui';
import { CUSTOMER_NS } from './i18n/register';
import { Muted, Strong } from './layout';

const Row = styled.li<{ $soldOut: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
  color: ${({ theme, $soldOut }) => ($soldOut ? theme.colour.textMuted : theme.colour.text)};
`;

const Text = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

type Props = Readonly<{
  item: MenuItemView;
  qty: number;
  lang: Language;
  onQty: (itemId: string, qty: number) => void;
  /** Ordering is closed: the item is shown, but its stepper is off. */
  closed?: boolean;
}>;

/** One menu item with its stepper; the stepper stops at the portions left (D-020 snapshot is server-side). */
export const ItemRow = memo(function ItemRow({ item, qty, lang, onQty, closed = false }: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const onChange = useCallback((next: number) => onQty(item.id, next), [onQty, item.id]);
  const name = pickText(item.name, lang);
  const description = pickText(item.description, lang);
  return (
    <Row $soldOut={item.soldOut}>
      <Text>
        <Strong>{name}</Strong>
        {description ? <Muted>{description}</Muted> : null}
        <Meta>
          <span>
            {pickText(item.size, lang)} · <Strong>{formatMoney(item.priceCents, lang)}</Strong>
          </span>
          {item.soldOut ? (
            <Pill tone="done">{t('menu.soldOut')}</Pill>
          ) : item.remaining != null && item.remaining > 0 && item.remaining <= LOW_STOCK ? (
            <Pill tone="ordered">{t('menu.left', { count: item.remaining })}</Pill>
          ) : null}
        </Meta>
      </Text>
      <Stepper
        value={qty}
        onChange={onChange}
        label={name}
        decreaseLabel={t('menu.decrease', { name })}
        increaseLabel={t('menu.increase', { name })}
        max={item.soldOut ? 0 : Math.min(MAX_QTY, item.remaining ?? MAX_QTY)}
        disabled={item.soldOut || closed}
      />
    </Row>
  );
});
