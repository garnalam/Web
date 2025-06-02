const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const dotenv = require('dotenv');
const moment = require('moment');
const path = require('path');
const mime = require('mime-types');
const session = require('express-session');

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

// Định nghĩa schema cho collection prediction
const predictionSchema = new mongoose.Schema({
  id_metadata: [{
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'metadata'
  }],
  id_image: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'image'
  },
  predictions: [[String, Number]] // Danh sách các tuple ["predicted_date", water_estimate]
}, { collection: 'prediction', versionKey: false });

const Prediction = mongoose.model('Prediction', predictionSchema);

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
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Log request
app.use((req, res, next) => {
  console.log(`Nhận request: ${req.method} ${req.url}`);
  next();
});

// Mật khẩu mặc định (mã hóa MD5 của "admin123")
let adminPasswordHash = '0192023a7bbd73250516f069df18b500';

// Route kiểm tra đăng nhập
app.post('/admin/login', (req, res) => {
  const { passwordHash } = req.body;
  if (passwordHash === adminPasswordHash) {
    req.session.isAuthenticated = true;
    res.status(200).json({ message: 'Đăng nhập thành công' });
  } else {
    res.status(401).json({ message: 'Mật khẩu không đúng' });
  }
});

// Route kiểm tra trạng thái đăng nhập
app.get('/admin/check-auth', (req, res) => {
  if (req.session.isAuthenticated) {
    res.status(200).json({ isAuthenticated: true });
  } else {
    res.status(200).json({ isAuthenticated: false });
  }
});

// Route đăng xuất
app.post('/admin/logout', (req, res) => {
  req.session.destroy();
  res.status(200).json({ message: 'Đăng xuất thành công' });
});

// Route đổi mật khẩu
app.post('/admin/change-password', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ message: 'Chưa đăng nhập' });
  }
  const { newPasswordHash } = req.body;
  adminPasswordHash = newPasswordHash;
  res.status(200).json({ message: 'Đổi mật khẩu thành công' });
});

// Middleware kiểm tra đăng nhập cho các route admin
const requireAuth = (req, res, next) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ message: 'Chưa đăng nhập' });
  }
  next();
};

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
      image_id: newImage._id.toString()
    });
  } catch (error) {
    console.error('Lỗi khi tải ảnh:', error);
    res.status(500).json({ message: 'Lỗi khi tải ảnh', error: error.message });
  }
});

// Route lưu ảnh mới (thay thế /upload)
app.post('/save-image', upload.single('image'), async (req, res) => {
  try {
    console.log('Vào route /save-image');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);

    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng cung cấp file ảnh' });
    }
    if (!req.body.mmyy) {
      return res.status(400).json({ message: 'Vui lòng cung cấp tháng/năm (mm/yy)' });
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ message: 'File ảnh rỗng hoặc không hợp lệ' });
    }
    console.log('Kích thước file:', req.file.buffer.length, 'bytes');

    const mmyy = req.body.mmyy;
    if (!mmyy.match(/^\d{2}\/\d{2}$/)) {
      return res.status(400).json({ message: 'Định dạng mm/yy không hợp lệ. Sử dụng mm/yy (ví dụ: 09/24)' });
    }

    const year = parseInt(`20${mmyy.split('/')[1]}`);
    const month = parseInt(mmyy.split('/')[0]) - 1; // moment tháng từ 0-11
    const isoDate = moment({ year, month, day: 1 }).toDate();

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

    const newImage = new Image({
      date: isoDate,
      'mm/yy': mmyy,
      id_file: fileId,
      mask_image: null
    });

    await newImage.save();
    console.log('Đã lưu vào collection image:', newImage);

    res.status(201).json({
      message: 'Lưu ảnh thành công',
      image_id: newImage._id.toString()
    });
  } catch (error) {
    console.error('Lỗi khi lưu ảnh:', error);
    res.status(500).json({ message: 'Lỗi khi lưu ảnh', error: error.message });
  }
});

// Route lưu metadata
app.post('/save-metadata', async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Dữ liệu metadata không hợp lệ' });
    }

    const savedRecords = await Metadata.insertMany(records);
    const metadataIds = savedRecords.map(record => record._id.toString());
    console.log(`Đã lưu ${savedRecords.length} bản ghi metadata`);
    res.status(201).json({ message: 'Lưu metadata thành công', metadata_ids: metadataIds });
  } catch (error) {
    console.error('Lỗi khi lưu metadata:', error);
    res.status(500).json({ message: 'Lỗi khi lưu metadata', error: error.message });
  }
});

// Route dự đoán (random)
app.post('/predict', async (req, res) => {
  try {
    const { prediction_dates } = req.body;
    if (!Array.isArray(prediction_dates) || prediction_dates.length === 0) {
      return res.status(400).json({ message: 'Danh sách ngày dự đoán không hợp lệ' });
    }

    const results = prediction_dates.map(date => {
      const waterLevel = Math.floor(Math.random() * 900) + 100; // Random 100-999
      return [date, waterLevel];
    });

    res.status(200).json({ message: 'Dự đoán thành công', results });
  } catch (error) {
    console.error('Lỗi khi dự đoán:', error);
    res.status(500).json({ message: 'Lỗi khi dự đoán', error: error.message });
  }
});

// Route lưu prediction
app.post('/save-prediction', async (req, res) => {
  try {
    const { metadata_ids, image_id, predictions } = req.body;
    if (!Array.isArray(metadata_ids) || metadata_ids.length === 0) {
      return res.status(400).json({ message: 'Danh sách metadata_ids không hợp lệ' });
    }
    if (!image_id) {
      return res.status(400).json({ message: 'image_id không hợp lệ' });
    }
    if (!Array.isArray(predictions) || predictions.length === 0) {
      return res.status(400).json({ message: 'Danh sách predictions không hợp lệ' });
    }

    const predictionRecord = {
      id_metadata: metadata_ids.map(id => new mongoose.Types.ObjectId(id)),
      id_image: new mongoose.Types.ObjectId(image_id),
      predictions: predictions // Danh sách các tuple ["predicted_date", water_estimate]
    };

    const savedPrediction = await Prediction.create(predictionRecord);
    console.log('Đã lưu prediction:', savedPrediction);
    res.status(201).json({ message: 'Lưu prediction thành công' });
  } catch (error) {
    console.error('Lỗi khi lưu prediction:', error);
    res.status(500).json({ message: 'Lỗi khi lưu prediction', error: error.message });
  }
});

// Route làm trống dữ liệu
app.post('/clean-all-data', async (req, res) => {
  try {
    const imageResult = await Image.deleteMany({});
    console.log(`Đã xóa ${imageResult.deletedCount} bản ghi trong collection image`);
    const metadataResult = await Metadata.deleteMany({});
    console.log(`Đã xóa ${metadataResult.deletedCount} bản ghi trong collection metadata`);
    const predictionResult = await Prediction.deleteMany({});
    console.log(`Đã xóa ${predictionResult.deletedCount} bản ghi trong collection prediction`);
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
    res.status(200).json({ message: 'Lấy danh sách bản ghi image thành công', records });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bản ghi image:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách bản ghi image', error: error.message });
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

// Route lấy danh sách bản ghi (phân trang) từ collection image
app.get('/admin/images', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const totalRecords = await Image.countDocuments();
    const images = await Image.find().skip(skip).limit(limit).lean();

    res.status(200).json({
      records: images,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bản ghi image:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách bản ghi image', error: error.message });
  }
});

// Route lấy danh sách bản ghi (phân trang) từ collection metadata
app.get('/admin/metadata', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const totalRecords = await Metadata.countDocuments();
    const metadata = await Metadata.find().skip(skip).limit(limit).lean();

    res.status(200).json({
      records: metadata,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bản ghi metadata:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách bản ghi metadata', error: error.message });
  }
});

// Route lấy danh sách bản ghi (phân trang) từ collection prediction
app.get('/admin/predictions', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const totalRecords = await Prediction.countDocuments();
    const predictions = await Prediction.find().skip(skip).limit(limit).lean();

    res.status(200).json({
      records: predictions,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bản ghi prediction:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách bản ghi prediction', error: error.message });
  }
});

// Route cập nhật bản ghi trong collection image
app.put('/admin/image/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { mm_yy } = req.body;
    const updatedImage = await Image.findByIdAndUpdate(
      id,
      { 'mm/yy': mm_yy },
      { new: true }
    );
    if (!updatedImage) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    }
    res.status(200).json({ message: 'Cập nhật thành công', record: updatedImage });
  } catch (error) {
    console.error('Lỗi khi cập nhật bản ghi image:', error);
    res.status(500).json({ message: 'Lỗi khi cập nhật bản ghi image', error: error.message });
  }
});

// Route xóa bản ghi trong collection image
app.delete('/admin/image/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    }

    // Xóa dữ liệu liên quan trong fs.files và fs.chunks
    await conn.db.collection('fs.files').deleteOne({ _id: image.id_file });
    await conn.db.collection('fs.chunks').deleteMany({ files_id: image.id_file });

    // Xóa bản ghi trong collection image
    await Image.deleteOne({ _id: id });

    res.status(200).json({ message: 'Xóa bản ghi thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa bản ghi image:', error);
    res.status(500).json({ message: 'Lỗi khi xóa bản ghi image', error: error.message });
  }
});

// Route cập nhật bản ghi trong collection metadata
app.put('/admin/metadata/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { dd, mm_yy, list_value } = req.body;

    const metadata = await Metadata.findById(id);
    if (!metadata) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    }

    metadata.dd = dd;
    metadata['mm/yy'] = mm_yy;

    // Cập nhật list_value
    if (Array.isArray(list_value)) {
      metadata.list_value = list_value.map(item => ({
        name: item[0],
        value: item[1]
      }));
    }

    await metadata.save();
    res.status(200).json({ message: 'Cập nhật thành công', record: metadata });
  } catch (error) {
    console.error('Lỗi khi cập nhật bản ghi metadata:', error);
    res.status(500).json({ message: 'Lỗi khi cập nhật bản ghi metadata', error: error.message });
  }
});

// Route xóa bản ghi trong collection metadata
app.delete('/admin/metadata/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const metadata = await Metadata.findByIdAndDelete(id);
    if (!metadata) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    }
    res.status(200).json({ message: 'Xóa bản ghi thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa bản ghi metadata:', error);
    res.status(500).json({ message: 'Lỗi khi xóa bản ghi metadata', error: error.message });
  }
});

// Route cập nhật bản ghi trong collection prediction
app.put('/admin/prediction/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { predictions } = req.body;

    const prediction = await Prediction.findById(id);
    if (!prediction) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    }

    // Cập nhật predictions
    if (Array.isArray(predictions)) {
      prediction.predictions = predictions;
    }

    await prediction.save();
    res.status(200).json({ message: 'Cập nhật thành công', record: prediction });
  } catch (error) {
    console.error('Lỗi khi cập nhật bản ghi prediction:', error);
    res.status(500).json({ message: 'Lỗi khi cập nhật bản ghi prediction', error: error.message });
  }
});

// Route xóa bản ghi trong collection prediction
app.delete('/admin/prediction/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const prediction = await Prediction.findByIdAndDelete(id);
    if (!prediction) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    }
    res.status(200).json({ message: 'Xóa bản ghi thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa bản ghi prediction:', error);
    res.status(500).json({ message: 'Lỗi khi xóa bản ghi prediction', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server chạy trên port ${PORT}`);
});