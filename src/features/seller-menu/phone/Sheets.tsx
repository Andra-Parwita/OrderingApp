import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCookingDate, formatCutoff } from '../../../../shared/dates';
import type { Language } from '../../../../shared/domain';
import type { MenuView } from '../../../../shared/menusContract';
import { BottomSheet, Button, Icon } from '../../../ui';
import { PHONE_MENU_NS } from './i18n/register';

// Plan 124 (Q2 A): the three sheets of the publish flow on the phone.

const Help = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
`;
const Fact = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  span:first-child {
    color: ${({ theme }) => theme.c.muted};
  }
  span:last-child {
    text-align: right;
  }
`;
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;
const Problem = styled.p`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  color: ${({ theme }) => theme.c.danger};
`;

export function PublishSheet({
  view,
  lang,
  busy,
  error,
  onPublish,
  onClose,
}: Readonly<{
  view: MenuView;
  lang: Language;
  busy: boolean;
  error: 'generic' | 'conflict' | null;
  onPublish: () => void;
  onClose: () => void;
}>) {
  const { t } = useTranslation(PHONE_MENU_NS);
  const { menu, pickupPoints, dishes } = view;
  const how = [
    pickupPoints.length > 0 ? t('publish.places', { count: pickupPoints.length }) : null,
    menu.delivery.available ? t('publish.delivery') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <BottomSheet title={t('publish.title')} onClose={busy ? () => undefined : onClose}>
      <Help>{t('publish.help')}</Help>
      <Fact>
        <span>{t('publish.day')}</span>
        <span>{formatCookingDate(menu.cookingDate, lang)}</span>
      </Fact>
      <Fact>
        <span>{t('publish.closes')}</span>
        <span>{formatCutoff(menu.cutoffAt, lang)}</span>
      </Fact>
      <Fact>
        <span>{t('publish.how')}</span>
        <span>{how}</span>
      </Fact>
      <Fact>
        <span>{t('publish.dishes')}</span>
        <span>{dishes.filter((dish) => dish.groupId === undefined).length}</span>
      </Fact>
      {error ? (
        <Problem role="alert">
          {t(error === 'conflict' ? 'publish.errorConflict' : 'publish.error')}
        </Problem>
      ) : null}
      <Stack>
        <Button variant="primary" fullWidth disabled={busy} onClick={onPublish}>
          {busy ? t('publish.publishing') : t('publish.confirm')}
        </Button>
        <Button variant="quiet" fullWidth disabled={busy} onClick={onClose}>
          {t('publish.cancel')}
        </Button>
      </Stack>
    </BottomSheet>
  );
}

export function LiveSheet({
  phones,
  onShare,
  onNotice,
  onClose,
}: Readonly<{
  /** Phones that get the notice; `null` hides the notice button (orders closed, or not the owner). */
  phones: number | null;
  onShare: () => void;
  onNotice: () => void;
  onClose: () => void;
}>) {
  const { t } = useTranslation(PHONE_MENU_NS);
  return (
    <BottomSheet title={t('live.title')} onClose={onClose}>
      <Help>{t('live.help')}</Help>
      <Stack>
        <Button variant="primary" fullWidth onClick={onShare}>
          <Icon name="chat" />
          {t('card.share')}
        </Button>
        {phones !== null ? (
          <Button fullWidth onClick={onNotice}>
            {t('live.notice', { count: phones })}
          </Button>
        ) : null}
        <Button variant="quiet" fullWidth onClick={onClose}>
          {t('live.done')}
        </Button>
      </Stack>
    </BottomSheet>
  );
}
