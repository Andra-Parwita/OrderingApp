import styled from 'styled-components';
import { viewedKitchenZone, zonesDiffer } from '../../shared/zone';

// Plan 077: a small muted word next to a time, only when the device's zone is not the kitchen's
// ("your time"), so a customer who travels is not confused. Text only, nothing when the zones match.
const Note = styled.small`
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: normal;
`;

type Props = Readonly<{
  /** The translated "your time". */
  label: string;
  /** The kitchen's zone; absent = the kitchen on screen. */
  kitchenZone?: string;
}>;

export function YourTime({ label, kitchenZone }: Props) {
  if (!zonesDiffer(kitchenZone ?? viewedKitchenZone())) return null;
  return <Note data-testid="your-time"> {label}</Note>;
}
