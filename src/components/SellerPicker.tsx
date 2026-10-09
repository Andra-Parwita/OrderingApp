import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Seller } from '../../shared/domain';
import { fetchDevSellers } from '../api/client';
import { useDevTools } from '../api/devTools';
import { chooseSeller, currentSellerSlug } from '../api/device/sellerContext';

const Dev = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const Caption = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Wrap = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Select = styled.select`
  box-sizing: border-box;
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.bg};
  color: ${({ theme }) => theme.colour.text};
  font: inherit;
`;

/** Switching seller reloads the page, so every list, setting and image is that seller's. */
function reload() {
  window.location.reload();
}

/**
 * Dev only: which seller the seller screens act for without signing in. Shown only when the server
 * runs with DEV_TOOLS; production never shows it (the seller then comes from the session).
 */
export function SellerPicker({ onChosen = reload }: Readonly<{ onChosen?: () => void }>) {
  const { t } = useTranslation();
  const [sellers, setSellers] = useState<ReadonlyArray<Seller>>([]);
  const [current, setCurrent] = useState(currentSellerSlug);
  const devTools = useDevTools();

  useEffect(() => {
    if (devTools !== true) return undefined;
    let live = true;
    void fetchDevSellers().then((result) => {
      if (live && result.ok) setSellers(result.data.sellers);
    });
    return () => {
      live = false;
    };
  }, [devTools]);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      chooseSeller(event.target.value);
      setCurrent(event.target.value);
      onChosen();
    },
    [onChosen],
  );

  if (devTools !== true || sellers.length === 0) return null;
  return (
    <Dev>
      <Caption>{t('sellerNav.devNoSignIn')}</Caption>
      <Wrap>
        {t('sellerNav.devSeller')}
        <Select value={current} onChange={onChange}>
          {sellers.map((seller) => (
            <option key={seller.slug} value={seller.slug}>
              {seller.name}
            </option>
          ))}
        </Select>
      </Wrap>
    </Dev>
  );
}
