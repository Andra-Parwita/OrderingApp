import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCookingDate } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { Button, Icon, WarningDialog } from '../../ui';
import type { MenuSlots } from './slots';
import { MENU_NS } from './i18n/register';
import { ErrorText, Muted, useOpWatch, useRunOp } from './menuShared';
import type { MenuData } from './menuSlice';
import { worries } from './worry';

// Step 4: Publish menu, then the post to share. An empty menu is a warning with a way ahead, not
// a block (D-062).

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  max-width: 40rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;

  h2 {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin: 0;
    font-size: 1.375rem;
  }
`;

export function PublishStep({
  data,
  lang,
  onGoToOrders,
  renderShare,
}: Readonly<{
  data: MenuData;
  lang: Language;
  onGoToOrders: () => void;
  renderShare: MenuSlots['share'];
}>) {
  const { t } = useTranslation(MENU_NS);
  const { run, busy } = useRunOp();
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const { menu, dishes } = data.view;
  useOpWatch(['publish'], {
    onDone: () => {
      setFailed(false);
      setAsking(false);
    },
    onFail: (result) => {
      if (result.warning?.code === 'no_dishes') setAsking(true);
      else setFailed(true);
    },
  });
  if (menu.state === 'live') {
    return (
      <Wrap>
        <h2>
          <Icon name="check" />
          {t('publish.live')}
        </h2>
        <Muted>{t('publish.liveHelp', { date: formatCookingDate(menu.cookingDate, lang) })}</Muted>
        {renderShare({ onGoToOrders })}
      </Wrap>
    );
  }
  const count = worries(data.view, new Date()).length;
  return (
    <Wrap>
      <h2>{t('publish.ready')}</h2>
      <Muted>
        {t('publish.summary', {
          dishes: dishes.length,
          date: formatCookingDate(menu.cookingDate, lang),
        })}
      </Muted>
      {count > 0 ? <Muted>{t('publish.worries', { count })}</Muted> : null}
      <div>
        <Button variant="primary" disabled={busy} onClick={() => run({ kind: 'publish' })}>
          {t('publish.button')}
        </Button>
      </div>
      <Muted>{t('publish.after')}</Muted>
      {failed ? <ErrorText role="alert">{t('genericError')}</ErrorText> : null}
      {asking ? (
        <WarningDialog
          title={t('publish.emptyTitle')}
          cancelLabel={t('publish.addDishes')}
          continueLabel={t('publish.emptyAnyway')}
          onCancel={() => setAsking(false)}
          onContinue={() => {
            setAsking(false);
            run({ kind: 'publish', force: true });
          }}
        >
          {t('publish.emptyBody')}
        </WarningDialog>
      ) : null}
    </Wrap>
  );
}
