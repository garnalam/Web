const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const dotenv = require('dotenv');
const moment = require('moment');
const path = require('path');
const fs = require('fs').promises;
const mime = require('mime-types');

dotenv.config();

const app = express();

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  tls: true
})
.then(() => console.log('Kết nối MongoDB thành công'))
.catch(err => console.error('Lỗi kết nối MongoDB:', err));

// Khởi tạo GridFSBucket
let gfsBucket;
const conn = mongoose.connection;
conn.once('open', () => {
  gfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'fs'
  });
  console.log('GridFSBucket đã được khởi tạo');
});

// Định nghĩa schema cho collection image
const imageSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  'mm/yy': {
    type: String,
    required: true,
    match: /^\d{2}\/\d{2}$/
  },
  id_file: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'fs.files'
  },
  mask_image: {
    type: {
      id_mask: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
      },
      id_file: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
      }
    },
    default: null
  }
}, { collection: 'image', versionKey: false });

const Image = mongoose.model('Image', imageSchema);

// Định nghĩa schema cho collection metadata
const metadataSchema = new mongoose.Schema({
  id_image: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'image'
  },
  dd: {
    type: String,
    required: true,
    match: /^\d{2}$/
  },
  'mm/yy': {
    type: String,
    required: true,
    match: /^\d{2}\/\d{2}$/
  },
  list_value: [{
    name: { type: String, required: true },
    value: { type: String, required: true }
  }]
}, { collection: 'metadata', versionKey: false });

const Metadata = mongoose.model('Metadata', metadataSchema);

// Cấu hình Multer
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const mimeType = mime.lookup(file.originalname) || file.mimetype;
    if (mimeType && mimeType.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('File không phải là ảnh hợp lệ'), false);
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Log request
app.use((req, res, next) => {
  console.log(`Nhận request: ${req.method} ${req.url}`);
  next();
});

// Route upload ảnh
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    console.log('Vào route /upload');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);

    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng cung cấp file ảnh' });
    }
    if (!req.body.datetime) {
      return res.status(400).json({ message: 'Vui lòng cung cấp datetime' });
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ message: 'File ảnh rỗng hoặc không hợp lệ' });
    }
    console.log('Kích thước file:', req.file.buffer.length, 'bytes');

    const datetime = moment(req.body.datetime, 'DD/MM/YYYY');
    if (!datetime.isValid()) {
      return res.status(400).json({ message: 'Định dạng datetime không hợp lệ. Sử dụng DD/MM/YYYY (ví dụ: 28/05/2025)' });
    }

    const isoDate = datetime.toDate();
    const dateMMYY = datetime.format('MM/YY');

    if (!gfsBucket) {
      console.error('GridFSBucket chưa được khởi tạo');
      throw new Error('GridFSBucket chưa được khởi tạo. Vui lòng kiểm tra kết nối MongoDB.');
    }

    let mimeType = mime.lookup(req.file.originalname) || req.file.mimetype;
    if (mimeType === 'application/octet-stream') {
      const extension = path.extname(req.file.originalname).toLowerCase();
      mimeType = mime.lookup(extension) || 'image/png';
    }
    console.log('MIME type:', mimeType);

    const uploadStream = gfsBucket.openUploadStream(req.file.originalname, {
      chunkSizeBytes: 261120,
      metadata: {
        mimeType: mimeType,
        type: 'image',
        datetime: isoDate
      }
    });

    const writePromise = new Promise((resolve, reject) => {
      uploadStream.write(req.file.buffer, (error) => {
        if (error) {
          console.error('Lỗi chi tiết khi ghi dữ liệu vào GridFS stream:', error);
          reject(new Error(`Lỗi khi ghi dữ liệu vào GridFS stream: ${error.message}`));
        } else {
          resolve(true);
        }
      });
    });

    await writePromise;
    uploadStream.end();

    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => {
        console.log('Upload stream hoàn tất, fileId:', uploadStream.id);
        resolve(uploadStream.id);
      });
      uploadStream.on('error', (error) => {
        console.error('Lỗi trong upload stream:', error);
        reject(error);
      });
    });

    const fileDoc = await conn.db.collection('fs.files').findOne({ _id: fileId });
    if (!fileDoc) {
      throw new Error('Không tìm thấy file trong fs.files sau khi upload');
    }
    console.log('File đã được lưu vào fs.files:', fileDoc);

    const chunks = await conn.db.collection('fs.chunks').find({ files_id: fileId }).sort({ n: 1 }).toArray();
    if (chunks.length === 0) {
      throw new Error('Không tìm thấy chunk nào trong fs.chunks sau khi upload');
    }
    console.log(`Số chunk trong fs.chunks: ${chunks.length}`);

    const tempDir = path.join(__dirname, 'temp_chunks');
    await fs.mkdir(tempDir, { recursive: true });

    const chunkFiles = [];
    for (const chunk of chunks) {
      const chunkData = {
        n: chunk.n,
        files_id: chunk.files_id.toString(),
        mimeType: mimeType,
        data: chunk.data.buffer.toString('base64')
      };
      const chunkFileName = `chunk_${chunk.n}_${fileId}.json`;
      const chunkFilePath = path.join(tempDir, chunkFileName);
      await fs.writeFile(chunkFilePath, JSON.stringify(chunkData, null, 2));
      chunkFiles.push({ fileName: chunkFileName, filePath: chunkFilePath });
      console.log(`Đã tạo file JSON cho chunk ${chunk.n}: ${chunkFilePath}`);
    }

    const newImage = new Image({
      date: isoDate,
      'mm/yy': dateMMYY,
      id_file: fileId,
      mask_image: null
    });

    await newImage.save();
    console.log('Đã lưu vào collection image:', newImage);

    res.status(201).json({
      message: 'Tải ảnh lên thành công',
      file_id: fileId.toString(),
      image_id: newImage._id.toString(),
      chunk_files: chunkFiles.map(file => ({
        fileName: file.fileName,
        downloadUrl: `/download-chunk/${file.fileName}`
      }))
    });
  } catch (error) {
    console.error('Lỗi khi tải ảnh:', error);
    res.status(500).json({ message: 'Lỗi khi tải ảnh', error: error.message });
  }
});

// Route tải file JSON chunk
app.get('/download-chunk/:fileName', async (req, res) => {
  try {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'temp_chunks', fileName);
    res.download(filePath, fileName, async (err) => {
      if (err) {
        console.error('Lỗi khi tải file JSON:', err);
        res.status(500).json({ message: 'Lỗi khi tải file JSON', error: err.message });
      }
      try {
        await fs.unlink(filePath);
        console.log(`Đã xóa file tạm: ${filePath}`);
      } catch (unlinkErr) {
        console.error('Lỗi khi xóa file tạm:', unlinkErr);
      }
    });
  } catch (error) {
    console.error('Lỗi khi tải file JSON:', error);
    res.status(500).json({ message: 'Lỗi khi tải file JSON', error: error.message });
  }
});

// Route tạo metadata
app.post('/update-metadata', async (req, res) => {
  try {
    const { id_image, date, list_value } = req.body;

    if (!id_image || !date || !list_value || !Array.isArray(list_value)) {
      return res.status(400).json({ message: 'Thiếu hoặc sai định dạng: id_image, date, hoặc list_value' });
    }

    let idImage;
    try {
      idImage = new mongoose.Types.ObjectId(id_image);
    } catch (error) {
      return res.status(400).json({ message: 'id_image không hợp lệ' });
    }

    const image = await Image.findById(idImage);
    if (!image) {
      return res.status(404).json({ message: 'Không tìm thấy document trong collection image với id_image này' });
    }

    const dateRegex = /^\d{2}\/\d{2}\/\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ message: 'Định dạng ngày không hợp lệ. Sử dụng dd/mm/yy (ví dụ: 28/05/25)' });
    }

    const dateParts = date.split('/');
    const dd = dateParts[0];
    const mmYY = `${dateParts[1]}/${dateParts[2]}`;

    const listValue = list_value.map(([name, value]) => {
      if (!name || !value) {
        throw new Error('Mỗi cặp trong list_value phải có name và value');
      }
      return { name: name.toString(), value: value.toString() };
    });

    const metadataDoc = await Metadata.findOneAndUpdate(
      { id_image: idImage },
      { $set: { id_image: idImage, dd, 'mm/yy': mmYY, list_value: listValue } },
      { upsert: true, new: true }
    );

    console.log('Đã cập nhật metadata:', metadataDoc);
    res.status(200).json({ message: 'Cập nhật metadata thành công', metadata: metadataDoc });
  } catch (error) {
    console.error('Lỗi khi cập nhật metadata:', error);
    res.status(500).json({ message: 'Lỗi khi cập nhật metadata', error: error.message });
  }
});

// Route lấy danh sách bản ghi từ collection image
app.get('/get-image-records', async (req, res) => {
  try {
    const images = await Image.find().lean();
    console.log('Số bản ghi image:', images.length);

    if (images.length === 0) {
      console.log('Không có bản ghi nào trong collection image');
      return res.status(200).json({ records: [] });
    }

    const fileIds = images.map(image => image.id_file);
    console.log('Danh sách fileIds:', fileIds);

    const files = await conn.db.collection('fs.files').find({ _id: { $in: fileIds } }).toArray();
    console.log('Số file trong fs.files:', files.length);

    const missingFiles = fileIds.filter(id => !files.some(file => file._id.equals(id)));
    if (missingFiles.length > 0) {
      console.log('Các id_file không tồn tại trong fs.files:', missingFiles);
    }

    const fileMap = files.reduce((map, file) => {
      map[file._id.toString()] = file;
      return map;
    }, {});

    const records = images.map(image => {
      const file = fileMap[image.id_file.toString()];
      return {
        _id: image._id.toString(),
        filename: file ? file.filename : 'Không tìm thấy file',
        date: image.date,
        file_id: file ? file._id.toString() : null
      };
    });

    console.log('Số bản ghi trả về:', records.length);
    res.status(200).json({ records });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bản ghi image:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách bản ghi image', error: error.message });
  }
});

// Route xóa bản ghi
app.post('/delete-record', async (req, res) => {
  try {
    const { id, type } = req.body;
    console.log('Nhận yêu cầu xóa bản ghi:', { id, type });

    if (!id || !type) {
      console.error('Thiếu id hoặc type trong payload');
      return res.status(400).json({ message: 'Thiếu id hoặc type' });
    }

    if (type === 'image') {
      let idImage;
      try {
        idImage = new mongoose.Types.ObjectId(id);
        console.log('Đã parse idImage thành ObjectId:', idImage);
      } catch (error) {
        console.error('ID không hợp lệ:', id, error);
        return res.status(400).json({ message: 'ID không hợp lệ' });
      }

      const image = await Image.findById(idImage);
      if (!image) {
        console.error('Không tìm thấy bản ghi trong collection image với id:', idImage);
        return res.status(404).json({ message: 'Không tìm thấy bản ghi trong collection image' });
      }
      console.log('Tìm thấy bản ghi image:', image);

      // Xóa file từ GridFS
      if (!gfsBucket) {
        console.error('GridFSBucket chưa được khởi tạo');
        throw new Error('GridFSBucket chưa được khởi tạo. Vui lòng kiểm tra kết nối MongoDB.');
      }

      try {
        await gfsBucket.delete(new mongoose.Types.ObjectId(image.id_file));
        console.log(`Đã xóa file ${image.id_file} từ GridFS`);
      } catch (error) {
        console.error(`Lỗi khi xóa file ${image.id_file} từ GridFS:`, error);
        throw new Error(`Lỗi khi xóa file từ GridFS: ${error.message}`);
      }

      // Xóa bản ghi từ collection image
      const imageDeleteResult = await Image.deleteOne({ _id: idImage });
      console.log(`Kết quả xóa bản ghi image:`, imageDeleteResult);
      if (imageDeleteResult.deletedCount === 0) {
        console.error('Không xóa được bản ghi image với id:', idImage);
        throw new Error('Không xóa được bản ghi trong collection image');
      }
      console.log(`Đã xóa bản ghi image với id: ${idImage}`);

      // Xóa metadata liên quan
      const metadataDeleteResult = await Metadata.deleteOne({ id_image: idImage });
      console.log(`Kết quả xóa metadata:`, metadataDeleteResult);
      if (metadataDeleteResult.deletedCount === 0) {
        console.warn('Không tìm thấy metadata liên quan để xóa với id_image:', idImage);
      } else {
        console.log(`Đã xóa metadata liên quan với id_image: ${idImage}`);
      }

      res.status(200).json({ message: 'Xóa bản ghi image thành công' });
    } else {
      console.error('Loại bản ghi không hợp lệ:', type);
      res.status(400).json({ message: 'Loại bản ghi không hợp lệ' });
    }
  } catch (error) {
    console.error('Lỗi khi xóa bản ghi:', error);
    res.status(500).json({ message: 'Lỗi khi xóa bản ghi', error: error.message });
  }
});

// Route làm trống dữ liệu
app.post('/clean-all-data', async (req, res) => {
  try {
    const imageResult = await Image.deleteMany({});
    console.log(`Đã xóa ${imageResult.deletedCount} bản ghi trong collection image`);
    const metadataResult = await Metadata.deleteMany({});
    console.log(`Đã xóa ${metadataResult.deletedCount} bản ghi trong collection metadata`);
    const filesResult = await conn.db.collection('fs.files').deleteMany({});
    console.log(`Đã xóa ${filesResult.deletedCount} bản ghi trong fs.files`);
    const chunksResult = await conn.db.collection('fs.chunks').deleteMany({});
    console.log(`Đã xóa ${chunksResult.deletedCount} bản ghi trong fs.chunks`);
    res.status(200).json({ message: 'Đã làm trống tất cả dữ liệu thành công' });
  } catch (error) {
    console.error('Lỗi khi làm trống dữ liệu:', error);
    res.status(500).json({ message: 'Lỗi khi làm trống dữ liệu', error: error.message });
  }
});

// Route lấy danh sách bản ghi metadata
app.get('/get-metadata-records', async (req, res) => {
  try {
    const records = await Metadata.find().lean();
    console.log('Số bản ghi metadata:', records.length);
    res.status(200).json({ records });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách metadata:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách metadata', error: error.message });
  }
});

// Route lấy ảnh từ GridFS
app.get('/get-image/:fileId', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    const file = await conn.db.collection('fs.files').findOne({ _id: fileId });
    if (!file) {
      return res.status(404).json({ message: 'Không tìm thấy file' });
    }

    res.set('Content-Type', file.metadata.mimeType);
    const downloadStream = gfsBucket.openDownloadStream(fileId);
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      console.error('Lỗi khi tải ảnh:', error);
      res.status(500).json({ message: 'Lỗi khi tải ảnh', error: error.message });
    });
  } catch (error) {
    console.error('Lỗi khi tải ảnh:', error);
    res.status(500).json({ message: 'Lỗi khi tải ảnh', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server chạy trên port ${PORT}`);
});