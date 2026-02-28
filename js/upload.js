// upload.js использует конфигурацию из supabase.js

let selectedFile = null;
let videoDuration = 0;

// Обработка загрузки файла
document.getElementById('uploadArea').addEventListener('click', () => {
    document.getElementById('videoInput').click();
});

document.getElementById('uploadArea').addEventListener('dragover', (e) => {
    e.preventDefault();
    e.target.style.borderColor = '#ff0000';
});

document.getElementById('uploadArea').addEventListener('dragleave', (e) => {
    e.target.style.borderColor = '#ccc';
});

document.getElementById('uploadArea').addEventListener('drop', (e) => {
    e.preventDefault();
    e.target.style.borderColor = '#ccc';
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
        handleVideoSelect(file);
    }
});

document.getElementById('videoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleVideoSelect(file);
    }
});

// Обработка выбранного видео
async function handleVideoSelect(file) {
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
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    
    if (!title || !selectedFile) {
        alert('Заполните все поля');
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
        for (let i = 50; i <= 80; i += 10) {
            setTimeout(() => {
                progressFill.style.width = i + '%';
                progressText.textContent = i + '% - Загрузка...';
            }, (i - 40) * 100);
        }
        
        // Шаг 3: Сохраняем в Supabase
        progressFill.style.width = '90%';
        progressText.textContent = '90% - Сохранение...';
        
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
        
        const { data, error } = await supabaseHelpers.insertVideo(videoData);
        
        if (error) throw error;
        
        progressFill.style.width = '100%';
        progressText.textContent = '100% - Готово!';
        
        // Показываем успешное сообщение
        showNotification('Видео успешно загружено!', 'success');
        
        setTimeout(() => {
            window.location.href = `/video.html?id=${data[0].id}`;
        }, 1500);
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        alert('Ошибка при загрузке видео: ' + error.message);
        
        progressBar.style.display = 'none';
        uploadBtn.disabled = false;
        uploadBtn.querySelector('.btn-text').style.display = 'inline';
        uploadBtn.querySelector('.loading-spinner').style.display = 'none';
    }
});

// Показать уведомление
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4caf50' : '#ff4444'};
        color: white;
        border-radius: 8px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}