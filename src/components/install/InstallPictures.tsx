import { useTranslation } from 'react-i18next';
import type { ScreenId } from './flow';
import { INSTALL_NS } from './i18n/register';
import { InstallIcon } from './installIcons';
import {
  Arrow,
  BigButton,
  MenuCard,
  Panel,
  Ring,
  Sheet,
  SheetHead,
  SheetRow,
  Tile,
  Toggle,
} from './installStyles';

// The pictures in the install steps (moved out of InstallScreens).
/** The kitchen's icon, or its initials on the kitchen's colour. */
export function AppTile({
  name,
  src,
  size,
}: Readonly<{ name: string; src?: string | undefined; size: string }>) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return (
    <Tile $size={size} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials}
    </Tile>
  );
}

function Pointer({ label }: Readonly<{ label: string }>) {
  return (
    <Arrow viewBox="0 0 48 64" role="img" aria-label={label}>
      <path d="M8 4c4 24 16 38 30 52M28 54l10 4 2-12" />
    </Arrow>
  );
}

type PictureProps = Readonly<{ name: string; src?: string | undefined; code?: string | undefined }>;

export function StepPicture({ screen, name, src, code }: PictureProps & { screen: ScreenId }) {
  const { t } = useTranslation(INSTALL_NS);
  switch (screen) {
    case 'ios-step-1':
      return (
        <Panel>
          <BigButton aria-hidden="true">
            <i />
            <i />
            <i />
          </BigButton>
          <Pointer label={t('step1.pointer')} />
        </Panel>
      );
    case 'ios-step-2':
      return (
        <Panel aria-hidden="true">
          <MenuCard>
            <SheetRow $on>
              {t('pictures.share')}
              <InstallIcon name="share" />
            </SheetRow>
            <SheetRow>Bookmarks</SheetRow>
            <SheetRow>New Tab</SheetRow>
            <SheetRow>Reload</SheetRow>
          </MenuCard>
        </Panel>
      );
    case 'ios-step-3':
      return (
        <Panel aria-hidden="true">
          <Sheet>
            <SheetHead>
              <AppTile name={name} src={src} size="2.5rem" />
              <div>
                <b>{name}</b>
                <small>{window.location.host}</small>
              </div>
            </SheetHead>
            <SheetRow>{t('pictures.copy')}</SheetRow>
            <SheetRow>{t('pictures.readingList')}</SheetRow>
            <SheetRow $on>{t('pictures.addHome')}</SheetRow>
            <SheetRow>{t('pictures.findOnPage')}</SheetRow>
          </Sheet>
        </Panel>
      );
    case 'ios-step-4':
      return (
        <Panel aria-hidden="true">
          <Sheet>
            <SheetRow>
              <span>{t('pictures.cancel')}</span>
              <b>{t('pictures.addHome')}</b>
              <Ring>
                <b>&nbsp;{t('pictures.add')}&nbsp;</b>
              </Ring>
            </SheetRow>
            <SheetHead>
              <AppTile name={name} src={src} size="3.5rem" />
              <div>
                <b>{name}</b>
                <small>{`${window.location.host}/o/${code ?? ''}`}</small>
              </div>
            </SheetHead>
            <SheetRow>
              {t('pictures.openAsApp')}
              <Toggle />
            </SheetRow>
          </Sheet>
        </Panel>
      );
    default:
      return null;
  }
}
