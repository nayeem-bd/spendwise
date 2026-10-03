import { Snackbar } from 'react-native-paper';

import { useNoticeStore } from '@/store/notice';

export function NoticeSnackbar() {
  const message = useNoticeStore((s) => s.message);
  return (
    <Snackbar visible={message !== null} onDismiss={() => useNoticeStore.setState({ message: null })} duration={6000}>
      {message ?? ''}
    </Snackbar>
  );
}
