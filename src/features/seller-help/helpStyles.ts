import { styled } from 'styled-components';
import { brandColour, brandHelp, brandPill } from '../../theme/brandTokens';
import { SCREEN_HEIGHT, SCREEN_HEIGHT_VH } from '../../theme/screen';

// Plan 058, D-095: the Help page frame and the brand band (moved out of HelpScreen).
export const Page = styled.div<{ $split: boolean; $embedded: boolean }>`
  ${({ $embedded, $split }) =>
    $embedded
      ? `display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: ${$split ? 'hidden' : 'auto'};`
      : `min-height: ${SCREEN_HEIGHT_VH};
  min-height: ${SCREEN_HEIGHT};
  ${
    $split
      ? `display: flex;
  flex-direction: column;
  height: ${SCREEN_HEIGHT_VH};
  height: ${SCREEN_HEIGHT};
  overflow: hidden;`
      : ''
  }`}
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
  font-family: ${({ theme }) => theme.font.ui};
  line-height: ${({ theme }) => theme.type.lineHeight.normal};

  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  :focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: ${({ theme }) => theme.border.focus};
    border-radius: ${({ theme }) => theme.radius.md};
  }
`;
// Inside the seller app (plan 079) there is no brand band: a slim title row with Print.
export const EmbeddedHead = styled.header`
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  box-sizing: border-box;
  max-width: 73.75rem;
  width: 100%;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl} 0;

  h1 {
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.lg};
  }
  @media (max-width: 51.25rem) {
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg} 0;
  }
  @media print {
    padding-top: 0;
  }
`;
export const Band = styled.header`
  position: relative;
  flex: none;
  height: 9.375rem;
  overflow: hidden;
  background: ${brandColour.beige};
  color: ${brandColour.ink};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${brandPill.light.border};

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: ${brandHelp.fade};
  }
  @media (max-width: 51.25rem) {
    height: 8rem;
  }
  @media print {
    height: auto;
    background: none;
    border: 0;
  }
`;
export const Scene = styled.img`
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(100%, 26.25rem);
  aspect-ratio: 3 / 5;
  transform: translate(-50%, -50%);
  opacity: ${brandHelp.sceneOpacity};

  @media print {
    display: none;
  }
`;
export const BandIn = styled.div`
  position: relative;
  z-index: 3;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  max-width: 73.75rem;
  height: 100%;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing.xl};

  @media (max-width: 51.25rem) {
    flex-wrap: wrap;
    align-content: center;
    gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }
`;
export const Heading = styled.div`
  flex: 1;
  min-width: 0;

  h1 {
    margin: 0;
    font-size: 1.375rem;
    line-height: ${({ theme }) => theme.type.lineHeight.tight};
    letter-spacing: -0.01em;
  }
  p {
    margin: 0.125rem 0 0;
    font-size: 0.875rem;
  }
  @media (max-width: 51.25rem) {
    flex-basis: 100%;
    order: 3;
    padding-right: 6rem;

    h1 {
      font-size: ${({ theme }) => theme.type.size.lg};
    }
    p {
      display: none;
    }
  }
`;
export const Logo = styled.div`
  @media (max-width: 51.25rem) {
    order: 1;
  }
`;
export const Tools = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};

  @media (max-width: 51.25rem) {
    order: 2;
    margin-left: auto;
  }
  @media print {
    display: none;
  }
`;
export const Switch = styled.div`
  display: inline-flex;
  overflow: hidden;
  border: ${({ theme }) => theme.border.hairline} solid ${brandColour.ink};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${brandPill.light.bg};
`;
export const SwitchButton = styled.button`
  min-height: 2.25rem;
  padding: 0.375rem 0.875rem;
  border: 0;
  background: transparent;
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};

  &[aria-pressed='true'] {
    background: ${brandColour.ink};
    color: ${brandColour.beige};
  }
`;
export const PrintButton = styled.button`
  min-height: 2.25rem;
  padding: 0.375rem 0.875rem;
  border: ${({ theme }) => theme.border.hairline} solid ${brandColour.ink};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${brandPill.light.bg};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
// Inside the seller app the button follows the theme (light and dark), not the brand beige pill.
export const EmbeddedPrint = styled(PrintButton)`
  border-color: ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.text};
`;
export const MascotBox = styled.div`
  position: absolute;
  right: max(12.5rem, calc(50% - 24.375rem));
  bottom: 0;
  z-index: 1;
  width: 11.875rem;

  @media (max-width: 51.25rem) {
    right: ${({ theme }) => theme.spacing.md};
    width: 6rem;
  }
  @media print {
    display: none;
  }
`;
