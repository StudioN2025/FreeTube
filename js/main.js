// js/main.js

// Функция загрузки видео
async function loadVideos(filter = 'all') {
    const container = document.getElementById('videosContainer');
    
    try {
        // Проверяем наличие supabaseHelpers
        if (typeof supabaseHelpers === 'undefined') {
            throw new Error('supabaseHelpers не загружен');
        }
        
        const { data: videos, error } = await supabaseHelpers.getVideos(filter);
        
        if (error) throw error;
        
        if (!videos || videos.length === 0) {
            container.innerHTML = '<p class="no-videos">Видео не найдены. Загрузите первое видео!</p>';
            return;
        }
        
        // Отображаем видео
        container.innerHTML = videos.map(video => `
            <div class="video-card" onclick="watchVideo('${video.id}')">
                <div class="thumbnail-container">
                    ${video.thumbnail ? 
                        `<img src="${video.thumbnail}" class="thumbnail" alt="${video.title}">` :
                        `<div class="thumbnail" style="background: linear-gradient(45deg, #ff0000, #000);">
                            <span style="color:white; display:flex; justify-content:center; align-items:center; height:100%;">
                                🎥
                            </span>
                        </div>`
                    }
                    <span class="duration">${formatDuration(video.duration)}</span>
                </div>
                <div class="video-info">
                    <h3 class="video-title">${video.title || 'Без названия'}</h3>
                    <p class="channel-name">${video.channel_name || 'FreeTube User'}</p>
                    <div class="video-stats">
                        <span>${formatViews(video.views)} просмотров</span> • 
                        <span>${timeAgo(video.created_at)}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка:', error);
        container.innerHTML = `
            <div class="error-message">
                <p>❌ Ошибка загрузки видео: ${error.message}</p>
                <button onclick="location.reload()">Обновить страницу</button>
            </div>
        `;
    }
}

// Переход к видео
function watchVideo(videoId) {
    window.location.href = `video.html?id=${videoId}`;
}

// Поиск
async function searchVideos() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    
    if (!searchTerm) {
        loadVideos();
        return;
    }
    
    try {
        const { data: videos, error } = await supabaseHelpers.searchVideos(searchTerm);
        
        if (error) throw error;
        
        const container = document.getElementById('videosContainer');
        
        if (!videos || videos.length === 0) {
            container.innerHTML = '<p class="no-videos">Ничего не найдено</p>';
            return;
        }
        
        container.innerHTML = videos.map(video => `
            <div class="video-card" onclick="watchVideo('${video.id}')">
                <div class="thumbnail-container">
                    <div class="thumbnail" style="background: linear-gradient(45deg, #ff0000, #000);">
                        <span style="color:white; display:flex; justify-content:center; align-items:center; height:100%;">
                            🎥
                        </span>
                    </div>
                </div>
                <div class="video-info">
                    <h3 class="video-title">${video.title}</h3>
                    <p class="channel-name">${video.channel_name || 'FreeTube User'}</p>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
    }
}

// Форматирование длительности
function formatDuration(seconds) {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Форматирование просмотров
function formatViews(views) {
    if (!views) return '0';
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
}

// Форматирование даты
function timeAgo(date) {
    if (!date) return 'недавно';
    
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'только что';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' минут назад';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' часов назад';
    if (seconds < 2592000) return Math.floor(seconds / 86400) + ' дней назад';
    
    return new Date(date).toLocaleDateString();
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('Страница загружена, инициализация...');
    
    // Проверяем загрузку supabaseHelpers
    if (typeof supabaseHelpers !== 'undefined') {
        console.log('✅ supabaseHelpers загружен');
        loadVideos();
    } else {
        console.error('❌ supabaseHelpers не загружен!');
        document.getElementById('videosContainer').innerHTML = `
            <div class="error-message">
                <p>❌ Ошибка загрузки конфигурации Supabase</p>
                <p>Проверьте, что файл config/supabase.js существует и правильно подключен</p>
            </div>
        `;
    }
    
    // Обработчики фильтров
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            loadVideos(e.target.dataset.filter);
        });
    });
    
    // Поиск по Enter
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchVideos();
        });
    }
});
