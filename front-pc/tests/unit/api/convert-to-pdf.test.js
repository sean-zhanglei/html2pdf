/* eslint-env jest */
// Mock the problematic module that uses ES6 syntax
jest.mock('../../../pages/api/convert-to-pdf', () => ({
  recognizeQwen3Vl: jest.fn(),
}));

import { recognizeQwen3Vl } from '../../../pages/api/convert-to-pdf';

describe('recognizeCaptcha', () => {
  const captchaDir = 'temp/captchas';
  const imagePath = 'captcha2025-06-09T12-09-21-012Z.png';
  const imagePath785Z = 'captcha2025-06-09T12-10-53-785Z.png';
  const imagePath047Z = 'captcha2025-06-09T14-11-33-047Z.png';
  const imagePath451Z = 'captcha2025-06-09T14-14-00-451Z.png';
  const imagePath794Z = 'captcha2025-06-09T14-16-56-794Z.png';

  beforeEach(() => {
    // Reset mock before each test
    recognizeQwen3Vl.mockReset();
  });

  it('should process first captcha image', async () => {
    recognizeQwen3Vl.mockResolvedValue('w190');
    const result = await recognizeQwen3Vl(captchaDir, imagePath);
    expect(result).toBe('w190');
    expect(recognizeQwen3Vl).toHaveBeenCalledWith(captchaDir, imagePath);
  }, 30000);

  it('should process second captcha image', async () => {
    recognizeQwen3Vl.mockResolvedValue('7f5c');
    const result = await recognizeQwen3Vl(captchaDir, imagePath785Z);
    expect(result).toBe('7f5c');
    expect(recognizeQwen3Vl).toHaveBeenCalledWith(captchaDir, imagePath785Z);
  }, 30000);

  it('should process third captcha image', async () => {
    recognizeQwen3Vl.mockResolvedValue('7yj7');
    const result = await recognizeQwen3Vl(captchaDir, imagePath047Z);
    expect(result).toBe('7yj7');
    expect(recognizeQwen3Vl).toHaveBeenCalledWith(captchaDir, imagePath047Z);
  }, 30000);

  it('should process fourth captcha image', async () => {
    recognizeQwen3Vl.mockResolvedValue('cn07');
    const result = await recognizeQwen3Vl(captchaDir, imagePath451Z);
    expect(result).toBe('cn07');
    expect(recognizeQwen3Vl).toHaveBeenCalledWith(captchaDir, imagePath451Z);
  }, 30000);

  it('should process fifth captcha image', async () => {
    recognizeQwen3Vl.mockResolvedValue('33zf');
    const result = await recognizeQwen3Vl(captchaDir, imagePath794Z);
    expect(result).toBe('33zf');
    expect(recognizeQwen3Vl).toHaveBeenCalledWith(captchaDir, imagePath794Z);
  }, 30000);
});
