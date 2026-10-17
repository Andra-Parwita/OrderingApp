import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, MenuItemView } from '../../../shared/domain';
import { LOW_STOCK, MAX_QTY } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Pill, Stepper } from '../../ui';
import { FullPictureViewer } from './FullPictureViewer';
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

// Plan 067: a fixed 64 x 64 slot on the left, so nothing jumps while the picture loads.
const PictureButton = styled.button<{ $soldOut: boolean }>`
  flex: none;
  width: 4rem;
  height: 4rem;
  padding: 0;
  overflow: hidden;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.surf};
  cursor: pointer;

  img {
    display: block;
    width: 4rem;
    height: 4rem;
    object-fit: cover;
    opacity: ${({ $soldOut }) => ($soldOut ? 0.5 : 1)};
  }
`;

const Text = styled.div`
  flex: 1;
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
  const size = pickText(item.size, lang);
  const [viewing, setViewing] = useState(false);
  const closeViewer = useCallback(() => setViewing(false), []);
  return (
    <Row $soldOut={item.soldOut}>
      {item.pictureRef ? (
        <PictureButton
          type="button"
          $soldOut={item.soldOut}
          aria-haspopup="dialog"
          aria-label={t('menu.enlargePicture', { name })}
          onClick={() => setViewing(true)}
        >
          <img src={item.pictureRef} alt="" width={64} height={64} loading="lazy" />
        </PictureButton>
      ) : null}
      <Text>
        <Strong>{name}</Strong>
        {description ? <Muted>{description}</Muted> : null}
        <Meta>
          <span>
            {size ? `${size} · ` : null}
            <Strong>{formatMoney(item.priceCents, lang)}</Strong>
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
        max={
          item.soldOut || item.preorder === false ? 0 : Math.min(MAX_QTY, item.remaining ?? MAX_QTY)
        }
        disabled={item.soldOut || item.preorder === false || closed}
      />
      {viewing && item.pictureRef ? (
        <FullPictureViewer
          src={item.pictureRef}
          title={name}
          label={t('menu.dishPicture', { name })}
          caption={`${name} · ${formatMoney(item.priceCents, lang)}`}
          {...(description ? { detail: description } : {})}
          onClose={closeViewer}
        />
      ) : null}
    </Row>
  );
});
