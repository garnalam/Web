document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('login-section');
  const adminSection = document.getElementById('admin-section');
  const passwordInput = document.getElementById('password-input');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const changePasswordBtn = document.getElementById('change-password-btn');
  const changePasswordOverlay = document.getElementById('change-password-overlay');
  const changePasswordClose = document.getElementById('change-password-close');
  const newPasswordInput = document.getElementById('new-password-input');
  const confirmChangePasswordBtn = document.getElementById('confirm-change-password-btn');
  const imageBtn = document.getElementById('image-btn');
  const metadataBtn = document.getElementById('metadata-btn');
  const predictionBtn = document.getElementById('prediction-btn');
  const recordsOverlay = document.getElementById('records-overlay');
  const recordsClose = document.getElementById('records-close');
  const recordsTitle = document.getElementById('records-title');
  const recordsList = document.getElementById('records-list');
  const pagination = document.getElementById('pagination');
  const editRecordOverlay = document.getElementById('edit-record-overlay');
  const editRecordClose = document.getElementById('edit-record-close');
  const editRecordTitle = document.getElementById('edit-record-title');
  const editRecordForm = document.getElementById('edit-record-form');
  const saveEditBtn = document.getElementById('save-edit-btn');

  let currentCollection = '';
  let currentPage = 1;
  let totalPages = 1;
  let currentRecordId = '';

  // Kiểm tra trạng thái đăng nhập khi tải trang
  fetch('/admin/check-auth')
    .then(response => response.json())
    .then(data => {
      if (data.isAuthenticated) {
        loginSection.classList.add('hidden');
        adminSection.classList.remove('hidden');
      }
    });

  // Đăng nhập
  loginBtn.addEventListener('click', () => {
    const password = passwordInput.value;
    const passwordHash = md5(password);
    fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passwordHash })
    })
      .then(response => response.json())
      .then(data => {
        if (data.message === 'Đăng nhập thành công') {
          loginSection.classList.add('hidden');
          adminSection.classList.remove('hidden');
        } else {
          alert('Mật khẩu không đúng');
        }
      });
  });

  // Đăng xuất
  logoutBtn.addEventListener('click', () => {
    fetch('/admin/logout', { method: 'POST' })
      .then(() => {
        loginSection.classList.remove('hidden');
        adminSection.classList.add('hidden');
      });
  });

  // Mở overlay đổi mật khẩu
  changePasswordBtn.addEventListener('click', () => {
    changePasswordOverlay.style.display = 'flex';
  });

  // Đóng overlay đổi mật khẩu
  changePasswordClose.addEventListener('click', () => {
    changePasswordOverlay.style.display = 'none';
  });

  // Xác nhận đổi mật khẩu
  confirmChangePasswordBtn.addEventListener('click', () => {
    const newPassword = newPasswordInput.value;
    const newPasswordHash = md5(newPassword);
    fetch('/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPasswordHash })
    })
      .then(response => response.json())
      .then(data => {
        alert(data.message);
        changePasswordOverlay.style.display = 'none';
      });
  });

  // Mở overlay danh sách bản ghi
  function openRecordsOverlay(collection, title) {
    currentCollection = collection;
    recordsTitle.textContent = title;
    currentPage = 1;
    fetchRecords();
    recordsOverlay.style.display = 'flex';
  }

  // Đóng overlay danh sách bản ghi
  recordsClose.addEventListener('click', () => {
    recordsOverlay.style.display = 'none';
  });

  // Lấy danh sách bản ghi
  function fetchRecords() {
    fetch(`/admin/${currentCollection}?page=${currentPage}`)
      .then(response => response.json())
      .then(data => {
        recordsList.innerHTML = '';
        totalPages = data.totalPages;

        if (currentCollection === 'images') {
          data.records.forEach(record => {
            const recordDiv = document.createElement('div');
            recordDiv.className = 'bg-gray-700 p-4 rounded-lg flex justify-between items-center';
            recordDiv.innerHTML = `
              <div>
                <p><strong>_id:</strong> ${record._id}</p>
                <p><strong>Date:</strong> ${new Date(record.date).toISOString()}</p>
                <p><strong>mm/yy:</strong> ${record['mm/yy']}</p>
                <p><strong>Image:</strong> <img src="/get-image/${record.id_file}" class="w-16 h-16 object-cover rounded" alt="Image"></p>
                <p><strong>Mask Image:</strong> ${
                  record.mask_image && record.mask_image.id_file
                    ? `<img src="/get-image/${record.mask_image.id_file}" class="w-16 h-16 object-cover rounded" alt="Mask Image">`
                    : '<div class="w-16 h-16 bg-gray-300 rounded"></div>'
                }</p>
              </div>
              <div class="space-x-2">
                <button class="edit-btn bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-400" data-id="${record._id}">Chỉnh Sửa</button>
                <button class="delete-btn bg-red-500 text-white px-3 py-1 rounded hover:bg-red-400" data-id="${record._id}">Xóa</button>
              </div>
            `;
            recordsList.appendChild(recordDiv);
          });
        } else if (currentCollection === 'metadata') {
          data.records.forEach(record => {
            const recordDiv = document.createElement('div');
            recordDiv.className = 'bg-gray-700 p-4 rounded-lg flex justify-between items-center';
            recordDiv.innerHTML = `
              <div>
                <p><strong>_id:</strong> ${record._id}</p>
                <p><strong>dd/mm/yy:</strong> ${record.dd}/${record['mm/yy']}</p>
                <p><strong>List Value:</strong></p>
                <ul class="list-disc list-inside">
                  ${record.list_value.map(item => `<li>(${item.name}, ${item.value})</li>`).join('')}
                </ul>
              </div>
              <div class="space-x-2">
                <button class="edit-btn bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-400" data-id="${record._id}">Chỉnh Sửa</button>
                <button class="delete-btn bg-red-500 text-white px-3 py-1 rounded hover:bg-red-400" data-id="${record._id}">Xóa</button>
              </div>
            `;
            recordsList.appendChild(recordDiv);
          });
        } else if (currentCollection === 'predictions') {
          data.records.forEach(record => {
            const recordDiv = document.createElement('div');
            recordDiv.className = 'bg-gray-700 p-4 rounded-lg flex justify-between items-center';
            recordDiv.innerHTML = `
              <div>
                <p><strong>_id:</strong> ${record._id}</p>
                <p><strong>Image:</strong> <img id="image-${record._id}" class="w-16 h-16 object-cover rounded" alt="Image"></p>
                <p><strong>Predictions:</strong></p>
                <ul class="list-disc list-inside">
                  ${record.predictions.map(item => `<li>(${item[0]}, ${item[1]})</li>`).join('')}
                </ul>
              </div>
              <div class="space-x-2">
                <button class="edit-btn bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-400" data-id="${record._id}">Chỉnh Sửa</button>
                <button class="delete-btn bg-red-500 text-white px-3 py-1 rounded hover:bg-red-400" data-id="${record._id}">Xóa</button>
              </div>
            `;
            recordsList.appendChild(recordDiv);

            // Lấy ảnh từ id_image
            fetch(`/admin/images`)
              .then(response => response.json())
              .then(imageData => {
                const imageRecord = imageData.records.find(img => img._id === record.id_image.toString());
                if (imageRecord && imageRecord.mask_image && imageRecord.mask_image.id_file) {
                  document.getElementById(`image-${record._id}`).src = `/get-image/${imageRecord.mask_image.id_file}`;
                } else {
                  document.getElementById(`image-${record._id}`).style.backgroundColor = '#d1d5db';
                }
              });
          });
        }

        // Tạo phân trang
        pagination.innerHTML = `
          <button id="prev-page" class="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}">Trang trước</button>
          <input id="page-input" type="number" min="1" max="${totalPages}" value="${currentPage}" class="w-16 p-1 bg-gray-700 border border-yellow-500 border-opacity-30 rounded-lg text-center text-gray-200">
          <span>/ ${totalPages}</span>
          <button id="next-page" class="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}">Trang sau</button>
        `;

        document.getElementById('prev-page').addEventListener('click', () => {
          if (currentPage > 1) {
            currentPage--;
            fetchRecords();
          }
        });

        document.getElementById('next-page').addEventListener('click', () => {
          if (currentPage < totalPages) {
            currentPage++;
            fetchRecords();
          }
        });

        document.getElementById('page-input').addEventListener('change', (e) => {
          let newPage = parseInt(e.target.value);
          if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            fetchRecords();
          } else {
            e.target.value = currentPage;
          }
        });

        // Thêm sự kiện cho nút chỉnh sửa và xóa
        document.querySelectorAll('.edit-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            currentRecordId = btn.dataset.id;
            if (currentCollection === 'images') {
              editRecordOverlay.style.display = 'flex';
              editRecordTitle.textContent = 'Chỉnh Sửa Bản Ghi Image';
              const record = data.records.find(r => r._id === currentRecordId);
              editRecordForm.innerHTML = `
                <div class="mb-4">
                  <label class="block mb-2 text-sm font-medium">mm/yy:</label>
                  <input id="edit-mm-yy" type="text" value="${record['mm/yy']}" class="w-full p-2 bg-gray-700 border border-yellow-500 border-opacity-30 rounded-lg text-gray-200">
                </div>
              `;
            } else if (currentCollection === 'metadata') {
              editRecordOverlay.style.display = 'flex';
              editRecordTitle.textContent = 'Chỉnh Sửa Bản Ghi Metadata';
              const record = data.records.find(r => r._id === currentRecordId);
              editRecordForm.innerHTML = `
                <div class="mb-4">
                  <label class="block mb-2 text-sm font-medium">dd:</label>
                  <input id="edit-dd" type="text" value="${record.dd}" class="w-full p-2 bg-gray-700 border border-yellow-500 border-opacity-30 rounded-lg text-gray-200">
                </div>
                <div class="mb-4">
                  <label class="block mb-2 text-sm font-medium">mm/yy:</label>
                  <input id="edit-mm-yy" type="text" value="${record['mm/yy']}" class="w-full p-2 bg-gray-700 border border-yellow-500 border-opacity-30 rounded-lg text-gray-200">
                </div>
                <div class="mb-4">
                  <label class="block mb-2 text-sm font-medium">List Value (dạng JSON array, ví dụ: [["area", "10000"], ["depth", "2.5"]]):</label>
                  <textarea id="edit-list-value" class="w-full p-2 bg-gray-700 border border-yellow-500 border-opacity-30 rounded-lg text-gray-200 h-32">${JSON.stringify(record.list_value.map(item => [item.name, item.value]))}</textarea>
                </div>
              `;
            } else if (currentCollection === 'predictions') {
              editRecordOverlay.style.display = 'flex';
              editRecordTitle.textContent = 'Chỉnh Sửa Bản Ghi Prediction';
              const record = data.records.find(r => r._id === currentRecordId);
              editRecordForm.innerHTML = `
                <div class="mb-4">
                  <label class="block mb-2 text-sm font-medium">Predictions (dạng JSON array, ví dụ: [["26/09/24", "292"]]):</label>
                  <textarea id="edit-predictions" class="w-full p-2 bg-gray-700 border border-yellow-500 border-opacity-30 rounded-lg text-gray-200 h-32">${JSON.stringify(record.predictions)}</textarea>
                </div>
              `;
            }
          });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) {
              fetch(`/admin/${currentCollection === 'images' ? 'image' : currentCollection === 'metadata' ? 'metadata' : 'prediction'}/${btn.dataset.id}`, {
                method: 'DELETE'
              })
                .then(response => response.json())
                .then(data => {
                  alert(data.message);
                  fetchRecords();
                });
            }
          });
        });
      });
  }

  // Đóng overlay chỉnh sửa
  editRecordClose.addEventListener('click', () => {
    editRecordOverlay.style.display = 'none';
  });

  // Lưu chỉnh sửa
  saveEditBtn.addEventListener('click', () => {
    if (currentCollection === 'images') {
      const mm_yy = document.getElementById('edit-mm-yy').value;
      fetch(`/admin/image/${currentRecordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mm_yy })
      })
        .then(response => response.json())
        .then(data => {
          alert(data.message);
          editRecordOverlay.style.display = 'none';
          fetchRecords();
        });
    } else if (currentCollection === 'metadata') {
      const dd = document.getElementById('edit-dd').value;
      const mm_yy = document.getElementById('edit-mm-yy').value;
      const list_value = JSON.parse(document.getElementById('edit-list-value').value);
      fetch(`/admin/metadata/${currentRecordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dd, mm_yy, list_value })
      })
        .then(response => response.json())
        .then(data => {
          alert(data.message);
          editRecordOverlay.style.display = 'none';
          fetchRecords();
        });
    } else if (currentCollection === 'predictions') {
      const predictions = JSON.parse(document.getElementById('edit-predictions').value);
      fetch(`/admin/prediction/${currentRecordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions })
      })
        .then(response => response.json())
        .then(data => {
          alert(data.message);
          editRecordOverlay.style.display = 'none';
          fetchRecords();
        });
    }
  });

  // Mở overlay cho từng collection
  imageBtn.addEventListener('click', () => openRecordsOverlay('images', 'Danh Sách Bản Ghi Image'));
  metadataBtn.addEventListener('click', () => openRecordsOverlay('metadata', 'Danh Sách Bản Ghi Metadata'));
  predictionBtn.addEventListener('click', () => openRecordsOverlay('predictions', 'Danh Sách Bản Ghi Prediction'));
});