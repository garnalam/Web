document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('uploadForm');
  const resultDiv = document.getElementById('result');
  const btnText = document.getElementById('btn-text');
  const spinner = document.getElementById('spinner');
  const imageInput = document.getElementById('image');
  const previewImage = document.getElementById('preview-image');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const calendarContainer = document.getElementById('calendar-container');
  const calendarSection = document.getElementById('calendar-section');
  const calendar = document.getElementById('calendar');
  const waterLevel = document.getElementById('water-level');

  // Preview ảnh khi chọn file
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        previewImage.src = event.target.result;
        previewImage.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    } else {
      previewImage.src = '';
      previewImage.classList.add('hidden');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Hiển thị spinner, ẩn text
    btnText.textContent = 'Đang xử lý...';
    spinner.style.display = 'block';
    if (calendarSection) {
      calendarSection.classList.add('hidden');
    }
    if (progressContainer) {
      progressContainer.classList.add('hidden');
    }

    // Lấy dữ liệu từ form
    let datetimeInput = document.getElementById('datetime').value;
    const daysInput = parseInt(document.getElementById('days').value, 10);
    const file = imageInput.files[0];

    // Kiểm tra dữ liệu
    if (!file) {
      showMessage('Vui lòng chọn một file ảnh!', 'error');
      resetButton();
      return;
    }
    if (!datetimeInput) {
      showMessage('Vui lòng nhập ngày chụp ảnh!', 'error');
      resetButton();
      return;
    }
    if (isNaN(daysInput) || daysInput < 1 || daysInput > 30) {
      showMessage('Số ngày cần ước lượng phải từ 1 đến 30!', 'error');
      resetButton();
      return;
    }

    // Chuẩn hóa định dạng ngày (thêm số 0 nếu thiếu)
    const parts = datetimeInput.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      datetimeInput = `${day}/${month}/${year}`;
    }

    // Kiểm tra định dạng ngày
    const datetime = moment(datetimeInput, 'DD/MM/YYYY');
    if (!datetime.isValid()) {
      showMessage('Định dạng ngày không hợp lệ. Sử dụng DD/MM/YYYY (ví dụ: 28/05/2025)!', 'error');
      resetButton();
      return;
    }

    // Tạo FormData
    const formData = new FormData();
    formData.append('image', file);
    formData.append('datetime', datetimeInput);

    try {
      // Gửi request đến server với IP mới
      const response = await fetch('localhost:5000/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('Tải ảnh lên thành công!', 'success');
        // Reset preview sau khi upload thành công
        previewImage.src = '';
        previewImage.classList.add('hidden');
        form.reset();

        // Hiển thị thanh tiến trình
        if (progressContainer) {
          progressContainer.classList.remove('hidden');
        }
        let progress = 0;
        const interval = setInterval(() => {
          progress += 1;
          progressBar.style.width = `${progress}%`;
          progressText.textContent = `Đang ước lượng: ${progress}%`;
          if (progress >= 100) {
            clearInterval(interval);
            showCalendar(datetimeInput, daysInput);
          }
        }, 50);
      } else {
        showMessage(`Tải ảnh thất bại: ${data.message || 'Lỗi không xác định'}`, 'error');
      }
    } catch (error) {
      showMessage(`Tải ảnh thất bại: Lỗi kết nối server - ${error.message}`, 'error');
    } finally {
      resetButton();
    }
  });

  // Hàm hiển thị lịch
  function showCalendar(startDate, days) {
    calendar.innerHTML = '';
    const startMoment = moment(startDate, 'DD/MM/YYYY');
    // Tạo mực nước ngẫu nhiên có 3 chữ số (100-999) cho mỗi ngày
    const waterLevels = Array.from({ length: days }, () => Math.floor(Math.random() * 900) + 100);

    for (let i = 0; i < days; i++) {
      const day = startMoment.clone().add(i + 1, 'days');
      const dayElement = document.createElement('div');
      dayElement.classList.add('calendar-day');
      dayElement.textContent = day.format('DD/MM');
      dayElement.dataset.date = day.format('DD/MM/YYYY');
      dayElement.dataset.level = waterLevels[i];
      dayElement.addEventListener('click', () => {
        document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('active'));
        dayElement.classList.add('active');
        waterLevel.textContent = `Mực nước ước lượng ngày ${day.format('DD/MM/YYYY')}: ${waterLevels[i]} cm`;
      });
      calendar.appendChild(dayElement);
    }

    if (calendarSection) {
      calendarSection.classList.remove('hidden');
    }
    if (calendarContainer) {
      calendarContainer.classList.remove('hidden');
    }
    waterLevel.textContent = 'Chọn một ngày để xem mực nước ước lượng.';
  }

  // Hàm reset button
  function resetButton() {
    btnText.textContent = 'Xác Nhận';
    spinner.style.display = 'none';
  }

  // Hàm hiển thị thông báo
  function showMessage(message, type) {
    resultDiv.innerHTML = `
      <div class="message p-4 rounded-lg text-white font-semibold 
        ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}">
        ${message}
      </div>
    `;
  }
});