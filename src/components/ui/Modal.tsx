'use client';

import { ReactNode, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}: ModalProps) {
  // Fechar o modal com a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Impedir o scroll do body quando o modal está aberto
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Se o modal estiver fechado, não renderizar nada
  if (!isOpen) return null;
  
  // Mapear o tamanho do modal para classes CSS
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl'
  };

  // Renderizar o modal usando portal no documento
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      {/* Overlay de fundo para fechar o modal ao clicar fora */}
      <div 
        className="absolute inset-0 bg-transparent" 
        onClick={onClose} 
        aria-hidden="true"
      />
      
      {/* Container do modal */}
      <div 
        className={`relative z-10 w-full ${sizeClasses[size]} bg-white rounded-lg shadow-xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do modal */}
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              onClick={onClose}
            >
              <FaTimes />
            </button>
          </div>
        )}
        
        {/* Corpo do modal */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
} 