document.addEventListener('DOMContentLoaded', () => {
  const imageInput = document.getElementById('image-input');
  const imagePreview = document.getElementById('image-preview');
  const csvInput = document.getElementById('csv-input');
  const mmyyInput = document.getElementById('mmyy-input');
  const predictBtn = document.getElementById('predict-btn');
  const logOverlay = document.getElementById('log-overlay');
  const logMessages = document.getElementById('log-messages');
  const logCloseBtn = document.getElementById('log-close');
  const calendarOverlay = document.getElementById('calendar-overlay');
  const calendarGrid = document.getElementById('calendar-grid');
  const calendarCloseBtn = document.getElementById('calendar-close');
  const confirmDatesBtn = document.getElementById('confirm-dates-btn');
  const progressOverlay = document.getElementById('progress-overlay');
  const progressBar = document.getElementById('progress-bar');
  const resultOverlay = document.getElementById('result-overlay');
  const calendarGridResult = document.getElementById('calendar-grid-result');
  const resultDetails = document.getElementById('result-details');
  const downloadResultBtn = document.getElementById('download-result-btn');
  const resultCloseBtn = document.getElementById('result-close');
  const downloadSampleCsvBtn = document.getElementById('download-sample-csv');

  let csvData = [];
  let lastDate = null;
  let selectedStartDate = null;
  let selectedEndDate = null;
  let predictionDates = [];
  let predictionResults = [];
  let metadataIds = [];
  let imageId = null;

  // Hiển thị ảnh preview khi chọn file
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    } else {
      imagePreview.classList.add('hidden');
    }
  });

  // Tải file CSV minh họa
  downloadSampleCsvBtn.addEventListener('click', () => {
    const sampleCsvContent = `dd/mm/yy,value
22/09/24,[("area", 10000), ("depth", 2.5), ("flow", 500)]
23/09/24,[("area", 11000), ("depth", 2.6), ("flow", 510)]
24/09/24,[("area", 12000), ("depth", 2.7), ("flow", 520)]
25/09/24,[("area", 13000), ("depth", 2.8), ("flow", 530)]`;
    const csvFile = new Blob([sampleCsvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(csvFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_metadata.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  });

  // Đóng overlay
  logCloseBtn.addEventListener('click', () => {
    logOverlay.style.display = 'none';
  });

  calendarCloseBtn.addEventListener('click', () => {
    calendarOverlay.style.display = 'none';
    selectedStartDate = null;
    selectedEndDate = null;
    const days = document.querySelectorAll('.calendar-day');
    days.forEach(day => day.classList.remove('selected'));
  });

  resultCloseBtn.addEventListener('click', () => {
    resultOverlay.style.display = 'none';
  });

  // Xử lý nút Predict
  predictBtn.addEventListener('click', async () => {
    logMessages.innerHTML = '';
    calendarOverlay.style.display = 'none';
    progressOverlay.style.display = 'none';
    resultOverlay.style.display = 'none';
    csvData = [];
    lastDate = null;
    selectedStartDate = null;
    selectedEndDate = null;
    predictionDates = [];
    predictionResults = [];
    metadataIds = [];
    imageId = null;

    // Hiển thị overlay log
    logOverlay.style.display = 'flex';

    // Kiểm tra ảnh
    if (!imageInput.files || imageInput.files.length === 0) {
      logMessage('Lỗi: Vui lòng chọn một ảnh!', 'error');
      return;
    }
    const imageFile = imageInput.files[0];
    const imageMimeType = imageFile.type; // Sử dụng File API để lấy MIME type
    if (!imageMimeType || !imageMimeType.startsWith('image/')) {
      logMessage('Lỗi: File không phải là ảnh hợp lệ!', 'error');
      return;
    }
    logMessage('Ảnh hợp lệ.', 'success');

    // Kiểm tra file CSV
    if (!csvInput.files || csvInput.files.length === 0) {
      logMessage('Lỗi: Vui lòng chọn một file CSV!', 'error');
      return;
    }
    const csvFile = csvInput.files[0];
    try {
      csvData = await parseCSV(csvFile);
      logMessage(`Đã đọc file CSV: ${csvData.length} bản ghi.`, 'success');
      console.log('Dữ liệu CSV đã parse:', csvData);
    } catch (error) {
      logMessage(`Lỗi khi đọc file CSV: ${error.message}`, 'error');
      return;
    }

    // Kiểm tra số lượng bản ghi
    if (csvData.length < 4) {
      logMessage('Lỗi: File CSV phải có ít nhất 4 bản ghi!', 'error');
      return;
    }
    logMessage('Số lượng bản ghi đủ (>= 4).', 'success');

    // Kiểm tra trường dd/mm/yy trong CSV
    if (!csvData.every(record => record['dd/mm/yy'])) {
      logMessage('Lỗi: Dữ liệu của bạn không hợp lệ, vui lòng thêm dữ liệu về ngày/tháng/năm cụ thể cho từng bản ghi .csv!', 'error');
      return;
    }
    logMessage('Tất cả bản ghi đều có trường dd/mm/yy.', 'success');

    // Kiểm tra trường value trong CSV
    if (!csvData.every(record => record.value && Array.isArray(record.value))) {
      logMessage('Lỗi: Tất cả bản ghi phải có trường value dạng danh sách hợp lệ!', 'error');
      return;
    }
    logMessage('Tất cả bản ghi đều có trường value hợp lệ.', 'success');

    // Kiểm tra tháng/năm của ảnh
    const mmyy = mmyyInput.value;
    if (!mmyy.match(/^\d{2}\/\d{2}$/)) {
      logMessage('Lỗi: Định dạng tháng/năm của ảnh không hợp lệ. Sử dụng mm/yy (ví dụ: 09/24)!', 'error');
      return;
    }
    logMessage('Tháng/năm của ảnh hợp lệ.', 'success');

    // Kiểm tra tháng/năm trùng khớp
    const csvDates = csvData.map(record => record['dd/mm/yy']);
    const csvMMYYs = csvDates.map(date => date.split('/').slice(1).join('/'));
    if (!csvMMYYs.every(csvMMYY => csvMMYY === mmyy)) {
      logMessage('Lỗi: Tháng/năm của ảnh không trùng với tháng/năm của dữ liệu trong CSV!', 'error');
      return;
    }
    logMessage('Tháng/năm của ảnh trùng khớp với dữ liệu CSV.', 'success');

    // Kiểm tra ngày liên tiếp
    const dates = csvDates.map(date => moment(date, 'DD/MM/YY'));
    for (let i = 1; i < dates.length; i++) {
      if (!dates[i].isSame(dates[i - 1].clone().add(1, 'day'), 'day')) {
        logMessage('Lỗi: Các ngày trong CSV không liên tiếp! Vui lòng điều chỉnh lại.', 'error');
        return;
      }
    }
    logMessage('Các ngày trong CSV liên tiếp.', 'success');

    // Lưu ảnh vào collection image
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('mmyy', mmyy);
      const response = await fetch('http://localhost:5000/save-image', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Lỗi không xác định');
      imageId = data.image_id;
      logMessage('Đã lưu ảnh vào collection image.', 'success');
    } catch (error) {
      logMessage(`Lỗi khi lưu ảnh: ${error.message}`, 'error');
      return;
    }

    // Lưu metadata vào collection metadata
    try {
      const metadataRecords = csvData.map(record => ({
        id_image: imageId,
        dd: record['dd/mm/yy'].split('/')[0],
        'mm/yy': record['dd/mm/yy'].split('/').slice(1).join('/'),
        list_value: record.value
      }));
      const response = await fetch('http://localhost:5000/save-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ records: metadataRecords })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Lỗi không xác định');
      metadataIds = data.metadata_ids;
      logMessage('Đã lưu metadata vào collection metadata.', 'success');
    } catch (error) {
      logMessage(`Lỗi khi lưu metadata: ${error.message}`, 'error');
      return;
    }

    // Đóng overlay log và mở overlay lịch
    logOverlay.style.display = 'none';
    calendarOverlay.style.display = 'flex';
    lastDate = dates[dates.length - 1];
    displayCalendar(lastDate);
  });

  // Xử lý chọn ngày trên lịch
  calendarGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('calendar-day')) {
      const selectedDate = e.target.dataset.date;
      const selectedMoment = moment(selectedDate, 'DD/MM/YY');

      if (!selectedStartDate) {
        selectedStartDate = selectedMoment;
        e.target.classList.add('selected');
      } else if (!selectedEndDate && (selectedMoment.isSame(selectedStartDate) || selectedMoment.isAfter(selectedStartDate))) {
        selectedEndDate = selectedMoment;
        const days = document.querySelectorAll('.calendar-day');
        days.forEach(day => {
          const dayMoment = moment(day.dataset.date, 'DD/MM/YY');
          if (dayMoment.isSameOrAfter(selectedStartDate) && dayMoment.isSameOrBefore(selectedEndDate)) {
            day.classList.add('selected');
          }
        });
      } else {
        selectedStartDate = selectedMoment;
        selectedEndDate = null;
        const days = document.querySelectorAll('.calendar-day');
        days.forEach(day => day.classList.remove('selected'));
        e.target.classList.add('selected');
      }
    }
  });

  // Xử lý nút Xác Nhận ngày dự đoán
  confirmDatesBtn.addEventListener('click', async () => {
    if (!selectedStartDate || !selectedEndDate) {
      logMessage('Lỗi: Vui lòng chọn khoảng ngày dự đoán (bắt đầu và kết thúc)!', 'error');
      return;
    }

    const daysDiff = selectedEndDate.diff(selectedStartDate, 'days') + 1;
    if (daysDiff > 30) {
      logMessage('Lỗi: Số ngày dự đoán không được vượt quá 30 ngày!', 'error');
      return;
    }

    // Tạo danh sách ngày dự đoán
    predictionDates = [];
    let currentDate = selectedStartDate.clone();
    while (currentDate.isSameOrBefore(selectedEndDate)) {
      predictionDates.push(currentDate.format('DD/MM/YY'));
      currentDate.add(1, 'day');
    }

    // Đóng overlay lịch và mở overlay tiến trình
    calendarOverlay.style.display = 'none';
    progressOverlay.style.display = 'flex';
    progressBar.style.width = '0%';

    // Giả lập tiến trình predict
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 10;
      progressBar.style.width = `${progress}%`;
      if (progress >= 100) {
        clearInterval(progressInterval);
        performPrediction();
      }
    }, 300);

    // Thực hiện dự đoán
    async function performPrediction() {
      try {
        const response = await fetch('http://localhost:5000/predict', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prediction_dates: predictionDates
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Lỗi không xác định');
        predictionResults = data.results;
        logMessage('Hoàn tất quá trình predict!', 'success');

        // Lưu prediction vào collection prediction
        try {
          const response = await fetch('http://localhost:5000/save-prediction', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              metadata_ids: metadataIds,
              image_id: imageId,
              predictions: predictionResults
            })
          });
          const saveData = await response.json();
          if (!response.ok) throw new Error(saveData.message || 'Lỗi không xác định');
          logMessage('Đã lưu lịch sử dự đoán vào collection prediction.', 'success');
        } catch (error) {
          logMessage(`Lỗi khi lưu lịch sử dự đoán: ${error.message}`, 'error');
        }

        // Đóng overlay tiến trình và mở overlay kết quả
        progressOverlay.style.display = 'none';
        resultOverlay.style.display = 'flex';
        displayResults();
      } catch (error) {
        logMessage(`Lỗi khi dự đoán: ${error.message}`, 'error');
        progressOverlay.style.display = 'none';
      }
    }
  });

  // Hiển thị kết quả
  function displayResults() {
    calendarGridResult.innerHTML = '';
    resultDetails.innerHTML = '';

    // Hiển thị lịch chỉ với các ngày đã dự đoán
    predictionDates.forEach(date => {
      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day';
      dayDiv.dataset.date = date;
      dayDiv.textContent = date;
      calendarGridResult.appendChild(dayDiv);
    });

    const days = document.querySelectorAll('#calendar-grid-result .calendar-day');
    days.forEach(day => {
      const dayDate = day.dataset.date;
      const result = predictionResults.find(r => r[0] === dayDate);
      if (result) {
        day.addEventListener('click', () => {
          resultDetails.innerHTML = `Ngày ${dayDate}: Lượng nước dự đoán: ${result[1]}`;
        });
      }
    });
  }

  // Tải xuống kết quả
  downloadResultBtn.addEventListener('click', () => {
    const csvContent = predictionResults.map(r => `${r[0]},${r[1]}`).join('\n');
    const csvHeader = 'Date,WaterLevel\n';
    const csvFile = new Blob([csvHeader + csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(csvFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prediction_results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  });

  // Hiển thị lịch (30 ngày ban đầu)
  function displayCalendar(lastDate) {
    calendarGrid.innerHTML = '';
    const startDate = lastDate.clone().add(1, 'day');
    for (let i = 0; i < 30; i++) {
      const date = startDate.clone().add(i, 'day');
      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day';
      dayDiv.dataset.date = date.format('DD/MM/YY');
      dayDiv.textContent = date.format('DD/MM/YY');
      calendarGrid.appendChild(dayDiv);
    }
  }

  // Đọc file CSV
  function parseCSV(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target.result;
          const rows = text.split('\n').filter(row => row.trim());
          const headers = rows[0].split(',').map(header => header.trim());
          
          const data = rows.slice(1).map(row => {
            // Tách thủ công để giữ nguyên phần value trong []
            const firstCommaIndex = row.indexOf(',');
            const datePart = row.substring(0, firstCommaIndex).trim();
            const valuePart = row.substring(firstCommaIndex + 1).trim();
            
            const record = {};
            headers.forEach((header, index) => {
              if (header === 'value') {
                try {
                  // Sửa lỗi cú pháp dấu ngoặc kép thừa
                  let cleanedValue = valuePart.replace(/""/g, '"');
                  // Loại bỏ dấu [ và ] ở đầu và cuối
                  if (!cleanedValue.startsWith('[') || !cleanedValue.endsWith(']')) {
                    throw new Error('Định dạng trường value không hợp lệ');
                  }
                  cleanedValue = cleanedValue.slice(1, -1); // Bỏ [ và ]

                  // Tách các tuple
                  const tuples = [];
                  let currentTuple = '';
                  let insideTuple = false;
                  for (let i = 0; i < cleanedValue.length; i++) {
                    const char = cleanedValue[i];
                    if (char === '(' && !insideTuple) {
                      insideTuple = true;
                      currentTuple = '';
                    } else if (char === ')' && insideTuple) {
                      insideTuple = false;
                      tuples.push(currentTuple);
                    } else if (char === ',' && !insideTuple) {
                      continue; // Bỏ qua dấu phẩy giữa các tuple
                    } else {
                      currentTuple += char;
                    }
                  }

                  // Parse từng tuple
                  record[header] = tuples.map(tuple => {
                    // Tách name và value trong tuple
                    const parts = tuple.split(',').map(part => part.trim());
                    if (parts.length !== 2) {
                      throw new Error('Mỗi phần tử trong trường value phải là một cặp (name, value)');
                    }
                    let name = parts[0];
                    let value = parts[1];

                    // Xử lý name: Loại bỏ dấu ngoặc kép nếu có
                    if (name.startsWith('"') && name.endsWith('"')) {
                      name = name.slice(1, -1);
                    }

                    // Xử lý value: Chuyển thành số nếu có thể
                    const numericValue = parseFloat(value);
                    value = isNaN(numericValue) ? value : numericValue;

                    return { name, value };
                  });
                } catch (error) {
                  throw new Error(`Lỗi parse trường value: ${error.message}`);
                }
              } else {
                record[header] = datePart;
              }
            });
            return record;
          });
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Lỗi khi đọc file CSV'));
      reader.readAsText(file);
    });
  }

  // Hiển thị thông báo
  function logMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message p-2 rounded-lg text-white ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`;
    messageDiv.textContent = message;
    logMessages.appendChild(messageDiv);
    logMessages.scrollTop = logMessages.scrollHeight;
  }
});