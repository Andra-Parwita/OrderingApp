import { useTranslation } from 'react-i18next';
import { RELEASE_VERSION } from '../../../shared/release';
import { BottomSheet } from '../../ui';
import { REMEMBER_NS } from './i18n/register';
import { Bullets, Heading, Text } from './parts';

// Plan 092: short headings with bullet lists (same facts as before). Keys are in the Remember me
// namespace: `<heading>H` and the bullets after it.
const SECTIONS: ReadonlyArray<{ heading: string; items: ReadonlyArray<string> }> = [
  { heading: 'privacyKeepH', items: ['privacyKeep1', 'privacyKeep2', 'privacyKeep3'] },
  { heading: 'privacyPhoneH', items: ['privacyPhone1', 'privacyPhone2', 'privacyPhone3'] },
  {
    heading: 'privacyAddrH',
    items: ['privacyAddr1', 'privacyAddr2', 'privacyAddr3', 'privacyAddr4'],
  },
  { heading: 'privacyNotifyH', items: ['privacyNotify1', 'privacyNotify2', 'privacyNotify3'] },
  { heading: 'privacyLongH', items: ['privacyLong1', 'privacyLong2'] },
  { heading: 'privacyFindH', items: ['privacyFind1'] },
  { heading: 'privacyRmH', items: ['rm1', 'rm2', 'rm3', 'rm4', 'rm5', 'rm6'] },
];

/** Customer Settings: "How we keep your data private" (a sheet, plan 087 / 092). */
export function PrivacyModal({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation();
  const { t: tr } = useTranslation(REMEMBER_NS);
  return (
    <BottomSheet title={tr('privacyTitle')} onClose={onClose}>
      {SECTIONS.map((section) => (
        <section key={section.heading}>
          <Heading>{tr(section.heading)}</Heading>
          <Bullets>
            {section.items.map((key) => (
              <li key={key}>{tr(key)}</li>
            ))}
          </Bullets>
        </section>
      ))}
      <Text>{tr('privacyWho', { app: t('app.name') })}</Text>
      <Text>{tr('privacyVersion', { version: RELEASE_VERSION })}</Text>
    </BottomSheet>
  );
}
