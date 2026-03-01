// js/video.js

// Проверяем, не объявлены ли уже переменные
if (typeof window.videoJsLoaded === 'undefined') {
    window.videoJsLoaded = true;

    // Получаем ID видео из URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');

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

    // Загрузка видео
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
            
            console.log('Загрузка видео ID:', videoId);
            const { data: video, error } = await supabaseHelpers.getVideoById(videoId);
            
            if (error) throw error;
            if (!video) throw new Error('Видео не найдено');
            
            console.log('Видео загружено:', video);
            displayVideo(video);
            
            // Увеличиваем счетчик просмотров
            await supabaseHelpers.incrementViews(videoId);
            
            // Загружаем рекомендации
            loadRecommendedVideos(videoId);
            
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

    // Конвертация Base64 в Blob URL
    function base64ToBlobUrl(base64, mimeType = 'video/mp4') {
        try {
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
            
            const blob = new Blob(byteArrays, { type: mimeType });
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('Ошибка конвертации Base64:', error);
            return null;
        }
    }

    // Отображение видео
    function displayVideo(video) {
        document.title = `${video.title} - FreeTube`;
        
        const videoPlayer = document.getElementById('videoPlayer');
        
        // Если видео собрано из чанков
        if (video.video_data) {
            const videoUrl = base64ToBlobUrl(video.video_data);
            if (videoUrl) {
                videoPlayer.src = videoUrl;
                
                // Очищаем URL после окончания видео
                videoPlayer.addEventListener('ended', () => {
                    URL.revokeObjectURL(videoUrl);
                });
            } else {
                videoPlayer.innerHTML = 'Ошибка загрузки видео';
            }
        }
        
        // Обновляем информацию
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
        
        // Дата загрузки (исправленная)
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

    // Форматирование даты (исправленная)
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
}
