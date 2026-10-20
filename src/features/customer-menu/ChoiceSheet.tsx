import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, MenuItemView } from '../../../shared/domain';
import { LOW_STOCK } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { BottomSheet } from '../../ui/patterns';
import { CUSTOMER_NS } from './i18n/register';
import { MenuIcon } from './menuIcons';
import { dishMax, Group, MainButton, Qty, Round } from './menuParts';

// Plan 111: the sheet a dish with choices opens from its + : how many of each choice, then one tap
// adds them all to the basket. The counts start at 0 each time; they are added to what the basket holds.

const Sub = styled.p`
  margin: ${({ theme }) => theme.spacing.xs} 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const List = styled.ul`
  max-height: 50dvh;
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  padding: 0;
  overflow-y: auto;
  list-style: none;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Row = styled.li<{ $out: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ theme, $out }) => ($out ? theme.c.muted : theme.c.text)};
`;
const Name = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-weight: 700;
`;
const Left = styled.span`
  color: ${({ theme }) => theme.c.warn};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: 700;
`;
const Out = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: 400;
`;

type Props = Readonly<{
  dish: MenuItemView;
  choices: ReadonlyArray<MenuItemView>;
  lang: Language;
  /** What the basket already holds per item. */
  basket: Readonly<Record<string, number>>;
  /** The counts picked here (only those above 0). */
  onAdd: (picked: Readonly<Record<string, number>>) => void;
  onClose: () => void;
}>;

/** The most of one choice this sheet may add: its own stock (and the dish's pre-order flag) less the basket. */
function room(dish: MenuItemView, choice: MenuItemView, inBasket: number): number {
  const base = dish.preorder === false ? { ...choice, preorder: false } : choice;
  return Math.max(0, dishMax(base) - inBasket);
}

export function ChoiceSheet({ dish, choices, lang, basket, onAdd, onClose }: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const [picked, setPicked] = useState<Readonly<Record<string, number>>>({});
  const change = useCallback((id: string, by: number, max: number) => {
    setPicked((prev) => {
      const next = Math.max(0, Math.min(max, (prev[id] ?? 0) + by));
      const copy: Record<string, number> = { ...prev };
      if (next > 0) copy[id] = next;
      else delete copy[id];
      return copy;
    });
  }, []);
  const count = Object.values(picked).reduce((sum, n) => sum + n, 0);
  const size = pickText(dish.size, lang);
  const pick = t('choices.pick');
  return (
    <BottomSheet
      title={`${pickText(dish.name, lang)} · ${formatMoney(dish.priceCents, lang)}`}
      onClose={onClose}
    >
      <Sub>{size ? `${size} · ${pick}` : pick}</Sub>
      <List>
        {choices.map((choice) => {
          const name = pickText(choice.name, lang);
          const max = room(dish, choice, basket[choice.id] ?? 0);
          const out = choice.soldOut || dishMax(choice) === 0;
          const qty = picked[choice.id] ?? 0;
          const low =
            !out &&
            choice.remaining !== null &&
            choice.remaining > 0 &&
            choice.remaining <= LOW_STOCK;
          return (
            <Row key={choice.id} $out={out}>
              <Name>
                {name}
                {out ? (
                  <Out>
                    <MenuIcon name="ban" size="1rem" />
                    {t('menu.soldOut')}
                  </Out>
                ) : low ? (
                  <Left>{t('menu.left', { count: choice.remaining })}</Left>
                ) : null}
              </Name>
              <Group role="group" aria-label={name}>
                {qty > 0 ? (
                  <>
                    <Round
                      type="button"
                      aria-label={t('menu.decrease', { name })}
                      onClick={() => change(choice.id, -1, max)}
                    >
                      <MenuIcon name="minus" />
                    </Round>
                    <Qty aria-live="polite">{qty}</Qty>
                  </>
                ) : null}
                <Round
                  type="button"
                  aria-label={t('menu.increase', { name })}
                  disabled={out || qty >= max}
                  onClick={() => change(choice.id, 1, max)}
                >
                  <MenuIcon name="plus" />
                </Round>
              </Group>
            </Row>
          );
        })}
      </List>
      <MainButton type="button" disabled={count === 0} onClick={() => onAdd(picked)}>
        {t('choices.add', { count, total: formatMoney(dish.priceCents * count, lang) })}
      </MainButton>
    </BottomSheet>
  );
}
