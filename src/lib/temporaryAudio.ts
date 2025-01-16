import { supabase } from './supabase';

export const uploadTemporaryAudio = async (file: File): Promise<string> => {
  const fileName = `temp_audio_${Date.now()}.${file.name.split('.').pop()}`;

  try {
    // Upload do arquivo
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('temporary-audios')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Obtém a URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('temporary-audios')
      .getPublicUrl(fileName);

    // Insere o registro no banco
    const { data: insertData, error: dbError } = await supabase
      .from('temporary_audios')
      .insert([
        {
          file_name: fileName,
          url: publicUrl,
          created_at: new Date().toISOString()
        }
      ]);

    if (dbError) throw dbError;

    return publicUrl;

  } catch (error) {
    throw error;
  }
}; 