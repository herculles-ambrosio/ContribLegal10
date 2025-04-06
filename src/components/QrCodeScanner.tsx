'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QrCodeScannerProps {
  onScanSuccess: (result: string) => void;
  onScanError?: (error: any) => void;
  onClose?: () => void;
}

export default function QrCodeScanner({ onScanSuccess, onScanError, onClose }: QrCodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const lastErrorRef = useRef<string>('');
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Se o componente for renderizado no servidor, não faça nada
    if (typeof window === 'undefined') return;

    // Limpar o scanner anterior, se existir
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (error) {
        console.error('Erro ao limpar scanner:', error);
      }
    }

    // Limpar timeout de erro, se existir
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }

    // Configurações do scanner
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true,
      // Configurações específicas para dispositivos móveis
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
      showZoomSliderIfSupported: true,
      defaultZoomValueIfSupported: 2,
    };

    try {
      // Criar nova instância do scanner
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        config,
        false // Não iniciar o scan automaticamente
      );

      // Definir callbacks de sucesso e erro
      const onScanSuccessCallback = (decodedText: string) => {
        // Marcar que não estamos mais escaneando
        setIsScanning(false);
        
        // Se o scanner ainda existir, limpe-o após um sucesso
        if (scannerRef.current) {
          try {
            scannerRef.current.clear();
          } catch (error) {
            console.error('Erro ao limpar scanner após sucesso:', error);
          }
        }
        
        // Chamar o callback de sucesso fornecido pelo componente pai
        onScanSuccess(decodedText);
      };

      const onScanFailureCallback = (errorMessage: string | Object) => {
        // Converter o erro para string, com tratamento seguro para evitar outro TypeError
        let errorStr = "";
        try {
          if (typeof errorMessage === 'string') {
            errorStr = errorMessage;
          } else if (errorMessage && typeof errorMessage === 'object') {
            errorStr = JSON.stringify(errorMessage);
          } else {
            errorStr = "Erro desconhecido ao escanear QR code";
          }
        } catch (e) {
          errorStr = "Erro não processável durante o escaneamento";
          console.error("Erro ao processar mensagem de erro:", e);
        }
        
        // Verificações de segurança
        if (!errorStr) {
          errorStr = "Erro desconhecido durante o escaneamento";
        }
        
        // Ignorar erros comuns durante o escaneamento
        if (
          errorStr.includes('No QR code found') || 
          errorStr.includes('No barcode or QR code detected') ||
          errorStr.includes('Scanner paused')
        ) {
          return;
        }
        
        // Verificar se este erro está relacionado ao TypeError conhecido
        if (
          errorStr.includes('TypeError') || 
          errorStr.includes('String') || 
          errorStr.includes('undefined is not an object')
        ) {
          console.warn("Tipo de erro conhecido detectado, suprimindo notificação ao usuário");
          return;
        }
        
        // Se este erro já foi reportado recentemente, não reportá-lo novamente
        if (errorStr === lastErrorRef.current) {
          return;
        }
        
        // Atualizar o último erro
        lastErrorRef.current = errorStr;
        
        // Chamar o callback de erro se fornecido
        if (onScanError) {
          onScanError(errorStr);
        } else {
          console.error('Erro no scan:', errorStr);
        }
        
        // Limpar o último erro após um tempo para permitir que ele seja reportado novamente
        errorTimeoutRef.current = setTimeout(() => {
          lastErrorRef.current = '';
        }, 5000);
      };

      // Renderizar o scanner e começar a escanear
      scanner.render(onScanSuccessCallback, onScanFailureCallback);
      setIsScanning(true);
      
      // Armazenar referência
      scannerRef.current = scanner;
    } catch (error) {
      console.error('Erro ao inicializar scanner:', error);
      if (onScanError) onScanError(error);
    }

    // Limpar ao desmontar
    return () => {
      // Limpar timeout de erro, se existir
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
      
      // Limpar scanner, se existir
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (error) {
          console.error('Erro ao limpar scanner durante desmontagem:', error);
        }
      }
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div className="qr-scanner-container">
      <div id="qr-reader" className="w-full"></div>
      {isScanning && (
        <p className="text-center text-blue-600 mt-2">
          Aponte a câmera para o QR code...
        </p>
      )}
      
      <style jsx>{`
        .qr-scanner-container {
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
        }
        
        /* Sobrescrever estilos da biblioteca para melhor aparência */
        :global(#qr-reader) {
          border: none !important;
          width: 100% !important;
        }
        
        :global(#qr-reader__scan_region) {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        
        :global(#qr-reader__dashboard) {
          padding: 8px !important;
        }
        
        :global(#qr-reader__dashboard_section_csr button) {
          background-color: #3b82f6 !important;
          color: white !important;
          border: none !important;
          border-radius: 4px !important;
          padding: 8px 16px !important;
          margin: 8px 4px !important;
          cursor: pointer !important;
        }
        
        :global(#qr-reader select) {
          padding: 8px !important;
          border-radius: 4px !important;
          border: 1px solid #d1d5db !important;
          margin: 8px 0 !important;
        }
        
        :global(#qr-reader__status_span) {
          display: none !important; /* Esconder mensagens de status da biblioteca */
        }
      `}</style>
    </div>
  );
} 