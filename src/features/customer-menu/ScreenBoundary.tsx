import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CUSTOMER_NS } from './i18n/register';
import { StateMessage } from './layout';

function Fallback({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const { t } = useTranslation(CUSTOMER_NS);
  return <StateMessage alert text={t('common.errorBody')} onRetry={onRetry} />;
}

type Props = Readonly<{ children: ReactNode }>;
type State = Readonly<{ failed: boolean }>;

/** One per screen: a render error shows a retry instead of a blank page. */
export class ScreenBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Customer screen crashed', error, info.componentStack);
  }

  private readonly retry = () => this.setState({ failed: false });

  override render(): ReactNode {
    return this.state.failed ? <Fallback onRetry={this.retry} /> : this.props.children;
  }
}
