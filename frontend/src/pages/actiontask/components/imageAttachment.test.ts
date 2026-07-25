import api from '../../../services/api/axios';
import { prepareImageAttachment } from './imageAttachment';

jest.mock('../../../services/api/axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

const mockPost = api.post as jest.Mock;
const originalCreateObjectUrl = URL.createObjectURL;

beforeEach(() => {
  mockPost.mockReset();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn(() => 'blob:clipboard-preview'),
  });
});

afterAll(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: originalCreateObjectUrl,
  });
});

test('prepares a clipboard image through the existing image processing endpoint', async () => {
  const info = {
    format: 'png',
    mime_type: 'image/png',
    size: 11,
    width: 1,
    height: 1,
  };
  mockPost.mockResolvedValue({ data: { success: true, data: info } });
  const file = new File(['image bytes'], 'clipboard.png', { type: 'image/png' });

  const { result, imageData } = await prepareImageAttachment(file);

  expect(mockPost).toHaveBeenCalledWith('/images/process', {
    base64: expect.stringMatching(/^data:image\/png;base64,/),
    operation: 'info',
  });
  expect(result).toEqual({ success: true, data: info });
  expect(imageData).toEqual(expect.objectContaining({
    file,
    info,
    preview: 'blob:clipboard-preview',
  }));
});

test('does not create an attachment when backend image validation fails', async () => {
  const result = { success: false, message: 'Unsupported image format' };
  mockPost.mockResolvedValue({ data: result });

  const prepared = await prepareImageAttachment(
    new File(['image bytes'], 'clipboard.bmp', { type: 'image/bmp' })
  );

  expect(prepared).toEqual({ result, imageData: null });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
