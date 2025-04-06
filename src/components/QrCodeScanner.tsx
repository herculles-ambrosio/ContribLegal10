'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Button from '@/components/ui/Button';
import { FaSync, FaCamera } from 'react-icons/fa';

interface QrCodeScannerProps {
  onScanSuccess: (result: string) => void;
  onScanError?: (error: any) => void;
  onClose?: () => void;
}

export default function QrCodeScanner({ onScanSuccess, onScanError, onClose }: QrCodeScannerProps) {
  const [cameras, setCameras] = useState<{id: string, label: string}[]>([]);
  const [currentCamera, setCurrentCamera] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string>('Iniciando câmera...');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Inicializar o scanner e obter lista de câmeras
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initScanner = async () => {
      try {
        // Criar uma instância do scanner
        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;

        // Buscar câmeras disponíveis
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            // Selecionar a câmera traseira por padrão (geralmente a última)
            const rearCamera = devices.find(camera => 
              camera.label.toLowerCase().includes('back') || 
              camera.label.toLowerCase().includes('traseira') ||
              camera.label.toLowerCase().includes('environment')
            );
            
            // Usar a câmera traseira se disponível, senão usar a primeira
            const cameraId = rearCamera ? rearCamera.id : devices[0].id;
            setCurrentCamera(cameraId);
            
            // Iniciar o escaneamento com esta câmera
            startScanner(cameraId);
          } else {
            setMessage('Nenhuma câmera encontrada.');
          }
        } catch (error) {
          console.error('Erro ao obter câmeras:', error);
          setMessage('Falha ao acessar as câmeras. Verifique as permissões.');
          if (onScanError) onScanError('Falha ao acessar as câmeras');
        }
      } catch (error) {
        console.error('Erro ao inicializar scanner:', error);
        setMessage('Falha ao inicializar o scanner de QR code.');
        if (onScanError) onScanError('Falha ao inicializar scanner');
      }
    };

    initScanner();

    // Limpar recursos ao desmontar
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop()
          .catch(error => console.error('Erro ao parar scanner:', error));
      }
    };
  }, [onScanError]);

  // Alternar entre câmeras
  const switchCamera = async () => {
    if (!cameras || cameras.length <= 1) return;
    
    // Parar o scanner atual
    if (scannerRef.current && scannerRef.current.isScanning) {
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
              onScanSuccess(decodedText);
            })
            .catch(error => console.error('Erro ao parar scanner após sucesso:', error));
        }
      };

      const config = {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250,
        },
        aspectRatio: 1.0
      };

      await scannerRef.current.start(
        cameraId, 
        config,
        qrCodeSuccessCallback,
        (errorMessage) => {
          // Ignorar mensagens de erro comuns durante o escaneamento 
          // que não necessitam ser reportadas ao usuário
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
      
      setMessage('Aponte a câmera para o QR code...');
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
        id="qr-reader" 
        ref={scannerContainerRef} 
        className="w-full h-64 overflow-hidden bg-gray-100 rounded-lg relative"
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
            icon={FaSync}
            onClick={switchCamera}
            className="text-sm md:text-base flex items-center"
          >
            Alternar câmera
          </Button>
        </div>
      )}

      <style jsx>{`
        .qr-scanner-wrapper {
          width: 100%;
        }

        :global(#qr-reader) {
          width: 100% !important;
          border: none !important;
          border-radius: 0.5rem !important;
          overflow: hidden !important;
        }

        :global(#qr-reader video) {
          width: 100% !important;
          height: auto !important;
          object-fit: cover !important;
          border-radius: 0.375rem !important;
        }

        :global(#qr-reader__scan_region) {
          background: rgba(0, 0, 0, 0.1) !important;
          overflow: hidden !important;
        }

        :global(#qr-reader__scan_region img) {
          display: none !important;
        }

        :global(#qr-reader__dashboard) {
          display: none !important;
        }
      `}</style>
    </div>
  );
} 