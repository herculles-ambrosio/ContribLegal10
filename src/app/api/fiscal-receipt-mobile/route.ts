import { NextRequest, NextResponse } from 'next/server';
import { extractDataFromFiscalReceipt } from '@/lib/services/fiscalReceiptService';

export const dynamic = 'force-dynamic'; // Sem cache para esta rota

// Configuração de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handler para requisições OPTIONS (preflight CORS)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const { qrCodeLink } = await request.json();
    
    if (!qrCodeLink) {
      return NextResponse.json(
        { error: 'Link do QR Code não fornecido' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('API-Mobile - Processando requisição para:', qrCodeLink);
    
    // Usar o serviço para extrair os dados
    const result = await extractDataFromFiscalReceipt(qrCodeLink);
    
    console.log('API-Mobile - Resultado:', result);
    
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error('API-Mobile - Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: 'Erro ao processar a requisição' },
      { status: 500, headers: corsHeaders }
    );
  }
} 