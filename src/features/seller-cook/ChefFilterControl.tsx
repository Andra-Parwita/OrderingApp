import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { lastSignedIn } from '../../api/device/sellerContext';
import { Segmented, type SegmentedOption } from '../../ui';
import { ALL_CHEFS, chefChoices, type ChefFilter } from './cookModel';
import { selectCookMenu } from './cookSelectors';
import type { CookRootState } from './cookSlice';
import { COOK_NS } from './i18n/register';

// "Chef" filter for Cook and Pack (plan 016). The choice is kept on this device only.

const KEY = 'cook-chef-filter';
/** Up to this many choices (All included) it is a Segmented, else a select. */
const SEGMENTED_MAX = 4;

function readStored(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Private window or blocked storage: the choice lasts until the page closes.
  }
}

/** The chosen chef: the saved choice, else the signed-in chef, else All. Never an unknown chef. */
export function useChefFilter() {
  const { t } = useTranslation(COOK_NS);
  const menu = useSelector((state: CookRootState) => selectCookMenu(state));
  const [stored, setStored] = useState<string | null>(readStored);
  const choices = useMemo(
    () => [{ value: ALL_CHEFS, label: t('chefFilter.all') }, ...chefChoices(menu)],
    [menu, t],
  );
  const wanted = stored ?? (lastSignedIn()?.chefId ? `chef-${lastSignedIn()?.chefId}` : null);
  const filter = choices.some((choice) => choice.value === wanted)
    ? (wanted ?? ALL_CHEFS)
    : ALL_CHEFS;
  const setFilter = useCallback((next: ChefFilter) => {
    setStored(next);
    writeStored(next);
  }, []);
  return { filter, setFilter, choices };
}

const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Label = styled.label`
  color: ${({ theme }) => theme.c.muted};
`;
const Muted = styled.span`
  color: ${({ theme }) => theme.c.muted};
`;
const Pick = styled.select`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
`;

/** Hidden when the kitchen has no chefs (only "All" is left). */
export function ChefFilterControl({
  filter,
  setFilter,
  choices,
}: Readonly<ReturnType<typeof useChefFilter>>) {
  const { t } = useTranslation(COOK_NS);
  const onSelect = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => setFilter(event.target.value),
    [setFilter],
  );
  if (choices.length < 2) return null;
  if (choices.length <= SEGMENTED_MAX) {
    const options: ReadonlyArray<SegmentedOption<ChefFilter>> = choices;
    return (
      <Wrap>
        <Muted>{t('chefFilter.label')}</Muted>
        <Segmented
          compact
          options={options}
          value={filter}
          onChange={setFilter}
          label={t('chefFilter.label')}
        />
      </Wrap>
    );
  }
  return (
    <Wrap>
      <Label htmlFor="cook-chef-filter">{t('chefFilter.label')}</Label>
      <Pick id="cook-chef-filter" value={filter} onChange={onSelect}>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </Pick>
    </Wrap>
  );
}
