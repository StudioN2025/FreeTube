// js/upload.js

// Проверяем загрузку supabaseHelpers при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Страница загрузки инициализирована');
    
    // Проверяем наличие supabaseHelpers
    if (typeof supabaseHelpers === 'undefined') {
        console.error('❌ supabaseHelpers не загружен!');
        showNotification('Ошибка загрузки конфигурации Supabase', 'error');
        return;
    }
    
    console.log('✅ supabaseHelpers загружен');
    initializeUpload();
});

// Инициализация функций загрузки
function initializeUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const videoInput = document.getElementById('videoInput');
    const uploadForm = document.getElementById('uploadForm');
    
    if (uploadArea) {
        uploadArea.addEventListener('click', () => {
            videoInput.click();
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.target.style.borderColor = '#ff0000';
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.target.style.borderColor = '#ccc';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.target.style.borderColor = '#ccc';
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('video/')) {
                handleVideoSelect(file);
            }
        });
    }

    if (videoInput) {
        videoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleVideoSelect(file);
            }
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await uploadVideo();
        });
    }
}

let selectedFile = null;
let videoDuration = 0;

// Обработка выбранного видео
async function handleVideoSelect(file) {
    console.log('Выбран файл:', file.name);
    
    // Проверка размера (макс 100 МБ)
    if (file.size > 100 * 1024 * 1024) {
        alert('Файл слишком большой. Максимальный размер: 100 МБ');
        return;
    }
    
    // Проверка формата
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
        alert('Неподдерживаемый формат видео. Используйте MP4, WebM, OGG или MOV');
        return;
    }
    
    selectedFile = file;
    
    // Показываем превью
    const videoPreview = document.getElementById('videoPreview');
    const videoElement = videoPreview.querySelector('video');
    videoElement.src = URL.createObjectURL(file);
    videoPreview.style.display = 'block';
    
    // Получаем длительность видео
    videoElement.onloadedmetadata = () => {
        videoDuration = Math.floor(videoElement.duration);
        document.getElementById('uploadForm').style.display = 'block';
        document.getElementById('uploadArea').style.display = 'none';
    };
}

// Конвертация видео в Base64
async function convertVideoToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                // Получаем Base64 без префикса
                const base64 = e.target.result.split(',')[1];
                resolve(base64);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

// Создание превью
async function generateThumbnail(videoFile) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoFile);
        video.currentTime = 1; // Берем кадр на 1 секунде
        
        video.onloadeddata = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Конвертируем в Base64 (сжимаем до 80% качества)
            const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            resolve(thumbnail);
            
            URL.revokeObjectURL(video.src);
        };
    });
}

// Загрузка видео
async function uploadVideo() {
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    
    if (!title || !selectedFile) {
        alert('Заполните все поля');
        return;
    }
    
    // Проверяем наличие supabaseHelpers
    if (typeof supabaseHelpers === 'undefined') {
        alert('Ошибка конфигурации. Пожалуйста, обновите страницу.');
        return;
    }
    
    // Проверка авторизации
    const { data: { user } } = await supabaseHelpers.getCurrentUser();
    if (!user) {
        alert('Необходимо войти в систему для загрузки видео');
        window.location.href = 'login.html';
        return;
    }
    
    // Показываем прогресс
    const progressBar = document.querySelector('.progress-bar');
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    const uploadBtn = document.getElementById('uploadBtn');
    
    progressBar.style.display = 'block';
    uploadBtn.disabled = true;
    uploadBtn.querySelector('.btn-text').style.display = 'none';
    uploadBtn.querySelector('.loading-spinner').style.display = 'inline';
    
    try {
        // Шаг 1: Генерируем превью
        progressFill.style.width = '20%';
        progressText.textContent = '20% - Создание превью...';
        const thumbnail = await generateThumbnail(selectedFile);
        
        // Шаг 2: Конвертируем видео
        progressFill.style.width = '40%';
        progressText.textContent = '40% - Конвертация в Base64...';
        const videoBase64 = await convertVideoToBase64(selectedFile);
        
        // Анимируем прогресс
        progressFill.style.width = '60%';
        progressText.textContent = '60% - Подготовка...';
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        progressFill.style.width = '80%';
        progressText.textContent = '80% - Сохранение...';
        
        // Шаг 3: Сохраняем в Supabase
        const videoData = {
            title: title,
            description: description,
            video_data: videoBase64,
            thumbnail: thumbnail,
            duration: videoDuration,
            views: 0,
            channel_name: user.email || 'FreeTube User',
            user_id: user.id
        };
        
        console.log('Отправка данных в Supabase...');
        const { data, error } = await supabaseHelpers.insertVideo(videoData);
        
        if (error) throw error;
        
        progressFill.style.width = '100%';
        progressText.textContent = '100% - Готово!';
        
        showNotification('Видео успешно загружено!', 'success');
        
        setTimeout(() => {
            window.location.href = `/video.html?id=${data[0].id}`;
        }, 1500);
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showNotification('Ошибка при загрузке видео: ' + error.message, 'error');
        
        progressBar.style.display = 'none';
        uploadBtn.disabled = false;
        uploadBtn.querySelector('.btn-text').style.display = 'inline';
        uploadBtn.querySelector('.loading-spinner').style.display = 'none';
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    // Удаляем предыдущее уведомление если есть
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#ff4444' : '#2196f3'};
        color: white;
        border-radius: 8px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    document.body.appendChild(notification);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
