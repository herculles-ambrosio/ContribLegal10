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
  // Estado do vídeo
  const [hasStream, setHasStream] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('Inicializando câmera...');
  
  // Refs para manipulação direta de elementos
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScannedQR = useRef<string | null>(null);
  
  // Logger simples
  const log = useCallback((message: string) => {
    console.log(`[QRScanner] ${message}`);
    if (onDebugLog) onDebugLog(message);
  }, [onDebugLog]);

  // Parar stream de vídeo e liberar recursos
  const stopMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      log('Parando stream de vídeo');
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    setHasStream(false);
    setIsScanning(false);
  }, [log]);

  // Função para processar um QR code encontrado
  const handleQrCodeFound = useCallback((qrCode: string) => {
    log(`QR code detectado: ${qrCode}`);
    
    // Verificações básicas
    if (!qrCode || qrCode.trim() === '' || qrCode.length < 10) {
      log('QR code inválido, ignorando');
      return;
    }
    
    // Evitar duplicações
    if (lastScannedQR.current === qrCode) {
      log('QR code já processado, ignorando');
      return;
    }
    
    // Registrar e processar
    lastScannedQR.current = qrCode;
    stopMediaStream();
    
    toast.success("QR Code detectado!");
    log(`Processando QR code: ${qrCode}`);
    
    try {
      // Chamar callback de sucesso
      onScanSuccess(qrCode);
    } catch (error) {
      log(`Erro ao chamar callback: ${error}`);
      if (onScanError) onScanError(error);
    }
  }, [log, onScanError, onScanSuccess, stopMediaStream]);

  // Iniciar o processo de escaneamento (análise do canvas para detectar QR code)
  const startScanning = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) {
      log('Canvas ou vídeo não disponível');
      return;
    }
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    
    // Inicializar html5-qrcode
    try {
      const qrContainer = document.getElementById('qr-reader');
      if (!qrContainer) {
        log('Elemento qr-reader não encontrado');
        return;
      }
      
      // Limpar conteúdo atual
      qrContainer.innerHTML = '';
      
      // Configurações simplificadas
      const config = {
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: false
        }
      };
      
      const html5QrCode = new Html5Qrcode("qr-reader");
      
      // Usar camera id se disponível, caso contrário usar 'environment'
      const cameraSelection = activeDeviceId || { facingMode: "environment" };
      
      const successCallback = (decodedText: string) => {
        handleQrCodeFound(decodedText);
      };
      
      const errorCallback = (errorMessage: string) => {
        // Ignorar mensagens de erro comuns
        if (errorMessage.includes('No QR code found') || 
            errorMessage.includes('Scanning paused')) {
          return;
        }
        log(`Erro durante escaneamento: ${errorMessage}`);
      };
      
      html5QrCode.start(
        cameraSelection, 
        config, 
        successCallback,
        errorCallback
      ).then(() => {
        log('Scanner HTML5QrCode iniciado com sucesso');
        setIsScanning(true);
        setScanMessage('Aponte a câmera para o QR Code');
        
        // Timer para feedback ao usuário
        let scanAttempts = 0;
        scanIntervalRef.current = setInterval(() => {
          scanAttempts++;
          
          if (scanAttempts === 3) {
            setScanMessage('Ajuste a câmera para que o QR code esteja visível');
          } else if (scanAttempts === 8) {
            setScanMessage('Certifique-se de que há iluminação suficiente');
          } else if (scanAttempts >= 15 && scanAttempts % 5 === 0) {
            setScanMessage(`Tentando ler o QR code... (${Math.floor(scanAttempts/2)}s)`);
          }
          
          // Após 30 segundos sem sucesso, dar feedback
          if (scanAttempts >= 30) {
            toast.error('Dificuldade em ler o QR code. Tente novamente.');
            clearInterval(scanIntervalRef.current!);
          }
        }, 1000);
      }).catch(error => {
        log(`Erro ao iniciar scanner: ${error}`);
        setErrorMessage('Falha ao iniciar o scanner de QR code');
      });
    } catch (error) {
      log(`Erro ao configurar scanner: ${error}`);
      setErrorMessage('Erro ao configurar scanner de QR code');
    }
  }, [log, activeDeviceId, handleQrCodeFound]);

  // Verificar dispositivos de câmera disponíveis
  const loadCameraDevices = useCallback(async () => {
    try {
      log('Verificando dispositivos de câmera disponíveis');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      log(`Encontrados ${videoDevices.length} dispositivos de vídeo`);
      setDevices(videoDevices);
      
      // Selecionar câmera traseira por padrão (se disponível)
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('traseira') ||
        device.label.toLowerCase().includes('environment')
      );
      
      if (backCamera) {
        setActiveDeviceId(backCamera.deviceId);
        log(`Selecionada câmera traseira: ${backCamera.label}`);
      } else if (videoDevices.length > 0) {
        setActiveDeviceId(videoDevices[0].deviceId);
        log(`Selecionada primeira câmera disponível: ${videoDevices[0].label}`);
      } else {
        log('Nenhum dispositivo de câmera encontrado');
        setErrorMessage('Nenhuma câmera disponível no dispositivo');
      }
    } catch (error) {
      log(`Erro ao enumerar dispositivos: ${error}`);
      setErrorMessage('Falha ao acessar câmeras do dispositivo');
    }
  }, [log]);

  // Iniciar câmera com o dispositivo selecionado
  const startCamera = useCallback(async () => {
    try {
      log('Iniciando câmera...');
      
      // Parar qualquer stream existente
      stopMediaStream();
      
      // Resetar mensagens de erro
      setErrorMessage(null);
      setScanMessage('Solicitando acesso à câmera...');
      
      if (!navigator.mediaDevices) {
        throw new Error('MediaDevices API não suportada neste navegador');
      }
      
      // Verificar elemento de vídeo
      if (!videoRef.current) {
        throw new Error('Elemento de vídeo não encontrado');
      }
      
      // Configurações conservadoras que funcionam na maioria dos dispositivos
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15 }
        }
      };
      
      // Usar deviceId específico se disponível
      if (activeDeviceId) {
        (constraints.video as MediaTrackConstraints).deviceId = { exact: activeDeviceId };
      }
      
      // Solicitar stream de mídia com timeout
      const streamPromise = navigator.mediaDevices.getUserMedia(constraints);
      const timeoutPromise = new Promise<MediaStream>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao acessar câmera')), 8000);
      });
      
      // Aguardar o primeiro que completar
      const stream = await Promise.race([streamPromise, timeoutPromise]);
      mediaStreamRef.current = stream;
      
      // Verificar se a lanterna é suportada
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities();
        setHasTorch(!!capabilities.torch);
        log(`Lanterna ${capabilities.torch ? 'disponível' : 'não disponível'}`);
      }
      
      // Configurar o elemento de vídeo
      const videoElement = videoRef.current;
      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', 'true'); // Importante para iOS
      
      // Aguardar carregamento do vídeo
      await new Promise<void>((resolve) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play().then(() => {
            resolve();
            setHasStream(true);
            setHasPermission(true);
            setScanMessage('Aponte a câmera para o QR Code');
            log('Câmera iniciada com sucesso');
          }).catch(e => {
            log(`Erro ao iniciar reprodução: ${e}`);
            setErrorMessage('Não foi possível reproduzir o vídeo da câmera');
            throw e;
          });
        };
      });
      
      // Iniciar escaneamento
      startScanning();
      
      toast.success('Câmera iniciada!');
    } catch (error) {
      log(`Erro ao iniciar câmera: ${error}`);
      
      let errorMsg = 'Erro ao acessar câmera';
      
      if (String(error).includes('Permission denied') || 
          String(error).includes('NotAllowedError')) {
        errorMsg = 'Permissão de câmera negada';
        setHasPermission(false);
      } else if (String(error).includes('Timeout')) {
        errorMsg = 'Tempo esgotado ao acessar câmera';
      } else if (String(error).includes('NotFoundError')) {
        errorMsg = 'Câmera não encontrada no dispositivo';
      } else if (String(error).includes('NotReadableError')) {
        errorMsg = 'Câmera em uso por outro aplicativo';
      }
      
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      
      if (onScanError) onScanError(error);
    }
  }, [activeDeviceId, stopMediaStream, log, startScanning, onScanError]);

  // Alternar entre câmeras disponíveis
  const switchCamera = useCallback(() => {
    if (devices.length <= 1) {
      toast.error('Não há outras câmeras disponíveis');
      return;
    }
    
    // Encontrar próxima câmera
    const currentIndex = devices.findIndex(device => device.deviceId === activeDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];
    
    log(`Trocando câmera para: ${nextDevice.label}`);
    setActiveDeviceId(nextDevice.deviceId);
    toast.success(`Trocando para ${nextDevice.label || 'outra câmera'}`);
    
    // Reiniciar câmera com o novo dispositivo
    startCamera();
  }, [devices, activeDeviceId, log, startCamera]);

  // Alternar lanterna
  const toggleTorch = useCallback(async () => {
    if (!hasTorch || !mediaStreamRef.current) {
      toast.error('Lanterna não disponível');
      return;
    }
    
    try {
      const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('Track de vídeo não disponível');
      }
      
      const newTorchState = !torchEnabled;
      
      await videoTrack.applyConstraints({
        advanced: [{ torch: newTorchState }]
      });
      
      setTorchEnabled(newTorchState);
      toast.success(newTorchState ? 'Lanterna ativada' : 'Lanterna desativada');
      log(`Lanterna ${newTorchState ? 'ativada' : 'desativada'}`);
    } catch (error) {
      log(`Erro ao controlar lanterna: ${error}`);
      toast.error('Não foi possível controlar a lanterna');
    }
  }, [hasTorch, torchEnabled, log]);

  // Reiniciar câmera
  const restartCamera = useCallback(() => {
    log('Reiniciando câmera');
    lastScannedQR.current = null;
    setErrorMessage(null);
    startCamera();
  }, [log, startCamera]);

  // Efeito para enumerar dispositivos de câmera na montagem
  useEffect(() => {
    loadCameraDevices();
  }, [loadCameraDevices]);
  
  // Iniciar câmera quando o componente montar e depois de enumerar dispositivos
  useEffect(() => {
    if (activeDeviceId) {
      startCamera();
    }
    
    return () => {
      stopMediaStream();
    };
  }, [activeDeviceId, startCamera, stopMediaStream]);

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-gray-700">Scanner de QR Code</h3>
        <p className="text-sm text-gray-500">{scanMessage}</p>
      </div>
      
      <div className="w-full h-72 relative bg-gray-100 rounded-md overflow-hidden mb-4">
        {/* Área para scanner HTML5 */}
        <div id="qr-reader" className="w-full h-full relative">
          {/* Video backup (caso a biblioteca falhe) */}
          <video 
            ref={videoRef} 
            className="absolute inset-0 w-full h-full object-cover hidden"
            playsInline 
            muted
          />
          <canvas 
            ref={canvasRef} 
            className="absolute inset-0 w-full h-full object-cover hidden"
          />
        </div>
        
        {/* Overlay de erro */}
        {(errorMessage || hasPermission === false) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white p-4 text-center">
            <div className="flex flex-col items-center">
              <FaExclamationTriangle className="text-3xl text-yellow-400 mb-2" />
              <p>{errorMessage || 'Permissão da câmera negada'}</p>
              <button 
                onClick={restartCamera}
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
          onClick={restartCamera}
          variant="secondary"
          className="flex items-center"
        >
          <FaRedo className="mr-2" /> Reiniciar
        </Button>
        
        {devices.length > 1 && (
          <Button 
            onClick={switchCamera}
            variant="secondary"
            className="flex items-center"
          >
            <FaCamera className="mr-2" /> Trocar Câmera
          </Button>
        )}
        
        {hasTorch && (
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