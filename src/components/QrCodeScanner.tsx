'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import Button from '@/components/ui/Button';
import { FaCamera, FaRedo, FaTimesCircle, FaQrcode } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

interface QrCodeScannerProps {
  onScanSuccess: (qrCodeData: string) => void;
  onClose?: () => void;
}

const QrCodeScanner: React.FC<QrCodeScannerProps> = ({ onScanSuccess, onClose }) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastDetectedCode, setLastDetectedCode] = useState<string | null>(null);
  
  // Referências para elementos e timers
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Configurações da webcam para melhorar a compatibilidade mobile
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: isFrontCamera ? "user" : "environment",
  };
  
  // Função para processar frames e detectar QR codes
  const scanQrCode = useCallback(() => {
    if (!isScanning || !webcamRef.current || !webcamRef.current.video) return;
    
    const video = webcamRef.current.video;
    
    // Garantir que o vídeo está pronto e tem dimensões válidas
    if (!video.readyState || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }
    
    // Criar canvas para o processamento da imagem se ainda não existir
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Definir dimensões do canvas para corresponder ao vídeo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Obter frame atual do vídeo
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      // Obter dados de imagem do canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Detectar QR code na imagem usando jsQR
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      // Se um QR code válido for encontrado
      if (code) {
        console.log("QR Code detectado:", code.data);
        
        // Validar o QR code (verificar se tem conteúdo e comprimento adequado)
        if (code.data && code.data.length > 10) {
          // Evitar duplicação (mesmo código lido múltiplas vezes)
          if (lastDetectedCode !== code.data) {
            // Salvar o código detectado para evitar leituras duplicadas
            setLastDetectedCode(code.data);
            
            // Parar a verificação e notificar sucesso
            stopScanning();
            handleScanSuccess(code.data);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao processar frame:", error);
    }
  }, [isScanning, lastDetectedCode]);
  
  // Iniciar o processo de escaneamento
  const startScanning = useCallback(() => {
    console.log("Iniciando escaneamento de QR code");
    setIsScanning(true);
    
    // Limpar intervalo anterior se existir
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    
    // Configurar verificação periódica de frames (a cada 200ms)
    scanIntervalRef.current = setInterval(() => {
      scanQrCode();
    }, 200);
  }, [scanQrCode]);
  
  // Parar o processo de escaneamento
  const stopScanning = useCallback(() => {
    console.log("Parando escaneamento de QR code");
    setIsScanning(false);
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);
  
  // Processar QR code lido com sucesso
  const handleScanSuccess = useCallback((qrCodeData: string) => {
    toast.success('QR Code lido com sucesso!');
    stopScanning();
    
    // Chamar callback de sucesso
    if (onScanSuccess) {
      onScanSuccess(qrCodeData);
    }
    
    // Fechar scanner após sucesso (opcional)
    if (onClose) {
      onClose();
    }
  }, [onClose, onScanSuccess, stopScanning]);
  
  // Função chamada quando a câmera é inicializada com sucesso
  const handleUserMedia = useCallback(() => {
    console.log('Câmera inicializada com sucesso!');
    setIsInitializing(false);
    setCameraError(null);
    
    // Iniciar escaneamento automaticamente quando a câmera estiver pronta
    startScanning();
  }, [startScanning]);
  
  // Função chamada quando ocorre um erro na inicialização da câmera
  const handleUserMediaError = (error: string | DOMException) => {
    console.error('Erro ao acessar câmera:', error);
    setIsInitializing(false);
    setIsScanning(false);
    
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
    const wasScanning = isScanning;
    
    // Parar o escaneamento temporariamente
    stopScanning();
    
    // Alternar câmera
    setIsFrontCamera(prev => !prev);
    
    // Reiniciar o escaneamento se estava ativo antes
    if (wasScanning) {
      // Pequeno atraso para garantir que a câmera tenha tempo de mudar
      setTimeout(() => {
        startScanning();
      }, 500);
    }
  }, [isScanning, startScanning, stopScanning]);
  
  // Reiniciar a câmera
  const restartCamera = useCallback(() => {
    setIsInitializing(true);
    setCameraError(null);
    setLastDetectedCode(null);
    
    // Parar escaneamento existente
    stopScanning();
    
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
      
      // Reiniciar escaneamento
      startScanning();
    }, 500);
  }, [startScanning, stopScanning]);
  
  // Fechar o scanner
  const handleClose = useCallback(() => {
    // Parar escaneamento antes de fechar
    stopScanning();
    
    if (onClose) {
      onClose();
    }
  }, [onClose, stopScanning]);
  
  // Limpar recursos quando o componente for desmontado
  useEffect(() => {
    return () => {
      console.log('Limpando recursos do QR Scanner');
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
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
              : isScanning
                ? 'Aponte a câmera para o QR Code'
                : 'Câmera pronta. Escaneamento parado.'}
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
        
        {/* Sobreposição visual para área de escaneamento */}
        {isScanning && !cameraError && !isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-white rounded-lg opacity-70 flex items-center justify-center">
              <FaQrcode className="text-white text-4xl opacity-50" />
            </div>
          </div>
        )}
        
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