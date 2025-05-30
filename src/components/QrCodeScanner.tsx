'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Button from '@/components/ui/Button';
import { FaSync, FaLightbulb, FaRedo, FaCamera, FaExclamationTriangle } from 'react-icons/fa';
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
  const [cameras, setCameras] = useState<{id: string, label: string}[]>([]);
  const [currentCamera, setCurrentCamera] = useState<string>('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string>('Inicializando...');
  const [scanFailed, setScanFailed] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  
  // Referências para elementos DOM e recursos
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const animationRef = useRef<number | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScannedQR = useRef<string | null>(null);
  
  // Logger
  const log = useCallback((msg: string) => {
    console.log(`[QRScanner] ${msg}`);
    if (onDebugLog) onDebugLog(msg);
  }, [onDebugLog]);

  // Função para processar um QR code encontrado
  const processQrCode = useCallback((qrCode: string) => {
    log(`QR code detectado: ${qrCode}`);
    
    // Verificações básicas
    if (!qrCode || qrCode.trim() === '' || qrCode.length < 10) {
      log('QR code inválido, ignorando');
      return;
    }
    
    // Evitar duplicações
    if (lastScannedQR.current === qrCode || hasScanned) {
      log('QR code já processado, ignorando');
      return;
    }
    
    // Registrar e processar
    lastScannedQR.current = qrCode;
    setHasScanned(true);
    setMessage('QR Code detectado!');
    toast.success("QR Code detectado!");
    
    // Parar scanner
    stopScanning();
    
    try {
      // Chamar callback de sucesso
      onScanSuccess(qrCode);
    } catch (error) {
      log(`Erro ao chamar callback: ${error}`);
      if (onScanError) onScanError(error);
    }
  }, [hasScanned, log, onScanError, onScanSuccess]);

  // Parar escaneamento e liberar recursos
  const stopScanning = useCallback(() => {
    setIsScanning(false);
    
    // Parar animação
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Limpar intervalos
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Parar stream de vídeo
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Parar scanner html5-qrcode se estiver ativo
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().catch(e => log(`Erro ao parar scanner: ${e}`));
        scannerRef.current = null;
      } catch (e) {
        log(`Erro ao limpar scanner: ${e}`);
      }
    }
    
    log('Scanner parado e recursos liberados');
  }, [log]);

  // Verificar se o dispositivo suporta BarcodeDetector API
  const supportsNativeBarcodeDetection = useCallback(() => {
    return 'BarcodeDetector' in window;
  }, []);

  // Iniciar scanner usando BarcodeDetector API (moderno)
  const startNativeScanner = useCallback(async () => {
    try {
      if (!videoRef.current || !canvasRef.current) {
        log('Referências de vídeo ou canvas não encontradas');
        return false;
      }
      
      log('Iniciando scanner nativo com BarcodeDetector API');
      
      // Obter stream de vídeo
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');  // Importante para iOS
      
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(() => resolve()).catch(e => {
            log(`Erro ao reproduzir vídeo: ${e}`);
            resolve();
          });
        };
      });
      
      // Verificar se a lanterna é suportada
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        setHasTorch(!!capabilities.torch);
        log(`Lanterna ${capabilities.torch ? '' : 'não '}suportada pelo dispositivo`);
      } catch (e) {
        log(`Erro ao verificar suporte à lanterna: ${e}`);
        setHasTorch(false);
      }
      
      // Configurar canvas para desenhar vídeo
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        log('Não foi possível obter contexto 2D do canvas');
        return false;
      }
      
      // Dimensões do vídeo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // @ts-ignore - Tipo BarcodeDetector não está no TypeScript padrão
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      
      // Função para escanear frame por frame
      const scanFrame = async () => {
        if (!ctx || !video || !canvas || !isScanning) return;
        
        try {
          // Desenhar frame atual no canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Detectar códigos no frame atual
          const barcodes = await barcodeDetector.detect(canvas);
          
          if (barcodes.length > 0) {
            // Encontrou um código QR
            for (const barcode of barcodes) {
              if (barcode.rawValue) {
                processQrCode(barcode.rawValue);
                return; // Parar após processar o primeiro código
              }
            }
          }
          
          // Continuar escaneamento se não encontrou nada
          if (isScanning && !hasScanned) {
            animationRef.current = requestAnimationFrame(scanFrame);
          }
        } catch (error) {
          log(`Erro ao escanear frame: ${error}`);
          setScanFailed(true);
          stopScanning();
        }
      };
      
      // Iniciar loop de escaneamento
      setIsScanning(true);
      animationRef.current = requestAnimationFrame(scanFrame);
      
      // Timer para feedback ao usuário
      let scanAttempts = 0;
      scanIntervalRef.current = setInterval(() => {
        scanAttempts++;
        
        if (scanAttempts === 3) {
          setMessage('Ajuste a câmera para que o QR code esteja visível');
        } else if (scanAttempts === 10) {
          setMessage('Certifique-se de que há iluminação suficiente');
        } else if (scanAttempts === 15) {
          setMessage('Tente aproximar mais a câmera do QR code');
        } else if (scanAttempts >= 20 && scanAttempts % 5 === 0) {
          setMessage(`Tentando ler o QR code... (${Math.floor(scanAttempts/2)}s)`);
        }
        
        // Após 30 segundos sem sucesso, dar feedback
        if (scanAttempts >= 30) {
          toast.error('Dificuldade em ler o QR code. Tente novamente.');
          clearInterval(scanIntervalRef.current!);
        }
      }, 1000);
      
      return true;
    } catch (error) {
      log(`Erro ao iniciar scanner nativo: ${error}`);
      toast.error('Não foi possível acessar a câmera');
      setScanFailed(true);
      return false;
    }
  }, [hasScanned, isScanning, log, processQrCode, stopScanning]);

  // Iniciar scanner usando Html5Qrcode (fallback)
  const startHtml5QrScanner = useCallback(async () => {
    try {
      log('Iniciando scanner com fallback Html5Qrcode');
      const qrCodeSuccessCallback = (decodedText: string) => {
        processQrCode(decodedText);
      };
      
      const config = {
        fps: 10,
        qrbox: { width: 350, height: 350 }, // Área de leitura aumentada
        aspectRatio: 1.0,
        disableFlip: false
      };
      
      // Criar instância do scanner
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      
      // Iniciar scanner
      await scanner.start(
        { facingMode: 'environment' },
        config,
        qrCodeSuccessCallback,
        (errorMessage) => {
          // Ignorar erros comuns durante escaneamento
          if (typeof errorMessage === 'string' && 
              (errorMessage.includes('No QR code found') || 
               errorMessage.includes('Scanning paused'))) {
            return;
          }
          
          log(`Erro durante escaneamento: ${errorMessage}`);
        }
      );
      
      // Verificar se a lanterna é suportada via capacidades HTML5QRCode
      try {
        // @ts-ignore - Verificar métodos disponíveis em runtime
        setHasTorch(typeof scanner.getRunningTrackCapabilities === 'function');
      } catch (e) {
        setHasTorch(false);
      }
      
      setIsScanning(true);
      setMessage('Aponte a câmera para o QR Code');
      
      // Timer para feedback ao usuário
      let scanAttempts = 0;
      scanIntervalRef.current = setInterval(() => {
        scanAttempts++;
        
        if (scanAttempts === 3) {
          setMessage('Ajuste a câmera para que o QR code esteja visível');
        } else if (scanAttempts === 10) {
          setMessage('Certifique-se de que há iluminação suficiente');
        } else if (scanAttempts === 15) {
          setMessage('Tente aproximar mais a câmera do QR code');
        } else if (scanAttempts >= 20 && scanAttempts % 5 === 0) {
          setMessage(`Tentando ler o QR code... (${Math.floor(scanAttempts/2)}s)`);
        }
        
        // Após 30 segundos sem sucesso, dar feedback
        if (scanAttempts >= 30) {
          toast.error('Dificuldade em ler o QR code. Tente novamente.');
          clearInterval(scanIntervalRef.current!);
        }
      }, 1000);
      
      return true;
    } catch (error) {
      log(`Erro ao iniciar scanner Html5Qrcode: ${error}`);
      setScanFailed(true);
      return false;
    }
  }, [log, processQrCode]);

  // Iniciar escaneamento
  const startScanner = useCallback(async () => {
    // Resetar estado
    setScanFailed(false);
    setHasScanned(false);
    lastScannedQR.current = null;
    setMessage('Inicializando câmera...');
    
    // Verificar se há navegador / suporte à câmera
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Seu navegador não suporta acesso à câmera');
      setScanFailed(true);
      return;
    }
    
    try {
      // Primeiro paramos qualquer scanner ativo
      stopScanning();
      
      // Tentar scanner nativo primeiro, se suportado
      let success = false;
      if (supportsNativeBarcodeDetection()) {
        log('Detector nativo de QR code suportado, tentando usar');
        success = await startNativeScanner();
      }
      
      // Se falhar ou não for suportado, usar fallback
      if (!success) {
        log('Usando scanner fallback');
        success = await startHtml5QrScanner();
      }
      
      if (success) {
        toast.success('Câmera pronta!');
      } else {
        toast.error('Não foi possível iniciar o scanner');
        setScanFailed(true);
      }
    } catch (error) {
      log(`Erro ao iniciar scanner: ${error}`);
      toast.error('Erro ao acessar câmera');
      setScanFailed(true);
      
      if (onScanError) {
        onScanError(error);
      }
    }
  }, [onScanError, startHtml5QrScanner, startNativeScanner, stopScanning, supportsNativeBarcodeDetection, log]);

  // Alternar lanterna (quando disponível)
  const toggleTorch = useCallback(async () => {
    try {
      if (!streamRef.current) {
        toast.error('Câmera não está ativa');
        return;
      }
      
      if (!hasTorch) {
        toast.error('Este dispositivo não suporta lanterna');
        return;
      }
      
      const track = streamRef.current.getVideoTracks()[0];
      
      // Método 1: API moderna - usar applyConstraints com torch
      try {
        // Alternar estado da lanterna
        const newTorchState = !torchEnabled;
        await track.applyConstraints({ advanced: [{ torch: newTorchState }] });
        setTorchEnabled(newTorchState);
        
        toast.success(newTorchState ? 'Lanterna ativada' : 'Lanterna desativada');
        return;
      } catch (e) {
        log(`Método 1 falhou, tentando método 2: ${e}`);
      }
      
      // Método 2: Usar imageCapture como alternativa
      try {
        if ('ImageCapture' in window) {
          // @ts-ignore - ImageCapture pode não estar no TypeScript
          const imageCapture = new ImageCapture(track);
          if (imageCapture && 'setOptions' in imageCapture) {
            // @ts-ignore - setOptions pode não estar no TypeScript
            await imageCapture.setOptions({ fillLightMode: torchEnabled ? 'off' : 'flash' });
            setTorchEnabled(!torchEnabled);
            
            toast.success(torchEnabled ? 'Lanterna ativada' : 'Lanterna desativada');
            return;
          }
        }
      } catch (e) {
        log(`Método 2 falhou, tentando método 3: ${e}`);
      }
      
      // Método 3: Html5Qrcode específico
      if (scannerRef.current) {
        try {
          if (torchEnabled) {
            // @ts-ignore - As propriedades podem não estar no tipo Html5Qrcode
            if (typeof scannerRef.current.turnFlashOff === 'function') {
              // @ts-ignore
              await scannerRef.current.turnFlashOff();
              setTorchEnabled(false);
              toast.success('Lanterna desativada');
              return;
            }
          } else {
            // @ts-ignore - As propriedades podem não estar no tipo Html5Qrcode
            if (typeof scannerRef.current.turnFlashOn === 'function') {
              // @ts-ignore
              await scannerRef.current.turnFlashOn();
              setTorchEnabled(true);
              toast.success('Lanterna ativada');
              return;
            }
          }
        } catch (e) {
          log(`Método 3 falhou: ${e}`);
        }
      }
      
      // Se chegou aqui, todos os métodos falharam
      throw new Error('Nenhum método de controle de lanterna funcionou');
    } catch (error) {
      log(`Erro ao alternar lanterna: ${error}`);
      toast.error('Não foi possível controlar a lanterna');
    }
  }, [log, torchEnabled, hasTorch]);

  // Trocar câmera
  const switchCamera = useCallback(async () => {
    if (cameras.length <= 1) {
      toast.error('Não há outras câmeras disponíveis');
      return;
    }
    
    try {
      // Parar scanner atual
      stopScanning();
      
      // Alternar para próxima câmera
      const currentIndex = cameras.findIndex(cam => cam.id === currentCamera);
      const nextIndex = (currentIndex + 1) % cameras.length;
      setCurrentCamera(cameras[nextIndex].id);
      
      toast.success(`Trocando para ${cameras[nextIndex].label}`);
      
      // Esperar um momento e reiniciar
      setTimeout(() => {
        startScanner();
      }, 500);
    } catch (error) {
      log(`Erro ao trocar câmera: ${error}`);
      toast.error('Erro ao trocar câmera');
    }
  }, [cameras, currentCamera, startScanner, stopScanning, log]);

  // Reiniciar scanner
  const restartScanner = useCallback(() => {
    setHasScanned(false);
    lastScannedQR.current = null;
    setScanFailed(false);
    startScanner();
  }, [startScanner]);

  // Detectar câmeras disponíveis
  useEffect(() => {
    const detectCameras = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
          log('API MediaDevices não suportada');
          return;
        }
        
        // Solicitar permissão primeiro para poder ver labels das câmeras
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
        } catch (error) {
          log(`Erro ao obter permissão inicial: ${error}`);
          setScanFailed(true);
          return;
        }
        
        // Listar dispositivos
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          log('Nenhuma câmera encontrada');
          setScanFailed(true);
          return;
        }
        
        // Mapear câmeras
        const cameraOptions = videoDevices.map(device => ({
          id: device.deviceId,
          label: device.label || `Câmera ${device.deviceId.slice(0, 5)}`
        }));
        
        setCameras(cameraOptions);
        
        // Preferir câmera traseira
        let defaultCamera = cameraOptions[0].id;
        const backCamera = cameraOptions.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('traseira') ||
          camera.label.toLowerCase().includes('environment')
        );
        
        if (backCamera) {
          defaultCamera = backCamera.id;
        }
        
        setCurrentCamera(defaultCamera);
      } catch (error) {
        log(`Erro ao detectar câmeras: ${error}`);
        setScanFailed(true);
      }
    };
    
    detectCameras();
  }, [log]);

  // Iniciar scanner automaticamente na montagem
  useEffect(() => {
    if (cameras.length > 0 && !isScanning && !scanFailed) {
      startScanner();
    }
    
    // Cleanup ao desmontar
    return () => {
      stopScanning();
    };
  }, [cameras, isScanning, scanFailed, startScanner, stopScanning]);

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-gray-700">Scanner de QR Code</h3>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
      
      <div className="w-full h-80 relative bg-gray-100 rounded-md overflow-hidden mb-4">
        {/* Área de vídeo para scanner nativo */}
        <div className={`absolute inset-0 ${supportsNativeBarcodeDetection() ? 'block' : 'hidden'}`}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="hidden"
          />
          
          {/* Indicador visual para área de escaneamento */}
          {isScanning && !hasScanned && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-blue-500 rounded-lg animate-pulse"></div>
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 border-2 border-transparent rounded-lg">
                <div className="absolute top-0 left-0 w-16 h-2 bg-blue-500 rounded-full"></div>
                <div className="absolute top-0 right-0 w-2 h-16 bg-blue-500 rounded-full"></div>
                <div className="absolute bottom-0 left-0 w-2 h-16 bg-blue-500 rounded-full"></div>
                <div className="absolute bottom-0 right-0 w-16 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          )}
        </div>
        
        {/* Área para scanner HTML5 (fallback) */}
        <div id="qr-reader" className={`w-full h-full ${supportsNativeBarcodeDetection() ? 'hidden' : 'block'}`} />
        
        {/* Overlay de erro */}
        {scanFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white p-4 text-center">
            <div className="flex flex-col items-center">
              <FaExclamationTriangle className="text-3xl text-yellow-400 mb-2" />
              <p>Não foi possível acessar a câmera</p>
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