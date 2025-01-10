import React from 'react';

interface ConfirmDialogProps {
  audioId: string;
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
  buttonPosition: { x: number; y: number } | null;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  audioId,
  onConfirm,
  onEdit,
  onCancel,
  buttonPosition
}) => {
  if (!buttonPosition) return null;

  return (
    <div
      className="fixed z-50 bg-[#2d2d2d] border border-[#404040] rounded-lg shadow-lg py-2 min-w-[160px]"
      style={{
        left: buttonPosition.x,
        top: buttonPosition.y
      }}
    >
      <button
        onClick={onConfirm}
        className="w-full px-4 py-2 text-left hover:bg-[#404040] transition-colors text-gray-200"
      >
        Repetição Automática
      </button>
      <button
        onClick={onEdit}
        className="w-full px-4 py-2 text-left hover:bg-[#404040] transition-colors text-gray-200"
      >
        Editar
      </button>
      <button
        onClick={onCancel}
        className="w-full px-4 py-2 text-left hover:bg-[#404040] transition-colors text-gray-200"
      >
        Cancelar
      </button>
    </div>
  );
}; 