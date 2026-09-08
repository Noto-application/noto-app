import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

// React не даёт хукового способа ловить ошибки рендера детей — только
// componentDidCatch/getDerivedStateFromError, отсюда class, а не function.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Ошибка в дереве компонентов', error, errorInfo);
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
