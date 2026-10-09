import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '../../../shared/domain';
import { setThemePreference, useThemePreference } from '../../theme/themePreference';
import { CustomerSettingsView } from './CustomerSettingsView';

/** The customer's Settings tab: language, appearance, order updates and the home-screen card. */
export function CustomerSettingsScreen() {
  const { i18n } = useTranslation();
  const theme = useThemePreference();
  const lang: Language = i18n.language.startsWith('id') ? 'id' : 'en';
  const onLang = useCallback((next: Language) => void i18n.changeLanguage(next), [i18n]);
  return (
    <CustomerSettingsView lang={lang} onLang={onLang} theme={theme} onTheme={setThemePreference} />
  );
}
