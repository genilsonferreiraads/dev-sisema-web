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
}

export interface VideoData {
  id: string;
  url: string;
  title?: string;
  created_at: string;
}

export const audioService = {
  async getAudios() {
    const { data, error } = await supabase
      .from('audios')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar áudios:', error);
      throw error;
    }

    console.log('Dados retornados do Supabase:', data); // Para debug
    return data as AudioData[];
  },

  async addAudio(audio: Omit<AudioData, 'id' | 'created_at'>) {
    console.log('Tentando adicionar áudio com dados:', audio);
    
    const { data, error } = await supabase
      .from('audios')
      .insert([{
        title: audio.title,
        url: audio.url,
        auto_repeat: false,
        repeat_interval: 0,
        play_count: 0
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao adicionar áudio:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Nenhum dado retornado após inserção');
    }

    return data as AudioData;
  },

  async deleteAudio(id: string) {
    const { error } = await supabase
      .from('audios')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  updateAudio: async (id: string, updates: Partial<AudioData>) => {
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
  }) => {
    const { data, error } = await supabase
      .from('audios')
      .update(preferences)
      .eq('id', audioId)
      .select()
      .single();

    if (error) throw error;
    return data as AudioData;
  },

  loadPreferences: async (audioId: string) => {
    const { data, error } = await supabase
      .from('audios')
      .select('auto_repeat, repeat_interval, last_played_at, play_count, timer_end_at')
      .eq('id', audioId)
      .single();

    if (error) throw error;
    return data;
  }
};

export const videoService = {
  async getVideos(): Promise<VideoData[]> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addVideo(url: string): Promise<VideoData> {
    if (!url) {
      throw new Error('URL não pode estar vazia');
    }

    console.log('Tentando adicionar vídeo:', { url });
    
    const { data, error } = await supabase
      .from('videos')
      .insert([{ url }])
      .select()
      .single();
    
    if (error) {
      console.error('Erro detalhado do Supabase:', error);
      throw new Error(
        error.message || 
        'Erro ao adicionar vídeo no banco de dados'
      );
    }

    if (!data) {
      throw new Error('Nenhum dado retornado após inserção');
    }

    console.log('Vídeo adicionado com sucesso:', data);
    return data as VideoData;
  },

  async deleteVideo(id: string) {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Erro ao deletar vídeo: ${error.message}`);
    }
  }
}; 