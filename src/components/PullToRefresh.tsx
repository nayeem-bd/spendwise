import { RefreshControl, type RefreshControlProps } from 'react-native';

/** Native: the platform's own pull-to-refresh. Web has its own version in PullToRefresh.web.tsx. */
export function PullToRefresh(props: RefreshControlProps) {
  return <RefreshControl {...props} />;
}
