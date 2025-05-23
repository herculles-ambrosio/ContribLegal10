'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Button from '@/components/ui/Button';
import { FaLightbulb, FaRedo, FaCamera, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
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
  onClose?: () => void;
}

const QrCodeScanner: React.FC<QrCodeScannerProps> = ({ 
  onScanSuccess, 
  onScanError,
  onDebugLog,
  onClose
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanFailed, setHasScanFailed] = useState(false);
  const [message, setMessage] = useState('Inicializando câmera...');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameras, setCameras] = useState<{id: string, label: string}[]>([]);
  const [isIOS, setIsIOS] = useState(false);
  const [initAttempts, setInitAttempts] = useState(0);
  
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
    
    // Limpar stream de vídeo direto
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
    
    // Limpar elemento de vídeo
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch (e) {
        log(`Erro ao limpar elemento de vídeo: ${e}`);
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
  
  // Verificar permissões de câmera
  const checkCameraPermission = useCallback(async () => {
    try {
      // Verificar se o navegador suporta a API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        log('Navegador não suporta API MediaDevices');
        return false;
      }
      
      // Solicitar permissão explicitamente
      log('Solicitando permissão de câmera explicitamente...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      
      // Se chegar aqui, a permissão foi concedida
      log('Permissão de câmera concedida!');
      
      // Liberar o stream imediatamente após o teste
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      log(`Erro ao verificar permissão de câmera: ${error}`);
      
      if (String(error).includes('NotAllowedError')) {
        log('Permissão de câmera negada pelo usuário');
        toast.error('Você precisa permitir o acesso à câmera para utilizar o scanner');
      } else if (String(error).includes('NotFoundError')) {
        log('Nenhuma câmera encontrada');
        toast.error('Nenhuma câmera foi encontrada no dispositivo');
      } 
      
      return false;
    }
  }, [log]);
  
  // Abordagem mais direta para câmera
  const startNativeCamera = useCallback(async () => {
    try {
      log('Iniciando abordagem nativa com camera...');
      setMessage('Inicializando câmera...');
      
      // Limpar recursos anteriores
      cleanupScanner();
      
      // Verificar elemento de vídeo
      if (!videoRef.current) {
        log('Elemento de vídeo não encontrado');
        throw new Error('Elemento de vídeo não encontrado');
      }
      
      // Verificar permissão de câmera
      const hasPermission = await checkCameraPermission();
      if (!hasPermission) {
        throw new Error('Permissão de câmera negada');
      }
      
      // Configurações de vídeo otimizadas
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: 'environment', // Câmera traseira
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      log('Acessando câmera...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Verificar disponibilidade de lanterna
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        // @ts-ignore - Propriedade torch pode não estar definida em todos os navegadores
        const hasTorch = capabilities.torch || false;
        setTorchAvailable(hasTorch);
        log(`Lanterna disponível: ${hasTorch}`);
      }
      
      // Armazenar referência para limpeza posterior
      streamRef.current = stream;
      
      // Configurar o elemento de vídeo
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true'); // Essencial para iOS
      video.muted = true;
      
      // Iniciar reprodução
      try {
        await video.play();
        log('Vídeo iniciado com sucesso');
      } catch (playError) {
        log(`Erro ao iniciar vídeo: ${playError}`);
        throw new Error('Falha ao iniciar reprodução de vídeo');
      }
      
      setIsScanning(true);
      setMessage('Câmera ativada. Aponte para o QR Code.');
      toast.success('Câmera ativada com sucesso!');
      
      setInitAttempts(prev => prev + 1);
      
      // Feedback de tempo
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
      }, 1000);
      
      scanTimerRef.current = feedbackTimer;
      
    } catch (error) {
      log(`Erro na abordagem nativa: ${error}`);
      
      let errorMessage = 'Erro ao acessar câmera';
      
      if (String(error).includes('NotAllowedError') || String(error).includes('Permission denied')) {
        errorMessage = 'Permissão de câmera negada. Verifique as configurações do navegador.';
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
  }, [checkCameraPermission, cleanupScanner, log, onScanError]);
  
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
  
  // Alternar lanterna
  const toggleTorch = useCallback(async () => {
    log('Tentando alternar lanterna');
    
    if (!torchAvailable) {
      toast.error('Lanterna não disponível neste dispositivo');
      return;
    }
    
    try {
      if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        
        if (videoTrack && typeof videoTrack.applyConstraints === 'function') {
          // Alternar estado da lanterna
          const newTorchState = !torchEnabled;
          
          // Aplicar restrição
          await videoTrack.applyConstraints({
            // @ts-ignore - Propriedade torch pode não estar definida em todos os tipos
            advanced: [{ torch: newTorchState }]
          });
          
          setTorchEnabled(newTorchState);
          log(`Lanterna ${newTorchState ? 'ativada' : 'desativada'}`);
          toast.success(`Lanterna ${newTorchState ? 'ativada' : 'desativada'}`);
        } else {
          throw new Error('Track de vídeo não suporta restrições avançadas');
        }
      } else if (scannerRef.current) {
        // Tentar usar a API do Html5Qrcode
        const scanner = scannerRef.current as any;
        const newTorchState = !torchEnabled;
        
        if (newTorchState) {
          if (typeof scanner.turnFlashOn === 'function') {
            await scanner.turnFlashOn();
            setTorchEnabled(true);
            log('Lanterna ativada via Html5Qrcode');
            toast.success('Lanterna ativada');
          } else {
            throw new Error('Método turnFlashOn não disponível');
          }
        } else {
          if (typeof scanner.turnFlashOff === 'function') {
            await scanner.turnFlashOff();
            setTorchEnabled(false);
            log('Lanterna desativada via Html5Qrcode');
            toast.success('Lanterna desativada');
          } else {
            throw new Error('Método turnFlashOff não disponível');
          }
        }
      } else {
        throw new Error('Nenhum stream ativo disponível');
      }
    } catch (error) {
      log(`Erro ao controlar lanterna: ${error}`);
      toast.error('Não foi possível controlar a lanterna');
      setTorchAvailable(false);
    }
  }, [torchAvailable, torchEnabled, log]);
  
  // Fechar o scanner
  const handleClose = useCallback(() => {
    log('Fechando scanner');
    cleanupScanner();
    
    if (onClose) {
      onClose();
    }
  }, [cleanupScanner, onClose]);
  
  // Trocar câmera
  const switchCamera = useCallback(() => {
    log('Tentando trocar câmera');
    
    // Tentar trocar entre câmera frontal e traseira
    cleanupScanner();
    
    // No próximo início, tentar com configuração oposta
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: torchEnabled ? 'user' : 'environment'
      }
    };
    
    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        if (videoRef.current) {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          
          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          videoRef.current.play()
            .then(() => {
              setIsScanning(true);
              toast.success('Câmera alternada com sucesso');
            })
            .catch(e => {
              log(`Erro ao iniciar vídeo após trocar câmera: ${e}`);
              toast.error('Erro ao trocar câmera');
            });
        }
      })
      .catch(error => {
        log(`Erro ao trocar câmera: ${error}`);
        toast.error('Falha ao trocar câmera');
        
        // Tentar reiniciar com a configuração original
        setTimeout(startNativeCamera, 500);
      });
  }, [cleanupScanner, startNativeCamera, torchEnabled, log]);
  
  // Reiniciar scanner
  const restartScanner = useCallback(() => {
    log('Reiniciando scanner');
    startNativeCamera();
  }, [startNativeCamera]);
  
  // Iniciar scanner automaticamente ao montar
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isScanning && !hasScanFailed) {
        startNativeCamera();
      }
    }, 1000);
    
    return () => {
      clearTimeout(timer);
    };
  }, [isScanning, hasScanFailed, startNativeCamera]);
  
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-gray-700">Scanner de QR Code</h3>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
      
      <div className="w-full h-80 relative bg-gray-100 rounded-md overflow-hidden mb-4">
        {/* Container para vídeo direto */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        ></video>
        
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
        
        <Button 
          onClick={toggleTorch}
          variant={torchEnabled ? "primary" : "secondary"}
          className="flex items-center"
        >
          <FaLightbulb className="mr-2" /> {torchEnabled ? 'Desligar Luz' : 'Ligar Luz'}
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
        
        {initAttempts > 1 && (
          <p className="mt-2 text-red-500">
            Se a câmera não abrir, verifique as permissões do navegador ou tente em outro dispositivo.
          </p>
        )}
      </div>
    </div>
  );
};

export default QrCodeScanner; 