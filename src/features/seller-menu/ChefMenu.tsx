import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { MAX_MENU_ITEMS } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Button, Icon } from '../../ui';
import { DishCsvTools } from './DishCsvTools';
import { DishEditorHost, useDishEditor } from './DishEditorHost';
import { MENU_NS } from './i18n/register';
import {
  ErrorText,
  Head,
  Muted,
  Page,
  Section,
  SwitchButton,
  Title,
  useLang,
  useMenuData,
  useOpWatch,
  useRunOp,
} from './menuShared';

// Plan 030 stage 2: a chef's Menu is "Your dishes" only: their own dishes from the library, the
// ones on the current menu (with a sold out switch), New dish and the editor without the chef
// picker. Other chefs' dishes, publishing, details and the wizard are the owner's.

const Row = styled.div<{ $off?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5rem 9rem 3rem;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowCompact + 8}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ $off, theme }) => ($off ? theme.c.muted : theme.c.text)};
  font-variant-numeric: tabular-nums;

  .name {
    font-weight: 600;
  }
  .sub {
    display: block;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
    font-weight: 400;
  }
  .num {
    text-align: right;
  }

  /* Phone: name, price, pencil; the menu status or Add to menu sits on a line of its own. */
  @media (max-width: 37.4375rem) {
    grid-template-columns: minmax(0, 1fr) auto 3rem;
    padding: ${({ theme }) => theme.spacing.sm} 0;

    > span:nth-child(3) {
      grid-column: 1 / 3;
      grid-row: 2;
    }
  }
`;
const Pencil = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.muted};
  cursor: pointer;
`;

export function ChefMenu({ chefId }: Readonly<{ chefId: string }>) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const { data, status } = useMenuData();
  const { run, busy } = useRunOp();
  const editor = useDishEditor();
  const [refused, setRefused] = useState<string | null>(null);
  useOpWatch(['addDishToMenu'], {
    onDone: () => setRefused(null),
    onFail: (result) =>
      setRefused(result.code === 'forbidden' ? t('chef.ownerOnly') : t('genericError')),
  });
  if (!data) {
    return (
      <Page>
        <Head>
          <Title>{t('title')}</Title>
        </Head>
        {status}
      </Page>
    );
  }
  const mine = data.dishes.filter((dish) => dish.chefId === chefId);
  const menuOpen = data.view.menu.state !== 'finished';
  const menuFull =
    data.view.dishes.filter((item) => item.groupId === undefined).length >= MAX_MENU_ITEMS;
  const onMenu = menuOpen
    ? data.view.dishes.filter((item) => item.chefId === chefId && item.groupId === undefined)
    : [];
  return (
    <Page>
      <Head>
        <Title>{t('chef.title')}</Title>
        <Button variant="primary" onClick={() => editor.open('new')}>
          <Icon name="plus" />
          {t('dishes.newDish')}
        </Button>
      </Head>
      <Section>
        <Muted style={{ marginBottom: '1rem' }}>{t('chef.help')}</Muted>
        <DishCsvTools dishes={mine} chefs={data.chefs.filter((chef) => chef.id === chefId)} />
        {refused ? <ErrorText role="alert">{refused}</ErrorText> : null}
        {mine.length === 0 ? <Muted>{t('dishes.noneYet')}</Muted> : null}
        {mine.map((dish) => {
          const name = pickText(dish.name, lang);
          const size = pickText(dish.size, lang);
          const item = onMenu.find((candidate) => candidate.dishId === dish.id);
          const itemName = item ? pickText(item.name, lang) : name;
          return (
            <Row key={dish.id} $off={item?.manualSoldOut === true}>
              <span className="name">
                {itemName}
                {size ? <span className="sub">{size}</span> : null}
              </span>
              <span className="num">{formatMoney(item?.priceCents ?? dish.priceCents, lang)}</span>
              <span>
                {item ? (
                  <SwitchButton
                    type="button"
                    role="switch"
                    aria-checked={item.manualSoldOut === true}
                    aria-label={t('live.soldOutFor', { name: itemName })}
                    $on={item.manualSoldOut === true}
                    disabled={busy}
                    onClick={() =>
                      run({
                        kind: 'updateMenuDish',
                        id: item.id,
                        request: { soldOut: item.manualSoldOut !== true },
                      })
                    }
                  >
                    <i />
                    <span>{item.manualSoldOut === true ? t('live.yes') : t('live.no')}</span>
                  </SwitchButton>
                ) : menuOpen && !menuFull ? (
                  <Button
                    disabled={busy}
                    aria-label={t('chef.addToMenuFor', { name })}
                    onClick={() => run({ kind: 'addDishToMenu', dishId: dish.id })}
                  >
                    {t('chef.addToMenu')}
                  </Button>
                ) : (
                  <Muted as="span">{t('chef.notOnMenu')}</Muted>
                )}
              </span>
              <Pencil
                type="button"
                aria-label={t('dishes.edit', { name: itemName })}
                onClick={() => editor.open(item ? { itemId: item.id } : { dishId: dish.id })}
              >
                <Icon name="pencil" />
              </Pencil>
            </Row>
          );
        })}
      </Section>
      <DishEditorHost data={data} value={editor.value} onClose={editor.close} asChef />
    </Page>
  );
}
