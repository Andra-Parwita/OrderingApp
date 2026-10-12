import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Kitchen, Language } from '../../../shared/domain';
import { markLanguageChosen } from '../../i18n/chosenLanguage';
import { setThemePreference, useThemePreference } from '../../theme/themePreference';
import { CustomerSettingsView } from './CustomerSettingsView';

/** The customer's Settings tab: language, appearance, order updates and the home-screen card. */
/** `showLanguage` is false for a kitchen that offers one language (plan 056). */
export function CustomerSettingsScreen({
  showLanguage = true,
  kitchen,
}: Readonly<{ showLanguage?: boolean; kitchen?: Kitchen }>) {
  const { i18n } = useTranslation();
  const theme = useThemePreference();
  const lang: Language = i18n.language.startsWith('id') ? 'id' : 'en';
  const onLang = useCallback(
    (next: Language) => {
      markLanguageChosen();
      void i18n.changeLanguage(next);
    },
    [i18n],
  );
  return (
    <CustomerSettingsView
      lang={lang}
      onLang={onLang}
      theme={theme}
      onTheme={setThemePreference}
      showLanguage={showLanguage}
      kitchen={kitchen}
    />
  );
}
