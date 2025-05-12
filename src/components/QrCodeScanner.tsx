'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Button from '@/components/ui/Button';
import { FaSync, FaLightbulb, FaSearch, FaRedo } from 'react-icons/fa';

interface QrCodeScannerProps {
  onScanSuccess: (result: string) => void;
  onScanError?: (error: any) => void;
  onDebugLog?: (message: string) => void;
}

export default function QrCodeScanner({ onScanSuccess, onScanError, onDebugLog }: QrCodeScannerProps) {
  const [cameras, setCameras] = useState<{id: string, label: string}[]>([]);
  const [currentCamera, setCurrentCamera] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string>('Iniciando câmera...');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanAttempts, setScanAttempts] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader";

  // Função para logs de depuração
  const logDebug = (message: string) => {
    console.log(`QR-SCANNER-DEBUG: ${message}`);
    if (onDebugLog) {
      onDebugLog(`QR-SCANNER: ${message}`);
    }
  };

  // Inicializar o scanner e obter lista de câmeras
  useEffect(() => {
    if (typeof window === 'undefined') return;

    logDebug("Inicializando QrCodeScanner");
    
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
              
              // Adicionar logs detalhados
              logDebug(`QR Code lido com sucesso: ${decodedText}`);
              
              try {
                // Usar um timeout para garantir que o componente principal tenha tempo de processar
                setTimeout(() => {
                  logDebug(`Enviando resultado para componente pai: ${decodedText}`);
                  
                  // Chamar o callback de sucesso com o link do QR code
                  onScanSuccess(decodedText);
                  
                  // REDUNDÂNCIA: Se existir um formulário com campo de número de documento, 
                  // tenta definir diretamente via DOM para garantir
                  try {
                    const numeroDocumentoInput = document.querySelector('input[name="numero_documento"]') as HTMLInputElement;
                    if (numeroDocumentoInput) {
                      logDebug(`Tentando definir diretamente o valor no campo via DOM: ${decodedText}`);
                      numeroDocumentoInput.value = decodedText;
                      
                      // Disparar eventos para notificar o React sobre a mudança
                      const event = new Event('input', { bubbles: true });
                      numeroDocumentoInput.dispatchEvent(event);
                      
                      const changeEvent = new Event('change', { bubbles: true });
                      numeroDocumentoInput.dispatchEvent(changeEvent);
                    }
                  } catch (domError) {
                    logDebug(`Erro ao manipular DOM diretamente: ${domError}`);
                  }
                }, 100);
              } catch (callbackError) {
                logDebug(`Erro ao chamar callback de sucesso: ${callbackError}`);
                // Tentar novamente em caso de erro
                setTimeout(() => onScanSuccess(decodedText), 500);
              }
            })
            .catch(error => {
              logDebug(`Erro ao parar scanner após sucesso: ${error}`);
              // Chamar o callback mesmo se houver erro ao parar o scanner
              onScanSuccess(decodedText);
            });
        } else {
          // Chamar o callback mesmo se o scanner não estiver disponível
          logDebug("Scanner não disponível, mas enviando resultado mesmo assim");
          onScanSuccess(decodedText);
        }
      };

      // Configuração otimizada para QR codes 
      const config = {
        fps: scanAttempts > 3 ? 5 : 10, // Reduzir FPS após mais tentativas para processamento mais profundo
        qrbox: scanAttempts > 3 
          ? { width: 350, height: 350 } // Área maior após várias tentativas
          : { width: 250, height: 250 }, // Padrão  
        aspectRatio: 1.0,
        disableFlip: false, // Permitir leitura em qualquer orientação
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Usar API nativa se disponível
          debugMode: scanAttempts > 5, // Ativar modo de debug após muitas tentativas
        },
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: false, // Usaremos nosso próprio botão
        focusMode: "continuous", // Manter foco continuo para melhor leitura
        videoConstraints: {
          // Tentar obter resolução mais alta após falhas
          width: { ideal: scanAttempts > 2 ? 1920 : 1280 },
          height: { ideal: scanAttempts > 2 ? 1080 : 720 },
          facingMode: { exact: "environment" } // Usar câmera traseira
        },
        // Tolerância aumentada para reconhecer QR codes de baixa qualidade
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.DATA_MATRIX
        ],
      };

      // Forçar um refresh completo do scanner após muitas tentativas
      if (scanAttempts > 0 && scanAttempts % 3 === 0) {
        // Parar completamente
        if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
        
        // Pequena pausa para reinicializar completamente
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Resetar a câmera antes de iniciar novamente 
        if (scannerRef.current) {
          try {
            await scannerRef.current.clear();
          } catch (e) {
            console.log('Reinicialização da câmera');
          }
        }
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
              errorMessage.includes('Scanning paused') ||
              errorMessage.includes('No MultiFormat Readers') ||
              errorMessage.includes('Decoder result')
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
    <div className="qr-scanner-container">
      <div id={scannerContainerId} className="qr-reader-container"></div>
      
      <div className="mt-4 text-center text-sm">
        <p className={`mb-2 ${isScanning ? 'text-blue-500' : 'text-gray-500'}`}>
          {message}
        </p>
        
        <div className="flex justify-center space-x-2 mt-3">
          {cameras.length > 1 && (
            <Button
              type="button"
              variant="secondary"
              onClick={switchCamera}
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
            onClick={toggleTorch}
            className="text-xs py-1 px-3 flex items-center"
            aria-label="Lanterna"
          >
            <FaLightbulb className={`mr-1 ${torchEnabled ? 'text-yellow-400' : ''}`} size={14} />
            {torchEnabled ? 'Desligar Luz' : 'Ligar Lanterna'}
          </Button>
          
          <Button
            type="button"
            variant="secondary"
            onClick={restartScanner}
            className="text-xs py-1 px-3 flex items-center"
            aria-label="Reiniciar"
          >
            <FaRedo className="mr-1" size={14} />
            Tentar Novamente
          </Button>
        </div>
      </div>
    </div>
  );
} 