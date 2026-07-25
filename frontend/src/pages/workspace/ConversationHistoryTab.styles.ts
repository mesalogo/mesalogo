import type { CSSProperties } from 'react';

export const conversationHistoryMessageListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: 'clamp(240px, calc(100dvh - 480px), 600px)',
  overflowY: 'auto',
  boxSizing: 'border-box',
  padding: '16px',
  backgroundColor: 'var(--custom-header-bg)',
  borderRadius: '8px',
  border: '1px solid var(--custom-border)'
};
