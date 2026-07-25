import { render, screen } from '@testing-library/react';
import SetupWizard from './SetupWizard';

jest.mock('antd', () => {
  const React = jest.requireActual('react');
  const Box: any = (props: any) => React.createElement('div', {
    style: props.style,
    'data-testid': props['data-testid'],
  }, props.children);
  const Button: any = (props: any) => React.createElement('button', {
    onClick: props.onClick,
  }, props.children);
  const Input: any = (props: any) => React.createElement('input', {
    defaultValue: props.defaultValue,
    onChange: props.onChange,
  });
  Input.Password = Input;
  const Select = Box;
  const Form: any = Box;
  Form.Item = Box;
  Form.useForm = () => [{
    validateFields: jest.fn(),
    getFieldsValue: jest.fn(() => ({})),
    getFieldValue: jest.fn(),
    setFieldValue: jest.fn(),
  }];
  const Descriptions: any = Box;
  Descriptions.Item = Box;
  const AntdApp: any = Box;
  AntdApp.useApp = () => ({
    message: {
      success: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    },
  });

  return {
    Steps: Box,
    Form,
    Input,
    Select,
    Button,
    Card: Box,
    Row: Box,
    Col: Box,
    Typography: { Title: Box, Text: Box },
    Alert: Box,
    App: AntdApp,
    Result: Box,
    Descriptions,
    Tag: Box,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../services/api/setup', () => ({
  setupAPI: {
    testDb: jest.fn(),
    testRedis: jest.fn(),
    save: jest.fn(),
    getStatus: jest.fn(),
  },
}));

test('includes shell padding inside its viewport height', () => {
  render(<SetupWizard onDone={jest.fn()} />);
  const shell = screen.getByTestId('setup-wizard-shell');

  expect(shell.style.minHeight).toBe('100vh');
  expect(shell.style.padding).toBe('24px');
  expect(shell.style.boxSizing).toBe('border-box');
});
