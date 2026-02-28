// Загрузка видео
async function loadVideos(filter = 'all') {
    try {
        // Проверяем, что supabaseHelpers существует
        if (typeof supabaseHelpers === 'undefined') {
            throw new Error('supabaseHelpers не загружен. Проверьте подключение supabase.js');
        }
        
        const { data: videos, error } = await supabaseHelpers.getVideos(filter);
        
        if (error) throw error;
        
        displayVideos(videos);
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        showNotification('Ошибка загрузки видео: ' + error.message, 'error');
        
        // Показываем заглушку
        const container = document.getElementById('videosContainer');
        container.innerHTML = '<div class="error-message">Не удалось загрузить видео. Проверьте подключение к Supabase.</div>';
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
                <h3 class="video-title">${video.title || 'Без названия'}</h3>
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
    // Проверяем, есть ли уже уведомление
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Создаем элемент уведомления
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
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    // Добавляем анимацию
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Добавляем в DOM
    document.body.appendChild(notification);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 300);
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
    if (!date) return 'недавно';
    
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
        год: 31536000,
        месяц: 2592000,
        неделя: 604800,
        день: 86400,
        час: 3600,
        минута: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            // Склонение
            let unitText = unit;
            if (interval > 1 && interval < 5) {
                unitText = unit + 'а';
            } else if (interval >= 5) {
                unitText = unit + 'ев';
            }
            return `${interval} ${unitText} назад`;
        }
    }
    
    return 'только что';
}

// Проверка авторизации
async function checkAuth() {
    try {
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
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем загрузку supabaseHelpers
    if (typeof supabaseHelpers === 'undefined') {
        console.error('supabaseHelpers не загружен!');
        showNotification('Ошибка загрузки конфигурации', 'error');
        return;
    }
    
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
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchVideos();
        });
    }
    
    // Проверка авторизации
    checkAuth();
});
