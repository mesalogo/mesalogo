import type { CSSProperties } from 'react';

type LogsPageStyleKey =
  | 'shell'
  | 'title'
  | 'card'
  | 'cardBody'
  | 'controls'
  | 'divider'
  | 'fileInfo'
  | 'logViewport';

export const logsPageStyles: Record<LogsPageStyleKey, CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100dvh - 104px)',
    minHeight: 0
  },
  title: {
    marginBottom: '24px',
    flexShrink: 0
  },
  card: {
    borderRadius: '12px',
    boxShadow: 'var(--custom-shadow)',
    marginBottom: 0,
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden'
  },
  cardBody: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden'
  },
  controls: {
    marginBottom: '16px',
    flexShrink: 0
  },
  divider: {
    margin: '12px 0',
    flexShrink: 0
  },
  fileInfo: {
    marginBottom: '16px',
    flexShrink: 0
  },
  logViewport: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    boxSizing: 'border-box',
    backgroundColor: 'var(--custom-hover-bg)',
    padding: '12px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all'
  }
};
