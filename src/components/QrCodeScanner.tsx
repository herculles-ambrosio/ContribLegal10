'use client';

import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QrCodeScannerProps {
  onScanSuccess: (result: string) => void;
  onScanError?: (error: any) => void;
  onClose?: () => void;
}

export default function QrCodeScanner({ onScanSuccess, onScanError, onClose }: QrCodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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

      const onScanFailureCallback = (error: any) => {
        // Não reportar erros regulares de scan (quando não encontra QR code na imagem)
        if (error?.includes?.('No QR code found')) return;
        
        // Chamar o callback de erro se fornecido
        if (onScanError) {
          onScanError(error);
        } else {
          console.error('Erro no scan:', error);
        }
      };

      // Renderizar o scanner e começar a escanear
      scanner.render(onScanSuccessCallback, onScanFailureCallback);
      
      // Armazenar referência
      scannerRef.current = scanner;
    } catch (error) {
      console.error('Erro ao inicializar scanner:', error);
      if (onScanError) onScanError(error);
    }

    // Limpar ao desmontar
    return () => {
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
      `}</style>
    </div>
  );
} 