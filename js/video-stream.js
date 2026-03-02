// js/video-stream.js

// Получаем ID видео из URL
const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('id');

// Конфигурация
const CHUNKS_PER_BATCH = 5; // Сколько чанков загружать за раз
let mediaSource = null;
let sourceBuffer = null;
let videoQueue = [];
let loadedChunks = 0;
let totalChunks = 0;
let videoInfo = null;
let isLoadingNextBatch = false;
let videoPlayer = document.getElementById('videoPlayer');
let isInitialized = false;

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

// Обновление прогресса загрузки
function updateProgress() {
    const chunkProgress = document.getElementById('chunkProgress');
    const loadingText = document.getElementById('loadingText');
    
    if (totalChunks > 0) {
        const percent = Math.floor((loadedChunks / totalChunks) * 100);
        chunkProgress.textContent = `📦 Загружено: ${loadedChunks}/${totalChunks} (${percent}%)`;
        chunkProgress.style.display = 'block';
        
        if (loadingText) {
            loadingText.textContent = `Загрузка видео... ${loadedChunks}/${totalChunks}`;
        }
        
        if (loadedChunks === totalChunks) {
            setTimeout(() => {
                chunkProgress.style.display = 'none';
            }, 3000);
        }
    }
}

// Инициализация MediaSource
function initMediaSource() {
    return new Promise((resolve, reject) => {
        mediaSource = new MediaSource();
        videoPlayer.src = URL.createObjectURL(mediaSource);
        
        mediaSource.addEventListener('sourceopen', async () => {
            try {
                // Определяем MIME тип (mp4)
                sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
                
                sourceBuffer.addEventListener('updateend', () => {
                    // Если есть очередь и буфер не занят, добавляем следующий чанк
                    if (videoQueue.length > 0 && !sourceBuffer.updating) {
                        appendNextChunk();
                    }
                    
                    // Если буфер почти пуст и есть еще чанки, загружаем следующую партию
                    if (sourceBuffer.buffered.length > 0) {
                        const bufferedEnd = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
                        const currentTime = videoPlayer.currentTime;
                        
                        // Если осталось меньше 10 секунд видео, загружаем следующую партию
                        if (bufferedEnd - currentTime < 10 && loadedChunks < totalChunks && !isLoadingNextBatch) {
                            loadNextChunks();
                        }
                    }
                });
                
                resolve();
            } catch (error) {
                reject(error);
            }
        });
        
        mediaSource.addEventListener('sourceended', () => {
            console.log('MediaSource закончился');
        });
        
        mediaSource.addEventListener('sourceclose', () => {
            console.log('MediaSource закрыт');
        });
    });
}

// Добавление следующего чанка в буфер
function appendNextChunk() {
    if (videoQueue.length === 0 || sourceBuffer.updating || !sourceBuffer) return;
    
    const chunk = videoQueue.shift();
    try {
        // Конвертируем Base64 в ArrayBuffer
        const binaryString = atob(chunk.chunk_data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        sourceBuffer.appendBuffer(bytes.buffer);
        loadedChunks++;
        
        // Обновляем прогресс
        updateProgress();
        
        // Если это первый чанк, скрываем индикатор загрузки
        if (loadedChunks === 1) {
            document.getElementById('videoLoading').style.display = 'none';
        }
        
        console.log(`✅ Чанк ${chunk.chunk_index} добавлен в буфер`);
        
    } catch (error) {
        console.error('❌ Ошибка добавления чанка в буфер:', error);
        
        // Пробуем следующий чанк
        if (videoQueue.length > 0) {
            setTimeout(() => appendNextChunk(), 100);
        }
    }
}

// Загрузка следующей партии чанков
async function loadNextChunks() {
    if (!videoInfo || isLoadingNextBatch || loadedChunks >= totalChunks) return;
    
    isLoadingNextBatch = true;
    
    const nextChunkIndex = loadedChunks + videoQueue.length;
    if (nextChunkIndex >= totalChunks) {
        isLoadingNextBatch = false;
        return;
    }
    
    const toIndex = Math.min(nextChunkIndex + CHUNKS_PER_BATCH - 1, totalChunks - 1);
    
    try {
        console.log(`📥 Загрузка чанков ${nextChunkIndex} - ${toIndex}`);
        
        const chunks = await supabaseHelpers.getVideoChunks(videoId, nextChunkIndex, toIndex);
        
        if (chunks && chunks.length > 0) {
            videoQueue.push(...chunks);
            
            // Если буфер свободен, начинаем добавлять
            if (sourceBuffer && !sourceBuffer.updating) {
                appendNextChunk();
            }
        }
        
    } catch (error) {
        console.error('Ошибка загрузки чанков:', error);
    } finally {
        isLoadingNextBatch = false;
    }
}

// Загрузка первых чанков
async function loadFirstChunks() {
    try {
        // Загружаем первую партию чанков
        const firstChunks = await supabaseHelpers.getVideoChunks(videoId, 0, CHUNKS_PER_BATCH * 2 - 1);
        
        if (firstChunks && firstChunks.length > 0) {
            videoQueue.push(...firstChunks);
            
            // Ждем готовности sourceBuffer
            const waitForSourceBuffer = () => {
                if (sourceBuffer && !sourceBuffer.updating) {
                    appendNextChunk();
                } else {
                    setTimeout(waitForSourceBuffer, 100);
                }
            };
            
            setTimeout(waitForSourceBuffer, 500);
        }
        
        // Загружаем остальные чанки в фоне
        loadNextChunks();
        
    } catch (error) {
        console.error('Ошибка загрузки первых чанков:', error);
    }
}

// Основная функция загрузки видео
async function loadVideo() {
    if (!videoId) {
        window.location.href = '/';
        return;
    }
    
    try {
        // Проверяем наличие supabaseHelpers
        if (typeof supabaseHelpers === 'undefined') {
            throw new Error('supabaseHelpers не загружен');
        }
        
        // Показываем индикатор загрузки
        document.getElementById('videoLoading').style.display = 'flex';
        
        // Загружаем информацию о видео
        const { data: info, error } = await supabaseHelpers.getVideoInfo(videoId);
        if (error) throw error;
        if (!info) throw new Error('Видео не найдено');
        
        videoInfo = info;
        
        // Отображаем информацию о видео
        displayVideoInfo(info);
        
        // Получаем общее количество чанков
        totalChunks = info.total_chunks || await supabaseHelpers.getTotalChunks(videoId);
        
        if (totalChunks === 0) {
            throw new Error('Видео повреждено');
        }
        
        console.log(`📊 Всего чанков: ${totalChunks}`);
        
        // Инициализируем MediaSource
        await initMediaSource();
        
        // Загружаем первые чанки
        await loadFirstChunks();
        
        // Увеличиваем счетчик просмотров
        await supabaseHelpers.incrementViews(videoId);
        
        // Загружаем рекомендации
        loadRecommendedVideos(videoId);
        
        // Отслеживаем время воспроизведения для подгрузки
        videoPlayer.addEventListener('timeupdate', () => {
            if (sourceBuffer && sourceBuffer.buffered.length > 0) {
                const bufferedEnd = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
                const currentTime = videoPlayer.currentTime;
                
                // Если осталось мало буфера, загружаем следующую партию
                if (bufferedEnd - currentTime < 5 && loadedChunks < totalChunks && !isLoadingNextBatch) {
                    loadNextChunks();
                }
            }
        });
        
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        showNotification('Видео не найдено', 'error');
        
        document.querySelector('.video-container').innerHTML = `
            <div class="error-message">
                <p>❌ Ошибка загрузки видео: ${error.message}</p>
                <button onclick="window.location.href='/'">Вернуться на главную</button>
            </div>
        `;
    }
}

// Отображение информации о видео
function displayVideoInfo(video) {
    document.title = `${video.title} - FreeTube`;
    
    document.getElementById('videoTitle').textContent = video.title || 'Без названия';
    document.getElementById('videoDescription').textContent = video.description || 'Нет описания';
    
    // Название канала
    const channelName = video.channel_name || 'FreeTube User';
    document.getElementById('channelName').textContent = channelName;
    
    // Аватар канала
    const channelAvatar = document.getElementById('channelAvatar');
    if (channelAvatar) {
        channelAvatar.textContent = channelName.charAt(0).toUpperCase();
    }
    
    // Просмотры
    const viewCount = document.getElementById('viewCount');
    viewCount.textContent = formatViews(video.views || 0) + ' просмотров';
    
    // Дата загрузки
    const uploadDate = document.getElementById('uploadDate');
    if (video.created_at) {
        uploadDate.textContent = timeAgo(video.created_at);
    } else {
        uploadDate.textContent = 'недавно';
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
        
        if (seconds < 0) return 'только что';
        if (seconds < 60) return 'только что';
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return minutes + ' ' + getMinutesWord(minutes) + ' назад';
        }
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return hours + ' ' + getHoursWord(hours) + ' назад';
        }
        
        const days = Math.floor(hours / 24);
        if (days < 7) {
            return days + ' ' + getDaysWord(days) + ' назад';
        }
        
        if (days < 30) {
            const weeks = Math.floor(days / 7);
            return weeks + ' ' + getWeeksWord(weeks) + ' назад';
        }
        
        if (days < 365) {
            const months = Math.floor(days / 30);
            return months + ' ' + getMonthsWord(months) + ' назад';
        }
        
        const years = Math.floor(days / 365);
        return years + ' ' + getYearsWord(years) + ' назад';
        
    } catch (error) {
        console.error('Ошибка форматирования даты:', error);
        return 'недавно';
    }
}

// Вспомогательные функции для склонения
function getMinutesWord(minutes) {
    if (minutes % 10 === 1 && minutes % 100 !== 11) return 'минуту';
    if ([2,3,4].includes(minutes % 10) && ![12,13,14].includes(minutes % 100)) return 'минуты';
    return 'минут';
}

function getHoursWord(hours) {
    if (hours % 10 === 1 && hours % 100 !== 11) return 'час';
    if ([2,3,4].includes(hours % 10) && ![12,13,14].includes(hours % 100)) return 'часа';
    return 'часов';
}

function getDaysWord(days) {
    if (days % 10 === 1 && days % 100 !== 11) return 'день';
    if ([2,3,4].includes(days % 10) && ![12,13,14].includes(days % 100)) return 'дня';
    return 'дней';
}

function getWeeksWord(weeks) {
    if (weeks % 10 === 1 && weeks % 100 !== 11) return 'неделю';
    if ([2,3,4].includes(weeks % 10) && ![12,13,14].includes(weeks % 100)) return 'недели';
    return 'недель';
}

function getMonthsWord(months) {
    if (months % 10 === 1 && months % 100 !== 11) return 'месяц';
    if ([2,3,4].includes(months % 10) && ![12,13,14].includes(months % 100)) return 'месяца';
    return 'месяцев';
}

function getYearsWord(years) {
    if (years % 10 === 1 && years % 100 !== 11) return 'год';
    if ([2,3,4].includes(years % 10) && ![12,13,14].includes(years % 100)) return 'года';
    return 'лет';
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('Страница видео загружена');
    
    // Проверяем наличие supabaseHelpers
    if (typeof supabaseHelpers !== 'undefined') {
        console.log('✅ supabaseHelpers загружен');
        loadVideo();
    } else {
        console.error('❌ supabaseHelpers не загружен!');
        document.querySelector('.video-container').innerHTML = `
            <div class="error-message">
                <p>❌ Ошибка загрузки конфигурации</p>
                <button onclick="location.reload()">Обновить</button>
            </div>
        `;
    }
});
