import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router';
import { styled } from 'styled-components';
import { Toast } from '../../ui';
import { SETTINGS_NS } from './i18n/register';
import { KitchenPane, PostPane } from './KitchenPanes';
import { PANE_IDS, SECOND_GROUP, paneHref, type PaneId } from './panes';
import { PickupPane } from './PickupPane';
import { AppearancePane, DefaultsPane } from './PreferencePanes';
import { toastDismissed, type SettingsRootState } from './settingsSlice';

const Page = styled.div`
  display: flex;
  flex-direction: column;
`;
const Title = styled.h1`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.size.pagePadTablet}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-size: ${({ theme }) => theme.type.size.xl};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
  align-items: start;

  @media (max-width: 40rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
const List = styled.nav`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.md};
  border-right: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Divider = styled.hr`
  width: 100%;
  margin: ${({ theme }) => theme.spacing.sm} 0;
  border: 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const PaneLink = styled(Link)<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme, $active }) => ($active ? theme.c.tint : 'transparent')};
  color: ${({ theme, $active }) => ($active ? theme.c.atext : theme.c.text)};
  text-decoration: none;

  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;
const PaneName = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const PaneSub = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.c.muted};
`;
const Content = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  min-width: 0;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  max-width: 64rem;

  /* The embedded screens bring their own page frame; here the pane is the frame. */
  main {
    min-height: 0;
    max-width: none;
    margin: 0;
    padding: 0;
  }
  main > div {
    padding-left: 0;
    padding-right: 0;
  }
`;
const PaneTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;

type Props = Readonly<{
  pane: PaneId;
  /** The Devices screen, made by the app (it needs the session to sign this device out). */
  devices: ReactNode;
  /** The other panes' screens, made by the app (a feature may not import another feature). */
  images: ReactNode;
  chefs: ReactNode;
  backup: ReactNode;
}>;

/** Settings (owner, tablet): a list of panes on the left and the open pane beside it. */
export function SettingsPanes({ pane, devices, images, chefs, backup }: Props) {
  const { t } = useTranslation(SETTINGS_NS);
  const dispatch = useDispatch();
  const sliceToast = useSelector((state: SettingsRootState) => state.sellerSettings.toast);
  // The pane the "saved" toast belongs to: leaving that pane hides it.
  const [flashPane, setFlashPane] = useState<PaneId | null>(null);
  const flash = flashPane === pane;
  const flashSaved = useCallback(() => setFlashPane(pane), [pane]);
  const dismiss = useCallback(() => {
    dispatch(toastDismissed());
    setFlashPane(null);
  }, [dispatch]);

  const content: Record<PaneId, ReactNode> = {
    kitchen: <KitchenPane images={images} />,
    post: <PostPane />,
    pickup: <PickupPane />,
    defaults: <DefaultsPane onToast={flashSaved} />,
    look: <AppearancePane onToast={flashSaved} />,
    chefs,
    devices,
    backup,
  };
  const link = (id: PaneId) => (
    <PaneLink
      key={id}
      to={paneHref(id)}
      $active={id === pane}
      aria-current={id === pane ? 'page' : undefined}
    >
      <PaneName>{t(`panes.${id}.title`)}</PaneName>
      <PaneSub>{t(`panes.${id}.sub`)}</PaneSub>
    </PaneLink>
  );

  return (
    <Page>
      <Title>{t('title')}</Title>
      <Layout>
        <List aria-label={t('panes.nav')}>
          {PANE_IDS.filter((id) => !SECOND_GROUP.includes(id)).map(link)}
          <Divider />
          {SECOND_GROUP.map(link)}
        </List>
        <Content>
          <PaneTitle>{t(`panes.${pane}.title`)}</PaneTitle>
          {content[pane]}
        </Content>
      </Layout>
      <Toast message={sliceToast || flash ? t('saved') : null} onDismiss={dismiss} />
    </Page>
  );
}
