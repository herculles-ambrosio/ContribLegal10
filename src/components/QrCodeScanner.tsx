'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Button from '@/components/ui/Button';
import { FaSync, FaLightbulb, FaSearch, FaRedo } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

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

  // Função robusta para iniciar o scanner com fallbacks progressivos
  const startScannerWithFallback = async (cameraIdOrFacingMode: string) => {
    // Lista de configurações para tentar, da mais completa à mais básica
    const configOptions = [
      // Opção 1: Configuração ideal
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.DATA_MATRIX
        ],
        videoConstraints: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment"
        }
      },
      // Opção 2: Configuração média
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        videoConstraints: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment"
        }
      },
      // Opção 3: Configuração básica
      {
        fps: 5,
        qrbox: { width: 200, height: 200 },
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        videoConstraints: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "environment"
        }
      },
      // Opção 4: Configuração mínima
      {
        fps: 5,
        qrbox: 200,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        videoConstraints: {
          facingMode: cameraIdOrFacingMode === 'environment' ? "environment" : { exact: cameraIdOrFacingMode }
        }
      },
      // Opção 5: Última tentativa
      {
        fps: 2,
        qrbox: 200,
        videoConstraints: {
          facingMode: "environment"
        }
      }
    ];
    
    // Tentar cada configuração até uma funcionar
    let success = false;
    
    for (let i = 0; i < configOptions.length; i++) {
      if (success) break;
      
      try {
        const config = configOptions[i];
        logDebug(`Tentando iniciar scanner com configuração #${i+1}`);
        
        // Verificar se ainda temos um scanner válido
        if (!scannerRef.current) {
          logDebug('Scanner não está mais disponível');
          break;
        }
        
        // Se já estiver escaneando, parar primeiro
        if (scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Configurar callbacks
        const successCallback = (decodedText: string) => {
          logDebug(`QR code lido com sucesso: ${decodedText}`);
          
          // Prevenir múltiplas chamadas do mesmo código QR
          // Parar o scanner imediatamente para evitar loops
          if (scannerRef.current) {
            try {
              scannerRef.current.pause();
            } catch (pauseError) {
              // Ignorar erros ao pausar
            }
          
            scannerRef.current.stop().then(() => {
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
            }).catch(stopError => {
              logDebug(`Erro ao parar scanner após sucesso: ${stopError}`);
              // Tentar chamar o callback mesmo se houver erro ao parar
              try {
                onScanSuccess(decodedText);
              } catch (finalError) {
                // Último recurso - ignorar erros
              }
            });
          } else {
            // Scanner não disponível, mas tentar chamar callback mesmo assim
            try {
              onScanSuccess(decodedText);
            } catch (noScannerError) {
              // Ignorar erros finais
            }
          }
        };
        
        // Variáveis para controlar erros
        let errorCount = 0;
        const maxErrors = 5;
        let lastErrorTime = 0;
        
        const errorCallback = (errorMessage: string | any) => {
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
          
          // Controle de taxa de erros para evitar loops
          const now = Date.now();
          if (now - lastErrorTime > 3000) {
            // Se passou mais de 3 segundos, resetar contador
            errorCount = 0;
          }
          lastErrorTime = now;
          
          // Incrementar contador de erros
          errorCount++;
          
          // Log de erro, mas apenas se não estiver em loop
          if (errorCount < maxErrors) {
            console.log(`Erro durante o scan (configuração #${i+1}):`, errorMessage);
            
            // Apenas notificar o usuário no primeiro erro e com um atraso
            if (errorCount === 1 && onScanError) {
              setTimeout(() => {
                if (errorCount <= maxErrors) {
                  onScanError('Falha temporária na câmera. Tente ajustar a posição ou reiniciar o scanner.');
                }
              }, 500);
            }
          } else if (errorCount === maxErrors) {
            // No último erro permitido, tentar próxima configuração se existir
            logDebug('Muitos erros consecutivos, tentando próxima configuração...');
            setMessage('Tentando configuração alternativa...');
            
            // Forçar parada para tentar próxima configuração
            if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
              try {
                scannerRef.current.stop().catch(() => {});
              } catch (e) {}
            }
            
            success = false; // Garantir que tente a próxima configuração
            return;
          }
        };
        
        // Tentar iniciar o scanner com esta configuração
        await scannerRef.current.start(
          cameraIdOrFacingMode === 'environment' ? { facingMode: "environment" } : cameraIdOrFacingMode,
          config,
          successCallback,
          errorCallback
        );
        
        // Se chegarmos aqui sem erros, configuração funcionou
        success = true;
        setIsScanning(true);
        setMessage(`Aponte a câmera para o QR Code do cupom fiscal...`);
        logDebug(`Scanner iniciado com sucesso usando configuração #${i+1}`);
        break;
        
      } catch (configError) {
        logDebug(`Falha ao iniciar com configuração #${i+1}: ${configError}`);
        
        // Pequena pausa antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Mostrar mensagem apenas na última tentativa
        if (i === configOptions.length - 1) {
          setMessage('Não foi possível iniciar o scanner. Tente recarregar a página.');
          if (onScanError) onScanError('Falha ao iniciar scanner após várias tentativas.');
        } else {
          setMessage(`Tentando configuração alternativa... (${i+2}/${configOptions.length})`);
        }
      }
    }
    
    return success;
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
      startScannerWithFallback(currentCamera);
    }, 500);
  };

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
    startScannerWithFallback(nextCameraId);
    
    setMessage(`Usando câmera: ${cameras[nextIndex].label || 'Desconhecida'}`);
    
    // Resetar estado da lanterna ao trocar de câmera
    setTorchEnabled(false);
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
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], // Começar apenas com QR code para melhor compatibilidade
        });
        scannerRef.current = html5QrCode;

        // Buscar câmeras disponíveis
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            
            // Tentar determinar a melhor câmera inicial
            let selectedCameraId = devices[0].id; // Padrão: primeira câmera
            
            // Priorizar câmera traseira ou ambiente se disponível
            for (const camera of devices) {
              const label = camera.label.toLowerCase();
              
              // Verificar por termos que indicam câmera traseira
              if (
                label.includes('back') || 
                label.includes('traseira') ||
                label.includes('environment') ||
                label.includes('rear')
              ) {
                selectedCameraId = camera.id;
                logDebug(`Câmera traseira detectada e selecionada: ${label}`);
                break;
              }
            }
            
            // Armazenar a câmera selecionada
            setCurrentCamera(selectedCameraId);
            
            // Iniciar o scanner de forma robusta
            logDebug(`Iniciando scanner com câmera ID: ${selectedCameraId}`);
            await startScannerWithFallback(selectedCameraId);
          } else {
            setMessage('Nenhuma câmera encontrada no dispositivo.');
            if (onScanError) onScanError('Nenhuma câmera detectada. Verifique se seu dispositivo possui câmera.');
          }
        } catch (cameraError) {
          console.error('Erro ao obter câmeras:', cameraError);
          setMessage('Falha ao acessar as câmeras. Verifique as permissões do navegador.');
          
          // Tentar iniciar de qualquer maneira, pode ser um erro apenas na listagem
          try {
            logDebug('Tentando iniciar câmera sem listar dispositivos...');
            const defaultCameraId = { deviceId: true };
            await startScannerWithFallback('environment');
          } catch (secondaryError) {
            if (onScanError) onScanError('Acesso à câmera negado. Verifique as permissões do navegador.');
          }
        }
      } catch (error) {
        console.error('Erro ao inicializar scanner:', error);
        setMessage('Falha ao inicializar o scanner de QR Code.');
        if (onScanError) onScanError('Erro ao inicializar o scanner. Tente recarregar a página.');
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

  const handleQrCodeError = (error: any) => {
    console.error('Erro na leitura do QR code:', error);
    
    // Mensagens mais específicas baseadas no tipo de erro
    let errorMessage = 'Erro ao ler o QR code. Tente novamente.';
    
    if (typeof error === 'string') {
      if (error.includes('denied') || error === 'Camera access denied') {
        errorMessage = 'Acesso à câmera negado. Verifique as permissões.';
      } else if (error.includes('No cameras') || error === 'No cameras detected') {
        errorMessage = 'Nenhuma câmera detectada no dispositivo.';
      }
    }
    
    toast.error(errorMessage);
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