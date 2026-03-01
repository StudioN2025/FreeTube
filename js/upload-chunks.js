// js/upload-chunks.js

// Глобальные переменные
let selectedFile = null;
let videoDuration = 0;
let videoId = null;

// Размер чанка - 256 КБ (меньше = надежнее)
const CHUNK_SIZE = 256 * 1024; // 256 КБ

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('Страница загрузки (чанки) инициализирована');
    
    if (typeof supabaseHelpers === 'undefined') {
        console.error('❌ supabaseHelpers не загружен!');
        alert('Ошибка загрузки конфигурации Supabase');
        return;
    }
    
    initializeEventListeners();
});

function initializeEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const videoInput = document.getElementById('videoInput');
    const uploadForm = document.getElementById('uploadForm');
    
    if (uploadArea) {
        uploadArea.addEventListener('click', () => videoInput.click());

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
            if (file) handleVideoSelect(file);
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await startUpload();
        });
    }
}

async function handleVideoSelect(file) {
    console.log('Выбран файл:', file.name, 'Размер:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
    if (file.size > 200 * 1024 * 1024) {
        alert('Файл слишком большой. Максимальный размер: 200 МБ');
        return;
    }
    
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
        alert('Неподдерживаемый формат видео. Используйте MP4, WebM, OGG или MOV');
        return;
    }
    
    selectedFile = file;
    
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    document.getElementById('chunkInfo').textContent = 
        `📦 Видео будет разбито на ${totalChunks} чанков по ${CHUNK_SIZE / 1024} КБ`;
    
    const videoPreview = document.getElementById('videoPreview');
    const videoElement = videoPreview.querySelector('video');
    videoElement.src = URL.createObjectURL(file);
    videoPreview.style.display = 'block';
    
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

async function generateThumbnail(videoFile) {
    return new Promise((resolve, reject) => {
        try {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(videoFile);
            video.currentTime = 1;
            
            video.onloadeddata = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const maxWidth = 320;
                    const scale = Math.min(maxWidth / video.videoWidth, 1);
                    canvas.width = video.videoWidth * scale;
                    canvas.height = video.videoHeight * scale;
                    
                    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                    const thumbnail = canvas.toDataURL('image/jpeg', 0.6);
                    
                    URL.revokeObjectURL(video.src);
                    resolve(thumbnail);
                } catch (err) {
                    reject(err);
                }
            };
            
            video.onerror = () => reject(new Error('Ошибка загрузки видео для превью'));
        } catch (error) {
            reject(error);
        }
    });
}

// Функция для отправки одного чанка
async function uploadChunk(chunkIndex, chunkData) {
    try {
        const { success, error } = await supabaseHelpers.saveChunk(videoId, chunkIndex, chunkData);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Ошибка загрузки чанка ${chunkIndex}:`, error);
        return false;
    }
}

// Основная функция загрузки
async function startUpload() {
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    
    if (!title || !selectedFile) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    const { data: { user } } = await supabaseHelpers.getCurrentUser();
    if (!user) {
        showNotification('Необходимо войти в систему', 'error');
        setTimeout(() => window.location.href = 'login.html', 2000);
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
        const thumbnail = await generateThumbnail(selectedFile);
        
        // Шаг 2: Создаем запись о видео
        updateProgress(10, 'Создание записи о видео...');
        const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
        
        const videoData = {
            title: title,
            description: description || 'Нет описания',
            duration: videoDuration,
            channel_name: user.email ? user.email.split('@')[0] : 'FreeTube User',
            user_id: user.id,
            thumbnail: thumbnail,
            total_chunks: totalChunks
        };
        
        const { data, error } = await supabaseHelpers.createVideo(videoData);
        if (error) throw error;
        
        videoId = data[0].id;
        console.log('Создана запись о видео, ID:', videoId);
        
        // Шаг 3: Загружаем чанки
        let successCount = 0;
        const chunkPromises = [];
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
            const chunk = selectedFile.slice(start, end);
            
            // Конвертируем чанк в Base64
            const chunkBase64 = await readChunkAsBase64(chunk);
            
            // Отправляем чанк
            const success = await uploadChunk(i, chunkBase64);
            if (success) {
                successCount++;
                const percent = Math.floor((i + 1) / totalChunks * 70) + 20; // 20-90%
                updateProgress(percent, `Загрузка чанков (${i + 1}/${totalChunks})...`);
            } else {
                throw new Error(`Ошибка загрузки чанка ${i}`);
            }
        }
        
        // Шаг 4: Завершаем загрузку
        updateProgress(95, 'Завершение загрузки...');
        await supabaseHelpers.completeUpload(videoId);
        
        updateProgress(100, 'Готово!');
        showNotification('✅ Видео успешно загружено!', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showNotification('❌ Ошибка: ' + error.message, 'error');
        
        progressBar.style.display = 'none';
        uploadBtn.disabled = false;
        uploadBtn.querySelector('.btn-text').style.display = 'inline';
        uploadBtn.querySelector('.loading-spinner').style.display = 'none';
    }
}

// Чтение чанка как Base64
function readChunkAsBase64(chunk) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(chunk);
    });
}

function updateProgress(percent, message) {
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    if (progressFill && progressText) {
        progressFill.style.width = percent + '%';
        progressText.textContent = `${percent}% - ${message}`;
    }
}

function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) existingNotification.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

window.addEventListener('beforeunload', function(e) {
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar && progressBar.style.display === 'block') {
        e.preventDefault();
        e.returnValue = 'Видео загружается. Вы уверены?';
    }
});
