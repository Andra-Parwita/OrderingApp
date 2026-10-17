import { styled } from 'styled-components';
import { Icon } from '../ui';

// Plan 081: Directions and Map as small muted text links with an icon (no button box), so they never
// look like a status control. They only open the maps app or a browser tab.

const Row = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: 0 ${({ theme }) => theme.spacing.lg};
`;
const Link = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: 2.5rem;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
  text-decoration: none;

  svg {
    width: 1rem;
    height: 1rem;
  }
  &:hover {
    color: ${({ theme }) => theme.c.text};
  }
`;

type MapLinkSpec = Readonly<{ href: string; label: string; aria?: string }>;

export function QuietMapLinks({
  directions,
  map,
}: Readonly<{ directions?: MapLinkSpec; map: MapLinkSpec }>) {
  return (
    <Row>
      {directions ? (
        <Link
          href={directions.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={directions.aria}
        >
          <Icon name="navigation" />
          {directions.label}
        </Link>
      ) : null}
      <Link href={map.href} target="_blank" rel="noopener noreferrer" aria-label={map.aria}>
        <Icon name="pin" />
        {map.label}
      </Link>
    </Row>
  );
}
