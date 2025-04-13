'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { FaPlus, FaDownload, FaEye, FaFileAlt, FaMoneyBillWave, FaReceipt, FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaPrint, FaCheck, FaFileContract } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type Documento = {
  id: string;
  usuario_id: string;
  tipo: string;
  numero_documento: string;
  data_emissao: string;
  valor: number;
  arquivo_url: string;
  numero_sorteio: string;
  status: string;
  created_at: string;
};

// Logo do Contribuinte Legal em base64 - versão simplificada para o PDF
const logoBase64 = 'data:image/jpeg;base64,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';

export default function MeusDocumentos() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [documentosFiltrados, setDocumentosFiltrados] = useState<Documento[]>([]);
  const [filtro, setFiltro] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modoSelecao, setModoSelecao] = useState(false);
  const [documentosSelecionados, setDocumentosSelecionados] = useState<string[]>([]);

  useEffect(() => {
    const verificarAutenticacao = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado para acessar esta página');
        router.push('/login');
        return;
      }
      
      await carregarDocumentos();
    };
    
    verificarAutenticacao();
  }, []);
  
  useEffect(() => {
    aplicarFiltro();
  }, [documentos, filtro, filtroStatus]);

  const carregarDocumentos = async () => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('usuario_id', session.user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setDocumentos(data || []);
      setDocumentosFiltrados(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar documentos:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setIsLoading(false);
    }
  };

  const aplicarFiltro = () => {
    let docsFiltrados = documentos;
    
    // Aplicar filtro por tipo de documento
    if (filtro !== 'todos') {
      if (filtro === 'cupom_fiscal') {
        // Para cupom fiscal, também mostrar documentos do tipo nota_venda (que são iguais)
        docsFiltrados = docsFiltrados.filter(doc => doc.tipo === 'cupom_fiscal' || doc.tipo === 'nota_venda');
      } else if (filtro === 'nota_venda') {
        // Para nota_venda, também mostrar documentos do tipo cupom_fiscal (que são iguais)
        docsFiltrados = docsFiltrados.filter(doc => doc.tipo === 'cupom_fiscal' || doc.tipo === 'nota_venda');
      } else {
        docsFiltrados = docsFiltrados.filter(doc => doc.tipo === filtro);
      }
    }
    
    // Aplicar filtro por status
    if (filtroStatus !== 'todos') {
      docsFiltrados = docsFiltrados.filter(doc => doc.status === filtroStatus);
    }
    
    setDocumentosFiltrados(docsFiltrados);
  };

  const handleFiltroChange = (novoFiltro: string) => {
    setFiltro(novoFiltro);
  };
  
  const handleFiltroStatusChange = (novoStatus: string) => {
    setFiltroStatus(novoStatus);
  };

  const getTipoDocumento = (tipo: string) => {
    switch (tipo) {
      case 'nota_servico':
        return {
          label: 'Nota Fiscal de Serviço',
          icon: FaFileContract
        };
      case 'cupom_fiscal':
        return {
          label: 'Cupom Fiscal',
          icon: FaReceipt
        };
      case 'nota_venda':
        return {
          label: 'Cupom Fiscal',
          icon: FaReceipt
        };
      case 'imposto':
        return {
          label: 'Comprovante de Imposto',
          icon: FaMoneyBillWave
        };
      default:
        return {
          label: 'Documento',
          icon: FaFileAlt
        };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'VALIDADO':
        return {
          color: 'bg-green-100 text-green-800',
          icon: FaCheckCircle,
          iconColor: 'text-green-500'
        };
      case 'INVÁLIDO':
        return {
          color: 'bg-red-100 text-red-800',
          icon: FaTimesCircle,
          iconColor: 'text-red-500'
        };
      case 'AGUARDANDO VALIDAÇÃO':
      default:
        return {
          color: 'bg-yellow-100 text-yellow-800',
          icon: FaHourglassHalf,
          iconColor: 'text-yellow-500'
        };
    }
  };

  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatarData = (dataISO: string) => {
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR');
  };

  const gerarPDF = async (documento: Documento) => {
    try {
      // Criando um novo documento PDF
      const pdf = new jsPDF();
      const tipo = getTipoDocumento(documento.tipo);
      
      // Adicionar logo do Contribuinte Legal
      try {
        // Dimensões para o logo
        const imgWidth = 50;
        const imgHeight = 30;
        
        // Centralizar o logo
        const pageWidth = pdf.internal.pageSize.getWidth();
        const xPos = (pageWidth - imgWidth) / 2;
        
        // Adicionar a imagem ao PDF
        pdf.addImage(logoBase64, 'JPEG', xPos, 10, imgWidth, imgHeight);
      } catch (logoError) {
        console.warn('Erro ao adicionar logo:', logoError);
        // Fallback para texto
        pdf.setFontSize(18);
        pdf.setTextColor(0, 71, 187); // Azul do Contribuinte Legal
        pdf.text('Contribuinte Legal', 105, 20, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
      }
      
      // Título do documento
      pdf.setFontSize(16);
      pdf.text('Comprovante de Documento Fiscal', 105, 50, { align: 'center' });
      
      pdf.setFontSize(14);
      pdf.text(`${tipo.label} - #${documento.numero_documento}`, 105, 60, { align: 'center' });
      
      // Adicionando marca d'água para documentos não validados
      if (documento.status === 'AGUARDANDO VALIDAÇÃO' || documento.status === 'INVÁLIDO') {
        // Cores e configurações para uma marca d'água profissional
        const textoMarcaDagua = 'DOCUMENTO SEM VALOR PARA SORTEIO';
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // Altura do retângulo central
        const rectHeight = 40;
        const rectY = pageHeight / 2 - rectHeight / 2;
        
        // Desenhar faixa com fundo suave
        pdf.setFillColor(240, 240, 245); // Cor de fundo suave
        pdf.rect(0, rectY, pageWidth, rectHeight, 'F');
        
        // Desenhar bordas da faixa
        pdf.setDrawColor(48, 63, 159); // Azul mais escuro
        pdf.setLineWidth(1);
        pdf.line(0, rectY, pageWidth, rectY);
        pdf.line(0, rectY + rectHeight, pageWidth, rectY + rectHeight);
        
        // Adicionar texto na faixa
        pdf.setTextColor(220, 53, 69); // Vermelho mais suave
        pdf.setFontSize(22);
        pdf.text(textoMarcaDagua, pageWidth / 2, pageHeight / 2 + 8, { align: 'center' });
        
        // Restaurar configurações
        pdf.setTextColor(0, 0, 0);
        pdf.setDrawColor(0, 0, 0);
        pdf.setFontSize(12);
      }
      
      // Adicionando informações do documento
      pdf.setFontSize(12);
      pdf.text(`Tipo de Documento: ${tipo.label}`, 20, 80);
      pdf.text(`Número do Documento: ${documento.numero_documento}`, 20, 90);
      pdf.text(`Data de Emissão: ${formatarData(documento.data_emissao)}`, 20, 100);
      pdf.text(`Valor: ${formatarValor(documento.valor)}`, 20, 110);
      pdf.text(`Status: ${documento.status}`, 20, 120);
      
      if (documento.status === 'VALIDADO') {
        pdf.text(`Número da Sorte: ${documento.numero_sorteio}`, 20, 130);
      }
      
      // Adicionar informações de verificação
      pdf.setFontSize(11);
      const linhaVerificacao = "Para verificar a autenticidade deste documento, acesse o portal Contribuinte Legal.";
      pdf.text(linhaVerificacao, 105, 260, { align: 'center' });
      
      // Rodapé
      pdf.setFontSize(10);
      pdf.text('Este documento é parte do programa Contribuinte Legal', 105, 280, { align: 'center' });
      pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, 285, { align: 'center' });
      
      // Salvar o PDF
      pdf.save(`comprovante_${documento.numero_documento}.pdf`);
      
      toast.success('PDF gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar o PDF');
    }
  };

  const baixarDocumento = async (arquivo_url: string) => {
    try {
      const { data, error } = await supabase.storage.from('documentos').download(arquivo_url);
      
      if (error) throw error;
      
      // Criar URL para download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = arquivo_url.split('/').pop() || 'documento';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Erro ao baixar documento:', error);
      toast.error('Erro ao baixar documento');
    }
  };

  const gerarPDFMultiplos = async () => {
    try {
      if (documentosSelecionados.length === 0) {
        toast.error('Selecione pelo menos um documento para imprimir');
        return;
      }

      // Gerar PDF para cada documento selecionado
      const docsParaImprimir = documentosFiltrados.filter(doc => 
        documentosSelecionados.includes(doc.id)
      );

      for (const doc of docsParaImprimir) {
        await gerarPDF(doc);
      }

      // Após imprimir, sair do modo seleção
      setModoSelecao(false);
      setDocumentosSelecionados([]);
      
      toast.success(`${docsParaImprimir.length} documentos impressos com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao gerar PDFs em lote:', error);
      toast.error('Erro ao gerar PDFs');
    }
  };

  const toggleSelecaoDocumento = (id: string) => {
    setDocumentosSelecionados(prevSelecionados => {
      if (prevSelecionados.includes(id)) {
        return prevSelecionados.filter(docId => docId !== id);
      } else {
        return [...prevSelecionados, id];
      }
    });
  };

  const toggleModoSelecao = () => {
    setModoSelecao(!modoSelecao);
    if (modoSelecao) {
      // Saindo do modo seleção, limpar seleções
      setDocumentosSelecionados([]);
    }
  };

  const limparFiltros = () => {
    setFiltro('todos');
    setFiltroStatus('todos');
  };

  return (
    <Layout isAuthenticated>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Meus Documentos</h1>
          <p className="text-gray-600">
            Gerencie todos os seus documentos fiscais cadastrados
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex space-x-2">
          {modoSelecao ? (
            <>
              <Button 
                variant="success" 
                icon={FaPrint}
                onClick={gerarPDFMultiplos}
                className="text-sm"
                disabled={documentosSelecionados.length === 0}
              >
                Imprimir Selecionados ({documentosSelecionados.length})
              </Button>
              <Button 
                variant="secondary"
                onClick={toggleModoSelecao}
                className="text-sm"
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="secondary" 
                icon={FaPrint}
                onClick={toggleModoSelecao}
                className="text-sm mr-2"
              >
                Modo Seleção
              </Button>
              <Link href="/meus-documentos/cadastrar">
                <Button variant="primary" icon={FaPlus}>
                  Novo Documento
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
      
      {/* Filtros */}
      <Card className="mb-6 bg-white shadow-lg rounded-lg">
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={filtro === 'todos' ? 'primary' : 'secondary'}
            onClick={() => handleFiltroChange('todos')}
            className="text-sm"
          >
            Todos
          </Button>
          <Button 
            variant={filtro === 'nota_servico' ? 'primary' : 'secondary'}
            onClick={() => handleFiltroChange('nota_servico')}
            className="text-sm"
          >
            Notas de Serviço
          </Button>
          <Button 
            variant={filtro === 'nota_venda' ? 'primary' : 'secondary'}
            onClick={() => handleFiltroChange('nota_venda')}
            className="text-sm"
          >
            Cupons Fiscais
          </Button>
          <Button 
            variant={filtro === 'imposto' ? 'primary' : 'secondary'}
            onClick={() => handleFiltroChange('imposto')}
            className="text-sm"
          >
            Comprovantes de Impostos
          </Button>
        </div>
      </Card>
      
      {/* Filtro de Status */}
      <Card className="mb-6 bg-white shadow-lg rounded-lg">
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={filtroStatus === 'todos' ? 'primary' : 'secondary'}
            onClick={() => handleFiltroStatusChange('todos')}
            className="text-sm"
          >
            Todos
          </Button>
          <Button 
            variant={filtroStatus === 'VALIDADO' ? 'primary' : 'secondary'}
            onClick={() => handleFiltroStatusChange('VALIDADO')}
            className="text-sm"
          >
            Validados
          </Button>
          <Button 
            variant={filtroStatus === 'INVÁLIDO' ? 'primary' : 'secondary'}
            onClick={() => handleFiltroStatusChange('INVÁLIDO')}
            className="text-sm"
          >
            Inválidos
          </Button>
          <Button 
            variant={filtroStatus === 'AGUARDANDO VALIDAÇÃO' ? 'primary' : 'secondary'}
            onClick={() => handleFiltroStatusChange('AGUARDANDO VALIDAÇÃO')}
            className="text-sm"
          >
            Aguardando Validação
          </Button>
          
          <div className="ml-auto">
            <Button 
              variant="secondary"
              onClick={limparFiltros}
              className="text-sm"
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
      </Card>
      
      {/* Lista de Documentos */}
      {isLoading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : documentosFiltrados.length === 0 ? (
        <Card className="bg-white shadow-lg rounded-lg">
          <div className="text-center py-8">
            <FaFileAlt className="mx-auto text-4xl text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-700 mb-2">Nenhum documento encontrado</h3>
            <p className="text-gray-500 mb-6">
              {filtro === 'todos' 
                ? 'Você ainda não cadastrou nenhum documento.' 
                : 'Nenhum documento encontrado com o filtro selecionado.'}
            </p>
            <Link href="/meus-documentos/cadastrar">
              <Button variant="primary" icon={FaPlus}>
                Cadastrar Documento
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {documentosFiltrados.map((documento) => {
            const tipo = getTipoDocumento(documento.tipo);
            const statusConfig = getStatusConfig(documento.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <Card key={documento.id} className="bg-white shadow-md hover:shadow-lg transition-shadow rounded-lg overflow-hidden relative">
                <div className="flex flex-col sm:flex-row justify-between items-start">
                  {modoSelecao && (
                    <div 
                      className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border ${
                        documentosSelecionados.includes(documento.id) 
                          ? 'bg-blue-500 border-blue-500 text-white' 
                          : 'bg-white border-gray-300'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelecaoDocumento(documento.id);
                      }}
                    >
                      {documentosSelecionados.includes(documento.id) && (
                        <FaCheck className="text-xs" />
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <div className="p-2 rounded-full bg-blue-100 mr-3">
                        <tipo.icon className="text-blue-600 text-lg" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{tipo.label}</h3>
                        <p className="text-sm text-gray-500">#{documento.numero_documento}</p>
                      </div>
                      <div className="ml-auto sm:hidden">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className={`mr-1 ${statusConfig.iconColor}`} />
                          {documento.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Data de Emissão</p>
                        <p className="font-medium">{formatarData(documento.data_emissao)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Valor</p>
                        <p className="font-medium">{formatarValor(documento.valor)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Número da Sorte</p>
                        <p className="font-medium">{documento.status === 'VALIDADO' ? documento.numero_sorteio : '-'}</p>
                      </div>
                    </div>
                    
                    <div className="hidden sm:block">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon className={`mr-1 ${statusConfig.iconColor}`} />
                        {documento.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-row sm:flex-col justify-end space-y-0 space-x-2 sm:space-y-2 sm:space-x-0 mt-4 sm:mt-0">
                    <Button 
                      variant="info" 
                      icon={FaEye}
                      onClick={() => window.open(
                        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documentos/${documento.arquivo_url}`, 
                        '_blank'
                      )}
                      className="text-sm"
                    >
                      Visualizar
                    </Button>
                    
                    <Button 
                      variant="secondary" 
                      icon={FaDownload}
                      onClick={() => baixarDocumento(documento.arquivo_url)}
                      className="text-sm"
                    >
                      Baixar
                    </Button>

                    <Button 
                      variant="success" 
                      icon={FaPrint}
                      onClick={() => gerarPDF(documento)}
                      className="text-sm"
                    >
                      Imprimir
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Layout>
  );
} 