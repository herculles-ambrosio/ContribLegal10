'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Button from '@/components/ui/Button';
import { FaSync, FaLightbulb, FaRedo, FaCamera, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

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
  const [isScanning, setIsScanning] = useState(true);
  const [hasScanned, setHasScanned] = useState(false);
  const [message, setMessage] = useState<string>('Inicializando câmera...');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanAttempts, setScanAttempts] = useState(0);
  const [scanStatus, setScanStatus] = useState<'initializing' | 'ready' | 'scanning' | 'error'>('initializing');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerContainerId = "qr-reader";
  const lastScannedCode = useRef<string | null>(null);
  
  // Função para log com suporte a log externo
  const logDebug = useCallback((message: string) => {
    console.log(`[QrCodeScanner] ${message}`);
    if (onDebugLog) {
      onDebugLog(`[QrCodeScanner] ${message}`);
    }
  }, [onDebugLog]);

  // Função para parar o scanner com segurança
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        logDebug('Tentando parar scanner...');
        
        // Primeiro pausamos
        try {
          scannerRef.current.pause(true);
          logDebug('Scanner pausado');
        } catch (pauseError) {
          logDebug(`Erro ao pausar scanner: ${pauseError}`);
        }
        
        // Depois paramos completamente
        await scannerRef.current.stop();
        logDebug('Scanner parado com sucesso');
        
        // Limpar referência
        scannerRef.current = null;
        setIsScanning(false);
        setScanStatus('ready');
      } catch (error) {
        logDebug(`Erro ao tentar parar scanner: ${error}`);
        // Reset manual
        scannerRef.current = null;
        setIsScanning(false);
        setScanStatus('error');
      }
    }
  }, [logDebug]);
  
  // Callback de sucesso refinado
  const successCallback = useCallback((decodedText: string) => {
    logDebug(`QR code lido com sucesso: ${decodedText}`);
    
    // Prevenir processamentos duplicados e garantir que o código seja válido
    if (hasScanned) {
      logDebug('QR code já foi processado. Ignorando.');
      return;
    }
    
    // Verifica se o código é o mesmo que já processamos antes
    if (lastScannedCode.current === decodedText) {
      logDebug('Mesmo QR code lido novamente. Ignorando.');
      return;
    }
    
    // Validar se o QR code tem um formato válido
    // Deve ser uma URL ou ter pelo menos 10 caracteres para potencialmente ser um cupom fiscal
    if (!decodedText || decodedText.length < 10) {
      logDebug(`QR code inválido ou muito curto: ${decodedText}`);
      setMessage('QR Code inválido. Tente novamente.');
      return;
    }
    
    // Registrar o código escaneado para evitar duplicação
    lastScannedCode.current = decodedText;
    
    // Marcar como já processado imediatamente
    setHasScanned(true);
    setMessage('QR Code detectado! Processando...');
    
    // Armazenar o código lido para processamento
    const scannedCode = decodedText;
    
    // Parar scanner imediatamente e chamar callback
    stopScanner().then(() => {
      try {
        logDebug(`Enviando resultado para componente pai: ${scannedCode}`);
        // Garantir que estamos enviando o código original completo
        onScanSuccess(scannedCode);
      } catch (callbackError) {
        logDebug(`Erro ao chamar callback de sucesso: ${callbackError}`);
        setHasScanned(false); // Resetar em caso de erro para permitir nova tentativa
      }
    }).catch((error) => {
      logDebug(`Erro ao parar scanner: ${error}`);
      // Tentar chamar callback mesmo se houver erro ao parar
      try {
        onScanSuccess(scannedCode);
      } catch (finalError) {
        logDebug(`Erro final ao chamar callback: ${finalError}`);
        setHasScanned(false); // Resetar em caso de erro para permitir nova tentativa
      }
    });
  }, [onScanSuccess, logDebug, stopScanner, hasScanned]);

  // Iniciar o scanner com uma configuração específica
  const startScanner = useCallback(async (cameraId: string) => {
    if (!containerRef.current) {
      logDebug('Container não encontrado');
      setScanStatus('error');
      setMessage('Erro: Não foi possível inicializar o scanner');
      return false;
    }
    
    if (scannerRef.current) {
      logDebug('Parando scanner existente antes de reiniciar');
      await stopScanner();
    }
    
    try {
      logDebug(`Iniciando scanner com câmera: ${cameraId}`);
      setMessage('Inicializando câmera...');
      
      // Limpar status anterior
      setHasScanned(false);
      lastScannedCode.current = null;
      
      // Criar uma nova instância do scanner
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      
      const config = { 
        fps: 15, // Aumentar para melhor responsividade
        qrbox: 350, // Aumentado de 250 para 350 para ter uma área de captura maior
        aspectRatio: 1.0,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };
      
      const cameraConfig = cameraId === 'environment' 
        ? { facingMode: 'environment' } 
        : cameraId;
      
      await scanner.start(
        cameraConfig, 
        config, 
        successCallback, 
        (errorMessage) => {
          // Ignorar erros comuns durante o escaneamento
          if (typeof errorMessage === 'string' && (
            errorMessage.includes('No QR code found') ||
            errorMessage.includes('Scanning paused') ||
            errorMessage.includes('No MultiFormat Readers')
          )) {
            return;
          }
          
          // Log de erros não críticos
          logDebug(`Erro não crítico durante escaneamento: ${errorMessage}`);
        }
      );
      
      setIsScanning(true);
      setScanStatus('scanning');
      setMessage('Aponte a câmera para o QR Code');
      logDebug('Scanner iniciado com sucesso');
      return true;
    } catch (error) {
      logDebug(`Erro ao iniciar scanner: ${error}`);
      setMessage('Erro ao acessar câmera. Tente reiniciar ou permitir acesso à câmera nas configurações do navegador.');
      setScanStatus('error');
      
      if (onScanError) {
        onScanError(error);
      }
      
      return false;
    }
  }, [logDebug, onScanError, stopScanner, successCallback]);

  // Reiniciar o scanner
  const handleRestartScanner = useCallback(async () => {
    logDebug('Solicitando reinício do scanner');
    setMessage('Reiniciando scanner...');
    setScanAttempts(prev => prev + 1);
    
    // Resetar estado
    setHasScanned(false);
    lastScannedCode.current = null;
    
    try {
      await stopScanner();
      
      // Pequena pausa antes de reiniciar
      setTimeout(() => {
        if (currentCamera) {
          startScanner(currentCamera);
        } else if (cameras.length > 0) {
          startScanner(cameras[0].id);
        } else {
          startScanner('environment');
        }
      }, 500);
    } catch (error) {
      logDebug(`Erro ao reiniciar scanner: ${error}`);
      setMessage('Erro ao reiniciar. Tente novamente.');
    }
  }, [cameras, currentCamera, logDebug, startScanner, stopScanner]);

  // Alternar lanterna
  const handleToggleTorch = useCallback(async () => {
    if (!scannerRef.current) {
      return;
    }
    
    try {
      if (torchEnabled) {
        // Usando as API via cast para any
        await (scannerRef.current as any).disableTorch();
        setTorchEnabled(false);
      } else {
        // Usando as API via cast para any
        await (scannerRef.current as any).enableTorch();
        setTorchEnabled(true);
      }
    } catch (error) {
      logDebug(`Erro ao alternar lanterna: ${error}`);
      toast.error('Lanterna não disponível neste dispositivo');
    }
  }, [torchEnabled, logDebug]);

  // Alternar câmera
  const handleSwitchCamera = useCallback(async () => {
    try {
      // Se estamos usando a primeira câmera, alternar para a segunda
      // Se estamos usando a segunda, alternar para a primeira
      const newCameraIndex = cameras.findIndex(cam => cam.id === currentCamera) === 0 ? 1 : 0;
      
      // Verificar se a câmera existe
      if (cameras.length <= newCameraIndex) {
        toast.error('Não há outra câmera disponível');
        return;
      }
      
      const newCameraId = cameras[newCameraIndex].id;
      logDebug(`Alternando para câmera: ${newCameraId}`);
      
      // Parar scanner atual
      await stopScanner();
      
      // Resetar estado
      setHasScanned(false);
      lastScannedCode.current = null;
      
      // Iniciar com nova câmera
      setCurrentCamera(newCameraId);
      await startScanner(newCameraId);
      
      toast.success(`Câmera alterada para ${cameras[newCameraIndex].label || 'Alternativa'}`);
    } catch (error) {
      logDebug(`Erro ao alternar câmera: ${error}`);
      toast.error('Erro ao alternar câmera');
    }
  }, [cameras, currentCamera, logDebug, startScanner, stopScanner]);

  // Detectar câmeras
  useEffect(() => {
    const detectCameras = async () => {
      try {
        setScanStatus('initializing');
        logDebug('Iniciando detecção de câmeras...');
        
        // Verifica se tem suporte à API MediaDevices
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
          logDebug('API MediaDevices não suportada');
          setMessage('Seu navegador não suporta acesso à câmera');
          setScanStatus('error');
          return;
        }
        
        // Solicitar permissão de acesso à câmera
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Parar stream após obter permissão
          stream.getTracks().forEach(track => track.stop());
        } catch (error) {
          logDebug(`Erro ao obter permissão de câmera: ${error}`);
          setMessage('Permissão de câmera negada. Verifique as configurações do navegador.');
          setScanStatus('error');
          
          if (onScanError) {
            onScanError('Permissão de câmera negada');
          }
          return;
        }
        
        // Listar dispositivos disponíveis
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          logDebug('Nenhuma câmera encontrada');
          setMessage('Nenhuma câmera encontrada no dispositivo');
          setScanStatus('error');
          return;
        }
        
        // Mapear câmeras disponíveis
        const cameraOptions = videoDevices.map(device => ({
          id: device.deviceId,
          label: device.label || `Câmera ${device.deviceId.slice(0, 5)}`
        }));
        
        setCameras(cameraOptions);
        logDebug(`${cameraOptions.length} câmeras encontradas`);
        
        // Usar câmera traseira por padrão se houver mais de uma câmera
        // Geralmente, câmeras traseiras têm 'back' ou 'environment' no label
        let defaultCamera = cameraOptions[0].id;
        
        // Preferir câmera traseira em dispositivos móveis
        const backCamera = cameraOptions.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('traseira') ||
          camera.label.toLowerCase().includes('environment')
        );
        
        if (backCamera) {
          defaultCamera = backCamera.id;
          logDebug(`Câmera traseira encontrada: ${backCamera.label}`);
        }
        
        setCurrentCamera(defaultCamera);
        setScanStatus('ready');
        
        // Iniciar scanner automaticamente
        startScanner(defaultCamera);
        
      } catch (error) {
        logDebug(`Erro ao detectar câmeras: ${error}`);
        setMessage('Erro ao acessar câmeras. Verifique as permissões do navegador.');
        setScanStatus('error');
        
        if (onScanError) {
          onScanError(error);
        }
      }
    };
    
    detectCameras();
    
    // Limpar ao desmontar
    return () => {
      if (scannerRef.current) {
        logDebug('Limpando scanner ao desmontar componente');
        stopScanner().catch(error => logDebug(`Erro ao limpar scanner: ${error}`));
      }
    };
  }, [logDebug, onScanError, startScanner, stopScanner]);

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-gray-700">Scanner de QR Code</h3>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
      
      <div 
        ref={containerRef} 
        className="w-full h-80 relative bg-gray-100 rounded-md overflow-hidden mb-4"
      >
        <div id={scannerContainerId} className="w-full h-full" />
        
        {scanStatus === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white p-4 text-center">
            <div className="flex flex-col items-center">
              <FaExclamationTriangle className="text-3xl text-yellow-400 mb-2" />
              <p>{message}</p>
              <button 
                onClick={handleRestartScanner}
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
          onClick={handleRestartScanner}
          variant="secondary"
          className="flex items-center"
        >
          <FaRedo className="mr-2" /> Reiniciar
        </Button>
        
        {cameras.length > 1 && (
          <Button 
            onClick={handleSwitchCamera}
            variant="secondary"
            className="flex items-center"
          >
            <FaCamera className="mr-2" /> Trocar Câmera
          </Button>
        )}
        
        <Button 
          onClick={handleToggleTorch}
          variant={torchEnabled ? "primary" : "secondary"}
          className="flex items-center"
        >
          <FaLightbulb className="mr-2" /> {torchEnabled ? 'Desligar Luz' : 'Ligar Luz'}
        </Button>
      </div>
      
      <div className="text-xs text-gray-400 text-center mt-4">
        Posicione o QR code do cupom fiscal dentro da área de leitura
      </div>
    </div>
  );
};

export default QrCodeScanner; 