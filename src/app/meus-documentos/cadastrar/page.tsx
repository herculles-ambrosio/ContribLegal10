'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { FaFileInvoice, FaCalendarAlt, FaMoneyBillWave, FaUpload, FaQrcode, FaExternalLinkAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import useDeviceDetect from '@/hooks/useDeviceDetect';
import { extractDataFromFiscalReceipt } from '@/lib/services/fiscalReceiptService';
import LoadingModal from '@/components/ui/LoadingModal';

// Importar o scanner de QR code dinamicamente (apenas no cliente)
const QrCodeScanner = dynamic(() => import('@/components/QrCodeScanner'), {
  ssr: false, // Não renderizar no servidor
  loading: () => <p className="text-center py-4">Carregando scanner...</p>
});

type TipoDocumento = 'nota_servico' | 'cupom_fiscal' | 'imposto';

// Definir o tipo DocumentoInfo
interface DocumentoInfo {
  valor?: string;
  dataEmissao?: string;
}

export default function CadastrarDocumento() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const { isMobile } = useDeviceDetect();
  const [empresaStatus, setEmpresaStatus] = useState<string>('ATIVO');
  const [formData, setFormData] = useState({
    tipo: 'cupom_fiscal' as TipoDocumento,
    numero_documento: '',
    data_emissao: '',
    valor: '',
    arquivo: null as File | null
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState('Extraindo dados do cupom fiscal...');
  const [scannerLogs, setScannerLogs] = useState<string[]>([]); // Para armazenar logs do scanner
  const [showQrCodeScanner, setShowQrCodeScanner] = useState(false);
  const [isProcessingQrCode, setIsProcessingQrCode] = useState(false);
  const [documentoInfo, setDocumentoInfo] = useState<DocumentoInfo | null>(null);

  // Refs para acessar diretamente os inputs do DOM
  const numeroDocumentoRef = useRef<HTMLInputElement>(null);
  const valorRef = useRef<HTMLInputElement>(null);
  const dataEmissaoRef = useRef<HTMLInputElement>(null);

  const tiposDocumento = [
    { value: 'nota_servico', label: 'Nota Fiscal de Serviço' },
    { value: 'cupom_fiscal', label: 'Cupom Fiscal' },
    { value: 'imposto', label: 'Comprovante de Pagamento de Imposto' }
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Log especial para o campo tipo
    if (name === 'tipo') {
      console.log('Tipo de documento alterado para:', value);
    }
    
    // Tratamento especial para links de QR Code no campo numero_documento
    if (name === 'numero_documento') {
      // Se o valor atual é um link (começa com http ou https), verificar se o usuário está editando
      if ((formData.numero_documento.startsWith('http://') || formData.numero_documento.startsWith('https://')) &&
          value !== formData.numero_documento) {
        // Alerta para o usuário que editou um link válido de QR code
        console.warn("Alerta: Editando um link de QR code pode afetar a validação do documento");
        
        // Se o usuário apagou o link, podemos mostrar um toast de aviso
        if (value.length < 10 && formData.numero_documento.length > 20) {
          toast.error("Atenção: Editar o link do QR code pode afetar a validação. Prefira usar o scanner.");
        }
      }
    }
    
    // Tratamento especial para o campo valor
    if (name === 'valor') {
      // Remove tudo que não for número ou vírgula
      let numericValue = value.replace(/[^\d,]/g, '');
      
      // Garante apenas uma vírgula
      const parts = numericValue.split(',');
      let formattedValue = parts[0];
      
      // Adiciona parte decimal limitada a 2 casas
      if (parts.length > 1) {
        formattedValue += ',' + parts[1].slice(0, 2);
      }
      
      setFormData(prev => ({ ...prev, [name]: formattedValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Limpar erro quando o usuário começa a digitar
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Função para formatar o valor como moeda BRL quando o campo perde o foco
  const handleValorBlur = () => {
    if (formData.valor) {
      try {
        // Converte para número (substituindo vírgula por ponto)
        const valorTexto = formData.valor.replace(/\./g, '').replace(',', '.');
        const numeroValor = parseFloat(valorTexto);
        
        if (!isNaN(numeroValor)) {
          // Formata como valor monetário brasileiro (duas casas decimais)
          const valorFormatado = numeroValor.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
          
          setFormData(prev => ({ ...prev, valor: valorFormatado }));
        }
      } catch (error) {
        console.error('Erro ao formatar valor:', error);
        // Em caso de erro, deixa o valor como está
      }
    } else {
      // Se o campo estiver vazio, preenche com 0,00
      setFormData(prev => ({ ...prev, valor: '0,00' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, arquivo: file }));
    
    if (errors.arquivo) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.arquivo;
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.numero_documento) {
      newErrors.numero_documento = 'Número do documento é obrigatório';
    }
    
    if (!formData.data_emissao) {
      newErrors.data_emissao = 'Data de emissão é obrigatória';
    }
    
    if (!formData.valor) {
      newErrors.valor = 'Valor é obrigatório';
    } else {
      try {
        // Converte valores com formato brasileiro (vírgula como separador decimal)
        const valorTexto = formData.valor.replace(/\./g, '').replace(',', '.');
        const valorNumerico = parseFloat(valorTexto);
        
        if (isNaN(valorNumerico) || valorNumerico <= 0) {
          newErrors.valor = 'Valor deve ser um número positivo';
        }
      } catch (error) {
        newErrors.valor = 'Valor deve ser um número positivo';
      }
    }
    
    // Verificar arquivo apenas se não for cupom fiscal
    if (formData.tipo !== 'cupom_fiscal' && !formData.arquivo) {
      newErrors.arquivo = 'Arquivo é obrigatório';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Função para processar QR code
  const handleQrCodeScan = useCallback((qrCodeText: string) => {
    console.log("🔍 QR code lido:", qrCodeText);
    
    // Verificar se já estamos processando outro QR code
    if (isProcessingQrCode) {
      console.log("⚠️ Já existe processamento em andamento, ignorando nova leitura");
      return;
    }
    
    // Fechar scanner imediatamente
    setShowQrCodeScanner(false);
    
    try {
      // Marcar que estamos processando
      setIsProcessingQrCode(true);
      toast.success("QR Code detectado! Extraindo dados...");
      
      if (!qrCodeText || qrCodeText.trim() === '') {
        toast.error("QR code inválido ou vazio");
        setIsProcessingQrCode(false);
        return;
      }
      
      // Limpar e normalizar o texto do QR code
      const cleanQrCode = qrCodeText.trim();
      console.log("🔍 QR code normalizado:", cleanQrCode);
      
      // IMPORTANTE: Criar uma nova referência para o link para garantir que será preservada
      const originalLink = cleanQrCode;
      
      // PRIORIDADE MÁXIMA: Definir o link como número do documento IMEDIATAMENTE
      // para que ele esteja visível para o usuário o mais rápido possível
      setFormData(prev => ({ ...prev, numero_documento: originalLink }));
      
      // Atualizar interface imediatamente
      if (numeroDocumentoRef.current) {
        console.log("🔒 Garantindo QR code no DOM:", originalLink);
        numeroDocumentoRef.current.value = originalLink;
        try {
          const evento = new Event('input', { bubbles: true });
          numeroDocumentoRef.current.dispatchEvent(evento);
        } catch (e) {
          console.error("⚠️ Erro ao disparar evento input:", e);
        }
      }
      
      // Mostrar feedback que estamos processando o QR code
      setExtractionMessage('Extraindo dados do cupom fiscal...');
      setIsExtracting(true);
      
      // Manter uma REFERÊNCIA DIRETA ao link original que deve persistir durante todo o processamento
      console.log("🔒 Link original que será preservado:", originalLink);
      
      // Criar um timeout para garantir que o processamento não demore muito
      // Reduzir o tempo de timeout para melhorar a experiência do usuário
      const timeoutDuration = 10000; // 10 segundos máximo
      const extractionTimeoutId = setTimeout(() => {
        console.log("⏱️ TIMEOUT: Extração demorou muito tempo, cancelando");
        setIsExtracting(false);
        
        // Mesmo com timeout, garantir o número do documento
        setFormData(prev => ({
          ...prev,
          numero_documento: originalLink,
          valor: prev.valor || '0,00',
          data_emissao: prev.data_emissao || new Date().toISOString().split('T')[0]
        }));
        
        // Atualizar DOM
        if (numeroDocumentoRef.current) numeroDocumentoRef.current.value = originalLink;
        
        toast.error("Tempo de extração excedido. Os campos foram preenchidos com os dados disponíveis.");
        setIsProcessingQrCode(false);
        
        // Oferecer ao usuário a opção de tentar novamente o scanner
        setTimeout(() => {
          if (window.confirm("Deseja tentar escanear o QR code novamente?")) {
            handleOpenQrScanner();
          }
        }, 300);
      }, timeoutDuration);
      
      // Chamar API para extrair dados adicionais
      extractDataFromFiscalReceipt(cleanQrCode)
        .then((info) => {
          // Limpar timeout pois a resposta chegou
          clearTimeout(extractionTimeoutId);
          
          console.log("🔍 Dados extraídos do QR code:", info);
          
          // Atualizar estado do documento atual
          setDocumentoInfo(info);
          
          // Esconder modal de carregamento
          setIsExtracting(false);
          
          // VERIFICAÇÃO CRÍTICA: Garantir que o número do documento continua sendo o link original
          if (info.numeroDocumento !== originalLink) {
            console.warn("⚠️ ALERTA: Número do documento foi alterado pela API, restaurando link original");
          }
          
          // Atualizar todos os campos do formulário de uma vez
          setFormData(prev => ({ 
            ...prev, 
            numero_documento: originalLink, // SEMPRE GARANTIR QUE ESTE É O LINK ORIGINAL
            valor: info.valor || '0,00',
            data_emissao: formatarDataParaInput(info.dataEmissao)
          }));
          
          // Atualizar DOM diretamente para garantir que os dados sejam exibidos
          updateFormElementsDirect(originalLink, info.valor, info.dataEmissao);
          
          // Verificar se temos valor e data válidos
          const temDadosCompletos = info.valor && info.dataEmissao;
          
          // Notificar sucesso com toast
          if (temDadosCompletos) {
            toast.success("Dados extraídos com sucesso!");
          } else {
            toast.success("QR code registrado, mas alguns dados não puderam ser extraídos automáticamente.");
          }
          
          // Liberar processamento
          setIsProcessingQrCode(false);
        })
        .catch((error) => {
          // Limpar timeout em caso de erro
          clearTimeout(extractionTimeoutId);
          console.error("❌ Erro ao extrair dados:", error);
          
          // Esconder modal de carregamento
          setIsExtracting(false);
          
          // Garantir que pelo menos o número do documento está preenchido
          setFormData(prev => ({
            ...prev,
            numero_documento: originalLink, // SEMPRE O LINK ORIGINAL
          }));
          
          if (numeroDocumentoRef.current) numeroDocumentoRef.current.value = originalLink;
          
          // Mostrar erro ao usuário com mensagem mais clara
          toast.error("Não foi possível extrair todos os dados do QR code. Verifique e complete os campos necessários.");
          
          // Liberar processamento
          setIsProcessingQrCode(false);
        });
    } catch (error) {
      console.error("❌ Erro ao processar QR code:", error);
      setIsExtracting(false);
      setIsProcessingQrCode(false);
      toast.error("Erro ao processar o QR code. Tente novamente ou preencha manualmente.");
    }
  }, [isProcessingQrCode]);

  // Função auxiliar para formatar data para o input do formulário
  const formatarDataParaInput = (dataString?: string): string => {
    if (!dataString) return new Date().toISOString().split('T')[0];
    
    try {
      // Se estiver no formato brasileiro DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataString)) {
        const [dia, mes, ano] = dataString.split('/');
        return `${ano}-${mes}-${dia}`;
      }
      
      // Se já estiver no formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
        return dataString;
      }
      
      // Fallback para data atual
      return new Date().toISOString().split('T')[0];
    } catch (e) {
      console.error("Erro ao formatar data:", e);
      return new Date().toISOString().split('T')[0];
    }
  };

  // Função auxiliar para atualizar os elementos do DOM diretamente
  const updateFormElementsDirect = (numeroDocumento: string, valor?: string, dataEmissao?: string) => {
    // Atualizar campo de número do documento
    if (numeroDocumentoRef.current) {
      numeroDocumentoRef.current.value = numeroDocumento;
      dispatchInputEvent(numeroDocumentoRef.current);
    }
    
    // Atualizar campo de valor se disponível
    if (valor && valorRef.current) {
      valorRef.current.value = valor;
      dispatchInputEvent(valorRef.current);
    }
    
    // Atualizar campo de data se disponível
    if (dataEmissao && dataEmissaoRef.current) {
      const dataFormatada = formatarDataParaInput(dataEmissao);
      dataEmissaoRef.current.value = dataFormatada;
      dispatchInputEvent(dataEmissaoRef.current);
    }
  };

  // Função auxiliar para disparar evento de input
  const dispatchInputEvent = (element: HTMLInputElement) => {
    try {
      const evento = new Event('input', { bubbles: true });
      element.dispatchEvent(evento);
    } catch (e) {
      console.error("Erro ao disparar evento input:", e);
    }
  };

  // Função para lidar com erros no scanner
  const handleScannerError = useCallback((error: any) => {
    console.error("Erro no scanner:", error);
    
    // Fechar o scanner
    setShowQrCodeScanner(false);
    setIsProcessingQrCode(false);
    
    // Determinar mensagem de erro apropriada
    let errorMessage = "Erro ao ler QR code. Tente novamente.";
    
    if (typeof error === 'string') {
      if (error.includes('denied') || error.includes('permission')) {
        errorMessage = "Acesso à câmera negado. Verifique as permissões do navegador.";
      } else if (error.includes('not found') || error.includes('no camera')) {
        errorMessage = "Nenhuma câmera encontrada no dispositivo.";
      }
    }
    
    toast.error(errorMessage);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Verificar se o usuário está autenticado
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Você precisa estar logado para cadastrar documentos');
      }
      
      const userId = session.user.id;
      
      let uploadData: { path?: string } | null = null;
      
      // Processar o upload do arquivo apenas se não for cupom fiscal ou se um arquivo foi fornecido
      if (formData.tipo !== 'cupom_fiscal' && formData.arquivo) {
        // Verificar tamanho do arquivo
        if (formData.arquivo.size > 5 * 1024 * 1024) {
          throw new Error('O arquivo não pode ser maior que 5MB');
        }
        
        // Verificar tipo do arquivo
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(formData.arquivo.type)) {
          throw new Error('Tipo de arquivo não permitido. Use apenas PDF, JPG ou PNG');
        }
        
        // Gerar nome único para o arquivo
        const fileExt = formData.arquivo.name.split('.').pop()?.toLowerCase();
        if (!fileExt || !['pdf', 'jpg', 'jpeg', 'png'].includes(fileExt)) {
          throw new Error('Extensão de arquivo inválida');
        }
        
        const fileName = `${userId}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        
        console.log('Iniciando upload do arquivo...', {
          fileName,
          fileSize: formData.arquivo.size,
          fileType: formData.arquivo.type
        });
        
        // Fazer upload do arquivo para o Supabase Storage
        const { error: uploadError, data } = await supabase
          .storage
          .from('documentos')
          .upload(fileName, formData.arquivo, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) {
          console.error('Erro detalhado no upload:', uploadError);
          throw new Error(`Erro no upload do arquivo: ${uploadError.message}`);
        }
        
        if (!data?.path) {
          throw new Error('Erro ao obter o caminho do arquivo após upload');
        }
        
        uploadData = data;
        console.log('Arquivo enviado com sucesso:', uploadData);
      }
      
      // Gerar número aleatório para sorteio (entre 000000000 e 999999999)
      const numeroSorteio = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
      
      console.log('Criando registro do documento...');
      
      // Formatar o valor para garantir 2 casas decimais (convertendo vírgula para ponto)
      const valorTexto = formData.valor.replace(/\./g, '').replace(',', '.');
      const valorNumerico = parseFloat(valorTexto);
      const valorFormatado = parseFloat(valorNumerico.toFixed(2));
      
      // Preparar os dados a serem inseridos
      const documentoData = {
        usuario_id: userId,
        tipo: formData.tipo as string,
        numero_documento: formData.numero_documento,
        data_emissao: formData.data_emissao,
        valor: valorFormatado,
        arquivo_url: uploadData?.path || null,
        numero_sorteio: numeroSorteio,
        status: 'AGUARDANDO VALIDAÇÃO' as string
      };
      
      console.log('Dados a serem inseridos:', documentoData);
      
      // Criar registro do documento no banco de dados
      const { error: insertError } = await supabase
        .from('documentos')
        .insert(documentoData as any);
      
      if (insertError) {
        console.error('Erro ao inserir documento:', insertError);
        
        // Se houver erro na inserção e tiver arquivo, tentar removê-lo
        if (uploadData?.path) {
          console.log('Removendo arquivo após erro na inserção...');
          const { error: removeError } = await supabase
            .storage
            .from('documentos')
            .remove([uploadData.path]);
            
          if (removeError) {
            console.error('Erro ao remover arquivo:', removeError);
          }
        }
        
        throw new Error(`Erro ao cadastrar documento: ${insertError.message}`);
      }
      
      console.log('Documento cadastrado com sucesso!');
      toast.success(`Documento cadastrado com sucesso!`);
      router.push('/meus-documentos');
      
    } catch (error: any) {
      console.error('Erro completo ao cadastrar documento:', error);
      toast.error(error.message || 'Ocorreu um erro ao cadastrar o documento');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para verificar se o texto é uma URL válida
  const isValidUrl = (text: string): boolean => {
    try {
      new URL(text);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Função para abrir o link do cupom fiscal
  const handleOpenLink = (url: string) => {
    if (isValidUrl(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Modificação na função de abertura do scanner para ser mais rápida
  const handleOpenQrScanner = async () => {
    // Verificar se o navegador suporta API de câmera
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Seu navegador não suporta acesso à câmera');
      return;
    }

    try {
      // Reset dos estados antes de abrir o scanner
      setIsProcessingQrCode(false);
      
      // Mostrar toast para feedback imediato
      toast.success("Preparando scanner de QR code...");
      
      // Mostrar modal de carregamento brevemente para indicar que estamos preparando o scanner
      setExtractionMessage('Ativando câmera para leitura do QR code...');
      setIsExtracting(true);
      
      // Inicializar scanner mais rapidamente
      setTimeout(() => {
        setIsExtracting(false);
        setShowQrCodeScanner(true);
      }, 1000);  // Apenas 1s de carregamento para feedback
      
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      setIsExtracting(false);
      setCameraPermission(false);
      toast.error('Não foi possível acessar a câmera. Verifique as permissões do seu navegador.');
    }
  };

  useEffect(() => {
    const verificarAutenticacao = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast.error('Você precisa estar logado para acessar esta página');
          router.push('/login');
          return;
        }

        // Verificar status da empresa
        const { data: empresaData, error: empresaError } = await supabase
          .from('empresa')
          .select('status')
          .single();

        if (!empresaError && empresaData && typeof empresaData === 'object' && 'status' in empresaData) {
          const statusDaEmpresa = empresaData.status as string; // Assumindo que status é string
          setEmpresaStatus(statusDaEmpresa);
          
          if (statusDaEmpresa === 'BLOQUEADO') {
            toast.error('O Contribuinte Legal encontra-se BLOQUEADO no momento');
            await supabase.auth.signOut();
            router.push('/');
            return;
          }

          if (statusDaEmpresa === 'INATIVO') {
            toast.error('O Contribuinte Legal encontra-se INATIVO no momento. Não é possível cadastrar novos documentos.');
            router.push('/contribuinte');
            return;
          }
        } else if (empresaError) {
          // Tratar o erro da query da empresa se necessário, ou logar
          console.error('Erro ao buscar status da empresa:', empresaError);
          toast.error('Não foi possível verificar o status da empresa. Tente novamente.');
          router.push('/login'); // Ou uma página de erro apropriada
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        toast.error('Erro ao verificar autenticação');
        router.push('/login');
      }
    };
    
    verificarAutenticacao();
  }, [router]);

  return (
    <Layout isAuthenticated>
      <div className="flex justify-center items-center min-h-[70vh]">
        <Card className="max-w-2xl w-full p-6 shadow-xl" variant="blue-gradient">
          <div className="flex flex-col items-center mb-8">
            <Image 
              src="/LOGO_CL_trans.png" 
              alt="Contribuinte Legal" 
              width={180} 
              height={70} 
              className="mb-6" 
              priority
              style={{ objectFit: 'contain' }}
            />
            <h1 className="text-3xl font-bold text-center text-white">Cadastrar Novo Documento</h1>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="form-group">
                <label htmlFor="tipo" className="block mb-2 text-sm font-medium text-white">
                  Tipo de Documento
                </label>
                <select
                  id="tipo"
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                  className="block w-full px-4 py-2 border border-blue-400/30 bg-blue-900/20 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {tiposDocumento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="relative">
                <Input 
                  label="Número do Documento"
                  name="numero_documento" 
                  placeholder="Número da nota ou comprovante"
                  icon={FaFileInvoice}
                  value={formData.numero_documento} 
                  onChange={handleChange} 
                  error={errors.numero_documento}
                  fullWidth
                  required
                  variant="dark"
                  className="pr-24"
                  ref={numeroDocumentoRef}
                />
               
                <div className="absolute right-2 top-9 flex items-center space-x-2 z-10">
                  {formData.tipo === 'cupom_fiscal' && isValidUrl(formData.numero_documento) && (
                    <Button
                      type="button"
                      variant="info"
                      onClick={() => handleOpenLink(formData.numero_documento)}
                      className="w-8 h-8 min-w-[2rem] flex items-center justify-center rounded-full"
                      aria-label="Abrir link do cupom fiscal"
                      title="Abrir link do cupom fiscal"
                    >
                      <FaExternalLinkAlt size={16} />
                    </Button>
                  )}
                  {formData.tipo === 'cupom_fiscal' && isMobile && (
                    <Button
                      type="button"
                      variant="info"
                      onClick={handleOpenQrScanner}
                      disabled={showQrCodeScanner || isProcessingQrCode}
                      className="w-8 h-8 min-w-[2rem] flex items-center justify-center rounded-full"
                      aria-label="Ler QR Code"
                    >
                      <FaQrcode size={16} />
                    </Button>
                  )}
                  {formData.tipo === 'cupom_fiscal' && !isMobile && (
                    <span className="text-xs text-blue-300 italic ml-1 mr-2">
                      Scanner disponível apenas em dispositivos móveis
                    </span>
                  )}
                </div>
              </div>
              
              <div className="relative">
                <label htmlFor="data_emissao" className="block mb-2 text-sm font-medium text-white">
                  <FaCalendarAlt className="inline mr-2" />
                  Data de Emissão
                </label>
                <input
                  type="date"
                  id="data_emissao"
                  name="data_emissao"
                  value={formData.data_emissao}
                  onChange={handleChange}
                  className={`block w-full px-4 py-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 
                    transition-all duration-200 ease-in-out bg-blue-900/30 border
                    ${errors.data_emissao ? 'border-red-500' : 'border-blue-400/30'} 
                    text-white placeholder-blue-200/60 focus:ring-blue-400 focus:border-blue-300
                    [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert
                    [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100
                    sm:text-base text-sm`}
                  required
                  ref={dataEmissaoRef}
                />
                {errors.data_emissao && (
                  <p className="mt-2 text-sm text-red-600">{errors.data_emissao}</p>
                )}
              </div>
              
              <div className="relative">
                <label htmlFor="valor" className="block mb-2 text-sm font-medium text-white">
                  Valor (R$)
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaMoneyBillWave className="text-blue-300" />
                  </div>
                  <input
                    type="text"
                    name="valor"
                    id="valor"
                    className={`pl-10 block w-full border rounded-md py-2 px-3 bg-blue-900/20 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                      errors.valor ? 'border-red-500' : 'border-blue-400/30'
                    }`}
                    placeholder="0,00"
                    value={formData.valor}
                    onChange={handleChange}
                    onBlur={handleValorBlur}
                    required
                    ref={valorRef}
                  />
                </div>
                {errors.valor && (
                  <p className="mt-1 text-sm text-red-400">{errors.valor}</p>
                )}
                <p className="mt-1 text-xs text-blue-200">
                  Digite o valor no formato: 1234,56 (use vírgula como separador decimal)
                </p>
              </div>
              
              {formData.tipo !== 'cupom_fiscal' && (
                <div>
                  <label htmlFor="arquivo" className="block mb-2 text-sm font-medium text-white">
                    Arquivo do Documento
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col w-full h-32 border-2 border-dashed border-blue-400/30 bg-blue-900/10 rounded-lg cursor-pointer hover:bg-blue-800/20 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-7">
                        <FaUpload className="w-8 h-8 text-blue-300" />
                        <p className="pt-1 text-sm text-blue-200">
                          {formData.arquivo 
                            ? formData.arquivo.name 
                            : 'Clique para selecionar ou arraste o arquivo aqui'}
                        </p>
                      </div>
                      <input 
                        id="arquivo" 
                        name="arquivo" 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg,.png" 
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  {errors.arquivo && (
                    <p className="mt-2 text-sm text-red-400">{errors.arquivo}</p>
                  )}
                  <p className="mt-1 text-xs text-blue-200">
                    Formatos aceitos: PDF, JPG, JPEG, PNG (máx. 5MB)
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-4 mt-8 justify-end">
              <Button 
                type="button" 
                variant="secondary"
                onClick={() => router.push('/meus-documentos')}
                className="text-xs md:text-base"
              >
                Cancelar
              </Button>
              
              <Button 
                type="submit" 
                variant="primary" 
                isLoading={isLoading}
                className="py-3 text-xs md:text-base font-medium shadow-lg hover:shadow-blue-500/50 transition-all duration-300"
                animated
              >
                Cadastrar
              </Button>
            </div>
          </form>
          
          {showQrCodeScanner && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80" onClick={() => setShowQrCodeScanner(false)}>
              <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-lg max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                    Escanear QR Code
                  </h3>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowQrCodeScanner(false)}
                    className="text-sm p-2"
                    aria-label="Fechar"
                  >
                    ✕
                  </Button>
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  <p className="font-medium mb-1">Para melhor resultado:</p>
                  <ul className="list-disc ml-5 space-y-1 text-xs">
                    <li>Certifique-se de que o QR Code está bem iluminado</li>
                    <li>Posicione o código dentro da área destacada</li>
                    <li>Mantenha o celular estável durante a leitura</li>
                    <li>Use o botão de lanterna se necessário</li>
                  </ul>
                </div>
                
                <QrCodeScanner 
                  onScanSuccess={handleQrCodeScan}
                  onScanError={handleScannerError}
                  onDebugLog={(msg) => console.log(msg)}
                />
                
                <div className="mt-3 text-center">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowQrCodeScanner(false)}
                    className="w-full"
                  >
                    Cancelar Leitura
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {isExtracting && (
            <LoadingModal
              isOpen={isExtracting}
              message={extractionMessage}
            />
          )}
        </Card>
      </div>
    </Layout>
  );
} 