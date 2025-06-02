document.addEventListener('DOMContentLoaded', () => {
  const accessBtn = document.getElementById('access-btn');
  const passwordInput = document.getElementById('password');
  const passwordSection = document.getElementById('password-section');
  const metadataSection = document.getElementById('metadata-section');
  const toggleRecordsBtn = document.getElementById('toggle-records-btn');
  const recordsList = document.getElementById('records-list');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const pageInfo = document.getElementById('page-info');
  const createMetadataBtn = document.getElementById('create-metadata-btn');
  const metadataFormContainer = document.getElementById('metadata-form-container');
  const metadataForm = document.getElementById('metadata-form');
  const selectImageBtn = document.getElementById('select-image-btn');
  const imageTableContainer = document.getElementById('image-table-container');
  const imageTable = document.getElementById('image-table');
  const dateInput = document.getElementById('date-input');
  const addValueBtn = document.getElementById('add-value-btn');
  const valuesContainer = document.getElementById('values-container');
  const updateMetadataBtn = document.getElementById('update-metadata-btn');
  const cancelMetadataBtn = document.getElementById('cancel-metadata-btn');

  const correctPassword = 'admin123';
  let isRecordsVisible = false;
  let currentPage = 1;
  let totalPages = 1;
  const recordsPerPage = 10;
  let allRecords = [];
  let selectedImageId = null;

  // Xử lý truy cập trang
  accessBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Nút Truy Cập được nhấn, mật khẩu:', passwordInput.value);
    const password = passwordInput.value;
    if (password === correctPassword) {
      console.log('Mật khẩu đúng, hiển thị metadata-section');
      passwordSection.style.display = 'none';
      metadataSection.style.display = 'block';
      isRecordsVisible = true;
      recordsList.style.display = 'block';
      toggleRecordsBtn.innerHTML = `
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
        Thu Gọn Danh Sách
      `;
      console.log('metadata-section display:', getComputedStyle(metadataSection).display);
      console.log('records-list display:', getComputedStyle(recordsList).display);
      loadRecords();
    } else {
      alert('Mật khẩu không đúng!');
    }
  });

  // Xử lý thu gọn/hiển thị danh sách
  toggleRecordsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isRecordsVisible = !isRecordsVisible;
    recordsList.style.display = isRecordsVisible ? 'block' : 'none';
    toggleRecordsBtn.innerHTML = `
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isRecordsVisible ? 'M19 9l-7 7-7-7' : 'M5 15l-7-7 7 7'}" />
      </svg>
      ${isRecordsVisible ? 'Thu Gọn' : 'Hiển Thị'} Danh Sách
    `;
    if (isRecordsVisible) {
      displayRecords();
    }
  });

  // Xử lý phân trang
  prevPageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentPage > 1) {
      currentPage--;
      displayRecords();
    }
  });

  nextPageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentPage < totalPages) {
      currentPage++;
      displayRecords();
    }
  });

  // Xử lý nút tạo metadata mới
  createMetadataBtn.addEventListener('click', (e) => {
    e.preventDefault();
    metadataFormContainer.classList.remove('hidden');
    selectedImageId = null;
    dateInput.value = '';
    valuesContainer.innerHTML = '';
    addValueField(valuesContainer);
  });

  // Xử lý nút hủy form tạo
  cancelMetadataBtn.addEventListener('click', (e) => {
    e.preventDefault();
    metadataFormContainer.classList.add('hidden');
  });

  // Xử lý chọn ảnh liên kết
  selectImageBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    imageTableContainer.classList.remove('hidden');
    await loadImageRecords();
  });

  // Xử lý thêm cặp name/value (form tạo)
  addValueBtn.addEventListener('click', (e) => {
    e.preventDefault();
    addValueField(valuesContainer);
  });

  // Xử lý submit form tạo metadata
  metadataForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!selectedImageId) {
      showMessage('Vui lòng chọn một ảnh liên kết!', 'error');
      return;
    }

    const date = dateInput.value;
    if (!date.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
      showMessage('Định dạng ngày không hợp lệ. Sử dụng dd/mm/yy (ví dụ: 25/08/23)!', 'error');
      return;
    }

    const values = [];
    const valueRows = valuesContainer.querySelectorAll('.value-row');
    for (const row of valueRows) {
      const nameInput = row.querySelector('.name-input').value.trim();
      const valueInput = row.querySelector('.value-input').value.trim();
      if (nameInput && valueInput) {
        values.push([nameInput, valueInput]);
      }
    }

    if (values.length === 0) {
      showMessage('Vui lòng thêm ít nhất một cặp name/value!', 'error');
      return;
    }

    try {
      console.log('Gửi yêu cầu tạo metadata:', { id_image: selectedImageId, date, list_value: values });
      const response = await fetch('http://localhost:5000/update-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id_image: selectedImageId,
          date: date,
          list_value: values
        })
      });

      const data = await response.json();
      console.log('Phản hồi từ server (update-metadata):', data);
      if (response.ok) {
        showMessage('Cập nhật metadata thành công!', 'success');
        metadataFormContainer.classList.add('hidden');
        loadRecords();
      } else {
        showMessage(`Cập nhật thất bại: ${data.message || 'Lỗi không xác định'}`, 'error');
      }
    } catch (error) {
      console.error('Lỗi khi gửi yêu cầu tạo metadata:', error);
      showMessage(`Lỗi khi cập nhật metadata: ${error.message}`, 'error');
    }
  });

  // Tải danh sách bản ghi metadata
  async function loadRecords() {
    try {
      console.log('Bắt đầu tải danh sách metadata');
      const response = await fetch('http://localhost:5000/get-metadata-records');
      console.log('Phản hồi từ server (get-metadata-records):', response.status, response.statusText);
      const data = await response.json();
      console.log('Dữ liệu nhận được:', data);
      if (response.ok) {
        allRecords = data.records || [];
        console.log('Số bản ghi metadata nhận được:', allRecords.length);
        totalPages = Math.ceil(allRecords.length / recordsPerPage) || 1;
        console.log('Tổng số trang:', totalPages);
        currentPage = 1;
        displayRecords();
      } else {
        showMessage(`Lỗi khi tải danh sách: ${data.message || 'Lỗi không xác định'}`, 'error');
      }
    } catch (error) {
      console.error('Lỗi khi tải danh sách:', error);
      showMessage(`Lỗi khi tải danh sách: ${error.message}`, 'error');
    }
  }

  // Hiển thị danh sách bản ghi metadata
  function displayRecords() {
    recordsList.innerHTML = '';
    console.log('Hiển thị trang:', currentPage);

    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = Math.min(startIndex + recordsPerPage, allRecords.length);
    const pageRecords = allRecords.slice(startIndex, endIndex);
    console.log('Bản ghi trên trang:', pageRecords);

    if (pageRecords.length === 0) {
      recordsList.innerHTML = '<p class="p-4 text-gray-400">Không có bản ghi metadata nào.</p>';
      pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
      prevPageBtn.disabled = true;
      nextPageBtn.disabled = true;
      return;
    }

    const table = document.createElement('table');
    table.className = 'w-full text-left border-collapse';
    table.innerHTML = `
      <thead>
        <tr>
          <th class="p-2">ID Image</th>
          <th class="p-2">Ngày (dd)</th>
          <th class="p-2">Tháng/Năm (mm/yy)</th>
          <th class="p-2">Values</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;

    const tbody = table.querySelector('tbody');
    pageRecords.forEach(record => {
      console.log('Thêm bản ghi:', record);
      const row = document.createElement('tr');
      row.className = 'border-b';
      const idImage = record.id_image?.toString() || 'N/A';
      const dd = record.dd || (record.date ? new Date(record.date).getDate().toString().padStart(2, '0') : 'N/A');
      const mmYY = record['mm/yy'] || (record.date ? moment(record.date).format('MM/YY') : 'N/A');
      const values = Array.isArray(record.list_value) 
        ? record.list_value.map(v => {
            if (typeof v === 'object' && v.name && v.value !== undefined) {
              return `(${v.name}, ${v.value})`;
            }
            return '(N/A, N/A)';
          })
        : [];
      const valuesString = values.length > 0 ? `[${values.join(', ')}]` : '[]';

      row.innerHTML = `
        <td class="p-2">${idImage}</td>
        <td class="p-2">${dd}</td>
        <td class="p-2">${mmYY}</td>
        <td class="p-2">${valuesString}</td>
      `;
      tbody.appendChild(row);
    });

    console.log('Bảng đã tạo:', table.outerHTML);
    recordsList.innerHTML = '';
    recordsList.appendChild(table);
    recordsList.style.display = 'block';
    console.log('records-list classes:', recordsList.classList);
    console.log('records-list display:', getComputedStyle(recordsList).display);

    pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
  }

  // Tải danh sách bản ghi image để chọn
  async function loadImageRecords() {
    try {
      console.log('Bắt đầu tải danh sách ảnh');
      const response = await fetch('http://localhost:5000/get-image-records');
      console.log('Phản hồi từ server (get-image-records):', response.status, response.statusText);
      const data = await response.json();
      console.log('Dữ liệu nhận được:', data);
      if (response.ok) {
        displayImageTable(data.records || []);
      } else {
        showMessage(`Lỗi khi tải danh sách ảnh: ${data.message || 'Lỗi không xác định'}`, 'error');
      }
    } catch (error) {
      console.error('Lỗi khi tải danh sách ảnh:', error);
      showMessage(`Lỗi khi tải danh sách ảnh: ${error.message}`, 'error');
    }
  }

  // Hiển thị bảng image
  function displayImageTable(records) {
    imageTable.innerHTML = `
      <thead>
        <tr class="bg-gray-700">
          <th class="p-2">Ảnh</th>
          <th class="p-2">Tên File</th>
          <th class="p-2">Ngày</th>
          <th class="p-2">Hành động</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;

    const tbody = imageTable.querySelector('tbody');
    records.forEach(record => {
      const row = document.createElement('tr');
      row.className = 'bg-gray-800 border-b';
      row.innerHTML = `
        <td class="p-2"><img src="/get-image/${record.file_id}" alt="Thumbnail" class="w-16 h-16 object-cover"></td>
        <td class="p-2">${record.filename}</td>
        <td class="p-2">${new Date(record.date).toLocaleString()}</td>
        <td class="p-2">
          <button class="select-image-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-3 rounded-lg" data-id="${record._id}">Chọn</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    document.querySelectorAll('.select-image-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedImageId = e.target.dataset.id;
        imageTableContainer.classList.add('hidden');
        showMessage(`Đã chọn ảnh ID: ${selectedImageId}`, 'success');
      });
    });

    document.getElementById('close-image-table').addEventListener('click', () => {
      imageTableContainer.classList.add('hidden');
    });
  }

  // Thêm cặp name/value
  function addValueField(container) {
    const row = document.createElement('div');
    row.className = 'value-row flex space-x-2 mb-2';
    row.innerHTML = `
      <input type="text" class="name-input flex-1 p-2 bg-gray-800 border border-gray-600 rounded-lg text-white" placeholder="Name" required>
      <input type="text" class="value-input flex-1 p-2 bg-gray-800 border border-gray-600 rounded-lg text-white" placeholder="Value" required>
      <button class="remove-value-btn bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg">X</button>
    `;
    container.appendChild(row);

    row.querySelector('.remove-value-btn').addEventListener('click', (e) => {
      e.preventDefault();
      row.remove();
    });
  }

  // Hàm hiển thị thông báo
  function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `p-4 rounded-lg text-white font-semibold ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`;
    messageDiv.textContent = message;
    recordsList.prepend(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
  }
});