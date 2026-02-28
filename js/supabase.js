// Конфигурация Supabase
const SUPABASE_CONFIG = {
    url: 'https://zsjxcrjopoxoaavmnoef.supabase.co', // Замените на ваш URL
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzanhjcmpvcG94b2Fhdm1ub2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTcyMTMsImV4cCI6MjA4Nzg3MzIxM30.MV8W9SAO3lvjLoqlQOLuGjIf3Ipa-OTJDNYVzs9Rfkc' // Замените на ваш anon key
};

// Инициализация Supabase клиента
const supabase = supabaseCreateClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Вспомогательные функции для работы с Supabase
const supabaseHelpers = {
    // Получение всех видео
    async getVideos(filter = 'all', limit = 50) {
        try {
            let query = supabase
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
            const { data, error } = await supabase
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
            const { data, error } = await supabase
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
            const { error } = await supabase.rpc('increment_views', { 
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
            const { data, error } = await supabase
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
            const { data, error } = await supabase
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

    // Получение видео по фильтру с пагинацией
    async getVideosPaginated(filter = 'all', page = 1, pageSize = 20) {
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            
            let query = supabase
                .from('videos')
                .select('*', { count: 'exact' });
            
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
            
            const { data, error, count } = await query
                .range(from, to);
            
            if (error) throw error;
            return { data, error: null, count };
        } catch (error) {
            console.error('Ошибка получения видео:', error);
            return { data: null, error, count: 0 };
        }
    },

    // Получение статистики пользователя (если есть авторизация)
    async getUserStats(userId) {
        try {
            const { data, error } = await supabase
                .from('videos')
                .select('*', { count: 'exact' })
                .eq('user_id', userId);
            
            if (error) throw error;
            
            const totalViews = data.reduce((sum, video) => sum + (video.views || 0), 0);
            
            return { 
                data: {
                    videoCount: data.length,
                    totalViews,
                    videos: data
                }, 
                error: null 
            };
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            return { data: null, error };
        }
    },

    // Обновление видео
    async updateVideo(videoId, updates) {
        try {
            const { data, error } = await supabase
                .from('videos')
                .update(updates)
                .eq('id', videoId)
                .select();
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Ошибка обновления видео:', error);
            return { data: null, error };
        }
    },

    // Удаление видео
    async deleteVideo(videoId) {
        try {
            const { error } = await supabase
                .from('videos')
                .delete()
                .eq('id', videoId);
            
            if (error) throw error;
            return { success: true, error: null };
        } catch (error) {
            console.error('Ошибка удаления видео:', error);
            return { success: false, error };
        }
    },

    // Аутентификация пользователя
    async signUp(email, password) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            return { data: null, error };
        }
    },

    async signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Ошибка входа:', error);
            return { data: null, error };
        }
    },

    async signOut() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            return { success: true, error: null };
        } catch (error) {
            console.error('Ошибка выхода:', error);
            return { success: false, error };
        }
    },

    // Получение текущего пользователя
    getCurrentUser() {
        return supabase.auth.getUser();
    },

    // Подписка на изменения в таблице
    subscribeToVideos(callback) {
        return supabase
            .channel('videos-channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'videos' },
                (payload) => callback(payload)
            )
            .subscribe();
    }
};

// Экспортируем для использования в других файлах
window.supabaseClient = supabase;
window.supabaseHelpers = supabaseHelpers;