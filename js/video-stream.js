// js/video-stream.js

// Получаем ID видео из URL
const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('id');

// Конфигурация
let hls = null;
let videoPlayer = document.getElementById('videoPlayer');
let mediaSource = null;

// Функция показа уведомлений
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

// Конвертация чанков в HLS формат (на лету)
async function createHLSPlaylist(chunks) {
    // Сортируем чанки
    chunks.sort((a, b) => a.chunk_index - b.chunk_index);
    
    // Создаем массив с данными
    const binaryData = [];
    let totalSize = 0;
    
    for (const chunk of chunks) {
        try {
            const binaryString = atob(chunk.chunk_data);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
            }
            binaryData.push(bytes);
            totalSize += bytes.length;
        } catch (e) {
            console.error('Ошибка обработки чанка:', e);
        }
    }
    
    console.log(`📦 Всего данных: ${(totalSize / 1024 / 1024).toFixed(2)} МБ`);
    
    // Создаем Blob и URL
    const blob = new Blob(binaryData, { type: 'video/mp4' });
    return URL.createObjectURL(blob);
}

// Загружаем видео с поддержкой HLS
async function loadVideoWithHLS() {
    try {
        // Загружаем информацию о видео
        const { data: info, error } = await supabaseHelpers.getVideoInfo(videoId);
        if (error) throw error;
        
        // Получаем общее количество чанков
        const totalChunks = info.total_chunks || await supabaseHelpers.getTotalChunks(videoId);
        console.log(`📊 Всего чанков: ${totalChunks}`);
        
        // Загружаем все чанки
        const allChunks = [];
        for (let i = 0; i < totalChunks; i += 20) {
            const end = Math.min(i + 19, totalChunks - 1);
            const chunks = await supabaseHelpers.getVideoChunks(videoId, i, end);
            if (chunks && chunks.length > 0) {
                allChunks.push(...chunks);
                
                // Обновляем прогресс
                const percent = Math.floor((allChunks.length / totalChunks) * 100);
                document.getElementById('loadingText').textContent = 
                    `Загрузка... ${allChunks.length}/${totalChunks} (${percent}%)`;
            }
        }
        
        // Создаем URL для видео
        const videoUrl = await createHLSPlaylist(allChunks);
        
        // Проверяем поддержку HLS
        if (Hls.isSupported()) {
            hls = new Hls({
                maxBufferSize: 30 * 1000 * 1000, // 30 МБ буфер
                maxBufferLength: 30, // 30 секунд буфера
                liveSyncDurationCount: 3,
                enableWorker: true,
                debug: false
            });
            
            hls.loadSource(videoUrl);
            hls.attachMedia(videoPlayer);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('✅ HLS манифест загружен');
                document.getElementById('videoLoading').style.display = 'none';
                showPlayButton();
            });
            
            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS ошибка:', data);
            });
        } 
        // Fallback для браузеров без HLS
        else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            videoPlayer.src = videoUrl;
            videoPlayer.addEventListener('loadedmetadata', () => {
                document.getElementById('videoLoading').style.display = 'none';
                showPlayButton();
            });
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

// Показать кнопку воспроизведения
function showPlayButton() {
    const videoContainer = document.querySelector('.video-wrapper');
    
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
        
        videoContainer.style.position = 'relative';
        videoContainer.appendChild(playButton);
    }
}

// Добавляем поддержку полноэкранного режима
function enableFullscreen() {
    if (videoPlayer.requestFullscreen) {
        videoPlayer.requestFullscreen();
    } else if (videoPlayer.webkitRequestFullscreen) {
        videoPlayer.webkitRequestFullscreen();
    } else if (videoPlayer.msRequestFullscreen) {
        videoPlayer.msRequestFullscreen();
    }
}

// Добавляем кнопку полноэкранного режима
function addFullscreenButton() {
    const videoWrapper = document.querySelector('.video-wrapper');
    const fsButton = document.createElement('button');
    fsButton.innerHTML = '⛶';
    fsButton.style.cssText = `
        position: absolute;
        bottom: 20px;
        right: 20px;
        background: rgba(0,0,0,0.6);
        color: white;
        border: none;
        border-radius: 5px;
        padding: 8px 12px;
        font-size: 18px;
        cursor: pointer;
        z-index: 15;
        transition: background 0.3s;
    `;
    
    fsButton.onmouseover = () => {
        fsButton.style.background = 'rgba(255,0,0,0.8)';
    };
    
    fsButton.onmouseout = () => {
        fsButton.style.background = 'rgba(0,0,0,0.6)';
    };
    
    fsButton.onclick = enableFullscreen;
    
    videoWrapper.appendChild(fsButton);
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('Страница видео загружена');
    
    if (typeof supabaseHelpers !== 'undefined') {
        console.log('✅ supabaseHelpers загружен');
        loadVideoWithHLS();
        addFullscreenButton();
    } else {
        console.error('❌ supabaseHelpers не загружен!');
    }
});
