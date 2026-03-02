// js/video-stream.js

const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('id');

let videoPlayer = document.getElementById('videoPlayer');

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

// Конвертация Base64 в Uint8Array
function base64ToUint8Array(base64) {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch (error) {
        console.error('Ошибка декодирования Base64:', error);
        return null;
    }
}

// Загрузка видео
async function loadVideo() {
    if (!videoId) {
        window.location.href = '/';
        return;
    }
    
    try {
        document.getElementById('videoLoading').style.display = 'flex';
        
        // Загружаем информацию о видео
        const { data: info, error } = await supabaseHelpers.getVideoInfo(videoId);
        if (error) throw error;
        if (!info) throw new Error('Видео не найдено');
        
        // Отображаем информацию
        document.getElementById('videoTitle').textContent = info.title || 'Без названия';
        document.getElementById('videoDescription').textContent = info.description || 'Нет описания';
        document.getElementById('channelName').textContent = info.channel_name || 'FreeTube User';
        document.getElementById('viewCount').textContent = formatViews(info.views || 0) + ' просмотров';
        
        const date = info.created_at ? timeAgo(info.created_at) : 'недавно';
        document.getElementById('uploadDate').textContent = date;
        
        // Аватар канала
        const channelAvatar = document.getElementById('channelAvatar');
        if (channelAvatar) {
            const name = info.channel_name || 'U';
            channelAvatar.textContent = name.charAt(0).toUpperCase();
        }
        
        // Получаем общее количество чанков
        const totalChunks = info.total_chunks || await supabaseHelpers.getTotalChunks(videoId);
        console.log(`📊 Всего чанков: ${totalChunks}`);
        
        if (totalChunks === 0) {
            throw new Error('Видео повреждено (нет чанков)');
        }
        
        // Загружаем все чанки и собираем бинарные данные
        const binaryArrays = [];
        const BATCH_SIZE = 20;
        
        for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
            const end = Math.min(i + BATCH_SIZE - 1, totalChunks - 1);
            console.log(`📥 Загрузка чанков ${i} - ${end}`);
            
            const chunks = await supabaseHelpers.getVideoChunks(videoId, i, end);
            
            if (chunks && chunks.length > 0) {
                // Сортируем чанки этой партии
                chunks.sort((a, b) => a.chunk_index - b.chunk_index);
                
                // Конвертируем каждый чанк в Uint8Array
                for (const chunk of chunks) {
                    const bytes = base64ToUint8Array(chunk.chunk_data);
                    if (bytes) {
                        binaryArrays.push(bytes);
                    }
                }
                
                const percent = Math.floor((binaryArrays.length / totalChunks) * 100);
                document.getElementById('loadingText').textContent = 
                    `Загрузка... ${binaryArrays.length}/${totalChunks} (${percent}%)`;
                
                const chunkProgress = document.getElementById('chunkProgress');
                if (chunkProgress) {
                    chunkProgress.textContent = `📦 Загружено: ${binaryArrays.length}/${totalChunks} (${percent}%)`;
                    chunkProgress.style.display = 'block';
                }
            }
        }
        
        if (binaryArrays.length === 0) {
            throw new Error('Не удалось загрузить чанки видео');
        }
        
        console.log(`✅ Загружено ${binaryArrays.length} чанков`);
        
        // Создаем Blob из всех бинарных массивов
        const blob = new Blob(binaryArrays, { type: 'video/mp4' });
        const videoUrl = URL.createObjectURL(blob);
        
        console.log(`📦 Размер видео: ${(blob.size / 1024 / 1024).toFixed(2)} МБ`);
        
        // Устанавливаем видео
        videoPlayer.src = videoUrl;
        
        // Убираем индикатор загрузки
        document.getElementById('videoLoading').style.display = 'none';
        
        // Показываем кнопку воспроизведения
        showPlayButton();
        
        // Очищаем URL после использования
        videoPlayer.addEventListener('ended', () => {
            URL.revokeObjectURL(videoUrl);
        });
        
        // Увеличиваем просмотры
        await supabaseHelpers.incrementViews(videoId);
        
        // Загружаем рекомендации
        loadRecommendedVideos(videoId);
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        showNotification('Ошибка загрузки видео: ' + error.message, 'error');
        
        document.querySelector('.video-container').innerHTML = `
            <div class="error-message">
                <p>❌ Ошибка загрузки видео</p>
                <p style="font-size:14px;">${error.message}</p>
                <button onclick="window.location.href='/'">Вернуться на главную</button>
            </div>
        `;
    }
}

// Кнопка воспроизведения
function showPlayButton() {
    const videoWrapper = document.querySelector('.video-wrapper');
    
    if (!document.getElementById('playButton')) {
        const playButton = document.createElement('button');
        playButton.id = 'playButton';
        playButton.innerHTML = '▶ Начать просмотр';
        playButton.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 15px 30px;
            background: #ff0000;
            color: white;
            border: none;
            border-radius: 50px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            z-index: 20;
            box-shadow: 0 4px 15px rgba(255,0,0,0.3);
            transition: all 0.3s;
        `;
        
        playButton.onmouseover = () => {
            playButton.style.transform = 'translate(-50%, -50%) scale(1.05)';
        };
        
        playButton.onmouseout = () => {
            playButton.style.transform = 'translate(-50%, -50%) scale(1)';
        };
        
        playButton.onclick = () => {
            videoPlayer.play();
            playButton.style.display = 'none';
        };
        
        videoWrapper.appendChild(playButton);
    }
}

// Загрузка рекомендаций
async function loadRecommendedVideos(currentVideoId) {
    try {
        const { data: videos, error } = await supabaseHelpers.getRecommendedVideos(currentVideoId);
        
        if (error) throw error;
        
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
                        `<div style="width:100%;height:100%;background:linear-gradient(45deg,#ff0000,#000);display:flex;align-items:center;justify-content:center;color:white;">📹</div>`
                    }
                </div>
                <div class="recommended-info">
                    <h4>${video.title || 'Без названия'}</h4>
                    <p>${video.channel_name || 'FreeTube User'}</p>
                    <p>${formatViews(video.views || 0)} просмотров</p>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки рекомендаций:', error);
        document.getElementById('recommendedVideos').innerHTML = '<p>Ошибка загрузки рекомендаций</p>';
    }
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
    
    try {
        const now = new Date();
        const past = new Date(date);
        const seconds = Math.floor((now - past) / 1000);
        
        if (seconds < 60) return 'только что';
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return minutes + ' ' + getWord(minutes, 'минуту', 'минуты', 'минут') + ' назад';
        }
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return hours + ' ' + getWord(hours, 'час', 'часа', 'часов') + ' назад';
        }
        
        const days = Math.floor(hours / 24);
        if (days < 7) {
            return days + ' ' + getWord(days, 'день', 'дня', 'дней') + ' назад';
        }
        
        return new Date(date).toLocaleDateString();
        
    } catch (error) {
        return 'недавно';
    }
}

function getWord(number, form1, form2, form5) {
    number = Math.abs(number) % 100;
    if (number > 10 && number < 15) return form5;
    number = number % 10;
    if (number === 1) return form1;
    if (number > 1 && number < 5) return form2;
    return form5;
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('Страница видео загружена');
    
    if (typeof supabaseHelpers !== 'undefined') {
        console.log('✅ supabaseHelpers загружен');
        loadVideo();
    } else {
        console.error('❌ supabaseHelpers не загружен!');
    }
});
