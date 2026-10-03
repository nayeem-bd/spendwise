import { create } from 'zustand';

/** One-line app-wide message (e.g. a budget alert), shown in a snackbar. */
export const useNoticeStore = create<{ message: string | null }>(() => ({ message: null }));

export const showNotice = (message: string) => useNoticeStore.setState({ message });
