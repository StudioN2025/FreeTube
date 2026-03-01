// js/upload.js

// Глобальные переменные
let selectedFile = null;
let videoDuration = 0;

// Размер чанка - 1 МБ (можно настроить)
const CHUNK_SIZE = 1024 * 1024; // 1 МБ

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
    
    // Проверка размера (макс 100 МБ для чанков)
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
    
    // Показываем предупреждение о размере
    const estimatedSize = (file.size / 1024 / 1024 * 1.37).toFixed(2);
    document.getElementById('previewSizeWarning').textContent = 
        `⚠️ В Base64 размер будет примерно ${estimatedSize} МБ, разбито на ${Math.ceil(file.size / CHUNK_SIZE)} чанков`;
    
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

// Разбиваем видео на чанки и конвертируем в Base64
async function convertVideoToBase64InChunks(file) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let offset = 0;
        let chunkIndex = 0;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        console.log(`Начинаем разбивку на ${totalChunks} чанков...`);
        
        const readChunk = () => {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            const reader = new FileReader();
            
            reader.onload = (e) => {
                // Получаем Base64 для чанка
                let base64 = e.target.result;
                
                // Убираем префикс (data:video/mp4;base64,)
                base64 = base64.split(',')[1];
                
                chunks.push(base64);
                chunkIndex++;
                
                // Обновляем прогресс
                const progress = Math.floor((chunkIndex / totalChunks) * 100);
                console.log(`Обработано чанков: ${chunkIndex}/${totalChunks} (${progress}%)`);
                
                offset += CHUNK_SIZE;
                if (offset < file.size) {
                    // Читаем следующий чанк с небольшой задержкой
                    setTimeout(readChunk, 10);
                } else {
                    // Все чанки обработаны - собираем вместе
                    console.log('Сборка чанков...');
                    const fullBase64 = chunks.join('');
                    console.log('Готово! Размер Base64:', Math.floor(fullBase64.length / 1024 / 1024), 'МБ');
                    resolve(fullBase64);
                }
            };
            
            reader.onerror = (error) => {
                console.error('Ошибка чтения чанка:', error);
                reject(error);
            };
            
            reader.readAsDataURL(slice);
        };
        
        readChunk();
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
                    const maxWidth = 320;
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

// Обновление прогресс-бара
function updateProgress(percent, message) {
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    if (progressFill && progressText) {
        progressFill.style.width = percent + '%';
        progressText.textContent = `${percent}% - ${message}`;
    }
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
    const uploadBtn = document.getElementById('uploadBtn');
    
    progressBar.style.display = 'block';
    uploadBtn.disabled = true;
    uploadBtn.querySelector('.btn-text').style.display = 'none';
    uploadBtn.querySelector('.loading-spinner').style.display = 'inline-block';
    
    try {
        // Шаг 1: Генерируем превью
        updateProgress(5, 'Создание превью...');
        console.log('Создание превью...');
        const thumbnail = await generateThumbnail(selectedFile);
        
        // Шаг 2: Конвертируем видео чанками
        updateProgress(10, 'Конвертация видео (начало)...');
        console.log('Конвертация видео чанками...');
        
        const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
        let lastProgress = 10;
        
        // Перехватываем console.log для обновления прогресса
        const originalConsoleLog = console.log;
        console.log = function(message) {
            if (typeof message === 'string' && message.includes('Обработано чанков:')) {
                const match = message.match(/(\d+)\/(\d+)/);
                if (match) {
                    const current = parseInt(match[1]);
                    const total = parseInt(match[2]);
                    const chunkProgress = Math.floor((current / total) * 70); // 10-80% за конвертацию
                    updateProgress(10 + chunkProgress, `Конвертация видео (${current}/${total} чанков)...`);
                }
            }
            originalConsoleLog.apply(console, arguments);
        };
        
        const videoBase64 = await convertVideoToBase64InChunks(selectedFile);
        
        // Восстанавливаем console.log
        console.log = originalConsoleLog;
        
        // Шаг 3: Подготовка данных
        updateProgress(80, 'Подготовка данных...');
        console.log('Подготовка данных...');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Шаг 4: Сохраняем в Supabase
        updateProgress(85, 'Сохранение в базу данных...');
        
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
        
        // Используем прямой INSERT вместо RPC для надежности
        const { data, error } = await supabaseClient
            .from('videos')
            .insert([{
                title: videoData.title,
                description: videoData.description,
                video_data: videoData.video_data,
                thumbnail: videoData.thumbnail,
                duration: videoData.duration,
                views: 0,
                channel_name: videoData.channel_name,
                user_id: videoData.user_id
            }])
            .select();
        
        if (error) throw error;
        
        updateProgress(100, 'Готово!');
        
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
