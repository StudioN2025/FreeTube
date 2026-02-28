// video.js использует конфигурацию из supabase.js

// Получаем ID видео из URL
const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('id');

// Загрузка видео
async function loadVideo() {
    if (!videoId) {
        window.location.href = '/';
        return;
    }
    
    try {
        const { data: video, error } = await supabaseHelpers.getVideoById(videoId);
        
        if (error) throw error;
        if (!video) throw new Error('Видео не найдено');
        
        displayVideo(video);
        await supabaseHelpers.incrementViews(videoId);
        loadRecommendedVideos(videoId);
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        showNotification('Видео не найдено', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }
}

// Отображение видео
function displayVideo(video) {
    document.title = `${video.title} - FreeTube`;
    
    const videoPlayer = document.getElementById('videoPlayer');
    
    // Декодируем Base64 в blob URL
    const videoBlob = base64ToBlob(video.video_data, 'video/mp4');
    const videoUrl = URL.createObjectURL(videoBlob);
    videoPlayer.src = videoUrl;
    
    document.getElementById('videoTitle').textContent = video.title;
    document.getElementById('videoDescription').textContent = video.description || 'Нет описания';
    document.getElementById('channelName').textContent = video.channel_name || 'FreeTube User';
    document.getElementById('viewCount').textContent = formatViews(video.views) + ' просмотров';
    document.getElementById('uploadDate').textContent = timeAgo(video.created_at);
    
    // Очищаем URL при выгрузке
    videoPlayer.addEventListener('ended', () => {
        URL.revokeObjectURL(videoUrl);
    });
    
    // Сохраняем видео в историю просмотров
    saveToHistory(video);
}

// Конвертация Base64 в Blob
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    
    return new Blob(byteArrays, { type: mimeType });
}

// Загрузка рекомендованных видео
async function loadRecommendedVideos(currentVideoId) {
    try {
        const { data: videos, error } = await supabaseHelpers.getRecommendedVideos(currentVideoId);
        
        if (error) throw error;
        
        displayRecommendedVideos(videos);
    } catch (error) {
        console.error('Ошибка загрузки рекомендаций:', error);
    }
}

// Отображение рекомендованных видео
function displayRecommendedVideos(videos) {
    const container = document.getElementById('recommendedVideos');
    
    if (!videos || videos.length === 0) {
        container.innerHTML = '<p>Нет рекомендованных видео</p>';
        return;
    }
    
    container.innerHTML = videos.map(video => `
        <div class="recommended-card" onclick="window.location.href='video.html?id=${video.id}'">
            <div class="recommended-thumbnail">
                ${video.thumbnail ? 
                    `<img src="${video.thumbnail}" style="width:100%;height:100%;object-fit:cover;" alt="${video.title}">` :
                    `<div style="width:100%;height:100%;background:linear-gradient(45deg,#ff0000,#000);"></div>`
                }
            </div>
            <div class="recommended-info">
                <h4>${video.title}</h4>
                <p>${video.channel_name || 'FreeTube User'}</p>
                <p>${formatViews(video.views)} просмотров • ${timeAgo(video.created_at)}</p>
            </div>
        </div>
    `).join('');
}

// Сохранение в историю просмотров
function saveToHistory(video) {
    let history = JSON.parse(localStorage.getItem('viewHistory') || '[]');
    
    // Удаляем дубликаты
    history = history.filter(v => v.id !== video.id);
    
    // Добавляем в начало
    history.unshift({
        id: video.id,
        title: video.title,
        channel_name: video.channel_name,
        thumbnail: video.thumbnail,
        viewed_at: new Date().toISOString()
    });
    
    // Ограничиваем историю 50 элементами
    history = history.slice(0, 50);
    
    localStorage.setItem('viewHistory', JSON.stringify(history));
}

// Обработка комментариев
async function addComment() {
    const commentText = document.querySelector('.comments-section textarea').value;
    
    if (!commentText.trim()) {
        alert('Введите комментарий');
        return;
    }
    
    const { data: { user } } = await supabaseHelpers.getCurrentUser();
    
    if (!user) {
        alert('Необходимо войти в систему');
        window.location.href = 'login.html';
        return;
    }
    
    // Здесь можно добавить сохранение комментариев в отдельную таблицу
    showNotification('Комментарий добавлен!', 'success');
    document.querySelector('.comments-section textarea').value = '';
}

// Вспомогательные функции
function formatViews(views) {
    if (!views) return '0';
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
        год: 31536000,
        месяца: 2592000,
        недели: 604800,
        дня: 86400,
        часа: 3600,
        минуты: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            let unitText = unit;
            if (interval > 1 && interval < 5) {
                unitText = unit.slice(0, -1) + 'а';
            } else if (interval >= 5) {
                unitText = unit.slice(0, -1) + 'ев';
            }
            return `${interval} ${unitText} назад`;
        }
    }
    
    return 'только что';
}

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

// Инициализация
document.addEventListener('DOMContentLoaded', loadVideo);

// Добавляем обработчик для кнопки комментария
document.querySelector('.comments-section button')?.addEventListener('click', addComment);