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
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{ id: string, label: string }[]>([]);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCode = useRef<string | null>(null);
  const scanTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Função simples de log
  const log = useCallback((msg: string) => {
    console.log(`[QRScanner] ${msg}`);
    if (onDebugLog) onDebugLog(msg);
  }, [onDebugLog]);

  // Limpar recursos
  const cleanupScanner = useCallback(() => {
    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
      scanTimer.current = null;
    }
    
    if (scannerRef.current) {
      try {
        scannerRef.current.stop()
          .then(() => {
            log('Scanner parado com sucesso');
            scannerRef.current = null;
          })
          .catch(e => {
            log(`Erro ao parar scanner: ${e}`);
            scannerRef.current = null;
          });
      } catch (e) {
        log(`Erro ao limpar scanner: ${e}`);
        scannerRef.current = null;
      }
    }
    
    setIsScanning(false);
  }, [log]);

  // Função para processar o QR code detectado
  const handleQrCodeSuccess = useCallback((decodedText: string) => {
    log(`QR code detectado: ${decodedText}`);
    
    // Validações básicas
    if (!decodedText || decodedText.length < 10) {
      log('QR code muito curto ou inválido');
      return;
    }
    
    // Evitar duplicação
    if (lastScannedCode.current === decodedText) {
      log('QR code já processado');
      return;
    }
    
    // Registrar e processar
    lastScannedCode.current = decodedText;
    toast.success('QR Code detectado!');
    
    // Parar scanner
    cleanupScanner();
    
    // Chamar callback de sucesso
    try {
      onScanSuccess(decodedText);
    } catch (error) {
      log(`Erro ao processar QR code: ${error}`);
      if (onScanError) onScanError(error);
    }
  }, [cleanupScanner, log, onScanError, onScanSuccess]);

  // Iniciar o scanner
  const startScanner = useCallback(async () => {
    try {
      log('Iniciando scanner de QR code');
      setMessage('Aguarde, inicializando câmera...');
      setHasScanFailed(false);
      lastScannedCode.current = null;
      
      // Limpar scanner anterior
      cleanupScanner();
      
      // Verificar se o elemento está disponível
      const qrContainer = document.getElementById('qr-reader');
      if (!qrContainer) {
        throw new Error('Elemento HTML para scanner não encontrado');
      }
      
      // Limpar conteúdo anterior
      qrContainer.innerHTML = '';

      // Criar nova instância
      const html5QrCode = new Html5Qrcode("qr-reader", { verbose: false });
      scannerRef.current = html5QrCode;
      
      // Configurações simplificadas para dispositivos móveis
      const config = {
        fps: 5, // Reduzir FPS para economizar bateria
        qrbox: 250,
        disableFlip: false,
        aspectRatio: 1.0
      };
      
      // Função de erro simplificada
      const qrCodeErrorCallback = (errorMessage: string) => {
        // Ignorar erros comuns de "No QR code found"
        if (errorMessage.includes('No QR code found')) {
          return;
        }
        
        if (errorMessage.includes('Camera access denied')) {
          log('Acesso à câmera negado');
          setMessage('Permissão de câmera negada');
          setHasScanFailed(true);
        } else {
          log(`Erro: ${errorMessage}`);
        }
      };
            
      // Definir timeout para a operação completa
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao inicializar câmera')), 10000);
      });
      
      // Tentar iniciar o scanner com a câmera traseira (environment)
      try {
        const startPromise = html5QrCode.start(
          { facingMode: "environment" }, 
          config,
          handleQrCodeSuccess,
          qrCodeErrorCallback
        );
        
        await Promise.race([startPromise, timeoutPromise]);
        
        setIsScanning(true);
        setMessage('Aponte a câmera para o QR Code');
        
        // Configurar um timer de feedback para o usuário
        let attempts = 0;
        const feedbackInterval = setInterval(() => {
          attempts++;
          
          if (attempts === 5) {
            setMessage('Ajuste a câmera para que o QR code esteja visível');
          } else if (attempts === 12) {
            setMessage('Certifique-se de que há iluminação suficiente');
          } else if (attempts >= 20 && attempts % 10 === 0) {
            setMessage(`Tentando ler o QR code... (${Math.floor(attempts/2)}s)`);
            toast.success('Tentando ler o QR code...');
          }
          
          // Após 60 segundos sem sucesso, mostrar feedback
          if (attempts >= 60) {
            toast.error('Dificuldade em ler o QR code. Tente novamente.');
            clearInterval(feedbackInterval);
          }
        }, 1000);
        
        scanTimer.current = feedbackInterval;
        log('Scanner iniciado com sucesso');
        
      } catch (error) {
        log(`Falha ao iniciar scanner: ${error}`);
        
        // Mensagens de erro específicas
        let errorMsg = 'Erro ao iniciar câmera';
        
        if (String(error).includes('NotAllowedError') || 
            String(error).includes('Permission denied')) {
          errorMsg = 'Acesso à câmera negado. Verifique as permissões do seu navegador.';
        } else if (String(error).includes('Timeout')) {
          errorMsg = 'Tempo esgotado ao iniciar câmera. Verifique as permissões.';
        } else if (String(error).includes('NotFoundError')) {
          errorMsg = 'Câmera não encontrada ou indisponível.';
        } else if (String(error).includes('NotReadableError')) {
          errorMsg = 'Câmera em uso por outro aplicativo.';
        }
        
        toast.error(errorMsg);
        setMessage(errorMsg);
        setHasScanFailed(true);
        
        if (onScanError) onScanError(error);
      }
    } catch (error) {
      log(`Erro ao configurar scanner: ${error}`);
      setMessage('Falha ao inicializar scanner. Tente novamente.');
      setHasScanFailed(true);
      
      if (onScanError) onScanError(error);
    }
  }, [cleanupScanner, handleQrCodeSuccess, log, onScanError]);

  // Reiniciar scanner
  const restartScanner = useCallback(() => {
    log('Reiniciando scanner');
    startScanner();
  }, [startScanner]);

  // Alternar lanterna (quando disponível)
  const toggleTorch = useCallback(async () => {
    if (!scannerRef.current) {
      toast.error('Scanner não inicializado');
      return;
    }
    
    try {
      // TypeScript não conhece essas propriedades, então usamos casting
      const scanner = scannerRef.current as any;
      const newTorchState = !torchEnabled;
      
      if (newTorchState) {
        if (typeof scanner.turnFlashOn === 'function') {
          await scanner.turnFlashOn();
          setTorchEnabled(true);
          toast.success('Lanterna ativada');
        } else {
          throw new Error('Lanterna não suportada');
        }
      } else {
        if (typeof scanner.turnFlashOff === 'function') {
          await scanner.turnFlashOff();
          setTorchEnabled(false);
          toast.success('Lanterna desativada');
        }
      }
    } catch (error) {
      log(`Erro ao controlar lanterna: ${error}`);
      toast.error('Lanterna não disponível neste dispositivo');
    }
  }, [torchEnabled, log]);

  // Trocar câmera
  const switchCamera = useCallback(async () => {
    if (availableCameras.length <= 1) {
      toast.error('Não há outras câmeras disponíveis');
      return;
    }
    
    try {
      log('Alternando câmera');
      cleanupScanner();
      
      setTimeout(() => {
        startScanner();
      }, 500);
      
    } catch (error) {
      log(`Erro ao trocar câmera: ${error}`);
      toast.error('Falha ao trocar câmera');
    }
  }, [availableCameras.length, cleanupScanner, log, startScanner]);

  // Detectar câmeras ao montar
  useEffect(() => {
    const detectCameras = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          const cameras = devices.map(camera => ({
            id: camera.id,
            label: camera.label || `Câmera ${camera.id.slice(0, 5)}`
          }));
          
          setAvailableCameras(cameras);
          log(`Detectadas ${cameras.length} câmeras`);
        } else {
          log('Nenhuma câmera detectada');
        }
      } catch (error) {
        log(`Erro ao enumerar câmeras: ${error}`);
        // Não falhar completamente, apenas registrar
      }
    };
    
    detectCameras();
  }, [log]);

  // Iniciar scanner automaticamente
  useEffect(() => {
    // Pequeno delay para garantir que o DOM esteja pronto
    const timer = setTimeout(() => {
      if (!isScanning && !hasScanFailed) {
        startScanner();
      }
    }, 500);
    
    return () => {
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [cleanupScanner, isScanning, hasScanFailed, startScanner]);

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
        
        {availableCameras.length > 1 && (
          <Button 
            onClick={switchCamera}
            variant="secondary"
            className="flex items-center"
          >
            <FaCamera className="mr-2" /> Trocar Câmera
          </Button>
        )}
        
        <Button 
          onClick={toggleTorch}
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