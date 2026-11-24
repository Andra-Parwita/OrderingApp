import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatDay } from '../../../../shared/dates';
import type { Language } from '../../../../shared/domain';
import type { Dish } from '../../../../shared/menusContract';
import { formatMoney } from '../../../../shared/money';
import { pickText } from '../../../../shared/text';
import { BottomSheet, Button, Icon } from '../../../ui';
import { Pencil } from '../DishPicker';
import { MENU_NS } from '../i18n/register';
import { LinkButton, Muted } from '../menuShared';
import type { MenuData } from '../menuSlice';
import { matchPastDishes } from '../pastMenus';
import { ChangeMark } from '../SessionMarks';
import { PhoneFooterSlot } from './PhoneWizardShell';
import { useLayerStack } from './useLayerStack';

// Plan 134: step 1 Dishes on the phone, one column: + New dish first, the source (Your dishes, Saved
// sets, Past menus), a search, the dishes with a tick and a pencil, and "On this menu N" in the footer
// (a bottom sheet with the chosen dishes). The state (ticks, auto-save, sets) stays in DishesStep.

export type PhoneSource = 'dishes' | 'sets' | 'past';

export type OnMenuRow = Readonly<{
  key: string;
  dishId: string | undefined;
  name: { en: string; id: string };
  priceCents: number;
  /** In a live-menu edit session: "added" or "edited" (a mark beside the name). */
  mark: 'added' | 'edited' | null;
}>;

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px;
`;
const Source = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  overflow: hidden;
`;
const SourceButton = styled.button<{ $on: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: ${({ theme }) => theme.spacing.xs};
  border: 0;
  border-inline-start: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  background: ${({ $on, theme }) => ($on ? theme.c.fill : 'transparent')};
  color: ${({ $on, theme }) => ($on ? theme.c.on : theme.c.text)};
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: center;
  cursor: pointer;

  &:first-child {
    border-inline-start: 0;
  }
  span {
    max-width: 100%;
    overflow-wrap: anywhere;
  }
`;
const Search = styled.input`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
`;
const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Row = styled.li`
  display: grid;
  grid-template-columns: ${({ theme }) => theme.size.tap}px minmax(0, 1fr) ${({ theme }) =>
      theme.size.tap}px;
  align-items: center;
  min-height: 3.5rem;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-variant-numeric: tabular-nums;
`;
const TickLabel = styled.label`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: ${({ theme }) => theme.size.tap}px;

  input {
    width: 1.375rem;
    height: 1.375rem;
    margin: 0;
    accent-color: ${({ theme }) => theme.c.fill};
  }
`;
const Text = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: ${({ theme }) => theme.spacing.xs} 0;

  b {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
`;
/** The size stays whole ("· 1 box") when the name wraps. */
const Size = styled.span`
  white-space: nowrap;
`;
const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  strong {
    overflow-wrap: anywhere;
  }
`;
const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: 62rem;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
`;
const SheetRow = styled.li<{ $changed: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto ${({ theme }) => theme.size.tap}px;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: 3rem;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ $changed, theme }) => ($changed ? theme.c.warnTint : 'transparent')};
  font-variant-numeric: tabular-nums;

  > span:first-child {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
`;

export function PhoneDishes({
  data,
  lang,
  source,
  onSource,
  search,
  onSearch,
  onMenu,
  onMenuIds,
  full,
  busy,
  locked,
  status,
  note,
  added,
  onToggle,
  onRemove,
  onEdit,
  onNewDish,
  onUseSet,
  onUsePast,
  onSaveSet,
}: Readonly<{
  data: MenuData;
  lang: Language;
  source: PhoneSource;
  onSource: (next: PhoneSource) => void;
  search: string;
  onSearch: (next: string) => void;
  onMenu: ReadonlyArray<OnMenuRow>;
  onMenuIds: ReadonlyArray<string>;
  full: boolean;
  busy: boolean;
  /** A tick is waiting to be saved: the set and past buttons wait too. */
  locked: boolean;
  /** The auto-save line (saving, failed) and the notes under the list. */
  status: ReactNode;
  note: ReactNode;
  /** The dish just made, which has no picture yet: a link to add one. */
  added: Readonly<{ dishId: string; name: string }> | null;
  onToggle: (dish: Dish) => void;
  onRemove: (key: string, dishId: string | undefined, name: string) => void;
  onEdit: (dishId: string) => void;
  onNewDish: () => void;
  onUseSet: (setId: string) => void;
  onUsePast: (weekId: string) => void;
  onSaveSet: () => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const footer = useContext(PhoneFooterSlot);
  const layers = useLayerStack();
  const sheet = layers.stack.includes('onMenu');
  const needle = search.trim().toLowerCase();
  const shown = data.dishes.filter(
    (dish) =>
      needle === '' ||
      dish.name.en.toLowerCase().includes(needle) ||
      dish.name.id.toLowerCase().includes(needle),
  );
  const options: ReadonlyArray<Readonly<{ value: PhoneSource; label: string; n: number }>> = [
    { value: 'dishes', label: t('dishes.yours'), n: data.dishes.length },
    { value: 'sets', label: t('dishes.sets'), n: data.sets.length },
    { value: 'past', label: t('dishes.past'), n: data.past.length },
  ];
  const chip = t('dishes.onMenuChip', { count: onMenu.length });
  return (
    <Page>
      <Button variant="primary" fullWidth onClick={onNewDish}>
        <Icon name="plus" />
        {t('dishes.newDish')}
      </Button>
      {added ? (
        <Muted role="status">
          {t('dishes.addedPhone', { name: added.name })}{' '}
          <LinkButton onClick={() => onEdit(added.dishId)}>
            {t('dishes.addPicturePhone')}
          </LinkButton>
        </Muted>
      ) : null}
      <Source role="radiogroup" aria-label={t('dishes.startFrom')}>
        {options.map((option) => (
          <SourceButton
            key={option.value}
            type="button"
            role="radio"
            aria-checked={source === option.value}
            $on={source === option.value}
            onClick={() => onSource(option.value)}
          >
            <span>{option.label}</span>
            <span>{option.n}</span>
          </SourceButton>
        ))}
      </Source>
      {status}
      {source === 'dishes' ? (
        <>
          <Search
            type="search"
            value={search}
            aria-label={t('dishes.search')}
            placeholder={t('dishes.searchHint')}
            autoComplete="off"
            onChange={(event) => onSearch(event.target.value)}
          />
          {data.dishes.length === 0 ? <Muted>{t('dishes.noneYet')}</Muted> : null}
          <List aria-label={t('dishes.yours')}>
            {shown.map((dish) => {
              const on = onMenuIds.includes(dish.id);
              const name = pickText(dish.name, lang);
              const size = pickText(dish.size, lang);
              const last = [
                formatMoney(dish.priceCents, lang),
                dish.lastUsedAt ? formatDay(dish.lastUsedAt, lang) : '',
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <Row key={dish.id}>
                  <TickLabel>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && full}
                      aria-label={t('dishes.onMenuFor', { name })}
                      onChange={() => onToggle(dish)}
                    />
                  </TickLabel>
                  <Text>
                    <b>
                      {name}
                      {size ? <Size>{` · ${size}`}</Size> : null}
                    </b>
                    <small>{last}</small>
                  </Text>
                  <Pencil
                    type="button"
                    aria-label={t('dishes.edit', { name })}
                    onClick={() => onEdit(dish.id)}
                  >
                    <Icon name="pencil" />
                  </Pencil>
                </Row>
              );
            })}
          </List>
        </>
      ) : null}
      {source === 'sets' ? (
        <div>
          {data.sets.length === 0 ? <Muted>{t('dishes.noSets')}</Muted> : null}
          {data.sets.map((set) => {
            const names = set.dishIds
              .map((id) => data.dishes.find((dish) => dish.id === id))
              .flatMap((dish) => (dish ? [pickText(dish.name, lang)] : []));
            return (
              <Group key={set.id}>
                <strong>{set.name}</strong>
                <Muted>{names.join(' · ')}</Muted>
                <Button fullWidth disabled={busy || locked} onClick={() => onUseSet(set.id)}>
                  {t('dishes.addSet')}
                </Button>
              </Group>
            );
          })}
        </div>
      ) : null}
      {source === 'past' ? (
        <div>
          {data.past.length === 0 ? <Muted>{t('past.empty')}</Muted> : null}
          {data.past.map((week) => {
            const { ids } = matchPastDishes(week.totals.items, data.dishes);
            return (
              <Group key={week.id}>
                <strong>{formatDay(week.cookingDate, lang)}</strong>
                <Muted>
                  {week.totals.items.map((item) => pickText(item.name, lang)).join(' · ')}
                </Muted>
                <Button
                  fullWidth
                  disabled={busy || locked || ids.length === 0}
                  onClick={() => onUsePast(week.id)}
                >
                  {t('dishes.addThese')}
                </Button>
              </Group>
            );
          })}
        </div>
      ) : null}
      {note}
      {footer
        ? createPortal(
            <Chip
              type="button"
              aria-haspopup="dialog"
              aria-label={chip}
              onClick={() => layers.push('onMenu')}
            >
              {chip}
              <Icon name="forward" />
            </Chip>,
            footer,
          )
        : null}
      {sheet ? (
        <BottomSheet
          title={`${t('dishes.onMenu')} · ${t('dishes.count', { count: onMenu.length })}`}
          onClose={layers.back}
        >
          {onMenu.length === 0 ? <Muted>{t('dishes.emptyMenuPhone')}</Muted> : null}
          <List>
            {onMenu.map((dish) => {
              const name = pickText(dish.name, lang);
              return (
                <SheetRow key={dish.key} $changed={dish.mark !== null}>
                  <span>
                    {name}
                    {dish.mark ? <ChangeMark kind={dish.mark} /> : null}
                  </span>
                  <span>{formatMoney(dish.priceCents, lang)}</span>
                  <Pencil
                    type="button"
                    aria-label={t('dishes.remove', { name })}
                    disabled={!dish.dishId}
                    onClick={() => onRemove(dish.key, dish.dishId, name)}
                  >
                    <Icon name="x" />
                  </Pencil>
                </SheetRow>
              );
            })}
          </List>
          <Muted>{t('dishes.pricesLater')}</Muted>
          <LinkButton
            disabled={onMenuIds.length === 0}
            onClick={() => {
              layers.back();
              onSaveSet();
            }}
          >
            {t('dishes.saveSet')}
          </LinkButton>
        </BottomSheet>
      ) : null}
    </Page>
  );
}
