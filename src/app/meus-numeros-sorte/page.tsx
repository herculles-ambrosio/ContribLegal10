'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { FaTrophy, FaFileAlt, FaCalendarAlt, FaMoneyBillWave, FaEye, FaArrowLeft, FaSearch, FaFilter, FaStar, FaPrint, FaFilePdf } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { getUsuarioLogado } from '@/lib/auth';
import jsPDF from 'jspdf';

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

type NumeroSorteCompleto = {
  id: string;
  numero_sorte: string;
  created_at: string;
  documento: {
    id: string;
    tipo: string;
    numero_documento: string;
    data_emissao: string;
    valor: number;
    status: string;
  };
};

export default function MeusNumerosSorte() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [numerosSorte, setNumerosSorte] = useState<NumeroSorteCompleto[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [numerosFiltrados, setNumerosFiltrados] = useState<NumeroSorteCompleto[]>([]);

  useEffect(() => {
    const verificarAutenticacao = async () => {
      try {
        const usuario = await getUsuarioLogado();
        
        if (!usuario) {
          toast.error('Você precisa estar logado para acessar esta página');
          router.push('/login');
          return;
        }
        
        setNomeUsuario(usuario.nome_completo || '');
        await carregarNumerosSorte();
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        toast.error('Erro ao verificar autenticação');
        router.push('/login');
      }
    };
    
    verificarAutenticacao();
  }, [router]);

  useEffect(() => {
    // Filtrar documentos baseado no termo de busca
    if (termoBusca.trim() === '') {
      setNumerosFiltrados(numerosSorte);
    } else {
      const termo = termoBusca.toLowerCase();
      const filtrados = numerosSorte.filter(doc => 
        doc.numero_sorte.toLowerCase().includes(termo) ||
        doc.documento.numero_documento.toLowerCase().includes(termo) ||
        doc.documento.tipo.toLowerCase().includes(termo)
      );
      setNumerosFiltrados(filtrados);
    }
  }, [termoBusca, numerosSorte]);

  const carregarNumerosSorte = async () => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      // Buscar todos os números da sorte do usuário com informações dos documentos
      const { data: numerosSorteData, error } = await supabase
        .from('numeros_sorte_documento')
        .select(`
          id,
          numero_sorte,
          created_at,
          documentos!inner (
            id,
            tipo,
            numero_documento,
            data_emissao,
            valor,
            status,
            usuario_id
          )
        `)
        .eq('documentos.usuario_id', session.user.id as any)
        .eq('documentos.status', 'VALIDADO' as any)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transformar os dados para o formato esperado
      const numerosSorteFormatados = numerosSorteData?.map((item: any) => ({
        id: item.id,
        numero_sorte: item.numero_sorte,
        created_at: item.created_at,
        documento: {
          id: item.documentos.id,
          tipo: item.documentos.tipo,
          numero_documento: item.documentos.numero_documento,
          data_emissao: item.documentos.data_emissao,
          valor: item.documentos.valor,
          status: item.documentos.status
        }
      })) || [];
      
      setNumerosSorte(numerosSorteFormatados);
      setNumerosFiltrados(numerosSorteFormatados);
    } catch (error: any) {
      console.error('Erro ao carregar números da sorte:', error);
      toast.error('Erro ao carregar seus números da sorte');
    } finally {
      setIsLoading(false);
    }
  };

  const getTipoDocumento = (tipo: string) => {
    switch (tipo) {
      case 'nota_servico':
        return 'Nota Fiscal de Serviço';
      case 'cupom_fiscal':
        return 'Cupom Fiscal';
      case 'nota_venda':
        return 'Cupom Fiscal';
      case 'imposto':
        return 'Comprovante de Imposto';
      default:
        return 'Documento';
    }
  };

  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatarData = (dataISO: string) => {
    try {
      if (!dataISO) return '';
      
      if (dataISO.includes('T')) {
        const [dataParte] = dataISO.split('T');
        const [ano, mes, dia] = dataParte.split('-').map(num => parseInt(num, 10));
        if (ano && mes && dia) {
          return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
        }
      }
      
      if (dataISO.includes('-') && dataISO.split('-').length === 3) {
        const [ano, mes, dia] = dataISO.split('-').map(num => parseInt(num, 10));
        if (ano && mes && dia) {
          return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
        }
      }
      
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataISO)) {
        return dataISO;
      }
      
      return new Date(dataISO).toLocaleDateString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data:', error, dataISO);
      return dataISO;
    }
  };

  const formatarNumeroSorte = (numero: string) => {
    // Formatar o número da sorte para melhor visualização
    if (!numero) return numero;
    
    // Remove espaços e caracteres especiais
    const numeroLimpo = numero.replace(/\D/g, '');
    
    // Se tem 9 dígitos, formatar como XXX.XXX.XXX
    if (numeroLimpo.length === 9) {
      return `${numeroLimpo.slice(0, 3)}.${numeroLimpo.slice(3, 6)}.${numeroLimpo.slice(6, 9)}`;
    }
    
    // Se tem 8 dígitos, formatar como XX.XXX.XXX
    if (numeroLimpo.length === 8) {
      return `${numeroLimpo.slice(0, 2)}.${numeroLimpo.slice(2, 5)}.${numeroLimpo.slice(5, 8)}`;
    }
    
    // Se tem 6 dígitos, formatar como XXX.XXX
    if (numeroLimpo.length === 6) {
      return `${numeroLimpo.slice(0, 3)}.${numeroLimpo.slice(3, 6)}`;
    }
    
    // Para outros tamanhos, retornar como está
    return numero;
  };

  const gerarPDF = () => {
    try {
      const pdf = new jsPDF();
      
      // Configurar o PDF
      pdf.setFontSize(16);
      pdf.text('Meus Números da Sorte', 20, 20);
      
      pdf.setFontSize(12);
      pdf.text(`Contribuinte: ${nomeUsuario}`, 20, 35);
      pdf.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, 20, 45);
      pdf.text(`Total de Números: ${numerosFiltrados.length}`, 20, 55);
      
      // Linha separadora
      pdf.line(20, 65, 190, 65);
      
      // Cabeçalho da tabela
      pdf.setFontSize(10);
      let yPosition = 80;
      
      pdf.text('Número da Sorte', 20, yPosition);
      pdf.text('Tipo', 80, yPosition);
      pdf.text('Data', 130, yPosition);
      pdf.text('Valor', 160, yPosition);
      
      // Linha do cabeçalho
      pdf.line(20, yPosition + 5, 190, yPosition + 5);
      yPosition += 15;
      
      // Dados dos números da sorte
      numerosFiltrados.forEach((documento, index) => {
        if (yPosition > 270) { // Nova página se necessário
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.text(formatarNumeroSorte(documento.numero_sorte), 20, yPosition);
        pdf.text(getTipoDocumento(documento.documento.tipo), 80, yPosition);
        pdf.text(formatarData(documento.documento.data_emissao), 130, yPosition);
        pdf.text(formatarValor(documento.documento.valor), 160, yPosition);
        
        yPosition += 10;
      });
      
      // Salvar o PDF
      pdf.save(`numeros_da_sorte_${nomeUsuario.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  return (
    <Layout isAuthenticated>
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/contribuinte">
            <Button variant="secondary" icon={FaArrowLeft} className="text-sm">
              Voltar ao Painel
            </Button>
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold mb-2 text-gray-900 flex items-center gap-3">
          <FaTrophy className="text-yellow-500" />
          Meus Números da Sorte
        </h1>
        <p className="text-gray-600 text-lg">
          Visualize todos os números da sorte gerados a partir dos seus documentos validados
        </p>
      </div>

      {/* Estatísticas Resumidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium mb-1">Total de Números</h3>
              <p className="text-3xl font-bold">{numerosSorte.length}</p>
              <p className="text-sm opacity-80">Números da sorte gerados</p>
            </div>
            <FaTrophy className="text-4xl opacity-80" />
          </div>
        </Card>
        
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium mb-1">Valor Total</h3>
              <p className="text-2xl font-bold">
                {formatarValor(numerosSorte.reduce((total, doc) => total + doc.documento.valor, 0))}
              </p>
              <p className="text-sm opacity-80">Documentos participantes</p>
            </div>
            <FaMoneyBillWave className="text-4xl opacity-80" />
          </div>
        </Card>
        
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium mb-1">Próximo Sorteio</h3>
              <p className="text-2xl font-bold">21/12/2025</p>
              <p className="text-sm opacity-80">Todos participam automaticamente</p>
            </div>
            <FaCalendarAlt className="text-4xl opacity-80" />
          </div>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número da sorte, documento ou tipo..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FaFilter className="text-gray-400" />
              <span>Mostrando apenas documentos validados</span>
            </div>
            {numerosFiltrados.length > 0 && (
              <Button 
                variant="primary" 
                icon={FaFilePdf} 
                onClick={gerarPDF}
                className="text-sm bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700"
              >
                Gerar PDF
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Lista de Números da Sorte */}
      <Card title={`Seus Números da Sorte (${numerosFiltrados.length})`}>
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        ) : numerosFiltrados.length === 0 ? (
          <div className="p-8 text-center">
            {termoBusca ? (
              <>
                <FaSearch className="text-4xl text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum resultado encontrado</h3>
                <p className="text-gray-600 mb-4">
                  Não encontramos números da sorte que correspondam aos critérios de busca.
                </p>
                <Button 
                  variant="secondary" 
                  onClick={() => setTermoBusca('')}
                  className="text-sm"
                >
                  Limpar Busca
                </Button>
              </>
            ) : (
              <>
                <FaTrophy className="text-4xl text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum número da sorte encontrado</h3>
                <p className="text-gray-600 mb-4">
                  Você ainda não possui documentos validados. Cadastre e valide seus documentos para gerar números da sorte.
                </p>
                <Link href="/meus-documentos/cadastrar">
                  <Button variant="primary" className="text-sm">
                    Cadastrar Documento
                  </Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    <div className="flex items-center gap-2">
                      <FaStar className="text-yellow-500" />
                      Número da Sorte
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Tipo</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Data</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Valor</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {numerosFiltrados.map((doc, index) => (
                  <tr key={doc.id} className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                          <FaTrophy className="text-sm" />
                        </div>
                        <div>
                          <p className="font-mono text-lg font-bold text-yellow-600">
                            {formatarNumeroSorte(doc.numero_sorte)}
                          </p>
                          <p className="text-xs text-gray-500">Número único</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getTipoDocumento(doc.documento.tipo)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-gray-900">{formatarData(doc.documento.data_emissao)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-gray-900">{formatarValor(doc.documento.valor)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <Link href={`/meus-documentos?highlight=${doc.documento.id}`}>
                        <Button variant="secondary" icon={FaEye} className="text-xs">
                          Ver Documento
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Informações sobre Sorteios */}
      <Card title="Como Funcionam os Sorteios" className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FaTrophy className="text-yellow-500" />
              Participação Automática
            </h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Cada documento validado gera um número da sorte único</li>
              <li>• Todos os números participam automaticamente dos sorteios</li>
              <li>• Quanto mais documentos válidos, mais chances de ganhar</li>
              <li>• Os números permanecem válidos para todos os sorteios futuros</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FaCalendarAlt className="text-blue-500" />
              Próximos Sorteios
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <span className="font-medium text-gray-900">Sorteio de Dezembro</span>
                <span className="text-yellow-700 font-semibold">21/12/2025</span>
              </div>
              <p className="text-gray-600 text-xs mt-2">
                * Os resultados serão divulgados no site e por email
              </p>
            </div>
          </div>
        </div>
      </Card>
    </Layout>
  );
} 