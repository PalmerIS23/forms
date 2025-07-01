// Конфигурация приложения
const APP_CONFIG = {
    appTitle: "Универсальная база данных",
    dbName: "UniversalDB",
    dbVersion: 2,
    storeName: "records",
    fields: [
        { name: "id", type: "hidden", label: "ID" },
        { name: "name", type: "text", label: "Название", required: true },
        { name: "description", type: "textarea", label: "Описание" },
        { name: "category", type: "select", label: "Категория", options: ["Категория 1", "Категория 2", "Категория 3"] },
        { name: "rating", type: "number", label: "Рейтинг", min: 1, max: 5 },
        { name: "createdAt", type: "date", label: "Дата создания" },
        { name: "image", type: "file", label: "Изображение" }
    ],
    searchFields: ["name", "description", "category"]
};

// Глобальные переменные
let db;
let currentRecordId = null;
let currentImage = null;
const MAX_DATE = new Date(2025, 6, 2); // 02.07.2025

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('app-title').textContent = APP_CONFIG.appTitle;
    await initDB();
    loadAllRecords();
    initUI();
    initSearch();
});

// Инициализация базы данных
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(APP_CONFIG.dbName, APP_CONFIG.dbVersion);

        request.onerror = (event) => {
            showError("Ошибка при открытии базы данных: " + event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(APP_CONFIG.storeName)) {
                const store = db.createObjectStore(APP_CONFIG.storeName, { keyPath: "id", autoIncrement: true });
                APP_CONFIG.searchFields.forEach(field => {
                    store.createIndex(field, field, { unique: false });
                });
            }
        };
    });
}

// Инициализация пользовательского интерфейса
function initUI() {
    document.getElementById('btn-show-all').addEventListener('click', loadAllRecords);
    document.getElementById('btn-add-new').addEventListener('click', () => showForm());

    document.querySelector('.close').addEventListener('click', hideModal);
    document.getElementById('modal-confirm').addEventListener('click', hideModal);

    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', importData);
}

// Загрузка изображения
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        currentImage = e.target.result;
        const preview = document.getElementById('image-preview');
        if (preview) {
            preview.innerHTML = `<img src="${currentImage}" alt="Предпросмотр" style="max-width: 100%;">`;
        }
    };
    reader.readAsDataURL(file);
}

// Инициализация поиска
function initSearch() {
    const searchFieldSelect = document.getElementById('search-field');

    APP_CONFIG.searchFields.forEach(field => {
        const fieldConfig = APP_CONFIG.fields.find(f => f.name === field);
        if (fieldConfig) {
            const option = document.createElement('option');
            option.value = field;
            option.textContent = fieldConfig.label;
            searchFieldSelect.appendChild(option);
        }
    });

    document.getElementById('btn-search').addEventListener('click', searchRecords);
    document.getElementById('btn-clear-search').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        loadAllRecords();
    });

    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchRecords();
    });
}

// Загрузка всех записей
function loadAllRecords() {
    const transaction = db.transaction([APP_CONFIG.storeName], "readonly");
    const store = transaction.objectStore(APP_CONFIG.storeName);
    const request = store.getAll();

    request.onerror = () => showError("Ошибка при загрузке записей");
    request.onsuccess = (event) => displayRecords(event.target.result);
}

// Отображение записей
function displayRecords(records) {
    const recordsList = document.getElementById('records-list');
    recordsList.innerHTML = '';

    if (records.length === 0) {
        recordsList.innerHTML = '<p>Нет записей для отображения</p>';
        return;
    }

    records.forEach(record => {
        const card = document.createElement('div');
        card.className = 'record-card';
        card.dataset.id = record.id;

        let html = `<h3>${record.name || 'Без названия'}</h3>`;

        if (record.image) {
            html += `<div class="card-image"><img src="${record.image}" alt="${record.name || ''}"></div>`;
        }

        APP_CONFIG.fields.forEach(field => {
            if (field.type !== 'hidden' && field.type !== 'file' && record[field.name] !== undefined) {
                html += `<p><strong>${field.label}:</strong> ${formatFieldValue(record[field.name], field)}</p>`;
            }
        });

        card.innerHTML = html;
        card.addEventListener('click', () => editRecord(record.id));
        recordsList.appendChild(card);
    });
}

// Форматирование значения поля
function formatFieldValue(value, field) {
    if (value === null || value === undefined) return 'Не указано';

    switch (field.type) {
        case 'date': return new Date(value).toLocaleDateString();
        case 'select': return value || 'Не выбрано';
        default: return value.toString();
    }
}

// Показать форму
function showForm(record = null) {
    const formContainer = document.getElementById('form-container');
    const formTitle = document.getElementById('form-title');
    const form = document.getElementById('record-form');

    form.innerHTML = '';

    if (record) {
        formTitle.textContent = 'Редактировать запись';
        currentRecordId = record.id;
        currentImage = record.image || null;
    } else {
        formTitle.textContent = 'Добавить новую запись';
        currentRecordId = null;
        currentImage = null;
        record = {};
    }

    // Создание полей формы
    APP_CONFIG.fields.forEach(field => {
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'form-group';

        if (field.type !== 'hidden') {
            const label = document.createElement('label');
            label.htmlFor = field.name;
            label.textContent = field.label;
            if (field.required) label.innerHTML += ' <span class="required">*</span>';
            fieldGroup.appendChild(label);
        }

        let input;

        switch (field.type) {
            case 'textarea':
                input = document.createElement('textarea');
                input.id = field.name;
                input.name = field.name;
                input.rows = 3;
                input.value = record[field.name] || '';
                break;

            case 'select':
                input = document.createElement('select');
                input.id = field.name;
                input.name = field.name;

                if (field.options) {
                    field.options.forEach(option => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        if (record[field.name] === option) optionElement.selected = true;
                        input.appendChild(optionElement);
                    });
                }
                break;

            case 'file':
                input = document.createElement('input');
                input.type = 'file';
                input.id = field.name;
                input.name = field.name;
                input.accept = 'image/*';
                input.addEventListener('change', handleImageUpload);
                break;

            case 'date':
                input = document.createElement('input');
                input.type = 'date';
                input.id = field.name;
                input.name = field.name;
                input.max = formatDateForInput(MAX_DATE);

                if (record[field.name]) {
                    const date = new Date(record[field.name]);
                    input.value = formatDateForInput(date);
                }
                break;

            case 'hidden':
                input = document.createElement('input');
                input.type = 'hidden';
                input.id = field.name;
                input.name = field.name;
                input.value = record[field.name] || '';
                break;

            default:
                input = document.createElement('input');
                input.type = field.type;
                input.id = field.name;
                input.name = field.name;
                input.value = record[field.name] || '';
                if (field.min) input.min = field.min;
                if (field.max) input.max = field.max;
        }

        if (field.required) input.required = true;
        fieldGroup.appendChild(input);

        // Превью изображения
        if (field.type === 'file' && record.image) {
            const preview = document.createElement('div');
            preview.id = 'image-preview';
            preview.className = 'image-preview';
            preview.innerHTML = `<img src="${record.image}" alt="Текущее изображение" style="max-width: 100%;">`;
            fieldGroup.appendChild(preview);
        }

        form.appendChild(fieldGroup);
    });

    // Кнопки формы
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'form-buttons';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Сохранить';
    saveBtn.className = 'btn-save';
    saveBtn.addEventListener('click', saveRecord);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.className = 'btn-cancel';
    cancelBtn.addEventListener('click', hideForm);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Удалить';
    deleteBtn.className = 'btn-delete';
    deleteBtn.style.display = currentRecordId ? 'block' : 'none';
    deleteBtn.addEventListener('click', deleteCurrentRecord);

    buttonsDiv.appendChild(saveBtn);
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(deleteBtn);
    form.appendChild(buttonsDiv);

    formContainer.classList.remove('hidden');
}

// Форматирование даты для input
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Скрыть форму
function hideForm() {
    document.getElementById('form-container').classList.add('hidden');
    currentRecordId = null;
    currentImage = null;
}

// Редактирование записи
function editRecord(id) {
    const transaction = db.transaction([APP_CONFIG.storeName], "readonly");
    const store = transaction.objectStore(APP_CONFIG.storeName);
    const request = store.get(Number(id));

    request.onerror = () => showError("Ошибка при загрузке записи");
    request.onsuccess = (event) => {
        if (event.target.result) showForm(event.target.result);
        else showError("Запись не найдена");
    };
}

// Сохранение записи
function saveRecord() {
    const record = {};
    let hasError = false;

    // Собираем данные из формы
    APP_CONFIG.fields.forEach(field => {
        const input = document.getElementById(field.name);
        if (!input) return;

        if (field.type !== 'file') {
            const value = input.value;

            // Проверка обязательных полей
            if (field.required && !value.trim()) {
                showError(`Поле "${field.label}" обязательно для заполнения`);
                input.focus();
                hasError = true;
                return;
            }

            switch (field.type) {
                case 'number':
                    record[field.name] = value ? Number(value) : null;
                    break;

                case 'date':
                    if (value) {
                        const selectedDate = new Date(value);
                        if (selectedDate > MAX_DATE) {
                            showError("Дата не может быть позже 02.07.2025");
                            hasError = true;
                        } else {
                            record[field.name] = selectedDate.toISOString();
                        }
                    } else {
                        record[field.name] = null;
                    }
                    break;

                default:
                    record[field.name] = value || null;
            }
        }
    });

    if (hasError) return;

    // Обработка изображения
    const imageInput = document.getElementById('image');
    if (imageInput && imageInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (e) => {
            record.image = e.target.result;
            saveToDatabase(record);
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        record.image = currentImage;
        saveToDatabase(record);
    }
}

// Сохранение в базу данных
function saveToDatabase(record) {
    // Добавляем дату создания для новых записей
    if (!currentRecordId && !record.createdAt) {
        record.createdAt = new Date().toISOString();
    }

    const transaction = db.transaction([APP_CONFIG.storeName], "readwrite");
    const store = transaction.objectStore(APP_CONFIG.storeName);

    let request;
    if (currentRecordId) {
        record.id = currentRecordId;
        request = store.put(record);
    } else {
        request = store.add(record);
    }

    request.onerror = (e) => {
        console.error("Ошибка сохранения:", e.target.error);
        showError("Ошибка при сохранении записи: " + e.target.error.message);
    };

    request.onsuccess = () => {
        hideForm();
        loadAllRecords();
        showMessage("Запись успешно сохранена");

        // Экспорт в JSON после сохранения
        exportData();
    };
}

// Удаление записи
function deleteCurrentRecord() {
    showConfirm("Вы уверены, что хотите удалить эту запись?", () => {
        const transaction = db.transaction([APP_CONFIG.storeName], "readwrite");
        const store = transaction.objectStore(APP_CONFIG.storeName);
        const request = store.delete(currentRecordId);

        request.onerror = () => showError("Ошибка при удалении записи");
        request.onsuccess = () => {
            hideForm();
            loadAllRecords();
            showMessage("Запись успешно удалена");
        };
    });
}

// Поиск записей
function searchRecords() {
    const searchTerm = document.getElementById('search-input').value.trim();
    const searchField = document.getElementById('search-field').value;

    if (!searchTerm) {
        loadAllRecords();
        return;
    }

    const transaction = db.transaction([APP_CONFIG.storeName], "readonly");
    const store = transaction.objectStore(APP_CONFIG.storeName);
    const index = store.index(searchField);
    const request = index.getAll();

    request.onerror = () => showError("Ошибка при поиске записей");
    request.onsuccess = (event) => {
        const results = event.target.result.filter(record =>
            String(record[searchField]).toLowerCase().includes(searchTerm.toLowerCase())
        );
        displayRecords(results);
    };
}

// Экспорт данных
function exportData() {
    const transaction = db.transaction([APP_CONFIG.storeName], "readonly");
    const store = transaction.objectStore(APP_CONFIG.storeName);
    const request = store.getAll();

    request.onerror = () => showError("Ошибка при экспорте данных");
    request.onsuccess = (event) => {
        const data = event.target.result;
        if (data.length === 0) {
            showMessage("Нет данных для экспорта");
            return;
        }

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `data_export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
}

// Импорт данных
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error("Неверный формат данных");

            showConfirm("Импортировать данные? Текущие данные будут заменены.", () => {
                const transaction = db.transaction([APP_CONFIG.storeName], "readwrite");
                const store = transaction.objectStore(APP_CONFIG.storeName);

                store.clear().onsuccess = () => {
                    data.forEach(item => store.add(item));

                    transaction.oncomplete = () => {
                        loadAllRecords();
                        showMessage(`Импортировано ${data.length} записей`);
                        event.target.value = '';
                    };

                    transaction.onerror = () => showError("Ошибка импорта");
                };
            });
        } catch (error) {
            showError("Ошибка обработки файла: " + error.message);
        }
    };
    reader.readAsText(file);
}

// Вспомогательные функции UI
function showMessage(msg) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-message').textContent = msg;
    modal.classList.remove('hidden');
}

function showError(msg) {
    showMessage("Ошибка: " + msg);
}

function showConfirm(msg, callback) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-message').textContent = msg;
    const confirmBtn = document.getElementById('modal-confirm');

    // Сохраняем оригинальный обработчик
    const originalHandler = confirmBtn.onclick;

    confirmBtn.onclick = () => {
        callback();
        hideModal();
        // Восстанавливаем оригинальный обработчик
        confirmBtn.onclick = originalHandler;
    };

    modal.classList.remove('hidden');
}

function hideModal() {
    document.getElementById('modal').classList.add('hidden');
}