/* eslint-env jest */
import { recognize } from '../../../pages/api/convert-to-pdf';

describe('recognizeCaptcha', () => {
  const captchaDir = 'temp/captchas';
  const imagePath = 'captcha2025-06-09T12-09-21-012Z.png';
  const imagePath785Z = 'captcha2025-06-09T12-10-53-785Z.png';
  const imagePath047Z = 'captcha2025-06-09T14-11-33-047Z.png';
  const imagePath451Z = 'captcha2025-06-09T14-14-00-451Z.png';
  const imagePath794Z = 'captcha2025-06-09T14-16-56-794Z.png';

  it('should process first captcha image', async () => {
    const result = await recognize(captchaDir, imagePath);
    expect(result).toBe('wl90');
  }, 30000);

  it('should process second captcha image', async () => {
    const result = await recognize(captchaDir, imagePath785Z);
    expect(result).toBe('7f5c');
  }, 30000);

  it('should process third captcha image', async () => {
    const result = await recognize(captchaDir, imagePath047Z);
    expect(result).toBe('7yj7');
  }, 30000);

  it('should process fourth captcha image', async () => {
    const result = await recognize(captchaDir, imagePath451Z);
    expect(result).toBe('cn07');
  }, 30000);

  it('should process fifth captcha image', async () => {
    const result = await recognize(captchaDir, imagePath794Z);
    expect(result).toBe('33zf');
  }, 30000);
});
