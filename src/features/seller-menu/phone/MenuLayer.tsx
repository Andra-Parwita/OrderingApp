import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatDay } from '../../../../shared/dates';
import type { Language } from '../../../../shared/domain';
import type { MenuDishView, MenuView } from '../../../../shared/menusContract';
import { formatMoney } from '../../../../shared/money';
import { pickText } from '../../../../shared/text';
import { Button, Icon, Pill } from '../../../ui';
import { ShareButtons, StatusPill } from './CardParts';
import type { CardState } from './cardState';
import { LayerBar, LayerBody, LayerShell } from './LayerShell';
import { PHONE_MENU_NS } from './i18n/register';

// Plan 124 (Q3 A): the read-only menu, opened from the Menu card. No editing; that stays on the tablet.

const Dish = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  > img,
  > span:first-child {
    flex: none;
    width: 3rem;
    height: 3rem;
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.c.surf2};
    object-fit: cover;
  }
`;
const Text = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;

  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.sm};
  }
`;
const Name = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-weight: 600;
`;
const Price = styled.b`
  font-variant-numeric: tabular-nums;
`;
const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Foot = styled.footer`
  flex: none;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadPhone}px;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;

function DishRow({
  dish,
  choices,
  lang,
}: Readonly<{ dish: MenuDishView; choices: ReadonlyArray<MenuDishView>; lang: Language }>) {
  const { t } = useTranslation(PHONE_MENU_NS);
  const when = dish.preorder === false ? t('menu.onTheDay') : t('menu.preorder');
  const names = choices.map((choice) => pickText(choice.name, lang)).join(', ');
  const detail =
    choices.length > 0 ? `${when} · ${t('menu.choices', { count: choices.length, names })}` : when;
  return (
    <Dish>
      {dish.pictureRef ? <img src={dish.pictureRef} alt="" /> : <span aria-hidden="true" />}
      <Text>
        <Name>
          {pickText(dish.name, lang)}
          {dish.soldOut ? <Pill tone="done">{t('menu.soldOut')}</Pill> : null}
        </Name>
        <small>{detail}</small>
      </Text>
      <Price>{formatMoney(dish.priceCents, lang)}</Price>
    </Dish>
  );
}

export function MenuLayer({
  view,
  state,
  lang,
  onClose,
  onShare,
  onNotice,
}: Readonly<{
  view: MenuView;
  state: CardState;
  lang: Language;
  onClose: () => void;
  onShare: (() => void) | undefined;
  onNotice: (() => void) | undefined;
}>) {
  const { t } = useTranslation(PHONE_MENU_NS);
  const title = t('menu.title', { date: formatDay(view.menu.cookingDate, lang) });
  const top = view.dishes.filter((dish) => dish.groupId === undefined);
  return (
    <LayerShell label={title} onClose={onClose}>
      <LayerBar>
        <Button variant="quiet" aria-label={t('menu.backLabel')} onClick={onClose}>
          <Icon name="back" />
          {t('menu.back')}
        </Button>
        <h2>{title}</h2>
        <StatusPill state={state} />
      </LayerBar>
      <LayerBody>
        {top.length === 0 ? <p>{t('menu.empty')}</p> : null}
        <List>
          {top.map((dish) => (
            <DishRow
              key={dish.id}
              dish={dish}
              lang={lang}
              choices={view.dishes.filter((choice) => choice.groupId === dish.id)}
            />
          ))}
        </List>
      </LayerBody>
      {onShare ? (
        <Foot>
          <ShareButtons onShare={onShare} onNotice={onNotice} />
        </Foot>
      ) : null}
    </LayerShell>
  );
}
