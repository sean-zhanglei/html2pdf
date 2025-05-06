import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  const { file } = req.query;

  const pdfDir = path.join(process.cwd(), 'temp');
  const filePath = path.join(pdfDir, file);
  console.log('Download file:', file);

  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    // 设置响应头
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    // 创建文件流并管道传输到响应
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    // 错误处理
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      res.status(500).end();
    });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
