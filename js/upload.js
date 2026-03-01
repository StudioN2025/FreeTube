// js/upload.js

// Глобальные переменные
let selectedFile = null;
let videoDuration = 0;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Страница загрузки инициализирована');
    
    // Проверяем наличие supabaseHelpers
    if (typeof supabaseHelpers === 'undefined') {
        console.error('❌ supabaseHelpers не загружен!');
        alert('Ошибка загрузки конфигурации Supabase');
        return;
    }
    
    // Инициализируем обработчики событий
    initializeEventListeners();
});

// Инициализация обработчиков событий
function initializeEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const videoInput = document.getElementById('videoInput');
    const uploadForm = document.getElementById('uploadForm');
    const qualitySelect = document.getElementById('quality');
    
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
            } else {
                alert('Пожалуйста, выберите видео файл');
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

    if (qualitySelect) {
        qualitySelect.addEventListener('change', function(e) {
            console.log('Выбрано качество:', e.target.value);
        });
    }
}

// Обработка выбранного видео
async function handleVideoSelect(file) {
    console.log('Выбран файл:', file.name, 'Размер:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
    // Проверка размера (макс 50 МБ для Base64)
    if (file.size > 50 * 1024 * 1024) {
        alert('Файл слишком большой. Максимальный размер: 50 МБ');
        return;
    }
    
    // Проверка формата
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
        alert('Неподдерживаемый формат видео. Используйте MP4, WebM, OGG или MOV');
        return;
    }
    
    selectedFile = file;
    
    // Показываем предупреждение о размере в Base64
    const estimatedSize = (file.size / 1024 / 1024 * 1.37).toFixed(2);
    document.getElementById('previewSizeWarning').textContent = 
        `⚠️ В Base64 размер будет примерно ${estimatedSize} МБ`;
    
    // Показываем превью
    const videoPreview = document.getElementById('videoPreview');
    const videoElement = videoPreview.querySelector('video');
    videoElement.src = URL.createObjectURL(file);
    videoPreview.style.display = 'block';
    
    // Получаем длительность видео
    videoElement.onloadedmetadata = () => {
        videoDuration = Math.floor(videoElement.duration);
        const minutes = Math.floor(videoDuration / 60);
        const seconds = videoDuration % 60;
        console.log(`Длительность видео: ${minutes}:${seconds.toString().padStart(2, '0')}`);
        
        document.getElementById('uploadForm').style.display = 'block';
        document.getElementById('uploadArea').style.display = 'none';
        
        alert('Видео загружено, заполните информацию');
    };
}

// Конвертация видео в Base64 с оптимизацией
async function convertVideoToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                // Получаем Base64 без префикса
                let base64 = e.target.result.split(',')[1];
                
                // Можно добавить сжатие если нужно
                // Здесь можно использовать pako или другие библиотеки сжатия
                
                resolve(base64);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

// Создание превью с оптимизацией
async function generateThumbnail(videoFile) {
    return new Promise((resolve, reject) => {
        try {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(videoFile);
            video.currentTime = 1; // Берем кадр на 1 секунде
            
            video.onloadeddata = () => {
                try {
                    const canvas = document.createElement('canvas');
                    // Уменьшаем размер превью для экономии места
                    const maxWidth = 320; // Еще больше уменьшаем
                    const scale = Math.min(maxWidth / video.videoWidth, 1);
                    canvas.width = video.videoWidth * scale;
                    canvas.height = video.videoHeight * scale;
                    
                    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    // Конвертируем в Base64 (сжимаем до 60% качества)
                    const thumbnail = canvas.toDataURL('image/jpeg', 0.6);
                    
                    // Очищаем
                    URL.revokeObjectURL(video.src);
                    
                    resolve(thumbnail);
                } catch (err) {
                    reject(err);
                }
            };
            
            video.onerror = () => {
                reject(new Error('Ошибка загрузки видео для превью'));
            };
        } catch (error) {
            reject(error);
        }
    });
}

// Функция показа уведомлений
function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// Загрузка видео
async function uploadVideo() {
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    
    if (!title) {
        showNotification('Введите название видео', 'error');
        return;
    }
    
    if (!selectedFile) {
        showNotification('Выберите видео файл', 'error');
        return;
    }
    
    // Проверяем наличие supabaseHelpers
    if (typeof supabaseHelpers === 'undefined') {
        showNotification('Ошибка конфигурации. Пожалуйста, обновите страницу.', 'error');
        return;
    }
    
    // Проверка авторизации
    const { data: { user } } = await supabaseHelpers.getCurrentUser();
    if (!user) {
        showNotification('Необходимо войти в систему для загрузки видео', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
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
    uploadBtn.querySelector('.loading-spinner').style.display = 'inline-block';
    
    try {
        // Шаг 1: Генерируем превью
        progressFill.style.width = '10%';
        progressText.textContent = '10% - Создание превью...';
        console.log('Создание превью...');
        const thumbnail = await generateThumbnail(selectedFile);
        
        // Шаг 2: Конвертируем видео
        progressFill.style.width = '30%';
        progressText.textContent = '30% - Конвертация видео...';
        console.log('Конвертация видео...');
        const videoBase64 = await convertVideoToBase64(selectedFile);
        
        // Шаг 3: Подготовка данных
        progressFill.style.width = '50%';
        progressText.textContent = '50% - Подготовка данных...';
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        progressFill.style.width = '70%';
        progressText.textContent = '70% - Сохранение в базу данных...';
        
        // Шаг 4: Сохраняем в Supabase
        const videoData = {
            title: title,
            description: description || 'Нет описания',
            video_data: videoBase64,
            thumbnail: thumbnail,
            duration: videoDuration,
            views: 0,
            channel_name: user.email ? user.email.split('@')[0] : 'FreeTube User',
            user_id: user.id
        };
        
        console.log('Отправка данных в Supabase...');
        console.log('Размер видео в Base64:', Math.floor(videoBase64.length / 1024 / 1024), 'МБ');
        
        // Используем функцию с увеличенным таймаутом
        const { data, error } = await supabaseHelpers.insertVideo(videoData);
        
        if (error) throw error;
        
        progressFill.style.width = '100%';
        progressText.textContent = '100% - Готово!';
        
        showNotification('✅ Видео успешно загружено!', 'success');
        
        // Перенаправляем на главную через 2 секунды
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showNotification('❌ Ошибка при загрузке видео: ' + error.message, 'error');
        
        // Сбрасываем прогресс
        progressBar.style.display = 'none';
        uploadBtn.disabled = false;
        uploadBtn.querySelector('.btn-text').style.display = 'inline';
        uploadBtn.querySelector('.loading-spinner').style.display = 'none';
    }
}

// Обработка ошибок глобально
window.addEventListener('error', function(e) {
    console.error('Глобальная ошибка:', e.error);
    if (e.error && e.error.message && !e.error.message.includes('ResizeObserver')) {
        console.log('Ошибка (игнорируем):', e.error.message);
    }
});

// Предупреждение при уходе со страницы во время загрузки
window.addEventListener('beforeunload', function(e) {
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar && progressBar.style.display === 'block') {
        e.preventDefault();
        e.returnValue = 'Видео загружается. Вы уверены, что хотите покинуть страницу?';
    }
});
