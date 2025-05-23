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
  const [cameras, setCameras] = useState<{id: string, label: string}[]>([]);
  const [currentCamera, setCurrentCamera] = useState<string>('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string>('Inicializando...');
  const [scanFailed, setScanFailed] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  
  // Referência para o scanner HTML5QrCode
  const scannerRef = useRef<Html5Qrcode | null>(null);
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
    try {
      setIsScanning(false);
      
      // Limpar intervalos
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      
      // Parar scanner html5-qrcode se estiver ativo
      if (scannerRef.current) {
        try {
          scannerRef.current.stop()
            .then(() => {
              log("Scanner parado com sucesso");
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
      
      log('Scanner parado e recursos liberados');
    } catch (e) {
      log(`Erro ao parar scanner: ${e}`);
    }
  }, [log]);

  // Iniciar scanner usando Html5Qrcode
  const startHtml5QrScanner = useCallback(async () => {
    try {
      log('Iniciando scanner HTML5QrCode');
      
      // Limpar qualquer scanner anterior
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current = null;
        } catch (e) {
          log(`Erro ao limpar scanner anterior: ${e}`);
        }
      }
      
      // Verificar se o elemento existe antes de continuar
      const qrReaderElement = document.getElementById("qr-reader");
      if (!qrReaderElement) {
        log('Elemento #qr-reader não encontrado no DOM');
        toast.error('Erro ao inicializar scanner: elemento DOM não encontrado');
        setScanFailed(true);
        return false;
      }
      
      // Configurações simplificadas, com parâmetros mais conservadores
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: false
        }
      };
      
      // Função de sucesso simplificada
      const qrCodeSuccessCallback = (decodedText: string) => {
        processQrCode(decodedText);
      };
      
      // Função de erro que ignora mensagens comuns
      const qrCodeErrorCallback = (errorMessage: string) => {
        if (errorMessage.includes('No QR code found') || 
            errorMessage.includes('Scanning paused')) {
          return;
        }
        log(`Erro durante escaneamento: ${errorMessage}`);
      };
      
      try {
        // Criar novo scanner
        const html5QrCode = new Html5Qrcode("qr-reader", { verbose: false });
        scannerRef.current = html5QrCode;
        
        // Mostrar mensagem clara
        setMessage('Solicitando acesso à câmera...');
        
        // Usando uma Promise com timeout para detectar falha na inicialização da câmera
        const cameraPromise = html5QrCode.start(
          { facingMode: "environment" },
          config,
          qrCodeSuccessCallback,
          qrCodeErrorCallback
        );
        
        // Promise com timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Timeout ao iniciar câmera")), 8000);
        });
        
        // Aguardar a primeira que completar (sucesso ou timeout)
        await Promise.race([cameraPromise, timeoutPromise]);
        
        setIsScanning(true);
        setMessage('Aponte a câmera para o QR Code');
        
        // Verificar se a lanterna é suportada (simplificado)
        try {
          const cameras = await Html5Qrcode.getCameras();
          setHasTorch(cameras.length > 0);
        } catch (e) {
          setHasTorch(false);
        }
        
        // Timer para feedback ao usuário
        let scanAttempts = 0;
        scanIntervalRef.current = setInterval(() => {
          scanAttempts++;
          
          if (scanAttempts === 3) {
            setMessage('Ajuste a câmera para que o QR code esteja visível');
          } else if (scanAttempts === 8) {
            setMessage('Certifique-se de que há iluminação suficiente');
          } else if (scanAttempts >= 15 && scanAttempts % 5 === 0) {
            setMessage(`Tentando ler o QR code... (${Math.floor(scanAttempts/2)}s)`);
          }
          
          // Após 20 segundos sem sucesso, dar feedback
          if (scanAttempts >= 20) {
            toast.error('Dificuldade em ler o QR code. Tente novamente.');
            clearInterval(scanIntervalRef.current!);
          }
        }, 1000);
        
        return true;
      } catch (cameraError) {
        log(`Erro ao iniciar câmera: ${cameraError}`);
        // Mostrar mensagem de erro mais específica para o usuário
        if (String(cameraError).includes('Permission denied') || 
            String(cameraError).includes('permission')) {
          toast.error('Permissão da câmera negada. Por favor, permita o acesso.');
        } else if (String(cameraError).includes('Timeout')) {
          toast.error('Tempo esgotado ao iniciar câmera. Tente novamente.');
        } else {
          toast.error('Erro ao acessar câmera. Verifique as permissões.');
        }
        throw cameraError;
      }
    } catch (error) {
      log(`Erro ao iniciar scanner Html5Qrcode: ${error}`);
      setScanFailed(true);
      if (onScanError) onScanError(error);
      return false;
    }
  }, [log, processQrCode, onScanError]);

  // Iniciar escaneamento com permissão de câmera
  const startScanner = useCallback(async () => {
    // Resetar estado
    setScanFailed(false);
    setHasScanned(false);
    lastScannedQR.current = null;
    setMessage('Aguarde, inicializando câmera...');
    
    // Verificar se há navegador / suporte à câmera
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Seu navegador não suporta acesso à câmera');
      log('API de câmera não suportada');
      setScanFailed(true);
      return;
    }
    
    try {
      // Primeiro paramos qualquer scanner ativo
      stopScanning();
      
      // Verificar permissões de câmera antes de iniciar
      try {
        // Solicitação explícita de permissão com timeout
        const permissionPromise = navigator.mediaDevices.getUserMedia({ video: true });
        
        // Promise com timeout para a permissão
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Tempo esgotado ao solicitar permissão de câmera')), 5000);
        });
        
        // Aguardar o primeiro que completar
        await Promise.race([permissionPromise, timeoutPromise]);
        
        // Tentar iniciar o scanner HTML5QrCode
        const success = await startHtml5QrScanner();
        
        if (success) {
          toast.success('Câmera pronta!');
        } else {
          toast.error('Não foi possível iniciar o scanner');
          setScanFailed(true);
        }
      } catch (permissionError) {
        log(`Erro de permissão de câmera: ${permissionError}`);
        
        // Mensagem de erro específica para permissão
        if (String(permissionError).includes('Permission denied') || 
            String(permissionError).includes('permission')) {
          toast.error('Acesso à câmera negado. Por favor, permita o acesso nas configurações do navegador.');
        } else if (String(permissionError).includes('Tempo esgotado')) {
          toast.error('Tempo esgotado ao solicitar permissão da câmera. Verifique as configurações do navegador.');
        } else {
          toast.error('Erro ao acessar câmera. Verifique as configurações do navegador.');
        }
        
        setScanFailed(true);
        if (onScanError) onScanError(permissionError);
      }
    } catch (error) {
      log(`Erro ao iniciar scanner: ${error}`);
      toast.error('Erro ao acessar câmera');
      setScanFailed(true);
      
      if (onScanError) {
        onScanError(error);
      }
    }
  }, [onScanError, startHtml5QrScanner, stopScanning, log]);

  // Alternar lanterna (quando disponível)
  const toggleTorch = useCallback(async () => {
    try {
      if (!hasTorch || !scannerRef.current) {
        toast.error('Lanterna não disponível');
        return;
      }
      
      const newTorchState = !torchEnabled;
      
      try {
        // Solução mais segura para acessar métodos que podem não estar no tipo
        const scanner = scannerRef.current as any;
        
        if (newTorchState && typeof scanner.turnFlashOn === 'function') {
          await scanner.turnFlashOn();
          setTorchEnabled(true);
          toast.success('Lanterna ativada');
        } else if (!newTorchState && typeof scanner.turnFlashOff === 'function') {
          await scanner.turnFlashOff();
          setTorchEnabled(false);
          toast.success('Lanterna desativada');
        } else {
          throw new Error('Função de lanterna não disponível');
        }
      } catch (e) {
        log(`Erro ao alternar lanterna: ${e}`);
        toast.error('Não foi possível controlar a lanterna');
      }
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
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length) {
          const cameraOptions = cameras.map(camera => ({
            id: camera.id,
            label: camera.label || `Câmera ${camera.id.slice(0, 5)}`
          }));
          
          setCameras(cameraOptions);
          
          // Preferir câmera traseira
          const backCamera = cameraOptions.find(camera => 
            camera.label.toLowerCase().includes('back') || 
            camera.label.toLowerCase().includes('traseira') ||
            camera.label.toLowerCase().includes('environment')
          );
          
          setCurrentCamera(backCamera ? backCamera.id : cameraOptions[0].id);
        } else {
          log('Nenhuma câmera encontrada');
          setScanFailed(true);
        }
      } catch (error) {
        log(`Erro ao detectar câmeras: ${error}`);
        // Não falhar completamente - algumas implementações podem não suportar esta API
        // mas ainda permitir o acesso à câmera pelo facingMode
      }
    };
    
    detectCameras();
  }, [log]);

  // Iniciar scanner automaticamente após montagem
  useEffect(() => {
    // Um timer para começar o scanner um pouco depois da montagem do componente
    // isso ajuda a garantir que o DOM está pronto
    const timer = setTimeout(() => {
      if (!isScanning && !scanFailed) {
        startScanner();
      }
    }, 500);
    
    // Cleanup ao desmontar
    return () => {
      clearTimeout(timer);
      stopScanning();
    };
  }, [isScanning, scanFailed, startScanner, stopScanning]);

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-gray-700">Scanner de QR Code</h3>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
      
      <div className="w-full h-96 relative bg-gray-100 rounded-md overflow-hidden mb-4">
        {/* Área para scanner HTML5 */}
        <div id="qr-reader" className="w-full h-full"></div>
        
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