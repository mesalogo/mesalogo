import { fireEvent, render, screen } from '@testing-library/react';
import MemoryPalaceDemo from './MemoryPalaceDemo';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

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
  const Text = ({ children }: any) => React.createElement('span', null, children);
  const Button = ({ children, onClick }: any) =>
    React.createElement('button', { onClick, type: 'button' }, children);
  const Space: any = Element;
  Space.Compact = Element;
  const Card = ({ children, extra, title }: any) =>
    React.createElement('section', null, title, extra, children);
  const Tree = ({ treeData = [] }: any) => {
    const renderNodes = (nodes: any[]): any =>
      nodes.map(({ children: childNodes, key, title }) =>
        React.createElement(
          'div',
          { key },
          title,
          childNodes ? renderNodes(childNodes) : null
        )
      );
    return React.createElement('div', null, renderNodes(treeData));
  };
  const Timeline = ({ items = [] }: any) =>
    React.createElement(
      'div',
      null,
      items.map(({ children }: any, index: number) =>
        React.createElement('div', { key: index }, children)
      )
    );
  const Descriptions = ({ items = [] }: any) =>
    React.createElement(
      'dl',
      null,
      items.map(({ children, key, label }: any) =>
        React.createElement(
          React.Fragment,
          { key },
          React.createElement('dt', null, label),
          React.createElement('dd', null, children)
        )
      )
    );

  return {
    Badge: ({ text }: any) => React.createElement('span', null, text),
    Button,
    Card,
    Col: Element,
    Descriptions,
    Divider: Element,
    Flex: Element,
    Progress: Element,
    Row: Element,
    Space,
    Statistic: ({ title, value }: any) =>
      React.createElement('div', null, title, value),
    Tag: Element,
    Timeline,
    Tree,
    Typography: { Paragraph: Text, Text, Title: Text },
  };
});

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      addEventListener: jest.fn(),
      addListener: jest.fn(),
      dispatchEvent: jest.fn(),
      matches: false,
      media: '',
      onchange: null,
      removeEventListener: jest.fn(),
      removeListener: jest.fn(),
    }),
    writable: true,
  });
});

test('renders the MemoryPalace workbench by default', () => {
  render(<MemoryPalaceDemo />);

  expect(screen.getByText('memory.demo.title')).toBeInTheDocument();
  expect(screen.getAllByText('memory.demo.rooms.preferences')).not.toHaveLength(0);
  expect(screen.getByText('memory.demo.inspector.title')).toBeInTheDocument();
});

test('switches between timeline and temporal graph views', () => {
  render(<MemoryPalaceDemo />);

  fireEvent.click(
    screen.getByRole('button', { name: /memory\.demo\.views\.timeline/ })
  );
  expect(screen.getByText('memory.demo.timeline.title')).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: /memory\.demo\.views\.graph/ })
  );
  expect(screen.getByText('memory.demo.graph.title')).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: 'memory.demo.graph.ariaLabel' })
  ).toBeInTheDocument();
});
