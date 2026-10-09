import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { formatDay } from '../../../shared/dates';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Button, Icon } from '../../ui';
import { DishEditorHost, useDishEditor } from './DishEditorHost';
import { MENU_NS } from './i18n/register';
import {
  Head,
  Muted,
  Page,
  Section,
  Title,
  Tools,
  useLang,
  useMenuData,
  useOpWatch,
  useRunOp,
} from './menuShared';

// Your dishes and Saved sets: reachable from the Menu header at all times.

const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 6rem 8rem 3rem;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowCompact + 8}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
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
const Card = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  strong {
    display: block;
  }
`;

function Back({ title }: Readonly<{ title: string }>) {
  const { t } = useTranslation(MENU_NS);
  const navigate = useNavigate();
  return (
    <Head>
      <Tools>
        <Button variant="quiet" onClick={() => void navigate('/seller/menu')}>
          <Icon name="back" />
          {t('back')}
        </Button>
        <Title>{title}</Title>
      </Tools>
    </Head>
  );
}

export function DishesScreen() {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const { data, status } = useMenuData();
  const editor = useDishEditor();
  return (
    <Page>
      <Back title={t('library.title')} />
      {!data ? (
        status
      ) : (
        <Section>
          <Tools style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
            <Muted>{t('library.help')}</Muted>
            <Button variant="primary" onClick={() => editor.open('new')}>
              <Icon name="plus" />
              {t('dishes.newDish')}
            </Button>
          </Tools>
          {data.dishes.length === 0 ? <Muted>{t('dishes.noneYet')}</Muted> : null}
          {data.dishes.map((dish) => {
            const name = pickText(dish.name, lang);
            const size = pickText(dish.size, lang);
            return (
              <Row key={dish.id}>
                <span className="name">
                  {name}
                  {size ? <span className="sub">{size}</span> : null}
                </span>
                <span className="num">{formatMoney(dish.priceCents, lang)}</span>
                <span className="num">
                  {dish.lastUsedAt ? formatDay(dish.lastUsedAt, lang) : '–'}
                </span>
                <Pencil
                  type="button"
                  aria-label={t('dishes.edit', { name })}
                  onClick={() => editor.open({ dishId: dish.id })}
                >
                  <Icon name="pencil" />
                </Pencil>
              </Row>
            );
          })}
        </Section>
      )}
      {data ? <DishEditorHost data={data} value={editor.value} onClose={editor.close} /> : null}
    </Page>
  );
}

export function SavedSetsScreen() {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const { data, status } = useMenuData();
  const { run, busy } = useRunOp();
  const [added, setAdded] = useState<string | null>(null);
  useOpWatch(['useSet'], {
    onDone: (result) => setAdded(t('sets.added', { count: result.added ?? 0 })),
    onFail: () => setAdded(t('sets.addFailed')),
  });
  const canAdd = data !== null && data.view.menu.state !== 'finished';
  return (
    <Page>
      <Back title={t('sets.title')} />
      {!data ? (
        status
      ) : (
        <Section>
          <Muted>{t('sets.help')}</Muted>
          {data.sets.length === 0 ? <Muted>{t('dishes.noSets')}</Muted> : null}
          {data.sets.map((set) => {
            const names = set.dishIds
              .map((id) => data.dishes.find((dish) => dish.id === id))
              .flatMap((dish) => (dish ? [pickText(dish.name, lang)] : []));
            return (
              <Card key={set.id}>
                <div>
                  <strong>{set.name}</strong>
                  <Muted>{names.join(' · ')}</Muted>
                </div>
                {canAdd ? (
                  <Button disabled={busy} onClick={() => run({ kind: 'useSet', setId: set.id })}>
                    {t('sets.use')}
                  </Button>
                ) : null}
              </Card>
            );
          })}
          {added ? <Muted role="status">{added}</Muted> : null}
        </Section>
      )}
    </Page>
  );
}
