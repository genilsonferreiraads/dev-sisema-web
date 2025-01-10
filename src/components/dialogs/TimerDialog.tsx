import React from 'react';

interface TimerDialogProps {
  audioId: string;
  onConfirm: () => void;
  onCancel: () => void;
  buttonPosition: { x: number; y: number } | null;
  initialValue: string;
  onValueChange: (value: string) => void;
}

export const TimerDialog: React.FC<TimerDialogProps> = ({
  audioId,
  onConfirm,
  onCancel,
  buttonPosition,
  initialValue,
  onValueChange
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
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">
          Minutos até tocar
        </label>
        <input
          type="number"
          value={initialValue}
          onChange={(e) => onValueChange(e.target.value)}
          className="w-full bg-[#1e1e1e] border border-[#404040] text-gray-200 rounded px-3 py-2"
          min="1"
          autoFocus
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-[#e1aa1e] text-gray-900 rounded hover:bg-[#f5d485] transition-colors"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}; 