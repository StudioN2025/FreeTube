// Конфигурация Appwrite
const APPWRITE_CONFIG = {
    endpoint: 'https://sgp.cloud.appwrite.io/v1', // Ваш endpoint
    projectId: '69a3134e00396e25bece', // Ваш Project ID
    databaseId: '69a3136100029295a7d3', // Ваш Database ID
    collectionId: '69a3137f0019afffbdf2' // Ваш Collection ID
};

// Инициализация Appwrite
const { Client, Databases, ID, Query } = Appwrite;
const client = new Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId);

const databases = new Databases(client);

// Функция загрузки видео (для главной страницы)
async function loadVideos() {
    const grid = document.getElementById('video-grid');
    if (!grid) return;

    try {
        // Запрашиваем все видео из базы, сортируем по дате (новые сверху)
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collectionId,
            [
                Query.orderDesc('createdAt'),
                Query.limit(20)
            ]
        );

        if (response.documents.length === 0) {
            grid.innerHTML = '<p>Пока нет видео. Будьте первым, кто загрузит!</p>';
            return;
        }

        // Очищаем сетку
        grid.innerHTML = '';

        // Для каждого видео создаем карточку
        response.documents.forEach(doc => {
            const card = createVideoCard(doc);
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        grid.innerHTML = '<p>Ошибка загрузки видео. Проверьте консоль.</p>';
    }
}

// Создание HTML карточки видео
function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => {
        window.location.href = `video.html?id=${video.$id}`;
    };

    // Для превью используем первый кадр видео (если есть данные)
    let thumbnailHtml = '<div style="color:white; padding:20px; text-align:center;">🎬 Нет превью</div>';
    
    if (video.videoData) {
        // Создаем миниатюру с видео, но не загружаем всё видео целиком
        thumbnailHtml = `<video src="${video.videoData}" preload="metadata"></video>`;
    }

    card.innerHTML = `
        <div class="video-thumbnail">
            ${thumbnailHtml}
        </div>
        <div class="video-info">
            <div class="video-title">${escapeHtml(video.title) || 'Без названия'}</div>
            <div class="video-description">${escapeHtml(video.description) || 'Нет описания'}</div>
            <div class="video-date">${formatDate(video.createdAt)}</div>
        </div>
    `;
    return card;
}

// Функция загрузки видео на страницу плеера
async function playVideo() {
    const container = document.getElementById('video-container');
    if (!container) return;

    // Получаем ID видео из URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');

    if (!videoId) {
        container.innerHTML = '<p>ID видео не указан</p>';
        return;
    }

    try {
        // Получаем документ по ID
        const video = await databases.getDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collectionId,
            videoId
        );

        if (!video.videoData) {
            container.innerHTML = '<p>Видео повреждено или отсутствует</p>';
            return;
        }

        // Проверяем размер данных (для отладки)
        const sizeInMB = (video.videoData.length * 0.75) / (1024 * 1024); // Приблизительный размер в MB
        console.log(`Размер видео: ~${sizeInMB.toFixed(2)} MB`);

        // Создаем HTML5 плеер
        container.innerHTML = `
            <div class="video-player-wrapper">
                <h2>${escapeHtml(video.title)}</h2>
                <video controls autoplay preload="auto">
                    <source src="${video.videoData}" type="video/mp4">
                    Ваш браузер не поддерживает видео тег.
                </video>
                <div class="video-description-full">
                    <h3>Описание:</h3>
                    <p>${escapeHtml(video.description) || 'Нет описания'}</p>
                </div>
                <div class="video-meta">
                    <small>Загружено: ${formatDate(video.createdAt)}</small>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        container.innerHTML = '<p>Ошибка загрузки видео. Проверьте консоль.</p>';
    }
}

// Обработчик формы загрузки
if (document.getElementById('upload-form')) {
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const fileInput = document.getElementById('video-file');
        const file = fileInput.files[0];

        if (!file) {
            alert('Выберите видео файл');
            return;
        }

        // Проверяем размер файла (предупреждаем если большой)
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > 10) {
            if (!confirm(`Внимание! Файл большой (${fileSizeMB.toFixed(2)} MB). 
Base64 кодирование может занять много времени и памяти. Продолжить?`)) {
                return;
            }
        }

        // Показываем прогресс
        const progressArea = document.getElementById('progress-area');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        progressArea.style.display = 'block';

        try {
            // Конвертируем файл в Base64
            progressText.textContent = 'Конвертация в Base64...';
            const base64Video = await fileToBase64(file, (progress) => {
                progressBar.value = progress;
                progressText.textContent = `Конвертация... ${Math.round(progress)}%`;
            });

            // Создаем документ в Appwrite
            progressText.textContent = 'Сохранение в базу данных...';
            progressBar.value = 90;

            const data = {
                title: title,
                description: description,
                videoData: base64Video,
                createdAt: new Date().toISOString()
            };

            await databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collectionId,
                ID.unique(),
                data
            );

            progressBar.value = 100;
            progressText.textContent = 'Готово!';
            
            setTimeout(() => {
                alert('✅ Видео успешно опубликовано!');
                window.location.href = 'index.html';
            }, 500);

        } catch (error) {
            console.error('Ошибка:', error);
            alert('❌ Ошибка при загрузке видео: ' + error.message);
            progressArea.style.display = 'none';
        }
    });
}

// Вспомогательная функция: File -> Base64
function fileToBase64(file, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => {
            resolve(reader.result); // Это и есть Base64 строка
        };
        
        reader.onerror = (error) => {
            reject(error);
        };

        // Для отслеживания прогресса
        if (reader.addEventListener) {
            reader.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const percentLoaded = (e.loaded / e.total) * 100;
                    onProgress(percentLoaded);
                }
            });
        }

        reader.readAsDataURL(file); // Запускаем чтение
    });
}

// Защита от XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Форматирование даты
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Добавляем стили для новых элементов
const style = document.createElement('style');
style.textContent = `
    .video-date {
        font-size: 0.7rem;
        color: #888;
        margin-top: 0.3rem;
    }
    
    .video-player-wrapper {
        background-color: #202020;
        border-radius: 8px;
        padding: 1rem;
    }
    
    .video-player-wrapper video {
        width: 100%;
        max-height: 70vh;
        background: black;
        border-radius: 4px;
        margin: 1rem 0;
    }
    
    .video-description-full {
        margin-top: 1rem;
        padding: 1rem;
        background-color: #2c2c2c;
        border-radius: 4px;
    }
    
    .video-description-full h3 {
        margin-bottom: 0.5rem;
        color: #ff4d4d;
    }
    
    .video-meta {
        margin-top: 1rem;
        color: #888;
    }
    
    #progress-area {
        margin: 1rem 0;
        padding: 1rem;
        background-color: #202020;
        border-radius: 4px;
    }
    
    progress {
        width: 100%;
        height: 20px;
        border-radius: 10px;
        overflow: hidden;
    }
    
    progress::-webkit-progress-bar {
        background-color: #2c2c2c;
    }
    
    progress::-webkit-progress-value {
        background-color: #ff4d4d;
    }
`;

document.head.appendChild(style);
