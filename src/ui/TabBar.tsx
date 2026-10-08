import { memo } from 'react';
import { css, styled } from 'styled-components';

export type TabBarItem = Readonly<{
  id: string;
  label: string;
  href: string;
  /** Not available yet: shown inert, not a link. `hint` is read out with the label. */
  disabled?: boolean;
  hint?: string;
}>;

export type TabBarProps = Readonly<{
  items: ReadonlyArray<TabBarItem>;
  activeId: string;
  /** Accessible name of the navigation landmark. */
  label: string;
}>;

const List = styled.ul`
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;

const Item = styled.li`
  flex: 1;
`;

const tabStyle = css<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: ${({ theme }) => theme.minTapTarget};
  border-top: ${({ theme }) => theme.border.tab} solid
    ${({ theme, $active }) => ($active ? theme.colour.accent : 'transparent')};
  margin-top: -${({ theme }) => theme.border.hairline};
  color: ${({ theme, $active }) => ($active ? theme.colour.accent : theme.colour.textMuted)};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  text-decoration: none;

  &:focus-visible {
    outline-offset: -${({ theme }) => theme.border.focus};
  }
`;

const Tab = styled.a<{ $active: boolean }>`
  ${tabStyle}
`;

const Inert = styled.span<{ $active: boolean }>`
  ${tabStyle}
  opacity: 0.5;
`;

export const TabBar = memo(function TabBar({ items, activeId, label }: TabBarProps) {
  return (
    <nav aria-label={label}>
      <List>
        {items.map((item) => (
          <Item key={item.id}>
            {item.disabled ? (
              <Inert
                $active={false}
                role="link"
                aria-disabled="true"
                aria-label={item.hint ? `${item.label}, ${item.hint}` : item.label}
              >
                {item.label}
              </Inert>
            ) : (
              <Tab
                href={item.href}
                $active={item.id === activeId}
                aria-current={item.id === activeId ? 'page' : undefined}
              >
                {item.label}
              </Tab>
            )}
          </Item>
        ))}
      </List>
    </nav>
  );
});
