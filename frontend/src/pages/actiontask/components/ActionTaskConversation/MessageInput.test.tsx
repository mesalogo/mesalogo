import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import MessageInput from './MessageInput';

jest.mock('@ant-design/icons', () =>
  new Proxy(
    { __esModule: true },
    {
      get: (target, property) =>
        property in target ? target[property as keyof typeof target] : () => null,
    }
  )
);

jest.mock('antd', () => {
  const React = jest.requireActual('react');

  const Element = ({ children }: any) => React.createElement('div', null, children);
  const Button = ({ children, icon, danger, loading, type, ...props }: any) =>
    React.createElement('button', props, icon, children);
  const Select: any = ({ children }: any) => React.createElement('div', null, children);
  Select.Option = Element;

  return {
    Avatar: Element,
    Badge: Element,
    Button,
    Dropdown: Element,
    Input: { TextArea: 'textarea' },
    Mentions: ({ onPaste, onPressEnter, onChange, value, ...props }: any) =>
      React.createElement('textarea', {
        'aria-label': 'message input',
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key === 'Enter') {
            onPressEnter(event);
          }
        },
        onPaste,
        value,
        disabled: props.disabled,
      }),
    Select,
    Space: Element,
    Switch: ({ onChange, ...props }: any) =>
      React.createElement('input', {
        type: 'checkbox',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.checked),
        ...props,
      }),
    Tooltip: Element,
  };
});

const renderMessageInput = (overrides: Record<string, unknown> = {}) => {
  const onPasteImages = jest.fn();
  const onSendMessage = jest.fn();

  render(
    <MessageInput
      task={{ status: 'active', agents: [] }}
      userMessage=""
      setUserMessage={jest.fn()}
      targetAgentIds={[]}
      setTargetAgentIds={jest.fn()}
      attachedImages={[]}
      showImageUpload={false}
      setShowImageUpload={jest.fn()}
      sendingMessage={false}
      isResponding={false}
      onSendMessage={onSendMessage}
      assistingMessage={false}
      globalSettings={{}}
      onMessageAssist={jest.fn()}
      isolationMode={false}
      setIsolationMode={jest.fn()}
      smartDispatchEnabled={false}
      setSmartDispatchEnabled={jest.fn()}
      autoScrollEnabled
      onToggleAutoScroll={jest.fn()}
      subAgentEnabled={false}
      onToggleSubAgent={jest.fn()}
      isAutoDiscussing={false}
      readOnly={false}
      onPasteImages={onPasteImages}
      t={(key: string) => key}
      {...overrides}
    />
  );

  return { onPasteImages, onSendMessage };
};

test('pasting clipboard images attaches them to the message', () => {
  const { onPasteImages } = renderMessageInput();
  const image = new File(['image bytes'], 'clipboard.png', { type: 'image/png' });
  const input = screen.getByRole('textbox', { name: 'message input' });
  const pasteEvent = createEvent.paste(input, {
    clipboardData: {
      items: [
        {
          kind: 'file',
          type: 'image/png',
          getAsFile: () => image,
        },
      ],
    },
  });

  fireEvent(input, pasteEvent);

  expect(pasteEvent.defaultPrevented).toBe(true);
  expect(onPasteImages).toHaveBeenCalledWith([image]);
});

test('pasting plain text keeps the browser default behavior', () => {
  const { onPasteImages } = renderMessageInput();
  const input = screen.getByRole('textbox', { name: 'message input' });
  const pasteEvent = createEvent.paste(input, {
    clipboardData: {
      items: [{ kind: 'string', type: 'text/plain' }],
    },
  });

  fireEvent(input, pasteEvent);

  expect(pasteEvent.defaultPrevented).toBe(false);
  expect(onPasteImages).not.toHaveBeenCalled();
});

test('does not send a message while a pasted image is still processing', () => {
  const { onSendMessage } = renderMessageInput({
    userMessage: 'Wait for the image',
    uploadingImages: true,
  });
  const input = screen.getByRole('textbox', { name: 'message input' });

  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

  expect(onSendMessage).not.toHaveBeenCalled();
  expect(screen.getByTitle('conversation.sendTooltip')).toBeDisabled();
});
