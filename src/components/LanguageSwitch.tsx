import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '../../shared/domain';
import { Segmented, type SegmentedOption } from '../ui';

const LANG_OPTIONS: ReadonlyArray<SegmentedOption<Language>> = [
  { value: 'en', label: 'EN' },
  { value: 'id', label: 'ID' },
];

/** The one EN / ID switch, used by every customer and seller screen. */
export function LanguageSwitch({ compact = false }: Readonly<{ compact?: boolean }>) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language.startsWith('id') ? 'id' : 'en';
  const onChange = useCallback((next: Language) => void i18n.changeLanguage(next), [i18n]);
  return (
    <Segmented
      options={LANG_OPTIONS}
      value={lang}
      onChange={onChange}
      label={t('language.label')}
      compact={compact}
    />
  );
}
