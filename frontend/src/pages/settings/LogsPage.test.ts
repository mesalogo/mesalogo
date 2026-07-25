import { logsPageStyles } from './LogsPage.styles';

test('keeps the logs page inside the viewport with only the log region scrolling', () => {
  expect(logsPageStyles.shell).toMatchObject({
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100dvh - 104px)',
    minHeight: 0
  });
  expect(logsPageStyles.title.flexShrink).toBe(0);
  expect(logsPageStyles.card).toMatchObject({
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden'
  });
  expect(logsPageStyles.cardBody).toMatchObject({
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden'
  });
  expect(logsPageStyles.controls.flexShrink).toBe(0);
  expect(logsPageStyles.divider.flexShrink).toBe(0);
  expect(logsPageStyles.fileInfo.flexShrink).toBe(0);
  expect(logsPageStyles.logViewport).toMatchObject({
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    boxSizing: 'border-box'
  });
  expect(logsPageStyles.logViewport.height).toBeUndefined();
});
