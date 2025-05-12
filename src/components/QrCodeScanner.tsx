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
    
    // Prevenir processamentos duplicados
    if (hasScanned) {
      logDebug('QR code já foi processado. Ignorando.');
      return;
    }
    
    // Marcar como já processado imediatamente
    setHasScanned(true);
    setMessage('QR Code detectado! Processando...');
    
    // Parar scanner imediatamente e chamar callback
    stopScanner().then(() => {
      try {
        logDebug(`Enviando resultado para componente pai: ${decodedText}`);
        onScanSuccess(decodedText);
      } catch (callbackError) {
        logDebug(`Erro ao chamar callback de sucesso: ${callbackError}`);
      }
    }).catch((error) => {
      logDebug(`Erro ao parar scanner: ${error}`);
      // Tentar chamar callback mesmo se houver erro ao parar
      try {
        onScanSuccess(decodedText);
      } catch (finalError) {
        logDebug(`Erro final ao chamar callback: ${finalError}`);
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
      
      // Criar uma nova instância do scanner
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      
      const config = { 
        fps: 10, 
        qrbox: 250,
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
  }, [logDebug, stopScanner, startScanner, currentCamera, cameras]);

  // Alternar entre câmeras disponíveis
  const handleSwitchCamera = useCallback(async () => {
    logDebug('Alternando câmera');
    
    if (!cameras || cameras.length <= 1) {
      toast.error('Não há outras câmeras disponíveis');
      return;
    }
    
    try {
      setMessage('Alternando câmera...');
      await stopScanner();
      
      // Encontrar próxima câmera
      const currentIndex = cameras.findIndex(camera => camera.id === currentCamera);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCameraId = cameras[nextIndex].id;
      
      // Atualizar câmera atual
      setCurrentCamera(nextCameraId);
      logDebug(`Alternando para câmera: ${nextCameraId}`);
      
      // Pequena pausa antes de reiniciar
      setTimeout(() => {
        startScanner(nextCameraId);
      }, 500);
      
      // Resetar estado da lanterna
      setTorchEnabled(false);
    } catch (error) {
      logDebug(`Erro ao alternar câmera: ${error}`);
      setMessage('Erro ao alternar câmera. Tente novamente.');
    }
  }, [cameras, currentCamera, logDebug, stopScanner, startScanner]);

  // Função para alternar lanterna (flash)
  const handleToggleTorch = useCallback(async () => {
    if (!scannerRef.current) {
      toast.error('Scanner não disponível');
      return;
    }
    
    try {
      logDebug('Tentando alternar lanterna');
      const cameraCapabilities = scannerRef.current.getRunningTrackCameraCapabilities();
      
      if (!cameraCapabilities) {
        toast.error('Recursos de câmera não disponíveis');
        return;
      }
      
      const torchFeature = cameraCapabilities.torchFeature();
      
      if (!torchFeature.isSupported()) {
        toast.error('Este dispositivo não suporta lanterna');
        return;
      }
      
      // Alternar estado da lanterna
      const newTorchState = !torchEnabled;
      torchFeature.apply(newTorchState);
      setTorchEnabled(newTorchState);
      setMessage(newTorchState ? 'Lanterna ligada' : 'Lanterna desligada');
      
      // Voltar à mensagem normal após 1.5 segundos
      setTimeout(() => {
        setMessage('Aponte a câmera para o QR Code');
      }, 1500);
    } catch (error) {
      logDebug(`Erro ao alternar lanterna: ${error}`);
      toast.error('Não foi possível acessar a lanterna');
    }
  }, [torchEnabled, logDebug]);

  // Inicializar o scanner e obter lista de câmeras
  useEffect(() => {
    if (typeof window === 'undefined' || hasScanned) return;

    logDebug('Inicializando componente QrCodeScanner');
    setScanStatus('initializing');
    
    // Detectar câmeras disponíveis
    const detectCameras = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        logDebug(`Câmeras detectadas: ${devices.length}`);
        
        if (devices && devices.length > 0) {
          setCameras(devices);
          
          // Selecionar câmera traseira por padrão
          let bestCamera = devices[0].id;
          
          for (const device of devices) {
            const label = device.label.toLowerCase();
            if (label.includes('back') || label.includes('traseira') || label.includes('environment') || label.includes('rear')) {
              bestCamera = device.id;
              logDebug(`Câmera traseira detectada: ${device.label}`);
              break;
            }
          }
          
          setCurrentCamera(bestCamera);
          logDebug(`Câmera selecionada: ${bestCamera}`);
          
          // Iniciar scanner com a câmera selecionada
          const success = await startScanner(bestCamera);
          
          if (!success) {
            // Se falhar, tentar com configuração padrão 'environment'
            logDebug('Tentando iniciar com configuração environment');
            await startScanner('environment');
          }
        } else {
          // Sem câmeras, tentar iniciar com environment
          logDebug('Nenhuma câmera detectada, tentando com environment');
          setMessage('Nenhuma câmera detectada. Tentando câmera padrão...');
          await startScanner('environment');
        }
      } catch (error) {
        logDebug(`Erro ao detectar câmeras: ${error}`);
        setMessage('Erro ao acessar câmeras. Verifique as permissões do navegador.');
        setScanStatus('error');
        
        // Tentar iniciar com 'environment' como fallback
        try {
          await startScanner('environment');
        } catch (fallbackError) {
          logDebug(`Erro ao iniciar com fallback: ${fallbackError}`);
          if (onScanError) {
            onScanError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
          }
        }
      }
    };
    
    detectCameras();
    
    // Cleanup ao desmontar
    return () => {
      logDebug('Componente desmontando, limpando recursos');
      if (scannerRef.current) {
        scannerRef.current.stop().catch(error => {
          logDebug(`Erro ao parar scanner durante cleanup: ${error}`);
        });
      }
    };
  }, [logDebug, startScanner, onScanError, hasScanned, stopScanner]);

  return (
    <div className="qr-scanner-container">
      <div className="scanner-status-indicator mb-2 text-center">
        {scanStatus === 'initializing' && (
          <div className="animate-pulse text-yellow-500 flex items-center justify-center">
            <FaCamera className="mr-2" /> Inicializando câmera...
          </div>
        )}
        {scanStatus === 'error' && (
          <div className="text-red-500 flex items-center justify-center">
            <FaExclamationTriangle className="mr-2" /> Erro ao acessar câmera
          </div>
        )}
      </div>
      
      <div className="qr-reader-container relative">
        <div ref={containerRef} id={scannerContainerId} style={{ 
          width: '100%', 
          minHeight: '250px',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '8px',
          boxShadow: '0 0 10px rgba(0,0,0,0.2)'
        }}></div>
        
        {/* Guia visual para posicionar o QR code */}
        <div className="qr-guide absolute top-0 left-0 w-full h-full pointer-events-none flex items-center justify-center">
          <div className="border-2 border-dashed border-blue-500 w-64 h-64 opacity-70 rounded-lg"></div>
        </div>
      </div>
      
      <div className="mt-4 text-center text-sm">
        <p className={`mb-2 ${isScanning ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
          {message}
        </p>
        
        <div className="flex justify-center space-x-2 mt-3">
          {cameras.length > 1 && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleSwitchCamera}
              className="text-xs py-1 px-3 flex items-center"
              aria-label="Alternar câmera"
            >
              <FaSync className="mr-1" size={14} />
              Trocar Câmera
            </Button>
          )}
          
          <Button
            type="button"
            variant="secondary"
            onClick={handleToggleTorch}
            className="text-xs py-1 px-3 flex items-center"
            aria-label="Lanterna"
          >
            <FaLightbulb className={`mr-1 ${torchEnabled ? 'text-yellow-400' : ''}`} size={14} />
            {torchEnabled ? 'Desligar Luz' : 'Ligar Lanterna'}
          </Button>
          
          <Button
            type="button"
            variant="secondary"
            onClick={handleRestartScanner}
            className="text-xs py-1 px-3 flex items-center"
            aria-label="Reiniciar"
          >
            <FaRedo className="mr-1" size={14} />
            Reiniciar
          </Button>
        </div>
        
        <p className="mt-4 text-xs text-gray-500">
          Se o QR code não for detectado automaticamente, tente ajustar a distância ou iluminação.
        </p>
      </div>
    </div>
  );
};

export default QrCodeScanner; 