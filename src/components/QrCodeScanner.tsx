'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Button from '@/components/ui/Button';
import { FaSync, FaLightbulb, FaSearch, FaRedo } from 'react-icons/fa';

interface QrCodeScannerProps {
  onScanSuccess: (result: string) => void;
  onScanError?: (error: any) => void;
}

export default function QrCodeScanner({ onScanSuccess, onScanError }: QrCodeScannerProps) {
  const [cameras, setCameras] = useState<{id: string, label: string}[]>([]);
  const [currentCamera, setCurrentCamera] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string>('Iniciando câmera...');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanAttempts, setScanAttempts] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader";

  // Inicializar o scanner e obter lista de câmeras
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initScanner = async () => {
      try {
        // Criar uma instância do scanner
        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          verbose: false, // Reduzir verbosidade para melhorar performance
        });
        scannerRef.current = html5QrCode;

        // Buscar câmeras disponíveis
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            
            // Priorizar câmera traseira para melhor escaneamento
            const rearCamera = devices.find(camera => 
              camera.label.toLowerCase().includes('back') || 
              camera.label.toLowerCase().includes('traseira') ||
              camera.label.toLowerCase().includes('environment')
            );
            
            // Usar a câmera traseira se disponível, senão usar a primeira
            const cameraId = rearCamera ? rearCamera.id : devices[0].id;
            setCurrentCamera(cameraId);
            
            // Iniciar o escaneamento
            startScanner(cameraId);
          } else {
            setMessage('Nenhuma câmera encontrada no dispositivo.');
            if (onScanError) onScanError('No cameras detected');
          }
        } catch (error) {
          console.error('Erro ao obter câmeras:', error);
          setMessage('Falha ao acessar as câmeras. Verifique as permissões do navegador.');
          if (onScanError) onScanError('Camera access denied');
        }
      } catch (error) {
        console.error('Erro ao inicializar scanner:', error);
        setMessage('Falha ao inicializar o scanner de QR Code.');
        if (onScanError) onScanError(error);
      }
    };

    initScanner();

    // Limpar recursos ao desmontar o componente
    return () => {
      if (scannerRef.current) {
        if (scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
          scannerRef.current.stop()
            .catch(error => console.error('Erro ao parar scanner:', error));
        }
      }
    };
  }, [onScanError]);

  // Alternar entre câmeras disponíveis
  const switchCamera = async () => {
    if (!cameras || cameras.length <= 1) return;
    
    // Parar o scanner atual
    if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
      await scannerRef.current.stop();
    }

    // Encontrar a próxima câmera na lista
    const currentIndex = cameras.findIndex(camera => camera.id === currentCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCameraId = cameras[nextIndex].id;
    
    // Atualizar a câmera atual
    setCurrentCamera(nextCameraId);
    
    // Reiniciar o scanner com a nova câmera
    startScanner(nextCameraId);
    
    setMessage(`Usando câmera: ${cameras[nextIndex].label || 'Desconhecida'}`);
    
    // Resetar estado da lanterna ao trocar de câmera
    setTorchEnabled(false);
  };

  // Alternar lanterna (flash) da câmera
  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    
    try {
      // Verificar se há suporte a lanterna
      const cameraCapabilities = scannerRef.current.getRunningTrackCameraCapabilities();
      if (!cameraCapabilities) {
        setMessage('Recursos da câmera não disponíveis');
        return;
      }
      
      const torchFeature = cameraCapabilities.torchFeature();
      if (!torchFeature.isSupported()) {
        setMessage('Este dispositivo não suporta lanterna');
        return;
      }
      
      // Alternar estado da lanterna
      const newTorchState = !torchEnabled;
      torchFeature.apply(newTorchState);
      setTorchEnabled(newTorchState);
      setMessage(newTorchState ? 'Lanterna ligada' : 'Lanterna desligada');
      
      // Voltar à mensagem normal após 1.5 segundos
      setTimeout(() => {
        setMessage('Aponte a câmera para o QR Code do cupom fiscal...');
      }, 1500);
    } catch (error) {
      console.error('Erro ao alternar lanterna:', error);
      setMessage('Este dispositivo não suporta lanterna');
      
      // Voltar à mensagem normal após 1.5 segundos
      setTimeout(() => {
        setMessage('Aponte a câmera para o QR Code do cupom fiscal...');
      }, 1500);
    }
  };

  // Reiniciar o scanner
  const restartScanner = async () => {
    setScanAttempts(prev => prev + 1);
    setMessage('Reiniciando scanner...');
    
    if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
      await scannerRef.current.stop();
    }
    
    // Adicionar um pequeno atraso antes de reiniciar
    setTimeout(() => {
      startScanner(currentCamera);
    }, 500);
  };

  // Iniciar o scanner com a câmera especificada
  const startScanner = async (cameraId: string) => {
    if (!scannerRef.current) return;
    
    try {
      setIsScanning(true);
      
      const qrCodeSuccessCallback = (decodedText: string) => {
        // Parar o scanner após um sucesso
        if (scannerRef.current) {
          scannerRef.current.stop()
            .then(() => {
              setIsScanning(false);
              // Chamar o callback de sucesso com o link do QR code
              onScanSuccess(decodedText);
            })
            .catch(error => console.error('Erro ao parar scanner após sucesso:', error));
        } else {
          // Chamar o callback mesmo se o scanner não estiver disponível
          onScanSuccess(decodedText);
        }
      };

      // Configuração otimizada para QR codes 
      const config = {
        fps: 10, // Taxa de quadros mais baixa para processamento mais eficiente
        qrbox: { 
          width: 250, // Área de escaneamento mais precisa
          height: 250
        },
        aspectRatio: 1.0,
        disableFlip: false, // Permitir leitura em qualquer orientação
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Usar API nativa se disponível
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.DATA_MATRIX
        ],
        // Aumentar capacidade de processamento
        returnDataInCallback: true,
        showTorchButtonIfSupported: false, // Usaremos nosso próprio botão
        focusMode: "continuous", // Manter foco continuo para melhor leitura
      };

      // Após algumas tentativas, ajustar as configurações para tentar uma abordagem diferente
      if (scanAttempts > 2) {
        config.fps = 5; // Reduzir FPS para processamento mais profundo
        config.qrbox = { width: 400, height: 400 }; // Área maior
      }

      await scannerRef.current.start(
        cameraId, 
        config,
        qrCodeSuccessCallback,
        (errorMessage) => {
          // Ignorar mensagens de erro comuns durante o escaneamento 
          if (
            typeof errorMessage === 'string' && (
              errorMessage.includes('No QR code found') ||
              errorMessage.includes('Scanning paused')
            )
          ) {
            return;
          }
          
          console.log('Erro durante o scan:', errorMessage);
        }
      );
      
      setMessage('Aponte a câmera para o QR Code do cupom fiscal...');
    } catch (error) {
      console.error('Erro ao iniciar scanner:', error);
      setMessage('Falha ao iniciar a câmera. Tente novamente.');
      setIsScanning(false);
      if (onScanError) onScanError(error);
    }
  };

  return (
    <div className="qr-scanner-wrapper">
      <div 
        id={scannerContainerId} 
        className="w-full h-[400px] overflow-hidden bg-gray-100 rounded-lg relative"
      ></div>
      
      <div className="text-center mt-2 mb-2">
        <p className={`text-sm ${isScanning ? 'text-blue-600' : 'text-red-500'}`}>
          {message}
        </p>
      </div>

      <div className="flex justify-center mt-2 mb-4 gap-2">
        {cameras.length > 1 && (
          <Button 
            type="button"
            variant="info"
            onClick={switchCamera}
            className="text-sm flex items-center gap-2"
            title="Alternar entre câmeras disponíveis"
          >
            <FaSync size={14} />
            Trocar Câmera
          </Button>
        )}
        
        <Button 
          type="button"
          variant={torchEnabled ? "warning" : "info"}
          onClick={toggleTorch}
          className="text-sm flex items-center gap-2"
          title="Ligar/Desligar lanterna"
        >
          <FaLightbulb size={14} />
          {torchEnabled ? 'Desligar Flash' : 'Ligar Flash'}
        </Button>
        
        <Button 
          type="button"
          variant="primary"
          onClick={restartScanner}
          className="text-sm flex items-center gap-2"
          title="Tentar novamente"
        >
          <FaRedo size={14} />
          Tentar Novamente
        </Button>
      </div>

      <style jsx>{`
        .qr-scanner-wrapper {
          width: 100%;
        }

        :global(#${scannerContainerId}) {
          width: 100% !important;
          border: none !important;
          border-radius: 0.5rem !important;
          overflow: hidden !important;
        }

        :global(#${scannerContainerId} video) {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 0.375rem !important;
        }

        :global(#${scannerContainerId}__scan_region) {
          background: rgba(0, 0, 0, 0.1) !important;
          overflow: hidden !important;
          width: 100% !important;
          height: 100% !important;
        }

        :global(#${scannerContainerId}__dashboard) {
          display: none !important;
        }
        
        /* Aumentar o contraste e visibilidade do quadro de escaneamento */
        :global(#${scannerContainerId}__scan_region_highlight) {
          width: 80% !important;
          height: 80% !important;
          border: 4px solid #60a5fa !important;
          border-radius: 8px !important;
          box-shadow: 0 0 0 4000px rgba(0, 0, 0, 0.4) !important;
        }
      `}</style>
    </div>
  );
} 