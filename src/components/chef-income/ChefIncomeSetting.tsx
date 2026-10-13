import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchPreferences } from '../../api/menus';
import { updatePreferences } from '../../api/settings';
import { INCOME_NS, registerChefIncomeI18n } from './i18n/register';

// Plan 069: Settings → Team (owners): may chefs see their own income? On by default.

const Row = styled.label`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  font-weight: 600;

  input {
    margin-top: 0.25rem;
  }
  small {
    display: block;
    color: ${({ theme }) => theme.colour.textMuted};
    font-weight: 400;
  }
`;
const Failure = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.danger};
`;

export function ChefIncomeSetting() {
  registerChefIncomeI18n();
  const { t } = useTranslation(INCOME_NS);
  const slug = currentSellerSlug();
  const [on, setOn] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void fetchPreferences(undefined, slug).then((result) => {
      if (live && result.ok) setOn(result.data.preferences.chefsSeeIncome !== false);
    });
    return () => {
      live = false;
    };
  }, [slug]);
  if (on === null) return null;
  const change = async (next: boolean) => {
    setFailed(false);
    setOn(next);
    const result = await updatePreferences({ chefsSeeIncome: next }, undefined, slug);
    if (!result.ok) {
      setOn(!next);
      setFailed(true);
    }
  };
  return (
    <>
      <Row>
        <input
          type="checkbox"
          checked={on}
          onChange={(event) => void change(event.target.checked)}
        />
        <span>
          {t('settingTitle')}
          <small>{t('settingHint')}</small>
        </span>
      </Row>
      {failed ? <Failure role="alert">{t('settingFailed')}</Failure> : null}
    </>
  );
}
