'use client';

import { useState } from 'react';
import { extractDataFromFiscalReceipt } from '@/lib/services/fiscalReceiptService';

export default function QRCodeHelperPage() {
  const [qrCodeLink, setQrCodeLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{valor?: string; dataEmissao?: string; error?: string} | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Usar o serviço para extrair os dados
      const data = await extractDataFromFiscalReceipt(qrCodeLink);
      setResult(data);
    } catch (error) {
      setResult({ error: 'Ocorreu um erro ao processar o cupom fiscal' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Extrator de Dados de Cupom Fiscal</h1>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">Como usar:</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Escaneie o QR Code do seu cupom fiscal</li>
          <li>Copie o link gerado</li>
          <li>Cole o link no campo abaixo</li>
          <li>Clique em &quot;Extrair Dados&quot;</li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="mb-4">
          <label htmlFor="qrCodeLink" className="block mb-2 font-medium">
            Link do QR Code
          </label>
          <input
            type="text"
            id="qrCodeLink"
            value={qrCodeLink}
            onChange={(e) => setQrCodeLink(e.target.value)}
            placeholder="Cole aqui o link do QR Code"
            className="w-full p-3 border rounded-lg"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`py-2 px-4 rounded-lg font-medium ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? 'Processando...' : 'Extrair Dados'}
        </button>
      </form>

      {result && (
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-3">Resultado:</h2>
          {result.error ? (
            <div className="text-red-600">{result.error}</div>
          ) : (
            <div className="space-y-2">
              {result.valor && (
                <div>
                  <span className="font-medium">Valor Total:</span> R$ {result.valor}
                </div>
              )}
              {result.dataEmissao && (
                <div>
                  <span className="font-medium">Data de Emissão:</span> {new Date(result.dataEmissao).toLocaleDateString('pt-BR')}
                </div>
              )}
              {!result.valor && !result.dataEmissao && (
                <div className="text-yellow-600">
                  Nenhum dado foi extraído. Verifique se o link está correto.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 