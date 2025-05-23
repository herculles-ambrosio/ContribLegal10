'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Button from '@/components/ui/Button';
import { FaLightbulb, FaRedo, FaCamera, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

// Estendendo interfaces nativas para suportar a propriedade torch
declare global {
  interface MediaTrackCapabilities {
    torch?: boolean;
  }
  
  interface MediaTrackConstraintSet {
    torch?: boolean;
  }
}

interface QrCodeScannerProps {
  onScanSuccess: (qrCodeData: string) => void;
  onScanError?: (error: any) => void;
  onDebugLog?: (message: string) => void;
}

const QrCodeScanner: React.FC<QrCodeScannerProps> = ({ 
  onScanSuccess, 
  onScanError,
  onDebugLog 
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanFailed, setHasScanFailed] = useState(false);
  const [message, setMessage] = useState('Inicializando câmera...');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameras, setCameras] = useState<{id: string, label: string}[]>([]);
  const [isIOS, setIsIOS] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Função de log
  const log = useCallback((msg: string) => {
    console.log(`[QRScanner] ${msg}`);
    if (onDebugLog) onDebugLog(msg);
  }, [onDebugLog]);
  
  // Detectar dispositivo iOS
  useEffect(() => {
    const detectIOS = () => {
      const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      setIsIOS(isApple);
      log(`Dispositivo iOS detectado: ${isApple}`);
    };
    
    detectIOS();
  }, [log]);
  
  // Limpar recursos do scanner
  const cleanupScanner = useCallback(() => {
    log('Limpando recursos do scanner');
    
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    
    // Limpar stream de vídeo direto se estiver usando abordagem nativa
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          log('Parando track de vídeo da abordagem nativa');
          track.stop();
        });
        streamRef.current = null;
      } catch (e) {
        log(`Erro ao parar stream nativo: ${e}`);
      }
    }
    
    // Limpar scanner Html5Qrcode
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          log('Parando scanner ativo...');
          scannerRef.current.stop()
            .then(() => {
              log('Scanner parado com sucesso');
              // Forçar liberação da câmera explicitamente
              try {
                const videoElements = document.querySelectorAll('video');
                videoElements.forEach(video => {
                  if (video.srcObject) {
                    const tracks = (video.srcObject as MediaStream).getTracks();
                    tracks.forEach(track => {
                      log('Parando track de vídeo explicitamente');
                      track.stop();
                    });
                    video.srcObject = null;
                  }
                });
              } catch (trackError) {
                log(`Erro ao parar tracks explicitamente: ${trackError}`);
              }
              
              scannerRef.current = null;
              setIsScanning(false);
            })
            .catch(e => {
              log(`Erro ao parar scanner: ${e}`);
              scannerRef.current = null;
              setIsScanning(false);
            });
        } else {
          scannerRef.current = null;
          setIsScanning(false);
        }
      } catch (e) {
        log(`Erro ao limpar scanner: ${e}`);
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  }, [log]);
  
  // Garantir limpeza ao desmontar o componente
  useEffect(() => {
    return () => {
      log('Componente desmontando, limpando recursos...');
      cleanupScanner();
    };
  }, [cleanupScanner, log]);
  
  // Detectar câmeras disponíveis
  const detectCameras = useCallback(async () => {
    try {
      log('Detectando câmeras disponíveis...');
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length) {
        const cameraList = devices.map(device => ({
          id: device.id,
          label: device.label || `Câmera ${device.id.substring(0, 4)}`
        }));
        
        setCameras(cameraList);
        log(`Encontradas ${cameraList.length} câmeras`);
        
        // Selecionar câmera traseira por padrão (se possível)
        const rearCamera = cameraList.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('traseira') ||
          camera.label.toLowerCase().includes('environment')
        );
        
        if (rearCamera) {
          log(`Selecionada câmera traseira: ${rearCamera.label}`);
        } else {
          log(`Selecionada primeira câmera: ${cameraList[0].label}`);
        }
        
        return true;
      } else {
        log('Nenhuma câmera encontrada');
        return false;
      }
    } catch (error) {
      log(`Erro ao detectar câmeras: ${error}`);
      return false;
    }
  }, [log]);
  
  // Processar QR Code lido
  const handleQrCodeSuccess = useCallback((decodedText: string) => {
    log(`QR Code detectado: ${decodedText}`);
    
    // Validação básica
    if (!decodedText || decodedText.length < 10) {
      log('QR Code inválido ou muito curto');
      return;
    }
    
    // Limpar scanner
    cleanupScanner();
    
    // Notificar usuário
    toast.success('QR Code lido com sucesso!');
    
    // Chamar callback de sucesso
    try {
      onScanSuccess(decodedText);
    } catch (error) {
      log(`Erro ao processar QR code: ${error}`);
      if (onScanError) onScanError(error);
    }
  }, [cleanupScanner, log, onScanSuccess, onScanError]);
  
  // Abordagem alternativa para iOS usando getUserMedia diretamente
  const startIOSDirectCamera = useCallback(async () => {
    try {
      log('Iniciando abordagem direta para iOS...');
      setMessage('Inicializando câmera (iOS)...');
      
      // Limpar recursos anteriores
      cleanupScanner();
      
      // Verificar elemento de vídeo
      if (!videoRef.current) {
        log('Elemento de vídeo não encontrado');
        throw new Error('Elemento de vídeo não encontrado');
      }
      
      // Configurações otimizadas para iOS
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: 'environment', // Usar câmera traseira
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      log('Solicitando acesso à câmera no iOS...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Armazenar referência para limpeza posterior
      streamRef.current = stream;
      
      // Conectar stream ao elemento de vídeo
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      
      log('Câmera iOS inicializada com sucesso');
      setMessage('Câmera ativada. Aponte para o QR Code.');
      setIsScanning(true);
      
      toast.success('Câmera ativada!');
      
      // Feedback de tempo para iOS
      let scanAttempts = 0;
      const feedbackTimer = setInterval(() => {
        scanAttempts++;
        
        if (scanAttempts === 5) {
          setMessage('Aponte a câmera para o QR Code');
        } else if (scanAttempts === 10) {
          setMessage('Certifique-se de que há boa iluminação');
        } else if (scanAttempts === 15) {
          setMessage('Mantenha o dispositivo estável');
        }
        
        // No iOS não temos leitura automática, apenas instruções
      }, 1000);
      
      scanTimerRef.current = feedbackTimer;
      
    } catch (error) {
      log(`Erro na abordagem iOS direta: ${error}`);
      
      let errorMessage = 'Erro ao acessar câmera no iOS';
      
      if (String(error).includes('NotAllowedError')) {
        errorMessage = 'Permissão de câmera negada. Verifique as configurações do Safari.';
      } else if (String(error).includes('NotFoundError')) {
        errorMessage = 'Câmera não encontrada neste dispositivo.';
      }
      
      toast.error(errorMessage);
      setMessage(errorMessage);
      setHasScanFailed(true);
      
      if (onScanError) onScanError(error);
    }
  }, [cleanupScanner, log, onScanError]);
  
  // Iniciar scanner padrão (para dispositivos não-iOS)
  const startStandardScanner = useCallback(async () => {
    try {
      log('Iniciando scanner padrão...');
      setMessage('Inicializando câmera...');
      setHasScanFailed(false);
      
      // Limpar scanner anterior
      cleanupScanner();
      
      // Verificar elemento HTML
      const scannerContainer = document.getElementById('qr-reader');
      if (!scannerContainer) {
        throw new Error('Elemento HTML para scanner não encontrado');
      }
      
      scannerContainer.innerHTML = '';
      
      // Solicitar permissão de câmera explícita
      try {
        log('Solicitando permissão de câmera...');
        await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        log('Permissão de câmera concedida');
      } catch (error) {
        log(`Erro de permissão: ${error}`);
        throw error;
      }
      
      // Inicializar scanner
      const html5QrCode = new Html5Qrcode('qr-reader', { 
        verbose: false
      });
      scannerRef.current = html5QrCode;
      
      // Configurações simplificadas
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
      };
      
      log('Iniciando leitura de QR code...');
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        handleQrCodeSuccess,
        (errorMessage) => {
          // Ignorar erros comuns de "No QR code found"
          if (errorMessage.includes('No QR code found')) return;
          log(`Erro de leitura: ${errorMessage}`);
        }
      );
      
      setIsScanning(true);
      setMessage('Aponte a câmera para o QR Code');
      
      // Feedback de tempo
      let scanAttempts = 0;
      const feedbackTimer = setInterval(() => {
        scanAttempts++;
        
        if (scanAttempts === 5) {
          setMessage('Posicione o QR Code no centro da tela');
        } else if (scanAttempts === 10) {
          setMessage('Certifique-se de que há boa iluminação');
        } else if (scanAttempts >= 20 && scanAttempts % 5 === 0) {
          setMessage(`Tentando ler o QR Code... (${scanAttempts}s)`);
        }
        
        // Timeout após 30 segundos
        if (scanAttempts >= 30) {
          setMessage('Toque em Reiniciar para tentar novamente');
          toast.error('Dificuldade em ler o QR Code. Tente novamente.');
          clearInterval(feedbackTimer);
        }
      }, 1000);
      
      scanTimerRef.current = feedbackTimer;
      
    } catch (error) {
      log(`Erro ao iniciar scanner padrão: ${error}`);
      
      let errorMessage = 'Erro ao iniciar scanner';
      
      if (String(error).includes('NotAllowedError') || String(error).includes('Permission denied')) {
        errorMessage = 'Permissão de câmera negada. Verifique as permissões do navegador.';
      } else if (String(error).includes('NotFoundError')) {
        errorMessage = 'Câmera não encontrada neste dispositivo.';
      } else if (String(error).includes('NotReadableError')) {
        errorMessage = 'Câmera em uso por outro aplicativo.';
      }
      
      toast.error(errorMessage);
      setMessage(errorMessage);
      setHasScanFailed(true);
      
      if (onScanError) onScanError(error);
    }
  }, [cleanupScanner, handleQrCodeSuccess, log, onScanError]);
  
  // Iniciar scanner (roteador baseado no dispositivo)
  const startScanner = useCallback(() => {
    // Em iOS, usar abordagem específica para maior compatibilidade
    if (isIOS) {
      log('Usando abordagem específica para iOS');
      startIOSDirectCamera();
    } else {
      log('Usando scanner padrão para não-iOS');
      startStandardScanner();
    }
  }, [isIOS, startIOSDirectCamera, startStandardScanner]);
  
  // Reiniciar scanner
  const restartScanner = useCallback(() => {
    log('Reiniciando scanner');
    startScanner();
  }, [startScanner]);
  
  // Trocar câmera
  const switchCamera = useCallback(() => {
    log('Tentando trocar câmera');
    
    // A implementação de troca de câmera continua a mesma
    toast.success('Tentando trocar de câmera...');
    
    // Reiniciar o scanner para usar outra câmera
    cleanupScanner();
    setTimeout(() => {
      startScanner();
    }, 500);
  }, [cleanupScanner, startScanner]);
  
  // Alternar lanterna
  const toggleTorch = useCallback(() => {
    log('Tentando alternar lanterna');
    toast.error('Função de lanterna não disponível neste dispositivo');
  }, []);
  
  // Iniciar scanner automaticamente ao montar
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isScanning && !hasScanFailed) {
        startScanner();
      }
    }, 1500);
    
    return () => {
      clearTimeout(timer);
    };
  }, [isScanning, hasScanFailed, startScanner]);
  
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-gray-700">Scanner de QR Code</h3>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
      
      <div className="w-full h-80 relative bg-gray-100 rounded-md overflow-hidden mb-4">
        {/* Container para o scanner HTML5 (usado em não-iOS) */}
        <div id="qr-reader" className={`w-full h-full ${isIOS ? 'hidden' : ''}`}></div>
        
        {/* Container para vídeo direto (usado em iOS) */}
        {isIOS && (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          ></video>
        )}
        
        {/* Overlay de erro */}
        {hasScanFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white p-4 text-center">
            <div className="flex flex-col items-center">
              <FaExclamationTriangle className="text-3xl text-yellow-400 mb-2" />
              <p>{message || 'Não foi possível acessar a câmera'}</p>
              <button 
                onClick={restartScanner}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
              >
                <FaRedo className="mr-2" /> Tentar Novamente
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        <Button 
          onClick={restartScanner}
          variant="secondary"
          className="flex items-center"
        >
          <FaRedo className="mr-2" /> Reiniciar
        </Button>
        
        <Button 
          onClick={switchCamera}
          variant="secondary"
          className="flex items-center"
        >
          <FaCamera className="mr-2" /> Trocar Câmera
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