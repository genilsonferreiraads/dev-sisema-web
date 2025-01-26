import { supabase } from '../lib/supabase';
import { TTS_API_KEYS } from '../config/api';

export const temporaryAudioService = {
  async uploadAudio(audioBlob: Blob): Promise<string> {
    try {
      // Primeiro, busca e remove os áudios antigos
      const { data: oldAudios, error: fetchError } = await supabase
        .from('temporary_audios')
        .select('file_path')
        .order('created_at', { ascending: false });

      if (!fetchError && oldAudios && oldAudios.length > 0) {
        // Remove os arquivos antigos do storage
        const filePaths = oldAudios.map(audio => audio.file_path);
        await supabase.storage
          .from('temporary-audios')
          .remove(filePaths);

        // Remove os registros antigos do banco
        await supabase
          .from('temporary_audios')
          .delete()
          .not('file_path', 'eq', 'dummy'); // Deleta todos os registros
      }

      // Gera um nome único para o arquivo
      const fileName = `temp_audio_${Date.now()}.mp3`;
      
      // Faz upload do arquivo para o bucket 'temporary-audios'
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('temporary-audios')
        .upload(fileName, audioBlob, {
          upsert: true,
          cacheControl: '300'
        });

      if (uploadError) throw uploadError;

      // Obtém a URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('temporary-audios')
        .getPublicUrl(fileName);

      // Salva a referência na tabela temporary_audios
      const { data: insertData, error: dbError } = await supabase
        .from('temporary_audios')
        .insert([
          {
            audio_url: publicUrl,
            file_path: fileName,
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutos
          }
        ])
        .select();

      if (dbError) throw dbError;

      return publicUrl;
    } catch (error) {
      console.error('Erro detalhado ao fazer upload do áudio:', error);
      throw error;
    }
  },

  async cleanupExpiredAudios() {
    try {
      // Busca áudios expirados
      const { data: expiredAudios, error: fetchError } = await supabase
        .from('temporary_audios')
        .select('file_path')
        .lt('expires_at', new Date().toISOString());

      if (fetchError) throw fetchError;

      if (expiredAudios && expiredAudios.length > 0) {
        // Remove os arquivos do storage
        const filePaths = expiredAudios.map(audio => audio.file_path);
        const { error: deleteStorageError } = await supabase.storage
          .from('temporary-audios')
          .remove(filePaths);

        if (deleteStorageError) throw deleteStorageError;

        // Remove os registros do banco
        const { error: deleteDbError } = await supabase
          .from('temporary_audios')
          .delete()
          .lt('expires_at', new Date().toISOString());

        if (deleteDbError) throw deleteDbError;
      }
    } catch (error) {
      console.error('Erro ao limpar áudios expirados:', error);
    }
  },

  async createTemporaryAudio(text: string): Promise<{ url: string }> {
    try {
      // Gera o áudio usando a API da Azure
      const response = await fetch(
        'https://brazilsouth.tts.speech.microsoft.com/cognitiveservices/v1',
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': TTS_API_KEYS.azure,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
          },
          body: `<speak version='1.0' xml:lang='pt-BR'>
            <voice xml:lang='pt-BR' xml:gender='Female' name='pt-BR-FranciscaNeural'>
              ${text}
            </voice>
          </speak>`
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao gerar áudio com Azure');
      }

      const audioBlob = await response.blob();
      const url = await this.uploadAudio(audioBlob);

      return { url };
    } catch (error) {
      console.error('Erro ao criar áudio temporário:', error);
      throw error;
    }
  }
}; 