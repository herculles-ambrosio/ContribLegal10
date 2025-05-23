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
  const [currentCamera, setCurrentCamera] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{id: string, label: string}[]>([]);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Função de log
  const log = useCallback((msg: string) => {
    console.log(`[QRScanner] ${msg}`);
    if (onDebugLog) onDebugLog(msg);
  }, [onDebugLog]);
  
  // Limpar recursos do scanner
  const cleanupScanner = useCallback(() => {
    log('Limpando recursos do scanner');
    
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          log('Parando scanner ativo...');
          scannerRef.current.stop()
            .then(() => {
              log('Scanner parado com sucesso');
              // Forçar liberação da câmera explicitamente para dispositivos móveis
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
  
  // Verificar suporte do navegador
  useEffect(() => {
    const checkMediaSupport = async () => {
      // Verificar suporte básico
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        log('Navegador não suporta API de mídia');
        setMessage('Este navegador não suporta acesso à câmera');
        setHasScanFailed(true);
        return false;
      }
      
      return true;
    };
    
    checkMediaSupport();
  }, [log]);
  
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
          setCurrentCamera(rearCamera.id);
          log(`Selecionada câmera traseira: ${rearCamera.label}`);
        } else {
          setCurrentCamera(cameraList[0].id);
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
  
  // Iniciar scanner
  const startScanner = useCallback(async () => {
    try {
      log('Iniciando scanner...');
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
      
      // Verificar se estamos em um dispositivo iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      
      // Verificar permissões da câmera explicitamente
      try {
        log('Solicitando permissão de câmera...');
        
        // Em iOS, usar configurações específicas
        if (isIOS) {
          log('Detectado dispositivo iOS, usando configurações específicas');
          await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          });
        } else {
          // Para outros dispositivos
          await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment'
            } 
          });
        }
        
        log('Permissão de câmera concedida');
      } catch (permError) {
        log(`Erro de permissão: ${permError}`);
        if (String(permError).includes('NotAllowedError')) {
          throw new Error('Permissão de câmera negada pelo usuário');
        } else if (String(permError).includes('NotFoundError')) {
          throw new Error('Nenhuma câmera encontrada neste dispositivo');
        } else {
          throw permError;
        }
      }
      
      // Inicializar scanner com modo silencioso
      const html5QrCode = new Html5Qrcode('qr-reader', { 
        verbose: false, 
        formatsToSupport: undefined // Permitir todos os formatos
      });
      scannerRef.current = html5QrCode;
      
      // Detectar câmeras se ainda não detectadas
      if (cameras.length === 0) {
        await detectCameras();
      }
      
      // Configurações otimizadas para dispositivos móveis
      const config = {
        fps: isIOS ? 5 : 10, // Menor FPS para iOS para economizar recursos
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };
      
      log('Iniciando leitura de QR code...');
      let scanStarted = false;
      
      try {
        // Primeiro tentar com câmera específica se disponível
        if (currentCamera) {
          log(`Tentando usar câmera específica: ${currentCamera}`);
          await html5QrCode.start(
            currentCamera,
            config,
            handleQrCodeSuccess,
            (errorMessage) => {
              // Ignorar erros comuns de "No QR code found"
              if (errorMessage.includes('No QR code found')) return;
              log(`Erro de leitura: ${errorMessage}`);
            }
          );
          scanStarted = true;
        }
      } catch (specificCameraError) {
        log(`Falha ao usar câmera específica: ${specificCameraError}`);
        // Continuar para o método de fallback
      }
      
      // Se falhou com câmera específica, tentar com facingMode
      if (!scanStarted) {
        try {
          log('Usando modo environment (câmera traseira)');
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
          scanStarted = true;
        } catch (facingModeError) {
          log(`Falha com facingMode environment: ${facingModeError}`);
          
          // Última tentativa: usar qualquer câmera disponível
          try {
            log('Tentando última opção: qualquer câmera disponível');
            await html5QrCode.start(
              { facingMode: "user" }, // Tentar com câmera frontal
              config,
              handleQrCodeSuccess,
              (errorMessage) => {
                if (errorMessage.includes('No QR code found')) return;
                log(`Erro de leitura: ${errorMessage}`);
              }
            );
            scanStarted = true;
          } catch (lastError) {
            log(`Todas as tentativas de iniciar scanner falharam: ${lastError}`);
            throw new Error('Não foi possível iniciar a câmera após várias tentativas');
          }
        }
      }
      
      if (!scanStarted) {
        throw new Error('Falha ao iniciar scanner de QR code');
      }
      
      // Verificar disponibilidade de lanterna
      try {
        const scanner = scannerRef.current as any;
        const hasFlash = scanner.getRunningTrackCapabilities?.()?.torch !== undefined;
        setTorchAvailable(hasFlash);
        log(`Lanterna disponível: ${hasFlash}`);
      } catch (e) {
        log(`Erro ao verificar lanterna: ${e}`);
        setTorchAvailable(false);
      }
      
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
        } else if (scanAttempts === 15) {
          setMessage('Mantenha o dispositivo estável');
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
      log(`Erro ao iniciar scanner: ${error}`);
      
      // Mensagens específicas de erro
      let errorMessage = 'Erro ao iniciar scanner';
      
      if (String(error).includes('NotAllowedError') || String(error).includes('Permission denied')) {
        errorMessage = 'Não foi possível acessar a câmera. Verifique as permissões do seu navegador.';
      } else if (String(error).includes('NotFoundError')) {
        errorMessage = 'Câmera não encontrada neste dispositivo.';
      } else if (String(error).includes('NotReadableError')) {
        errorMessage = 'Câmera em uso por outro aplicativo.';
      } else if (String(error).includes('OverconstrainedError')) {
        errorMessage = 'Restrições de câmera não puderam ser atendidas.';
      }
      
      toast.error(errorMessage);
      setMessage(errorMessage);
      setHasScanFailed(true);
      setIsScanning(false);
      
      if (onScanError) onScanError(error);
    }
  }, [cameras, cleanupScanner, currentCamera, detectCameras, handleQrCodeSuccess, log, onScanError]);
  
  // Reiniciar scanner
  const restartScanner = useCallback(() => {
    log('Reiniciando scanner');
    startScanner();
  }, [startScanner]);
  
  // Trocar câmera
  const switchCamera = useCallback(() => {
    if (cameras.length <= 1) {
      toast.error('Apenas uma câmera disponível');
      return;
    }
    
    log('Trocando câmera');
    const currentIndex = cameras.findIndex(cam => cam.id === currentCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex].id;
    
    setCurrentCamera(nextCamera);
    log(`Trocando para câmera: ${cameras[nextIndex].label}`);
    
    cleanupScanner();
    setTimeout(() => {
      startScanner();
    }, 500);
  }, [cameras, cleanupScanner, currentCamera, log, startScanner]);
  
  // Toggle flash/lanterna
  const toggleTorch = useCallback(async () => {
    if (!scannerRef.current || !torchAvailable) {
      toast.error('Lanterna não disponível');
      return;
    }
    
    try {
      const scanner = scannerRef.current as any;
      const newTorchState = !torchEnabled;
      
      if (newTorchState) {
        if (typeof scanner.turnFlashOn === 'function') {
          await scanner.turnFlashOn();
          setTorchEnabled(true);
          log('Lanterna ativada');
          toast.success('Lanterna ativada');
        } else {
          throw new Error('Método turnFlashOn não disponível');
        }
      } else {
        if (typeof scanner.turnFlashOff === 'function') {
          await scanner.turnFlashOff();
          setTorchEnabled(false);
          log('Lanterna desativada');
          toast.success('Lanterna desativada');
        } else {
          throw new Error('Método turnFlashOff não disponível');
        }
      }
    } catch (error) {
      log(`Erro ao controlar lanterna: ${error}`);
      toast.error('Não foi possível controlar a lanterna');
      setTorchAvailable(false);
    }
  }, [torchAvailable, torchEnabled, log]);
  
  // Iniciar scanner automaticamente ao montar
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isScanning && !hasScanFailed) {
        startScanner();
      }
    }, 1000);
    
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
        {/* Container para o scanner HTML5 */}
        <div id="qr-reader" className="w-full h-full"></div>
        
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
        
        {cameras.length > 1 && (
          <Button 
            onClick={switchCamera}
            variant="secondary"
            className="flex items-center"
          >
            <FaCamera className="mr-2" /> Trocar Câmera
          </Button>
        )}
        
        {torchAvailable && (
          <Button 
            onClick={toggleTorch}
            variant={torchEnabled ? "primary" : "secondary"}
            className="flex items-center"
          >
            <FaLightbulb className="mr-2" /> {torchEnabled ? 'Desligar Luz' : 'Ligar Luz'}
          </Button>
        )}
      </div>
      
      <div className="text-xs text-gray-400 text-center mt-4">
        <p>Posicione o QR code do cupom fiscal dentro da área de leitura.</p>
        <p className="mt-1">Certifique-se de que há boa iluminação e que o QR code está visível por completo.</p>
      </div>
    </div>
  );
};

export default QrCodeScanner; 