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

// Конвертация Base64 в Blob URL
function base64ToBlobUrl(base64, mimeType = 'video/mp4') {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error('Ошибка конвертации Base64:', error);
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
        
        // Отображаем информацию
        document.getElementById('videoTitle').textContent = info.title || 'Без названия';
        document.getElementById('videoDescription').textContent = info.description || 'Нет описания';
        document.getElementById('channelName').textContent = info.channel_name || 'FreeTube User';
        document.getElementById('viewCount').textContent = (info.views || 0) + ' просмотров';
        
        const date = info.created_at ? new Date(info.created_at).toLocaleDateString() : 'недавно';
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
        
        // Загружаем все чанки
        const allChunks = [];
        for (let i = 0; i < totalChunks; i += 10) {
            const end = Math.min(i + 9, totalChunks - 1);
            const chunks = await supabaseHelpers.getVideoChunks(videoId, i, end);
            if (chunks && chunks.length > 0) {
                allChunks.push(...chunks);
                
                const percent = Math.floor((allChunks.length / totalChunks) * 100);
                document.getElementById('loadingText').textContent = 
                    `Загрузка... ${allChunks.length}/${totalChunks} (${percent}%)`;
            }
        }
        
        // Сортируем чанки
        allChunks.sort((a, b) => a.chunk_index - b.chunk_index);
        
        // Собираем все данные
        let fullBase64 = '';
        for (const chunk of allChunks) {
            fullBase64 += chunk.chunk_data;
        }
        
        console.log(`📦 Всего данных: ${(fullBase64.length * 0.75 / 1024 / 1024).toFixed(2)} МБ`);
        
        // Создаем URL для видео
        const videoUrl = base64ToBlobUrl(fullBase64);
        
        if (videoUrl) {
            videoPlayer.src = videoUrl;
            document.getElementById('videoLoading').style.display = 'none';
            
            // Показываем кнопку воспроизведения
            showPlayButton();
        }
        
        // Увеличиваем просмотры
        await supabaseHelpers.incrementViews(videoId);
        
        // Загружаем рекомендации
        loadRecommendedVideos(videoId);
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки видео', 'error');
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
        `;
        
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
                        `<img src="${video.thumbnail}" style="width:100%;height:100%;object-fit:cover;">` :
                        `<div style="width:100%;height:100%;background:linear-gradient(45deg,#ff0000,#000);display:flex;align-items:center;justify-content:center;color:white;">📹</div>`
                    }
                </div>
                <div class="recommended-info">
                    <h4>${video.title || 'Без названия'}</h4>
                    <p>${video.channel_name || 'FreeTube User'}</p>
                    <p>${video.views || 0} просмотров</p>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки рекомендаций:', error);
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('Страница видео загружена');
    
    if (typeof supabaseHelpers !== 'undefined') {
        console.log('✅ supabaseHelpers загружен');
        loadVideo();
    }
});
