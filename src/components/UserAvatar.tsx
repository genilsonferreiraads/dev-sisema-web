import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types/auth';
import { supabase } from '../lib/supabase';

interface UserAvatarProps {
  user: User;
  size?: number;
  onAvatarUpdate?: () => void;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 40, onAvatarUpdate }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) fetchAvatar();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAvatar = async () => {
    try {
      const { data: avatar, error: fetchError } = await supabase
        .from('avatars')
        .select('url')
        .eq('user_id', user.id.toString())
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching avatar:', fetchError);
        return;
      }

      if (avatar?.url) {
        const { data: publicUrl } = supabase.storage
          .from('avatars')
          .getPublicUrl(avatar.url);
        
        if (publicUrl) {
          setAvatarUrl(publicUrl.publicUrl);
        }
      } else {
        setAvatarUrl(null);
      }
    } catch (error) {
      console.error('Error in fetchAvatar:', error);
    }
  };

  const sanitizeFileName = (fileName: string): string => {
    // Remove extensão para tratar separadamente
    const [name, ext] = fileName.split('.');
    
    return name
      // Remove acentos
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Substitui espaços e caracteres especiais por underline
      .replace(/[^a-zA-Z0-9]/g, '_')
      // Remove underlines duplicados
      .replace(/_+/g, '_')
      // Converte para minúsculas
      .toLowerCase()
      // Adiciona extensão de volta
      + '.' + ext.toLowerCase();
  };

  const uploadAvatar = async (file: File) => {
    try {
      setUploading(true);
      setError(null);

      // Validar tamanho do arquivo (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Arquivo muito grande. Tamanho máximo: 5MB');
        return;
      }

      // Validar tipo do arquivo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WEBP');
        return;
      }

      // 1. Buscar registro existente
      const { data: existingAvatar } = await supabase
        .from('avatars')
        .select('url')
        .eq('user_id', user.id.toString())
        .single();

      // 2. Se existir um avatar antigo, deletar do storage
      if (existingAvatar?.url) {
        const { error: removeError } = await supabase.storage
          .from('avatars')
          .remove([existingAvatar.url]);

        if (removeError) {
          console.error('Erro ao remover arquivo antigo:', removeError);
        }
      }

      // 3. Preparar o novo arquivo com nome sanitizado
      const sanitizedFileName = sanitizeFileName(file.name);
      const fileName = `${user.id}/${sanitizedFileName}`;

      // 4. Fazer upload do novo arquivo
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        setError('Erro ao fazer upload da imagem');
        return;
      }

      // 5. Obter URL pública do novo arquivo
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      if (!publicUrlData) {
        setError('Erro ao obter URL da imagem');
        return;
      }

      // 6. Atualizar ou inserir registro no banco
      const { error: upsertError } = await supabase
        .from('avatars')
        .upsert({
          user_id: user.id.toString(),
          url: fileName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        console.error('Erro ao atualizar registro:', upsertError);
        setError('Erro ao atualizar registro do avatar');
        return;
      }

      // 7. Atualizar interface
      setAvatarUrl(publicUrlData.publicUrl);
      if (onAvatarUpdate) onAvatarUpdate();
      
    } catch (error) {
      console.error('Erro ao processar avatar:', error);
      setError('Erro inesperado ao processar o avatar');
    } finally {
      setUploading(false);
      setShowUploadModal(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadAvatar(file);
    }
  };

  const getInitials = () => {
    const name = user.display_name || user.full_name || user.email || '';
    return name
      .split(' ')
      .map((part: string) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const handleEditClick = () => {
    setShowMenu(false);
    setShowUploadModal(true);
  };

  return (
    <>
      <div className="relative inline-block">
        <div
          className="relative group rounded-full overflow-hidden cursor-pointer border-2 border-[#404040] transform transition-all duration-300 hover:scale-110"
          style={{ width: size, height: size }}
          onClick={() => setShowMenu(!showMenu)}
        >
          {avatarUrl ? (
            <div className="relative w-full h-full">
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all duration-300">
                <svg 
                  className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full">
              <div className="absolute inset-0 bg-[#e1aa1e] flex items-center justify-center">
                <span className="text-gray-900 font-bold" style={{ fontSize: size * 0.4 }}>
                  {getInitials()}
                </span>
              </div>
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all duration-300">
                <svg 
                  className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Menu de Edição */}
        {showMenu && (
          <div 
            ref={menuRef}
            className="absolute right-0 mt-2 w-40 bg-[#2d2d2d] rounded-lg shadow-lg border border-[#404040] z-50
              animate-fadeInScale origin-top-right"
          >
            <div className="absolute -top-2 right-4 w-4 h-4 bg-[#2d2d2d] border-l border-t border-[#404040] transform rotate-45"></div>
            
            <div className="relative py-1">
              <button
                onClick={handleEditClick}
                className="w-full px-3 py-2 text-left text-gray-300 hover:bg-[#404040] flex items-center gap-2 transition-colors duration-200 whitespace-nowrap text-sm"
              >
                <svg 
                  className="w-4 h-4 text-[#e1aa1e] flex-shrink-0"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Editar foto
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#2d2d2d] rounded-lg shadow-xl max-w-md w-full mx-4 animate-fadeInScale border border-[#404040]">
            <div className="p-6">
              {/* Cabeçalho */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#1e1e1e] rounded-lg border border-[#404040]">
                    <svg 
                      className="w-6 h-6 text-[#e1aa1e]"
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Alterar foto</h3>
                    <p className="text-sm text-gray-400">Selecione uma nova imagem para seu perfil</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 hover:bg-[#404040] rounded-lg transition-colors duration-200 border border-transparent hover:border-[#505050]"
                >
                  <svg className="w-5 h-5 text-gray-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Preview do Avatar */}
              <div className="mb-8">
                <div className="relative mx-auto w-32 h-32">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#e1aa1e]/20 to-transparent rounded-full animate-pulse"></div>
                  <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-[#404040] bg-[#1e1e1e]">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#e1aa1e] flex items-center justify-center">
                        <span className="text-gray-900 font-bold text-4xl">{getInitials()}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 bg-[#e1aa1e] rounded-full p-2 border-2 border-[#2d2d2d] shadow-lg">
                    <svg className="w-4 h-4 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Input de Arquivo */}
              <div className="space-y-4">
                <div className="relative">
                  <label className="relative block w-full text-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-gray-300
                        file:mr-4 file:py-2.5 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-[#e1aa1e] file:text-gray-900
                        hover:file:bg-[#e1aa1e]/90
                        file:cursor-pointer
                        disabled:opacity-50 disabled:cursor-not-allowed
                        focus:outline-none"
                      disabled={uploading}
                    />
                  </label>
                </div>

                {uploading && (
                  <div className="flex flex-col items-center justify-center py-4 gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#e1aa1e] border-t-transparent"></div>
                    <span className="text-sm text-gray-400">Enviando foto...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 