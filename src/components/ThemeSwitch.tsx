import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from '../theme/themePreference';
import { Segmented, type SegmentedOption } from '../ui';

/** "Match device / Light / Dark", remembered on this device. */
export function ThemeSwitch() {
  const { t } = useTranslation();
  const preference = useThemePreference();
  const options = useMemo<Array<SegmentedOption<ThemePreference>>>(
    () => [
      { value: 'auto', label: t('theme.auto') },
      { value: 'light', label: t('theme.light') },
      { value: 'dark', label: t('theme.dark') },
    ],
    [t],
  );
  return (
    <Segmented
      options={options}
      value={preference}
      onChange={setThemePreference}
      label={t('theme.label')}
    />
  );
}
