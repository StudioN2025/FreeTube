// Теперь main.js использует конфигурацию из supabase.js

// Загрузка видео
async function loadVideos(filter = 'all') {
    try {
        const { data: videos, error } = await supabaseHelpers.getVideos(filter);
        
        if (error) throw error;
        
        displayVideos(videos);
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        showNotification('Ошибка загрузки видео', 'error');
    }
}

// Отображение видео
function displayVideos(videos) {
    const container = document.getElementById('videosContainer');
    
    if (!videos || videos.length === 0) {
        container.innerHTML = '<p class="no-videos">Видео не найдены</p>';
        return;
    }
    
    container.innerHTML = videos.map(video => `
        <div class="video-card" onclick="watchVideo('${video.id}')">
            <div class="thumbnail-container">
                ${video.thumbnail ? 
                    `<img src="${video.thumbnail}" class="thumbnail" alt="${video.title}">` :
                    `<div class="thumbnail" style="background: linear-gradient(45deg, #ff0000, #000);"></div>`
                }
                <span class="duration">${formatDuration(video.duration)}</span>
            </div>
            <div class="video-info">
                <h3 class="video-title">${video.title}</h3>
                <p class="channel-name">${video.channel_name || 'FreeTube User'}</p>
                <div class="video-stats">
                    <span>${formatViews(video.views)} просмотров</span> • 
                    <span>${timeAgo(video.created_at)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Переход к просмотру видео
function watchVideo(videoId) {
    window.location.href = `video.html?id=${videoId}`;
}

// Поиск видео
async function searchVideos() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    
    if (!searchTerm) {
        loadVideos();
        return;
    }
    
    try {
        const { data: videos, error } = await supabaseHelpers.searchVideos(searchTerm);
        
        if (error) throw error;
        
        displayVideos(videos);
    } catch (error) {
        console.error('Ошибка поиска:', error);
        showNotification('Ошибка поиска', 'error');
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Добавляем в DOM
    document.body.appendChild(notification);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Вспомогательные функции
function formatDuration(seconds) {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

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
            // Склонение
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

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadVideos();
    
    // Обработчики фильтров
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            loadVideos(e.target.dataset.filter);
        });
    });
    
    // Поиск по Enter
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchVideos();
    });
    
    // Проверка авторизации
    checkAuth();
});

// Проверка авторизации
async function checkAuth() {
    const { data: { user } } = await supabaseHelpers.getCurrentUser();
    const authBtn = document.getElementById('authBtn');
    
    if (user) {
        authBtn.textContent = 'Выйти';
        authBtn.onclick = async () => {
            await supabaseHelpers.signOut();
            window.location.reload();
        };
    } else {
        authBtn.textContent = 'Войти';
        authBtn.onclick = () => {
            window.location.href = 'login.html';
        };
    }
}