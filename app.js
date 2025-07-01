// Конфигурация приложения
const APP_CONFIG = {
    appTitle: "Универсальная база данных",
    dbName: "UniversalDB",
    dbVersion: 1,
    storeName: "records",
    // Определение полей для формы и отображения
    fields: [
        { name: "id", type: "hidden", label: "ID" },
        { name: "name", type: "text", label: "Название", required: true },
        { name: "description", type: "textarea", label: "Описание" },
        { name: "category", type: "select", label: "Категория", options: ["Категория 1", "Категория 2", "Категория 3"] },
        { name: "rating", type: "number", label: "Рейтинг", min: 1, max: 5 },
        { name: "createdAt", type: "date", label: "Дата создания" }
    ],
    // Поля, по которым можно выполнять поиск
    searchFields: ["name", "description", "category"]
};

// Глобальные переменные
let db;
let currentRecordId = null;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    // Установка заголовка приложения
    document.getElementById('app-title').textContent = APP_CONFIG.appTitle;
    
    // Инициализация базы данных
    await initDB();
    
    // Загрузка всех записей
    loadAllRecords();
    
    // Инициализация интерфейса
    initUI();
    
    // Инициализация поиска
    initSearch();
});

// Инициализация базы данных
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(APP_CONFIG.dbName, APP_CONFIG.dbVersion);
        
        request.onerror = (event) => {
            showError("Ошибка при открытии базы данных");
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
                // Создание индексов для полей поиска
                APP_CONFIG.searchFields.forEach(field => {
                    store.createIndex(field, field, { unique: false });
                });
            }
        };
    });
}

// Инициализация пользовательского интерфейса
function initUI() {
    // Кнопка "Показать все записи"
    document.getElementById('btn-show-all').addEventListener('click', loadAllRecords);
    
    // Кнопка "Добавить новую запись"
    document.getElementById('btn-add-new').addEventListener('click', () => {
        showForm();
    });
    
    // Кнопка "Отмена" в форме
    document.getElementById('btn-cancel').addEventListener('click', () => {
        hideForm();
    });
    
    // Кнопка "Удалить" в форме
    document.getElementById('btn-delete').addEventListener('click', deleteCurrentRecord);
    
    // Обработка отправки формы
    document.getElementById('record-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveRecord();
    });
    
    // Инициализация модального окна
    document.querySelector('.close').addEventListener('click', hideModal);
    document.getElementById('modal-confirm').addEventListener('click', hideModal);
    
    // Инициализация экспорта/импорта
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    
    document.getElementById('file-input').addEventListener('change', importData);
}

// Инициализация поиска
function initSearch() {
    const searchFieldSelect = document.getElementById('search-field');
    
    // Заполнение выпадающего списка полями для поиска
    APP_CONFIG.searchFields.forEach(field => {
        const fieldConfig = APP_CONFIG.fields.find(f => f.name === field);
        if (fieldConfig) {
            const option = document.createElement('option');
            option.value = field;
            option.textContent = fieldConfig.label;
            searchFieldSelect.appendChild(option);
        }
    });
    
    // Кнопка "Найти"
    document.getElementById('btn-search').addEventListener('click', searchRecords);
    
    // Кнопка "Очистить"
    document.getElementById('btn-clear-search').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        loadAllRecords();
    });
    
    // Поиск при нажатии Enter
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchRecords();
        }
    });
}

// Загрузка всех записей
function loadAllRecords() {
    const transaction = db.transaction([APP_CONFIG.storeName], "readonly");
    const store = transaction.objectStore(APP_CONFIG.storeName);
    const request = store.getAll();
    
    request.onerror = () => {
        showError("Ошибка при загрузке записей");
    };
    
    request.onsuccess = (event) => {
        displayRecords(event.target.result);
    };
}

// Отображение записей в списке
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
        
        APP_CONFIG.fields.forEach(field => {
            if (field.type !== 'hidden' && record[field.name] !== undefined) {
                html += `<p><strong>${field.label}:</strong> ${formatFieldValue(record[field.name], field)}</p>`;
            }
        });
        
        card.innerHTML = html;
        card.addEventListener('click', () => {
            editRecord(record.id);
        });
        
        recordsList.appendChild(card);
    });
}

// Форматирование значения поля для отображения
function formatFieldValue(value, field) {
    if (value === null || value === undefined) return 'Не указано';
    
    switch (field.type) {
        case 'date':
            return new Date(value).toLocaleDateString();
        case 'select':
            return value || 'Не выбрано';
        default:
            return value.toString();
    }
}

// Показать форму для добавления/редактирования записи
function showForm(record = null) {
    const formContainer = document.getElementById('form-container');
    const formTitle = document.getElementById('form-title');
    const form = document.getElementById('record-form');
    const deleteBtn = document.getElementById('btn-delete');
    
    form.innerHTML = '';
    
    if (record) {
        formTitle.textContent = 'Редактировать запись';
        deleteBtn.classList.remove('hidden');
        currentRecordId = record.id;
    } else {
        formTitle.textContent = 'Добавить новую запись';
        deleteBtn.classList.add('hidden');
        currentRecordId = null;
        record = {}; // Пустой объект для новых записей
    }
    
    // Создание полей формы на основе конфигурации
    APP_CONFIG.fields.forEach(field => {
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'form-group';
        
        if (field.type !== 'hidden') {
            const label = document.createElement('label');
            label.htmlFor = field.name;
            label.textContent = field.label;
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
                        if (record[field.name] === option) {
                            optionElement.selected = true;
                        }
                        input.appendChild(optionElement);
                    });
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
                
                if (field.min !== undefined) input.min = field.min;
                if (field.max !== undefined) input.max = field.max;
        }
        
        if (field.required) {
            input.required = true;
        }
        
        fieldGroup.appendChild(input);
        form.insertBefore(fieldGroup, form.querySelector('.form-buttons'));
    });
    
    formContainer.classList.remove('hidden');
}

// Скрыть форму
function hideForm() {
    document.getElementById('form-container').classList.add('hidden');
    currentRecordId = null;
}

// Редактирование записи
function editRecord(id) {
    const transaction = db.transaction([APP_CONFIG.storeName], "readonly");
    const store = transaction.objectStore(APP_CONFIG.storeName);
    const request = store.get(Number(id));
    
    request.onerror = () => {
        showError("Ошибка при загрузке записи");
    };
    
    request.onsuccess = (event) => {
        if (event.target.result) {
            showForm(event.target.result);
        } else {
            showError("Запись не найдена");
        }
    };
}

// Сохранение записи (добавление или обновление)
function saveRecord() {
    const form = document.getElementById('record-form');
    const formData = new FormData(form);
    const record = {};
    
    // Собираем данные из формы
    APP_CONFIG.fields.forEach(field => {
        const value = formData.get(field.name);
        
        switch (field.type) {
            case 'number':
                record[field.name] = value ? Number(value) : null;
                break;
            case 'date':
                record[field.name] = value ? new Date(value).toISOString() : null;
                break;
            default:
                record[field.name] = value || null;
        }
    });
    
    // Если это новая запись, добавляем дату создания
    if (!currentRecordId) {
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
    
    request.onerror = () => {
        showError("Ошибка при сохранении записи");
    };
    
    request.onsuccess = () => {
        hideForm();
        loadAllRecords();
        showMessage("Запись успешно сохранена");
    };
}

// Удаление текущей записи
function deleteCurrentRecord() {
    showConfirm("Вы уверены, что хотите удалить эту запись?", () => {
        const transaction = db.transaction([APP_CONFIG.storeName], "readwrite");
        const store = transaction.objectStore(APP_CONFIG.storeName);
        const request = store.delete(currentRecordId);
        
        request.onerror = () => {
            showError("Ошибка при удалении записи");
        };
        
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
    
    request.onerror = () => {
        showError("Ошибка при поиске записей");
    };
    
    request.onsuccess = (event) => {
        const allRecords = event.target.result;
        const filteredRecords = allRecords.filter(record => {
            const fieldValue = String(record[searchField]).toLowerCase();
            return fieldValue.includes(searchTerm.toLowerCase());
        });
        
        displayRecords(filteredRecords);
    };
}

// Экспорт данных в JSON
function exportData() {
    const transaction = db.transaction([APP_CONFIG.storeName], "readonly");
    const store = transaction.objectStore(APP_CONFIG.storeName);
    const request = store.getAll();
    
    request.onerror = () => {
        showError("Ошибка при экспорте данных");
    };
    
    request.onsuccess = (event) => {
        const data = event.target.result;
        if (data.length === 0) {
            showMessage("Нет данных для экспорта");
            return;
        }
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${APP_CONFIG.dbName}_export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage("Данные успешно экспортированы");
    };
}

// Импорт данных из JSON
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!Array.isArray(data)) {
                throw new Error("Файл должен содержать массив записей");
            }
            
            showConfirm("Вы уверены, что хотите импортировать данные? Существующие записи будут перезаписаны.", () => {
                const transaction = db.transaction([APP_CONFIG.storeName], "readwrite");
                const store = transaction.objectStore(APP_CONFIG.storeName);
                
                // Очищаем хранилище перед импортом
                const clearRequest = store.clear();
                
                clearRequest.onerror = () => {
                    showError("Ошибка при очистке базы данных");
                };
                
                clearRequest.onsuccess = () => {
                    // Добавляем все записи из файла
                    data.forEach(record => {
                        store.add(record);
                    });
                    
                    transaction.oncomplete = () => {
                        loadAllRecords();
                        showMessage(`Успешно импортировано ${data.length} записей`);
                        event.target.value = ''; // Сброс input file
                    };
                    
                    transaction.onerror = () => {
                        showError("Ошибка при импорте данных");
                    };
                };
            });
        } catch (error) {
            showError(`Ошибка при обработке файла: ${error.message}`);
        }
    };
    
    reader.onerror = () => {
        showError("Ошибка при чтении файла");
    };
    
    reader.readAsText(file);
}

// Показать сообщение
function showMessage(message) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-confirm').style.display = 'block';
    modal.classList.remove('hidden');
}

// Показать ошибку
function showError(message) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-confirm').style.display = 'block';
    modal.classList.remove('hidden');
}

// Показать подтверждение
function showConfirm(message, callback) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-message').textContent = message;
    const confirmBtn = document.getElementById('modal-confirm');
    
    confirmBtn.style.display = 'block';
    confirmBtn.onclick = () => {
        callback();
        hideModal();
    };
    
    modal.classList.remove('hidden');
}

// Скрыть модальное окно
function hideModal() {
    document.getElementById('modal').classList.add('hidden');
}