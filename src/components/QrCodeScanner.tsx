'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Button from '@/components/ui/Button';
import { FaCamera, FaRedo, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

interface QrCodeScannerProps {
  onScanSuccess: (qrCodeData: string) => void;
  onClose?: () => void;
}

const QrCodeScanner: React.FC<QrCodeScannerProps> = ({ onScanSuccess, onClose }) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  
  // Referência para o componente Webcam
  const webcamRef = useRef<Webcam>(null);
  
  // Configurações da webcam para melhorar a compatibilidade mobile
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: isFrontCamera ? "user" : "environment",
  };
  
  // Função chamada quando a câmera é inicializada com sucesso
  const handleUserMedia = () => {
    console.log('Câmera inicializada com sucesso!');
    setIsInitializing(false);
    setCameraError(null);
    
    // Simulação de leitura de QR code após 5 segundos
    setTimeout(() => {
      toast.success('QR Code encontrado (simulação)!');
      if (onScanSuccess) {
        onScanSuccess('TESTE_QR_CODE_12345');
      }
      
      if (onClose) {
        onClose();
      }
    }, 5000);
  };
  
  // Função chamada quando ocorre um erro na inicialização da câmera
  const handleUserMediaError = (error: string | DOMException) => {
    console.error('Erro ao acessar câmera:', error);
    setIsInitializing(false);
    
    let errorMessage = 'Erro ao acessar a câmera. Verifique as permissões.';
    
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permissão para acessar a câmera foi negada. Verifique as configurações do seu navegador.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Nenhuma câmera foi encontrada neste dispositivo.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'A câmera está sendo usada por outro aplicativo.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'As configurações solicitadas para a câmera não são suportadas.';
      }
    }
    
    setCameraError(errorMessage);
    toast.error(errorMessage);
  };
  
  // Trocar entre câmera frontal e traseira
  const switchCamera = useCallback(() => {
    setIsFrontCamera(prev => !prev);
  }, []);
  
  // Reiniciar a câmera
  const restartCamera = useCallback(() => {
    setIsInitializing(true);
    setCameraError(null);
    
    // A reinicialização ocorre automaticamente pela mudança de estado
    setTimeout(() => {
      if (webcamRef.current) {
        const video = webcamRef.current.video;
        if (video) {
          video.play().catch(e => {
            console.error('Erro ao reiniciar vídeo:', e);
            setCameraError('Falha ao reiniciar a câmera.');
          });
        }
      }
    }, 500);
  }, []);
  
  // Fechar o scanner
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);
  
  // Detectar quando o componente é desmontado
  useEffect(() => {
    return () => {
      console.log('Componente QrCodeScanner desmontado');
    };
  }, []);
  
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-gray-700">Scanner de QR Code</h3>
        <p className="text-sm text-gray-500">
          {isInitializing 
            ? 'Inicializando câmera...' 
            : cameraError 
              ? cameraError 
              : 'Aponte a câmera para o QR Code'}
        </p>
      </div>
      
      <div className="w-full h-80 relative bg-gray-100 rounded-md overflow-hidden mb-4">
        {/* Componente Webcam para acesso à câmera */}
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          onUserMedia={handleUserMedia}
          onUserMediaError={handleUserMediaError}
          className="w-full h-full object-cover"
          mirrored={isFrontCamera}
          width="100%"
          height="100%"
        />
        
        {/* Overlay de erro */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white p-4 text-center">
            <div className="flex flex-col items-center">
              <p>{cameraError}</p>
              <button 
                onClick={restartCamera}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
              >
                <FaRedo className="mr-2" /> Tentar Novamente
              </button>
            </div>
          </div>
        )}
        
        {/* Indicador de carregamento */}
        {isInitializing && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        <Button 
          onClick={restartCamera}
          variant="secondary"
          className="flex items-center"
          disabled={isInitializing}
        >
          <FaRedo className="mr-2" /> Reiniciar
        </Button>
        
        <Button 
          onClick={switchCamera}
          variant="secondary"
          className="flex items-center"
          disabled={isInitializing || !!cameraError}
        >
          <FaCamera className="mr-2" /> Trocar Câmera
        </Button>
        
        <Button 
          onClick={handleClose}
          variant="secondary"
          className="flex items-center"
        >
          <FaTimesCircle className="mr-2" /> Fechar
        </Button>
      </div>
      
      <div className="text-xs text-gray-400 text-center mt-4">
        <p>Posicione o QR code do cupom fiscal dentro da área de leitura.</p>
        <p className="mt-1">Certifique-se de que há boa iluminação e que o QR code está visível por completo.</p>
        <p className="mt-1">Aviso: Esta é uma versão de teste que simula a leitura de QR code após 5 segundos.</p>
      </div>
    </div>
  );
};

export default QrCodeScanner; 