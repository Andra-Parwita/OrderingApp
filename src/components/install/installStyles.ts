import { styled } from 'styled-components';
import { SCREEN_HEIGHT } from '../../theme/screen';

// The install screens' styled parts (moved out of InstallScreens).
export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  overflow-y: auto;
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
`;
export const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  box-sizing: border-box;
  max-width: 30rem;
  min-height: ${SCREEN_HEIGHT};
  margin: 0 auto;
  padding: calc(var(--sat) + ${({ theme }) => theme.spacing.lg}) ${({ theme }) => theme.spacing.lg}
    calc(var(--sab) + ${({ theme }) => theme.spacing.lg});
`;
export const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.tap}px;
  color: ${({ theme }) => theme.c.muted};
`;
export const IconOnly = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  margin-right: -${({ theme }) => theme.spacing.sm};
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.text};
  cursor: pointer;
`;
export const BackLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.size.tap}px;
  margin-left: -${({ theme }) => theme.spacing.xs};
  padding: 0 ${({ theme }) => theme.spacing.sm} 0 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;
export const Dots = styled.ol`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: ${({ theme }) => theme.radius.pill};
    background: ${({ theme }) => theme.c.line};
  }
  li[aria-current='step'] {
    width: 1.5rem;
    background: ${({ theme }) => theme.c.fill};
  }
`;
export const Eyebrow = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.atext};
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: 700;
`;
export const Heading = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
  line-height: 1.2;
  font-weight: 700;

  &:focus {
    outline: none;
  }
`;
export const Lead = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.base};
`;
export const Small = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
export const Note = styled.p`
  margin: 0;
  text-align: center;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
export const Disc = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.atext};
`;
export const WarnDisc = styled(Disc)`
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.warn};
`;
export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;
export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: auto;
`;
export const Primary = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-height: 3.25rem;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
`;
export const TextButton = styled.button<{ $quiet?: boolean }>`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  background: none;
  color: ${({ theme, $quiet }) => ($quiet ? theme.c.muted : theme.c.atext)};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;
export const Numbered = styled.ol`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: step;

  li {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    counter-increment: step;
    font-size: ${({ theme }) => theme.type.size.base};
  }
  li::before {
    content: counter(step);
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.c.line};
    color: ${({ theme }) => theme.c.atext};
    font-size: ${({ theme }) => theme.type.size.md};
    font-weight: 700;
  }
  b {
    font-weight: 700;
  }
`;

// ---- Pictures (illustrations of the phone's own screens; not real controls) ----

export const Panel = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 14rem;
  overflow: hidden;
  border-radius: 1.25rem;
  background: ${({ theme }) => theme.c.surf2};
`;
export const Ring = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.warn};
  border-radius: 1rem;
`;
export const BigButton = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 8.5rem;
  height: 8.5rem;
  border: 1rem solid ${({ theme }) => theme.c.line};
  border-radius: 50%;
  background: ${({ theme }) => theme.c.surf};

  i {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.c.text};
  }
`;
export const Arrow = styled.svg`
  position: absolute;
  right: 2rem;
  bottom: 1rem;
  width: 3rem;
  height: 4rem;
  fill: none;
  stroke: ${({ theme }) => theme.c.warn};
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
`;
export const Sheet = styled.div`
  align-self: flex-start;
  width: 100%;
  margin: 1.25rem 1rem 0;
  overflow: hidden;
  border-radius: 1rem 1rem 0 0;
  background: ${({ theme }) => theme.c.surf};
  box-shadow: 0 0.25rem 1rem ${({ theme }) => theme.colour.scrim};
`;
export const MenuCard = styled(Sheet)`
  align-self: flex-start;
  width: 62%;
  margin: 1.25rem 1rem 0 auto;
  border-radius: 1rem;
`;
export const SheetRow = styled.div<{ $on?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0.75rem 1rem;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-weight: ${({ $on }) => ($on ? 700 : 400)};
  box-shadow: ${({ $on, theme }) =>
    $on ? `inset 0 0 0 ${theme.border.focus} ${theme.c.warn}` : 'none'};
`;
export const SheetHead = styled(SheetRow)`
  justify-content: flex-start;
  font-weight: 400;

  div {
    display: flex;
    flex-direction: column;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
  }
  b {
    font-weight: 700;
  }
`;
export const Tile = styled.span<{ $size: string }>`
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: ${({ $size }) => $size};
  height: ${({ $size }) => $size};
  border-radius: 22%;
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font-weight: 700;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;
export const Toggle = styled.span`
  position: relative;
  flex: none;
  width: 3rem;
  height: 1.75rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.fill};

  &::after {
    content: '';
    position: absolute;
    top: 0.125rem;
    right: 0.125rem;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.c.on};
  }
`;
export const DarkPanel = styled(Panel)`
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 1.25rem;
  padding: 1.5rem;
  background: ${({ theme }) => theme.c.text};
  color: ${({ theme }) => theme.c.bg};
`;
export const Notification = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: 1.25rem;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font-size: ${({ theme }) => theme.type.size.md};

  div {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }
  b {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.sm};
    font-weight: 400;
  }
`;
export const HomeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  justify-items: center;

  > span {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 22%;
    background: ${({ theme }) => theme.c.muted};
    opacity: 0.5;
  }
  figcaption {
    white-space: nowrap;
  }
  figure {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.sm};
  }
`;
