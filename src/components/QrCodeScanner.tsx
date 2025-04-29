'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Button from '@/components/ui/Button';
import { FaSync } from 'react-icons/fa';

interface QrCodeScannerProps {
  onScanSuccess: (result: string) => void;
  onScanError?: (error: any) => void;
}

export default function QrCodeScanner({ onScanSuccess, onScanError }: QrCodeScannerProps) {
  const [cameras, setCameras] = useState<{id: string, label: string}[]>([]);
  const [currentCamera, setCurrentCamera] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string>('Iniciando câmera...');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader";

  // Inicializar o scanner e obter lista de câmeras
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initScanner = async () => {
      try {
        // Criar uma instância do scanner
        const html5QrCode = new Html5Qrcode(scannerContainerId);
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

      // Configuração otimizada para QR codes da SEFAZ MG
      const config = {
        fps: 30, // Maior taxa de quadros para detecção mais rápida
        qrbox: {
          width: 280,
          height: 280,
        },
        aspectRatio: 1.0,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      };

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
        className="w-full h-[300px] overflow-hidden bg-gray-100 rounded-lg relative"
      ></div>
      
      <div className="text-center mt-2 mb-2">
        <p className={`text-sm ${isScanning ? 'text-blue-600' : 'text-red-500'}`}>
          {message}
        </p>
      </div>

      {cameras.length > 1 && (
        <div className="flex justify-center mt-2 mb-4">
          <Button 
            type="button"
            variant="info"
            onClick={switchCamera}
            className="text-sm flex items-center gap-2"
          >
            <FaSync size={14} />
            Alternar câmera
          </Button>
        </div>
      )}

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
          height: auto !important;
          object-fit: cover !important;
          border-radius: 0.375rem !important;
        }

        :global(#${scannerContainerId}__scan_region) {
          background: rgba(0, 0, 0, 0.1) !important;
          overflow: hidden !important;
        }

        :global(#${scannerContainerId}__dashboard) {
          display: none !important;
        }
      `}</style>
    </div>
  );
} 