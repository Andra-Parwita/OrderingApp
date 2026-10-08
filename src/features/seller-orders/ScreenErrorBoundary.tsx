import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button } from '../../ui';
import { SELLER_NS } from './i18n/register';

const Box = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
`;

function Fallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation(SELLER_NS);
  return (
    <Box role="alert">
      <span>{t('error.screen')}</span>
      <Button onClick={onRetry}>{t('error.retry')}</Button>
    </Box>
  );
}

type State = { failed: boolean };

export class ScreenErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  private readonly retry = () => this.setState({ failed: false });

  override render() {
    return this.state.failed ? <Fallback onRetry={this.retry} /> : this.props.children;
  }
}
