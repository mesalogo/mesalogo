import { render, screen } from '@testing-library/react';
import GISApp from './GISApp';

jest.mock('antd', () => {
  const React = jest.requireActual('react');
  const Box: any = React.forwardRef(function Box(props: any, ref: any) {
    return React.createElement('div', {
      ref,
      style: props.style,
      className: props.className,
      'data-testid': props['data-testid'],
    }, props.children);
  });
  const Card: any = (props: any) => React.createElement('section', {
    style: props.style,
    'data-testid': props['data-testid'],
  }, props.title, React.createElement('div', {
    style: props.bodyStyle || props.styles?.body,
  }, props.children));
  const Button: any = (props: any) => React.createElement('button', {
    onClick: props.onClick,
  }, props.children);
  const Input: any = React.forwardRef(function Input(props: any, ref: any) {
    return React.createElement('input', {
      ref,
      id: props.id,
      value: props.value,
      defaultValue: props.defaultValue,
      onChange: props.onChange,
      style: props.style,
    });
  });
  Input.Search = Input;
  Input.TextArea = Input;
  const Select: any = Box;
  Select.Option = Box;
  const List: any = Box;
  List.Item = Box;
  List.Item.Meta = Box;

  return {
    Card,
    Button,
    Space: Box,
    Typography: { Title: Box, Text: Box },
    Row: Box,
    Col: Box,
    Tag: Box,
    message: {
      success: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    },
    Tooltip: ({ children }: any) => children,
    Modal: ({ open, children }: any) => open ? Box({ children }) : null,
    Input,
    Select,
    List,
    Popconfirm: ({ children }: any) => children,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('leaflet-draw', () => ({}));

jest.mock('leaflet', () => {
  const DefaultIcon: any = function DefaultIcon() {};
  DefaultIcon.mergeOptions = () => undefined;

  const mapInstance: any = {
    addLayer: () => undefined,
    addControl: () => undefined,
    on: () => undefined,
    off: () => undefined,
    remove: () => undefined,
  };
  mapInstance.setView = () => mapInstance;

  return {
    __esModule: true,
    default: {
      Icon: { Default: DefaultIcon },
      map: () => mapInstance,
      tileLayer: () => ({ addTo: () => undefined }),
      FeatureGroup: function FeatureGroup() {
        return {
          addLayer: () => undefined,
          removeLayer: () => undefined,
        };
      },
      Control: {
        Draw: function Draw() {
          return { options: { draw: {} } };
        },
      },
      Draw: {
        Event: {
          CREATED: 'created',
          EDITED: 'edited',
          DELETED: 'deleted',
        },
      },
    },
  };
});

test('uses its containing layout instead of the browser viewport', () => {
  render(<GISApp />);
  const root = screen.getByTestId('gis-app');
  const content = screen.getByTestId('gis-layout-content');
  const annotationList = screen.getByTestId('gis-annotation-list');
  const mapCard = screen.getByTestId('gis-map-card');
  const map = screen.getByTestId('gis-map');

  expect(root).toHaveStyle({
    height: '100%',
    minHeight: '0',
    overflow: 'hidden',
  });
  expect(content).toHaveStyle({
    minHeight: '0',
    overflow: 'hidden',
  });
  expect(annotationList).toHaveStyle({
    minHeight: '0',
    overflow: 'hidden',
  });
  expect(mapCard).toHaveStyle({
    height: '100%',
    minHeight: '0',
    overflow: 'hidden',
  });
  expect(map).toHaveStyle({ minHeight: '0' });

  const viewportRelativeBlockSizes = [root, content, annotationList, mapCard, map]
    .flatMap((element) => [element.style.height, element.style.minHeight])
    .filter((value) => value.includes('vh'));

  expect(viewportRelativeBlockSizes).toEqual([]);
});
