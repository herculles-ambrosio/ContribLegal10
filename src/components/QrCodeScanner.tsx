'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Função para inicializar a câmera
  const initCamera = async () => {
    try {
      console.log('Iniciando câmera...');
      setIsInitializing(true);
      setCameraError(null);
      
      // Limpar recursos anteriores
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Seu navegador não suporta acesso à câmera.');
        setIsInitializing(false);
        return;
      }
      
      // Solicitar acesso à câmera com configuração simples
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      
      if (!videoRef.current) {
        console.error('Elemento de vídeo não encontrado');
        setCameraError('Erro ao inicializar componente de vídeo.');
        setIsInitializing(false);
        return;
      }
      
      // Salvar referência ao stream
      streamRef.current = stream;
      
      // Configurar o vídeo
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true'); // Importante para iOS
      video.muted = true;
      
      // Aguardar carregamento do vídeo
      await video.play();
      
      setIsInitializing(false);
      console.log('Câmera inicializada com sucesso!');
      
      // Simular leitura de QR code para teste
      // (deve ser removido na versão de produção)
      setTimeout(() => {
        toast.success('QR Code encontrado (simulação)!');
        handleClose();
        onScanSuccess('TESTE_QR_CODE_12345');
      }, 5000);
      
    } catch (error) {
      console.error('Erro ao inicializar câmera:', error);
      let message = 'Erro ao acessar câmera. ';
      
      if (String(error).includes('NotAllowedError')) {
        message = 'Acesso à câmera negado. Verifique as permissões do navegador.';
      } else if (String(error).includes('NotFoundError')) {
        message = 'Nenhuma câmera encontrada neste dispositivo.';
      } else if (String(error).includes('NotReadableError')) {
        message = 'Câmera em uso por outro aplicativo ou não pode ser acessada.';
      }
      
      setCameraError(message);
      setIsInitializing(false);
    }
  };
  
  // Trocar para câmera frontal/traseira
  const switchCamera = async () => {
    if (!streamRef.current) return;
    
    // Obter o modo atual
    const currentFacingMode = streamRef.current.getVideoTracks()[0].getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    
    // Parar o stream atual
    streamRef.current.getTracks().forEach(track => track.stop());
    
    try {
      // Solicitar novo stream com a outra câmera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        streamRef.current = newStream;
        await videoRef.current.play();
        
        toast.success('Câmera alternada com sucesso');
      }
    } catch (error) {
      console.error('Erro ao trocar câmera:', error);
      toast.error('Não foi possível trocar para a outra câmera');
    }
  };
  
  // Reiniciar câmera em caso de erro
  const restartCamera = () => {
    initCamera();
  };
  
  // Limpar recursos ao fechar
  const handleClose = () => {
    console.log('Fechando câmera...');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('Parando track de vídeo');
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    if (onClose) {
      onClose();
    }
  };
  
  // Inicializar câmera ao montar o componente
  useEffect(() => {
    // Pequeno atraso antes de iniciar a câmera
    const timer = setTimeout(() => {
      initCamera();
    }, 500);
    
    // Limpar recursos ao desmontar
    return () => {
      clearTimeout(timer);
      handleClose();
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
        {/* Elemento de vídeo para exibir a câmera */}
        <video 
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
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
      </div>
    </div>
  );
};

export default QrCodeScanner; 