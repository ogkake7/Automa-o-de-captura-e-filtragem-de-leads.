import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { CyberButton } from './CyberButton';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmWord?: string;
  isLoading?: boolean;
  itemCount?: number;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmWord,
  isLoading = false,
  itemCount
}: ConfirmModalProps) {
  const [typedConfirmation, setTypedConfirmation] = useState('');

  if (!isOpen) return null;

  const requiresTyping = !!confirmWord;
  const isConfirmEnabled = requiresTyping 
    ? typedConfirmation.trim().toUpperCase() === confirmWord.toUpperCase() 
    : true;

  const handleConfirm = () => {
    if (!isConfirmEnabled || isLoading) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#0a0e17] border-2 border-cyber-red/50 rounded-xl p-6 shadow-[0_0_30px_rgba(255,51,102,0.25)] space-y-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyber-red/10 border border-cyber-red/30 rounded-lg text-cyber-red">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold text-white font-mono uppercase tracking-wide">
                {title}
              </h3>
              {itemCount !== undefined && (
                <span className="text-xs text-cyber-red font-mono font-bold">
                  {itemCount} registro(s) afetado(s)
                </span>
              )}
            </div>
          </div>

          <button 
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 bg-cyber-red/5 border border-cyber-red/20 rounded-lg text-xs md:text-sm text-gray-300 font-mono leading-relaxed">
          {description}
        </div>

        {requiresTyping && (
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-mono block">
              Para confirmar, digite <strong className="text-cyber-red">{confirmWord}</strong> abaixo:
            </label>
            <input 
              type="text"
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              placeholder={`Digite "${confirmWord}"`}
              className="w-full bg-cyber-bg border border-cyber-red/40 rounded px-3 py-2 text-sm text-white font-mono outline-none focus:border-cyber-red focus:shadow-[0_0_10px_rgba(255,51,102,0.3)] uppercase"
              autoFocus
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <CyberButton
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="text-xs py-2 px-4"
          >
            Cancelar
          </CyberButton>

          <CyberButton
            variant="danger"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isLoading}
            className="text-xs py-2 px-4 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {isLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
          </CyberButton>
        </div>
      </div>
    </div>
  );
}
