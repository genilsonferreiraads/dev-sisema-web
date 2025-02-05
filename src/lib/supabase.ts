import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam variáveis de ambiente do Supabase');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AudioData {
  id: string;
  title: string;
  url: string;
  created_at: string;
  auto_repeat: boolean;
  repeat_interval: number;
  last_played_at?: string;
  play_count?: number;
  timer_end_at?: string;
  is_pinned?: boolean;
  pinned_at?: string;
}

export interface VideoData {
  id: string;
  url: string;
  title?: string;
  created_at: string;
  play_order?: number;
  last_played?: string;
}

export const audioService = {
  getAudios: async (): Promise<AudioData[]> => {
    const { data, error } = await supabase
      .from('audios')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  addAudio: async (audio: Omit<AudioData, 'id' | 'created_at'>): Promise<AudioData> => {
    const { data, error } = await supabase
      .from('audios')
      .insert([{
        title: audio.title,
        url: audio.url,
        auto_repeat: false,
        repeat_interval: 0,
        play_count: 0,
        is_pinned: false,
        pinned_at: undefined
      }])
      .select()
      .single();
    
    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Nenhum dado retornado após inserção');
    }

    return data as AudioData;
  },

  deleteAudio: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('audios')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  updateAudio: async (id: string, updates: Partial<AudioData>): Promise<AudioData> => {
    const { data, error } = await supabase
      .from('audios')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as AudioData;
  },

  updatePreferences: async (audioId: string, preferences: {
    auto_repeat?: boolean;
    repeat_interval?: number;
    last_played_at?: string;
    play_count?: number;
    timer_end_at?: string;
  }): Promise<AudioData> => {
    const { data, error } = await supabase
      .from('audios')
      .update(preferences)
      .eq('id', audioId)
      .select()
      .single();

    if (error) throw error;
    return data as AudioData;
  },

  loadPreferences: async (audioId: string): Promise<{
    auto_repeat: boolean;
    repeat_interval: number;
    last_played_at?: string;
    play_count: number;
    timer_end_at?: string;
  }> => {
    const { data, error } = await supabase
      .from('audios')
      .select('auto_repeat, repeat_interval, last_played_at, play_count, timer_end_at')
      .eq('id', audioId)
      .single();

    if (error) throw error;
    return data;
  },

  getAudio: async (audioId: string): Promise<AudioData | null> => {
    const { data, error } = await supabase
      .from('audios')
      .select('*')
      .eq('id', audioId)
      .single();
      
    if (error) {
      console.error('Erro ao buscar áudio:', error);
      return null;
    }
    
    return data;
  },

  updateAudioTitle: async (audioId: string, title: string) => {
    const { data, error } = await supabase
      .from('audios')
      .update({ title })
      .eq('id', audioId)
      .single();

    if (error) throw error;
    return data;
  },

  updateAudioPreferences: async (audioId: string, preferences: any) => {
    const { data, error } = await supabase
      .from('audio_preferences')
      .upsert({
        audio_id: audioId,
        ...preferences
      })
      .single();

    if (error) throw error;
    return data;
  },

  async renameAudioFile(audioId: string, newTitle: string): Promise<AudioData> {
    try {
      // 1. Get the current audio data
      const { data: audio, error: fetchError } = await supabase
        .from('audios')
        .select('*')
        .eq('id', audioId)
        .single();

      if (fetchError) throw fetchError;
      if (!audio) throw new Error('Audio not found');

      // 2. Extract the old file name from the URL (removing query parameters)
      const oldFileName = audio.url.split('/').pop()?.split('?')[0];
      if (!oldFileName) throw new Error('Invalid file URL');

      // 3. Generate new file name (keeping the extension)
      const fileExtension = oldFileName.split('.').pop();
      const sanitizedTitle = newTitle
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-zA-Z0-9.]/g, '_')  // Replace special chars with _
        .replace(/_+/g, '_')             // Remove multiple underscores
        .toLowerCase();                   // Convert to lowercase
      const newFileName = `${sanitizedTitle}.${fileExtension}`;

      // 4. Move the file in storage (which effectively renames it)
      const { error: moveError } = await supabase.storage
        .from('audios')
        .move(oldFileName, newFileName);

      if (moveError) {
        console.error('Error moving file:', moveError);
        throw new Error('Failed to rename file in storage');
      }

      // 5. Get the new public URL
      const { data: { publicUrl: newUrl } } = supabase.storage
        .from('audios')
        .getPublicUrl(newFileName);

      // 6. Update the database with new title and URL
      const { data: updatedAudio, error: updateError } = await supabase
        .from('audios')
        .update({ 
          title: newTitle,
          url: newUrl 
        })
        .eq('id', audioId)
        .select()
        .single();

      if (updateError) throw updateError;
      if (!updatedAudio) throw new Error('Failed to update audio');

      return updatedAudio;
    } catch (error) {
      console.error('Error renaming audio file:', error);
      throw error;
    }
  }
};

interface UserVideoHistory {
  user_id: string;
  video_id: string;
  last_watched: Date;
  watch_order: number;
}

export const videoService = {
  async updateVideoOrder(videoId: string): Promise<void> {
    try {
      // Primeiro, busca todos os vídeos com seus dados completos
      const { data: allVideos } = await supabase
        .from('videos')
        .select('*')
        .order('play_order', { ascending: false });

      if (!allVideos) return;

      const currentVideo = allVideos.find(v => v.id === videoId);
      if (!currentVideo) return;

      // Atualiza o vídeo selecionado primeiro
      const { error: selectedError } = await supabase
        .from('videos')
        .update({ 
          play_order: allVideos.length,
          last_played: new Date().toISOString()
        })
        .eq('id', videoId);

      if (selectedError) {
        console.error('Erro ao atualizar vídeo selecionado:', selectedError);
        throw selectedError;
      }

      // Atualiza os outros vídeos
      for (const video of allVideos) {
        if (video.id === videoId) continue;

        const newOrder = video.play_order > currentVideo.play_order
          ? video.play_order
          : (video.play_order || 0) - 1;

        const { error } = await supabase
          .from('videos')
          .update({ play_order: newOrder })
          .eq('id', video.id);

        if (error) {
          console.error('Erro ao atualizar ordem do vídeo:', error);
          // Continua mesmo com erro para tentar atualizar os outros
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar ordem do vídeo:', error);
      throw error;
    }
  },

  async addVideo(url: string, title: string): Promise<VideoData> {
    try {
      // Extrai o ID do vídeo da URL do embed para comparação
      const videoId = url.split('/embed/')[1];
      
      // Faz as duas consultas em paralelo
      const [{ data: existingVideos }, { data: allVideos }] = await Promise.all([
        supabase
          .from('videos')
          .select('*')
          .filter('url', 'ilike', `%${videoId}%`),
        supabase
          .from('videos')
          .select('id, play_order')
          .order('play_order', { ascending: false })
      ]);

      // Se o vídeo já existe, apenas atualiza sua ordem
      const existingVideo = existingVideos?.[0];
      if (existingVideo) {
        await videoService.updateVideoOrder(existingVideo.id);
        return existingVideo;
      }

      // Adiciona o novo vídeo com a ordem correta
      const { data, error } = await supabase
        .from('videos')
        .insert([{ 
          url, 
          title, 
          play_order: allVideos?.length || 0,
          last_played: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Nenhum dado retornado após inserção');

      // Atualiza a ordem dos vídeos existentes
      if (allVideos?.length) {
        for (const video of allVideos) {
          const { error: updateError } = await supabase
            .from('videos')
            .update({ play_order: (video.play_order || 0) - 1 })
            .eq('id', video.id);

          if (updateError) {
            console.error('Erro ao atualizar ordem do vídeo:', updateError);
            // Continua mesmo com erro para tentar atualizar os outros
          }
        }
      }

      // Inicia limpeza de vídeos antigos em background
      videoService.cleanOldVideos().catch(console.error);

      return data;
    } catch (error) {
      console.error('Erro ao adicionar vídeo:', error);
      throw error;
    }
  },

  async deleteVideo(id: string): Promise<void> {
    try {
      // Primeiro, pega a ordem do vídeo que será deletado e todos os vídeos
      const { data: videos } = await supabase
        .from('videos')
        .select('id, play_order')
        .order('play_order', { ascending: false });

      const videoToDelete = videos?.find(v => v.id === id);
      if (!videoToDelete) return;

      const deletedOrder = videoToDelete.play_order || 0;

      // Deleta o vídeo
      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Atualiza a ordem dos vídeos que estavam depois do vídeo deletado
      const videosToUpdate = videos?.filter(v => 
        v.id !== id && 
        (v.play_order || 0) < deletedOrder
      );

      // Atualiza cada vídeo individualmente
      for (const video of videosToUpdate || []) {
        await supabase
          .from('videos')
          .update({ play_order: (video.play_order || 0) + 1 })
          .eq('id', video.id);
      }
    } catch (error) {
      console.error('Erro ao deletar vídeo:', error);
      throw error;
    }
  },

  async getRecentVideos(): Promise<VideoData[]> {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('play_order', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar vídeos:', error);
      throw error;
    }
  },

  async saveVideoHistory(userId: string, videoId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      // Tenta atualizar se existir
      const { data: existingData, error: checkError } = await supabase
        .from('user_video_history')
        .select('id')
        .eq('user_id', userId)
        .eq('video_id', videoId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Erro ao verificar histórico:', checkError);
        return;
      }

      if (existingData?.id) {
        const { error: updateError } = await supabase
          .from('user_video_history')
          .update({
            last_watched: now,
            watch_order: 0
          })
          .eq('id', existingData.id);

        if (updateError) {
          console.error('Erro ao atualizar histórico:', updateError);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_video_history')
          .insert([{
            user_id: userId,
            video_id: videoId,
            last_watched: now,
            watch_order: 0
          }]);

        if (insertError) {
          console.error('Erro ao inserir histórico:', insertError);
          return;
        }
      }

      // Tenta reordenar o histórico e trata possíveis erros
      const { error: reorderError } = await supabase
        .rpc('reorder_video_history', { p_user_id: userId });

      if (reorderError) {
        console.error('Erro ao reordenar histórico:', reorderError);
        // Não retorna aqui, pois o registro principal já foi salvo
      }

    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  },

  async getVideoHistory(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('user_video_history')
        .select('video_id')
        .eq('user_id', userId)
        .order('watch_order', { ascending: true })
        .order('last_watched', { ascending: false });

      if (error) throw error;
      return data?.map(h => h.video_id) || [];
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      return [];
    }
  },

  async getLastWatchedVideo(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('user_video_history')
        .select('video_id')
        .eq('user_id', userId)
        .order('last_watched', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0]?.video_id || null;
    } catch (error) {
      console.error('Erro ao carregar último vídeo:', error);
      return null;
    }
  },

  async cleanOldVideos(): Promise<void> {
    try {
      // Primeiro, pega todos os vídeos ordenados por data
      const { data: videos } = await supabase
        .from('videos')
        .select('id')
        .order('created_at', { ascending: false });

      if (!videos || videos.length <= 30) return; // Se tiver 30 ou menos vídeos, não precisa limpar

      // Pega os IDs dos vídeos que devem ser removidos (a partir do 31º)
      const videosToDelete = videos.slice(30).map(video => video.id);

      // Primeiro, remove os registros relacionados no histórico
      const { error: historyError } = await supabase
        .from('user_video_history')
        .delete()
        .in('video_id', videosToDelete);

      if (historyError) {
        console.error('Erro ao limpar histórico de vídeos:', historyError);
        return;
      }

      // Depois remove os vídeos
      const { error } = await supabase
        .from('videos')
        .delete()
        .in('id', videosToDelete);

      if (error) {
        console.error('Erro ao limpar vídeos antigos:', error);
      }
    } catch (error) {
      console.error('Erro ao limpar vídeos antigos:', error);
    }
  },

  async updateVideoTitle(videoId: string, title: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('videos')
        .update({ title })
        .eq('id', videoId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar título do vídeo:', error);
      throw error;
    }
  }
}; 