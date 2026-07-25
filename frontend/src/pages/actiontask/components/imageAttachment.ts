import api from '../../../services/api/axios';

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();

  reader.onload = () => {
    if (typeof reader.result === 'string') {
      resolve(reader.result);
      return;
    }

    reject(new Error('Image file could not be converted to a data URL'));
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export const prepareImageAttachment = async (file: File) => {
  const base64 = await fileToDataUrl(file);
  const response = await api.post('/images/process', {
    base64,
    operation: 'info'
  });
  const result = response.data;

  if (!result.success) {
    return { result, imageData: null };
  }

  return {
    result,
    imageData: {
      id: Date.now() + Math.random(),
      file,
      base64,
      info: result.data,
      preview: URL.createObjectURL(file)
    }
  };
};
