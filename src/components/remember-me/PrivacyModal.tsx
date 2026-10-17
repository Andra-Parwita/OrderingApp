import { useTranslation } from 'react-i18next';
import { RELEASE_VERSION } from '../../../shared/release';
import { BottomSheet } from '../../ui';
import { REMEMBER_NS } from './i18n/register';
import { Heading, Text } from './parts';

const TODAY = [
  'aboutKeep',
  'aboutNever',
  'aboutDevice',
  'aboutNotify',
  'aboutHow',
  'aboutFind',
  'aboutNo',
] as const;
const REMEMBER = ['rm1', 'rm2', 'rm3', 'rm4', 'rm5', 'rm6'] as const;

/** Customer Settings: "How we keep your data private" (a modal, plan 087) with today's rules and Remember me. */
export function PrivacyModal({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation();
  const { t: tr } = useTranslation(REMEMBER_NS);
  return (
    <BottomSheet title={tr('privacyTitle')} onClose={onClose}>
      {TODAY.map((key) => (
        <Text key={key}>{t(`customerSettings.${key}`)}</Text>
      ))}
      <Heading>{tr('privacyRmH')}</Heading>
      <Text>{tr('passkeyMore')}</Text>
      {REMEMBER.map((key) => (
        <Text key={key}>{tr(key)}</Text>
      ))}
      <Text>{t('customerSettings.aboutWho', { app: t('app.name') })}</Text>
      <Text>{t('customerSettings.aboutVersion', { version: RELEASE_VERSION })}</Text>
    </BottomSheet>
  );
}
