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
  onScanError?: (error: any) => void;
  onDebugLog?: (message: string) => void;
}

const QrCodeScanner: React.FC<QrCodeScannerProps> = ({ 
  onScanSuccess, 
  onClose,
  onScanError,
  onDebugLog 
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastDetectedCode, setLastDetectedCode] = useState<string | null>(null);
  const [lastProcessTime, setLastProcessTime] = useState(0);
  
  // Função de log que envia para o componente pai se disponível
  const log = useCallback((message: string) => {
    console.log(message);
    if (onDebugLog) {
      onDebugLog(message);
    }
  }, [onDebugLog]);
  
  // Referências para elementos e timers
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processingRef = useRef(false);
  
  // Configurações da webcam para melhorar a compatibilidade mobile
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: isFrontCamera ? "user" : "environment",
    // Melhorar qualidade e foco
    aspectRatio: 16/9,
    frameRate: { ideal: 30 }
  };
  
  // Função para processar frames e detectar QR codes com melhor performance
  const scanQrCode = useCallback(() => {
    if (!isScanning || !webcamRef.current || !webcamRef.current.video) return;
    
    // Evitar processamento de frames muito próximos para melhorar performance
    const now = performance.now();
    const timeSinceLastProcess = now - lastProcessTime;
    
    // Limitar a taxa de processamento para no máximo 10 frames por segundo (100ms)
    if (timeSinceLastProcess < 50) return;
    
    // Evitar processamento simultâneo
    if (processingRef.current) return;
    
    // Marcar como processando
    processingRef.current = true;
    setLastProcessTime(now);
    
    const video = webcamRef.current.video;
    
    // Garantir que o vídeo está pronto e tem dimensões válidas
    if (!video.readyState || video.videoWidth === 0 || video.videoHeight === 0) {
      processingRef.current = false;
      return;
    }
    
    // Criar canvas para o processamento da imagem se ainda não existir
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      processingRef.current = false;
      return;
    }
    
    // Reduzir a resolução para melhorar performance mantendo precisão adequada
    const scale = 0.6; // Usar 60% da resolução original
    const scaledWidth = Math.floor(video.videoWidth * scale);
    const scaledHeight = Math.floor(video.videoHeight * scale);
    
    // Definir dimensões do canvas para corresponder ao vídeo redimensionado
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    
    // Obter frame atual do vídeo com dimensões reduzidas
    ctx.drawImage(video, 0, 0, scaledWidth, scaledHeight);
    
    try {
      // Obter dados de imagem do canvas
      const imageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);
      
      // Detectar QR code na imagem usando jsQR com configurações otimizadas
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert", // Mais rápido, geralmente suficiente
      });
      
      // Se um QR code válido for encontrado
      if (code) {
        log(`Código QR detectado com dados: ${code.data.substring(0, 20)}...`);
        
        // Validar o QR code (verificar se tem conteúdo e comprimento adequado)
        if (code.data && code.data.length > 10) {
          // Evitar duplicação (mesmo código lido múltiplas vezes)
          if (lastDetectedCode !== code.data) {
            // Salvar o código detectado para evitar leituras duplicadas
            setLastDetectedCode(code.data);
            
            // Feedback visual e sonoro
            try {
              // Vibrar dispositivo (para mobile)
              if (navigator.vibrate) {
                navigator.vibrate(200);
              }
            } catch (e) {
              log("Vibração não suportada");
            }
            
            // Parar escaneamento
            if (scanIntervalRef.current) {
              clearInterval(scanIntervalRef.current);
              scanIntervalRef.current = null;
            }
            setIsScanning(false);
            
            // Notificar sucesso
            log(`QR Code detectado com sucesso: ${code.data.substring(0, 20)}...`);
            toast.success('QR Code lido com sucesso!');
            
            // Chamar callback de sucesso
            if (onScanSuccess) {
              onScanSuccess(code.data);
            }
            
            // Fechar scanner após sucesso (opcional)
            if (onClose) {
              onClose();
            }
          } else {
            log("QR Code ignorado (duplicado)");
          }
        } else {
          log(`QR Code rejeitado (muito curto): ${code.data}`);
        }
      }
    } catch (error) {
      console.error("Erro ao processar frame:", error);
      log(`Erro ao processar frame: ${error instanceof Error ? error.message : 'desconhecido'}`);
      
      // Notificar erro para componente pai
      if (onScanError) {
        onScanError(error);
      }
    } finally {
      // Marcar como não processando
      processingRef.current = false;
    }
  }, [isScanning, lastDetectedCode, lastProcessTime, log, onScanError, onScanSuccess, onClose]);
  
  // Iniciar o processo de escaneamento
  const startScanning = useCallback(() => {
    log("Iniciando escaneamento de QR code");
    setIsScanning(true);
    
    // Limpar intervalo anterior se existir
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    
    // Configurar verificação periódica de frames (agora mais frequente para melhor responsividade)
    scanIntervalRef.current = setInterval(() => {
      scanQrCode();
    }, 50); // Verificar a cada 50ms (mais rápido)
  }, [scanQrCode, log]);
  
  // Parar o processo de escaneamento
  const stopScanning = useCallback(() => {
    log("Parando escaneamento de QR code");
    setIsScanning(false);
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, [log]);
  
  // Função chamada quando a câmera é inicializada com sucesso
  const handleUserMedia = useCallback(() => {
    log('Câmera inicializada com sucesso!');
    setIsInitializing(false);
    setCameraError(null);
    
    // Iniciar escaneamento automaticamente quando a câmera estiver pronta
    startScanning();
  }, [startScanning, log]);
  
  // Função chamada quando ocorre um erro na inicialização da câmera
  const handleUserMediaError = useCallback((error: string | DOMException) => {
    const errorMessage = error instanceof DOMException ? `${error.name}: ${error.message}` : error;
    log(`Erro ao acessar câmera: ${errorMessage}`);
    console.error('Erro ao acessar câmera:', error);
    
    setIsInitializing(false);
    setIsScanning(false);
    
    let errorDisplayMessage = 'Erro ao acessar a câmera. Verifique as permissões.';
    
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        errorDisplayMessage = 'Permissão para acessar a câmera foi negada. Verifique as configurações do seu navegador.';
      } else if (error.name === 'NotFoundError') {
        errorDisplayMessage = 'Nenhuma câmera foi encontrada neste dispositivo.';
      } else if (error.name === 'NotReadableError') {
        errorDisplayMessage = 'A câmera está sendo usada por outro aplicativo.';
      } else if (error.name === 'OverconstrainedError') {
        errorDisplayMessage = 'As configurações solicitadas para a câmera não são suportadas.';
      }
    }
    
    setCameraError(errorDisplayMessage);
    toast.error(errorDisplayMessage);
    
    // Notificar o componente pai sobre o erro
    if (onScanError) {
      onScanError(error);
    }
  }, [log, onScanError]);
  
  // Trocar entre câmera frontal e traseira
  const switchCamera = useCallback(() => {
    log(`Trocando câmera: ${isFrontCamera ? 'traseira' : 'frontal'} -> ${isFrontCamera ? 'frontal' : 'traseira'}`);
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
  }, [isScanning, startScanning, stopScanning, isFrontCamera, log]);
  
  // Reiniciar a câmera - CORRIGIDO para funcionar corretamente
  const restartCamera = useCallback(() => {
    log("Reiniciando câmera...");
    // Parar escaneamento existente
    stopScanning();
    
    // Resetar estados e variáveis
    setIsInitializing(true);
    setCameraError(null);
    setLastDetectedCode(null);
    processingRef.current = false;
    
    // Se houver um stream ativo, pará-lo
    if (webcamRef.current && webcamRef.current.video) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
    
    // Pequeno atraso para garantir que tudo foi limpo
    setTimeout(() => {
      // Re-renderizar a câmera com um novo componente
      if (webcamRef.current) {
        // Forçar re-renderização
        webcamRef.current.video = null;
        setIsInitializing(true);
        
        // Atrasar o reinício da câmera para garantir limpeza completa
        setTimeout(() => {
          setIsInitializing(false);
          startScanning();
          log("Câmera reiniciada com sucesso");
        }, 300);
      }
    }, 200);
  }, [startScanning, stopScanning, log]);
  
  // Fechar o scanner - CORRIGIDO para funcionar corretamente
  const handleClose = useCallback(() => {
    log("Fechando scanner...");
    
    // Parar escaneamento antes de fechar
    stopScanning();
    
    // Se houver um stream ativo, pará-lo
    if (webcamRef.current && webcamRef.current.video) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
    
    // Chamar callback de fechamento
    if (onClose) {
      onClose();
    }
  }, [onClose, stopScanning, log]);
  
  // Limpar recursos quando o componente for desmontado
  useEffect(() => {
    return () => {
      console.log('Limpando recursos do QR Scanner');
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      
      // Garantir que todos os tracks da câmera sejam parados
      if (webcamRef.current && webcamRef.current.video) {
        const stream = webcamRef.current.video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
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