import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { toggleBannerCollapsed, useBannerCollapsed } from '../../components/useBannerCollapsed';
import { SELLER_NS } from './i18n/register';
import { ChevronDownIcon } from './PhoneIcons';

// Plan 014: slides the order area up over the banner (and back). Expanded, the chevron points up
// (the area will rise); collapsed, it points down.
const Button = styled.button<{ $collapsed: boolean }>`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  padding: 0;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: 50%;
  background: transparent;
  color: ${({ theme }) => theme.c.muted};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.c.surf2};
    color: ${({ theme }) => theme.c.text};
  }
  svg {
    transform: rotate(${({ $collapsed }) => ($collapsed ? '0' : '180deg')});
    transition: transform ${({ theme }) => theme.motion.fast};
  }
`;

export function BannerToggle() {
  const { t } = useTranslation(SELLER_NS);
  const collapsed = useBannerCollapsed();
  return (
    <Button
      type="button"
      $collapsed={collapsed}
      aria-label={collapsed ? t('banner.show') : t('banner.collapse')}
      aria-expanded={!collapsed}
      onClick={toggleBannerCollapsed}
    >
      <ChevronDownIcon />
    </Button>
  );
}
