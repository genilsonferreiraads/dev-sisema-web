import React from 'react';

interface DeleteConfirmDialogProps {
  audioId: string;
  onConfirm: () => void;
  onCancel: () => void;
  buttonPosition: { x: number; y: number } | null;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  audioId,
  onConfirm,
  onCancel,
  buttonPosition
}) => {
  if (!buttonPosition) return null;

  return (
    <div
      className="fixed z-50 bg-[#2d2d2d] border border-[#404040] rounded-lg shadow-lg p-4"
      style={{
        left: buttonPosition.x,
        top: buttonPosition.y
      }}
    >
      <p className="text-gray-200 mb-4">
        Tem certeza que deseja excluir este áudio?
      </p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}; 