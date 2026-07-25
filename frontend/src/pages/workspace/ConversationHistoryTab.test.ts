import { conversationHistoryMessageListStyle } from './ConversationHistoryTab.styles';

test('bounds conversation history without forcing a second page scrollbar', () => {
  expect(conversationHistoryMessageListStyle).toMatchObject({
    display: 'flex',
    flexDirection: 'column',
    height: 'clamp(240px, calc(100dvh - 480px), 600px)',
    overflowY: 'auto',
    boxSizing: 'border-box'
  });
  expect(conversationHistoryMessageListStyle.minHeight).toBeUndefined();
  expect(conversationHistoryMessageListStyle.maxHeight).toBeUndefined();
});
