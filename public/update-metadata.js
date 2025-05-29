document.addEventListener('DOMContentLoaded', () => {
  const accessBtn = document.getElementById('access-btn');
  const passwordInput = document.getElementById('password');
  const metadataSection = document.getElementById('metadata-section');
  const updateMetadataBtn = document.getElementById('update-metadata-btn');
  const metadataFileInput = document.getElementById('metadata-file');
  const updateResult = document.getElementById('update-result');
  const toggleRecordsBtn = document.getElementById('toggle-records-btn');
  const recordsList = document.getElementById('records-list');
  const deleteResult = document.getElementById('delete-result');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const pageInfo = document.getElementById('page-info');

  const correctPassword = 'admin123';
  let isRecordsVisible = false;
  let currentPage = 1;
  let totalPages = 1;
  const recordsPerPage = 10;
  let allRecords = [];

  // Xử lý truy cập trang
  accessBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const password = passwordInput.value;
    if (password === correctPassword) {
      metadataSection.classList.remove('hidden');
      passwordInput.parentElement.parentElement.parentElement.classList.add('hidden');
      loadRecords();
    } else {
      alert('Mật khẩu không đúng!');
    }
  });

  // Xử lý cập nhật metadata
  updateMetadataBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const file = metadataFileInput.files[0];
    if (!file) {
      showMessage('Vui lòng chọn một file JSON!', 'error', updateResult);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const metadata = JSON.parse(event.target.result);
        const response = await fetch('localhost:5000/update-metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metadata)
        });

        const data = await response.json();
        if (response.ok) {
          showMessage('Cập nhật metadata thành công!', 'success', updateResult);
          loadRecords(); // Cập nhật lại danh sách sau khi thêm metadata
        } else {
          showMessage(`Cập nhật thất bại: ${data.message || 'Lỗi không xác định'}`, 'error', updateResult);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      showMessage(`Lỗi khi xử lý file JSON: ${error.message}`, 'error', updateResult);
    }
  });

  // Xử lý thu gọn/hiển thị danh sách
  toggleRecordsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isRecordsVisible = !isRecordsVisible;
    recordsList.classList.toggle('hidden', !isRecordsVisible);
    toggleRecordsBtn.innerHTML = `
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isRecordsVisible ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'}" />
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

  // Tải danh sách bản ghi từ collection image
  async function loadRecords() {
    try {
      const response = await fetch('localhost:5000/get-image-records');
      const data = await response.json();
      if (response.ok) {
        allRecords = data.records;
        totalPages = Math.ceil(allRecords.length / recordsPerPage);
        currentPage = 1;
        displayRecords();
      } else {
        showMessage(`Lỗi khi tải danh sách: ${data.message || 'Lỗi không xác định'}`, 'error', deleteResult);
      }
    } catch (error) {
      showMessage(`Lỗi khi tải danh sách: ${error.message}`, 'error', deleteResult);
    }
  }

  // Hiển thị danh sách bản ghi
  function displayRecords() {
    recordsList.innerHTML = '';

    // Tính toán bản ghi hiển thị trên trang hiện tại
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    const pageRecords = allRecords.slice(startIndex, endIndex);

    // Hiển thị bản ghi từ collection image
    pageRecords.forEach(record => {
      const recordElement = document.createElement('div');
      recordElement.className = 'flex justify-between items-center p-4 bg-gray-800 rounded-lg';
      recordElement.innerHTML = `
        <div>
          <p><strong>File:</strong> ${record.filename}</p>
          <p><strong>Thời gian:</strong> ${new Date(record.date).toLocaleString()}</p>
        </div>
        <button class="delete-btn bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg flex items-center" data-id="${record._id}" data-type="image">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Xóa
        </button>
      `;
      recordsList.appendChild(recordElement);
    });

    // Cập nhật thông tin phân trang
    pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;

    // Thêm sự kiện cho các nút xóa
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        try {
          const response = await fetch('localhost:5000/delete-record', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, type })
          });

          const data = await response.json();
          if (response.ok) {
            showMessage('Xóa bản ghi thành công!', 'success', deleteResult);
            loadRecords(); // Cập nhật lại danh sách
          } else {
            showMessage(`Xóa thất bại: ${data.message || 'Lỗi không xác định'}`, 'error', deleteResult);
          }
        } catch (error) {
          showMessage(`Lỗi khi xóa bản ghi: ${error.message}`, 'error', deleteResult);
        }
      });
    });
  }

  // Hàm hiển thị thông báo
  function showMessage(message, type, container) {
    container.innerHTML = `
      <div class="message p-4 rounded-lg text-white font-semibold 
        ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}">
        ${message}
      </div>
    `;
  }
});