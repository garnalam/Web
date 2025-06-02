const fs = require('fs').promises;
const path = require('path');
const mime = require('mime-types');

async function reconstructImage(chunkFilesDir, outputDir) {
  try {
    // Đọc tất cả file JSON trong thư mục
    const files = await fs.readdir(chunkFilesDir);
    const jsonFiles = files.filter(file => file.endsWith('.json')).sort((a, b) => {
      const nA = parseInt(a.match(/chunk_(\d+)_/)[1]);
      const nB = parseInt(b.match(/chunk_(\d+)_/)[1]);
      return nA - nB;
    });

    if (jsonFiles.length === 0) {
      throw new Error('Không tìm thấy file JSON chunk trong thư mục');
    }

    // Đọc chunk đầu tiên để lấy mimeType
    const firstChunkPath = path.join(chunkFilesDir, jsonFiles[0]);
    const firstChunkContent = await fs.readFile(firstChunkPath, 'utf8');
    const firstChunkData = JSON.parse(firstChunkContent);
    const mimeType = firstChunkData.mimeType || 'image/png'; // Fallback to image/png
    const extension = mime.extension(mimeType) || 'png';
    const outputFileName = `reconstructed_image.${extension}`;
    const outputImagePath = path.join(outputDir, outputFileName);

    // Ghép dữ liệu từ các chunk
    const buffers = [];
    for (const file of jsonFiles) {
      const filePath = path.join(chunkFilesDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const chunkData = JSON.parse(content);
      const chunkBuffer = Buffer.from(chunkData.data, 'base64');
      buffers.push(chunkBuffer);
      console.log(`Đã đọc chunk ${chunkData.n}, kích thước: ${chunkBuffer.length} bytes`);
    }

    // Ghép các buffer thành một
    const finalBuffer = Buffer.concat(buffers);
    console.log('Tổng kích thước ảnh tái tạo:', finalBuffer.length, 'bytes');

    // Tạo thư mục đầu ra nếu chưa có
    await fs.mkdir(outputDir, { recursive: true });

    // Lưu file ảnh
    await fs.writeFile(outputImagePath, finalBuffer);
    console.log(`Đã lưu ảnh tái tạo tại: ${outputImagePath}`);
  } catch (error) {
    console.error('Lỗi khi tái tạo ảnh:', error);
  }
}

// Chạy script
const chunkFilesDir = 'C://Users//AlarmTran//Desktop//Bianconeri'; // Thư mục chứa file JSON
const outputDir = 'C://Users//AlarmTran//Desktop//Bianconeri'; // Thư mục lưu ảnh tái tạo
reconstructImage(chunkFilesDir, outputDir);