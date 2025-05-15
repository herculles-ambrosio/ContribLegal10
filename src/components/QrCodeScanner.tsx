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
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [message, setMessage] = useState<string>('Inicializando câmera...');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanStatus, setScanStatus] = useState<'initializing' | 'ready' | 'scanning' | 'error'>('initializing');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerContainerId = "qr-reader";
  const lastScannedCode = useRef<string | null>(null);
  const noQrCodeFoundCountRef = useRef<number>(0);
  const scanningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Função para log com suporte a log externo
  const logDebug = useCallback((message: string) => {
    console.log(`[QrCodeScanner] ${message}`);
    if (onDebugLog) {
      onDebugLog(`[QrCodeScanner] ${message}`);
    }
  }, [onDebugLog]);

  // Função para parar o scanner com segurança
  const stopScanner = useCallback(async () => {
    if (scanningIntervalRef.current) {
      clearInterval(scanningIntervalRef.current);
      scanningIntervalRef.current = null;
    }
    
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
  
  // Callback de sucesso simplificado e robusto
  const successCallback = useCallback((decodedText: string, decodedResult: any) => {
    logDebug(`QR code detectado: ${decodedText}`);
    
    // Verificações básicas
    if (!decodedText || decodedText.trim() === '') {
      logDebug('QR code vazio, ignorando');
      return;
    }
    
    // Se já scaneou, ignorar
    if (hasScanned) {
      logDebug('Já existe um QR code processado, ignorando');
      return;
    }
    
    // Marcar como processado para impedir duplicação
    setHasScanned(true);
    setMessage('QR Code detectado! Processando...');
    
    // Parar qualquer monitoramento de status
    if (scanningIntervalRef.current) {
      clearInterval(scanningIntervalRef.current);
      scanningIntervalRef.current = null;
    }
    
    // Chamar callback imediatamente com o código detectado
    try {
      onScanSuccess(decodedText);
      
      // Parar scanner após sucesso
      if (scannerRef.current) {
        try {
          scannerRef.current.pause();
          logDebug('Scanner pausado após sucesso');
          
          // Parar completamente em segundo plano
          stopScanner().catch(e => logDebug(`Erro ao parar scanner após sucesso: ${e}`));
        } catch (e) {
          logDebug(`Erro ao pausar scanner após sucesso: ${e}`);
        }
      }
    } catch (error) {
      logDebug(`Erro ao processar QR code: ${error}`);
      setHasScanned(false); // Resetar para permitir nova tentativa
      setMessage('Erro ao processar QR code. Tente novamente.');
      
      if (onScanError) {
        onScanError(error);
      }
    }
  }, [hasScanned, logDebug, onScanError, onScanSuccess, stopScanner]);
  
  // Função para monitorar o status do scanner
  const startScanningMonitor = useCallback(() => {
    // Limpar qualquer intervalo existente
    if (scanningIntervalRef.current) {
      clearInterval(scanningIntervalRef.current);
    }
    
    // Definir contador inicial
    noQrCodeFoundCountRef.current = 0;
    
    // Iniciar novo monitoramento a cada 1s
    scanningIntervalRef.current = setInterval(() => {
      if (!scannerRef.current || hasScanned) {
        clearInterval(scanningIntervalRef.current!);
        return;
      }
      
      // Verificar status atual - a cada 3s sem detecção
      noQrCodeFoundCountRef.current += 1;
      
      if (noQrCodeFoundCountRef.current >= 3) {
        // Após 3s sem detecção
        setMessage('Posicione o QR code para leitura - tente aproximar mais a câmera');
      }
      
      if (noQrCodeFoundCountRef.current >= 10) {
        // Após 10s sem detecção
        setMessage('Está difícil ler o QR code. Certifique-se de que há luz suficiente.');
      }
      
      if (noQrCodeFoundCountRef.current >= 20) {
        // Após 20s sem detecção
        toast.error('Não foi possível ler o QR code. Tente novamente.');
        clearInterval(scanningIntervalRef.current!);
        // Não parar scanner automaticamente, deixar usuário decidir
      }
    }, 1000);
  }, [hasScanned]);

  // Iniciar o scanner com configuração ultra simplificada para máxima compatibilidade
  const startScanner = useCallback(async (cameraId: string) => {
    if (!containerRef.current) {
      logDebug('Container não encontrado');
      setScanStatus('error');
      setMessage('Erro: Não foi possível inicializar o scanner');
      return false;
    }
    
    // Limpar scanner existente
    if (scannerRef.current) {
      await stopScanner();
    }
    
    try {
      logDebug(`Iniciando scanner com câmera: ${cameraId}`);
      setMessage('Inicializando câmera...');
      
      // Reset dos estados
      setHasScanned(false);
      lastScannedCode.current = null;
      noQrCodeFoundCountRef.current = 0;
      
      // Criar nova instância do scanner
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      
      // Configuração minimalista para máxima compatibilidade
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false
      };
      
      // Determinar qual câmera usar
      const cameraConfig = cameraId === 'environment' 
        ? { facingMode: 'environment' } 
        : cameraId;
      
      // Iniciar scanner com feedback de erro simplificado
      await scanner.start(
        cameraConfig,
        config,
        successCallback,
        (errorMessage) => {
          // Ignorar erros comuns durante escaneamento
          if (typeof errorMessage === 'string' && 
              (errorMessage.includes('No QR code found') || 
               errorMessage.includes('Scanning paused'))) {
            return;
          }
          
          logDebug(`Erro durante escaneamento: ${errorMessage}`);
        }
      );
      
      // Atualizar estados
      setIsScanning(true);
      setScanStatus('scanning');
      setMessage('Aponte a câmera para o QR Code');
      
      // Iniciar monitoramento de estado
      startScanningMonitor();
      
      logDebug('Scanner iniciado com sucesso');
      toast.success('Câmera pronta para leitura!');
      
      return true;
    } catch (error) {
      logDebug(`Erro ao iniciar scanner: ${error}`);
      setMessage(`Erro ao acessar câmera: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setScanStatus('error');
      
      if (onScanError) {
        onScanError(error);
      }
      
      return false;
    }
  }, [logDebug, onScanError, startScanningMonitor, stopScanner, successCallback]);

  // Reiniciar o scanner
  const handleRestartScanner = useCallback(async () => {
    logDebug('Reiniciando scanner');
    setMessage('Reiniciando scanner...');
    
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

  // Alternar lanterna - implementação simplificada
  const handleToggleTorch = useCallback(async () => {
    if (!scannerRef.current) {
      toast.error('Scanner não está ativo');
      return;
    }
    
    try {
      // Usar método direto com try-catch
      if (torchEnabled) {
        // @ts-ignore
        await scannerRef.current.disableTorch();
        setTorchEnabled(false);
        toast.success('Lanterna desativada');
      } else {
        // @ts-ignore
        await scannerRef.current.enableTorch();
        setTorchEnabled(true);
        toast.success('Lanterna ativada');
      }
    } catch (error) {
      console.error('Erro ao alternar lanterna:', error);
      toast.error('Lanterna não disponível neste dispositivo');
    }
  }, [torchEnabled]);

  // Alternar câmera
  const handleSwitchCamera = useCallback(async () => {
    if (cameras.length <= 1) {
      toast.error('Não há outra câmera disponível');
      return;
    }
    
    try {
      const newCameraIndex = cameras.findIndex(cam => cam.id === currentCamera) === 0 ? 1 : 0;
      const newCameraId = cameras[newCameraIndex].id;
      
      logDebug(`Alternando para câmera: ${newCameraId}`);
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
        
        // Verificar suporte
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
          setMessage('Seu navegador não suporta acesso à câmera');
          setScanStatus('error');
          return;
        }
        
        // Solicitar permissão de câmera - tentativa simplificada
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          });
          
          // Liberar stream após obter permissão
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
        
        // Listar dispositivos
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          logDebug('Nenhuma câmera encontrada');
          setMessage('Nenhuma câmera encontrada no dispositivo');
          setScanStatus('error');
          return;
        }
        
        // Mapear câmeras
        const cameraOptions = videoDevices.map(device => ({
          id: device.deviceId,
          label: device.label || `Câmera ${device.deviceId.slice(0, 5)}`
        }));
        
        setCameras(cameraOptions);
        logDebug(`${cameraOptions.length} câmeras encontradas`);
        
        // Preferir câmera traseira
        let defaultCamera = cameraOptions[0].id;
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
        
        // Iniciar scanner
        await startScanner(defaultCamera);
        
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
      if (scanningIntervalRef.current) {
        clearInterval(scanningIntervalRef.current);
      }
      
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
        
        {/* Indicador visual para mostrar que o scanner está ativo */}
        {isScanning && scanStatus === 'scanning' && !hasScanned && (
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
        <p>Posicione o QR code do cupom fiscal dentro da área de leitura.</p>
        <p className="mt-1">Certifique-se de que há boa iluminação e que o QR code está visível por completo.</p>
      </div>
    </div>
  );
};

export default QrCodeScanner; 