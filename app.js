// Конфигурация Appwrite
const APPWRITE_CONFIG = {
    endpoint: 'https://sgp.cloud.appwrite.io/v1',
    projectId: '69a3134e00396e25bece',
    databaseId: '69a3136100029295a7d3',
    collectionId: '69a3137f0019afffbdf2'
};

// Глобальные переменные
let databases;
let Query;
let ID;

// Функция инициализации Appwrite
function initAppwrite() {
    try {
        if (typeof Appwrite === 'undefined') {
            console.error('❌ Appwrite SDK не загружен');
            return false;
        }

        console.log('✅ Appwrite SDK найден');
        
        const { Client, Databases, ID: AppwriteID, Query: AppwriteQuery } = Appwrite;
        
        const client = new Client()
            .setEndpoint(APPWRITE_CONFIG.endpoint)
            .setProject(APPWRITE_CONFIG.projectId);
        
        databases = new Databases(client);
        ID = AppwriteID;
        Query = AppwriteQuery;
        
        console.log('✅ Appwrite инициализирован');
        return true;
    } catch (error) {
        console.error('❌ Ошибка:', error);
        return false;
    }
}

// Загрузка видео на главную
async function loadVideos() {
    const grid = document.getElementById('video-grid');
    if (!grid) return;

    if (!initAppwrite()) {
        grid.innerHTML = '<p>❌ Ошибка подключения к базе данных</p>';
        return;
    }

    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collectionId
        );

        if (!response.documents || response.documents.length === 0) {
            grid.innerHTML = '<p>📹 Пока нет видео. <a href="upload.html">Загрузите первое видео!</a></p>';
            return;
        }

        grid.innerHTML = '';
        
        response.documents.forEach(doc => {
            const card = createVideoCard(doc);
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('❌ Ошибка:', error);
        grid.innerHTML = `<p>❌ Ошибка: ${error.message}</p>`;
    }
}

// Создание карточки видео
function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => {
        window.location.href = `video.html?id=${video.$id}`;
    };

    let thumbnailHtml = '<div style="color:white; padding:20px; text-align:center;">🎬 Нет превью</div>';
    
    if (video.videoData) {
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

// Плеер
async function playVideo() {
    const container = document.getElementById('video-container');
    if (!container) return;

    if (!initAppwrite()) {
        container.innerHTML = '<p>❌ Ошибка подключения к базе данных</p>';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');

    if (!videoId) {
        container.innerHTML = '<p>❌ ID видео не указан</p>';
        return;
    }

    try {
        const video = await databases.getDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collectionId,
            videoId
        );

        if (!video.videoData) {
            container.innerHTML = '<p>❌ Видео отсутствует</p>';
            return;
        }

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
        console.error('❌ Ошибка:', error);
        container.innerHTML = `<p>❌ Ошибка: ${error.message}</p>`;
    }
}

// Загрузка видео
if (document.getElementById('upload-form')) {
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!initAppwrite()) {
            alert('❌ Ошибка подключения к базе данных');
            return;
        }

        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const fileInput = document.getElementById('video-file');
        const file = fileInput.files[0];

        if (!file) {
            alert('❌ Выберите видео');
            return;
        }

        const progressArea = document.getElementById('progress-area');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        progressArea.style.display = 'block';

        try {
            progressText.textContent = '🔄 Конвертация...';
            
            const base64Video = await fileToBase64(file);

            progressText.textContent = '💾 Сохранение...';

            await databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collectionId,
                ID.unique(),
                {
                    title: title,
                    description: description,
                    videoData: base64Video,
                    createdAt: new Date().toISOString()
                }
            );

            alert('✅ Видео опубликовано!');
            window.location.href = 'index.html';

        } catch (error) {
            console.error('❌ Ошибка:', error);
            alert('❌ Ошибка: ' + error.message);
            progressArea.style.display = 'none';
        }
    });
}

// Конвертация в Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
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
    return date.toLocaleDateString('ru-RU');
}

console.log('✅ FreeTube скрипт загружен');
