// Конфигурация Supabase
const SUPABASE_CONFIG = {
    url: 'https://zsjxcrjopoxoaavmnoef.supabase.co', // Замените на ваш URL
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzanhjcmpvcG94b2Fhdm1ub2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTcyMTMsImV4cCI6MjA4Nzg3MzIxM30.MV8W9SAO3lvjLoqlQOLuGjIf3Ipa-OTJDNYVzs9Rfkc' // Замените на ваш anon key
};

// Проверяем, что Supabase загружен
if (typeof supabase === 'undefined') {
    console.error('Supabase SDK не загружен! Проверьте подключение CDN');
}

// Инициализация Supabase клиента
const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Вспомогательные функции для работы с Supabase
const supabaseHelpers = {
    // Получение всех видео
    async getVideos(filter = 'all', limit = 50) {
        try {
            let query = supabaseClient
                .from('videos')
                .select('*');
            
            switch(filter) {
                case 'latest':
                    query = query.order('created_at', { ascending: false });
                    break;
                case 'popular':
                    query = query.order('views', { ascending: false });
                    break;
                default:
                    query = query.order('created_at', { ascending: false });
            }
            
            const { data, error } = await query.limit(limit);
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Ошибка получения видео:', error);
            return { data: null, error };
        }
    },

    // Получение одного видео по ID
    async getVideoById(videoId) {
        try {
            const { data, error } = await supabaseClient
                .from('videos')
                .select('*')
                .eq('id', videoId)
                .single();
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Ошибка получения видео:', error);
            return { data: null, error };
        }
    },

    // Добавление нового видео
    async insertVideo(videoData) {
        try {
            const { data, error } = await supabaseClient
                .from('videos')
                .insert([videoData])
                .select();
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Ошибка вставки видео:', error);
            return { data: null, error };
        }
    },

    // Увеличение счетчика просмотров
    async incrementViews(videoId) {
        try {
            const { error } = await supabaseClient.rpc('increment_views', { 
                video_id: videoId 
            });
            
            if (error) throw error;
            return { success: true, error: null };
        } catch (error) {
            console.error('Ошибка обновления просмотров:', error);
            return { success: false, error };
        }
    },

    // Поиск видео
    async searchVideos(searchTerm) {
        try {
            const { data, error } = await supabaseClient
                .from('videos')
                .select('*')
                .ilike('title', `%${searchTerm}%`)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Ошибка поиска:', error);
            return { data: null, error };
        }
    },

    // Получение рекомендованных видео (исключая текущее)
    async getRecommendedVideos(currentVideoId, limit = 10) {
        try {
            const { data, error } = await supabaseClient
                .from('videos')
                .select('*')
                .neq('id', currentVideoId)
                .order('views', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Ошибка получения рекомендаций:', error);
            return { data: null, error };
        }
    },

    // Получение текущего пользователя
    getCurrentUser() {
        return supabaseClient.auth.getUser();
    },

    // Выход из системы
    async signOut() {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            return { success: true, error: null };
        } catch (error) {
            console.error('Ошибка выхода:', error);
            return { success: false, error };
        }
    }
};

// Делаем функции доступными глобально
window.supabaseClient = supabaseClient;
window.supabaseHelpers = supabaseHelpers;

console.log('Supabase инициализирован успешно');
