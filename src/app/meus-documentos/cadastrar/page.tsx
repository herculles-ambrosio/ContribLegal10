'use client';

import { useState, useEffect, useRef } from 'react';
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

  const handleScanQR = async () => {
    // Verificar se o navegador suporta API de câmera
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Seu navegador não suporta acesso à câmera');
      return;
    }

    try {
      // Solicitar permissão para usar a câmera
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      
      // Fechar stream imediatamente para não consumir recursos
      stream.getTracks().forEach(track => track.stop());
      
      // Definir que temos permissão e mostrar scanner
      setCameraPermission(true);
      setShowScanner(true);
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      setCameraPermission(false);
      toast.error('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const handleQrCodeResult = async (result: string) => {
    console.log('DEBUG > ============ INÍCIO DO PROCESSAMENTO DO QR CODE ============');
    console.log('DEBUG > QR Code detectado (valor original):', result);
    
    // Salvar o QR code original para uso em caso de problemas
    const originalQrCode = result.trim();
    console.log('DEBUG > QR Code normalizado:', originalQrCode);
    
    // SOLUÇÃO RADICAL: Definir o valor diretamente via DOM além do React state
    if (numeroDocumentoRef.current) {
      console.log('DEBUG > Definindo número_documento via ref DOM:', originalQrCode);
      numeroDocumentoRef.current.value = originalQrCode;
    }
    
    // Também atualizar via state para manter consistência
    console.log('DEBUG > Definindo número_documento via setState:', originalQrCode);
    setFormData(prev => {
      const newState = { ...prev, numero_documento: originalQrCode };
      console.log('DEBUG > Estado do formulário atualizado (número documento):', newState);
      return newState;
    });
    
    // REDUNDÂNCIA: Definir novamente após um pequeno delay
    setTimeout(() => {
      // Verificar se o valor foi realmente definido
      console.log('DEBUG > Verificando se o valor do número do documento foi mantido...');
      
      // Verificar via DOM
      if (numeroDocumentoRef.current && numeroDocumentoRef.current.value !== originalQrCode) {
        console.log('DEBUG > Valor DOM perdido! Redefinindo número_documento via DOM:', originalQrCode);
        numeroDocumentoRef.current.value = originalQrCode;
      }
      
      // Verificar via state
      if (formData.numero_documento !== originalQrCode) {
        console.log('DEBUG > Valor state perdido! Redefinindo número_documento via setState:', originalQrCode);
        setFormData(prev => ({ ...prev, numero_documento: originalQrCode }));
      }
    }, 300);
    
    // Fechar o scanner automaticamente
    setShowScanner(false);
    
    // Mostrar modal de carregamento com mensagem mais descritiva
    setExtractionMessage('Extraindo dados do cupom fiscal - isso pode demorar alguns segundos...');
    setIsExtracting(true);
    
    try {
      // Tentar extrair dados adicionais do cupom fiscal
      console.log('DEBUG > Iniciando extração de dados do cupom fiscal:', originalQrCode);
      const fiscalReceiptData = await extractDataFromFiscalReceipt(originalQrCode);
      console.log('DEBUG > Dados extraídos completos:', JSON.stringify(fiscalReceiptData));
      
      // Esconder modal de carregamento
      setIsExtracting(false);
      
      // Atualizações para cada campo
      handleFieldUpdate('numero_documento', originalQrCode);
      
      // Processar valor
      if (fiscalReceiptData.valor) {
        try {
          console.log('DEBUG > Processando valor:', fiscalReceiptData.valor);
          // Converter para formato brasileiro
          let valorNumerico = processarValor(fiscalReceiptData.valor);
          if (!isNaN(valorNumerico)) {
            const valorFormatado = valorNumerico.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
            
            // Atualizar o campo de valor
            handleFieldUpdate('valor', valorFormatado);
          } else {
            // Valor padrão se não conseguir processar
            handleFieldUpdate('valor', '0,00');
          }
        } catch (e) {
          console.error('DEBUG > Erro ao processar valor:', e);
          handleFieldUpdate('valor', '0,00');
        }
      } else {
        // Valor padrão se não tiver valor
        handleFieldUpdate('valor', '0,00');
      }
      
      // Processar data de emissão
      if (fiscalReceiptData.dataEmissao) {
        try {
          console.log('DEBUG > Processando data:', fiscalReceiptData.dataEmissao);
          // Converter para formato YYYY-MM-DD
          const dataFormatada = processarData(fiscalReceiptData.dataEmissao);
          if (dataFormatada) {
            // Atualizar o campo de data
            handleFieldUpdate('data_emissao', dataFormatada);
          } else {
            // Data padrão (hoje) se não conseguir processar
            const hoje = new Date().toISOString().split('T')[0];
            handleFieldUpdate('data_emissao', hoje);
          }
        } catch (e) {
          console.error('DEBUG > Erro ao processar data:', e);
          const hoje = new Date().toISOString().split('T')[0];
          handleFieldUpdate('data_emissao', hoje);
        }
      } else {
        // Data padrão (hoje) se não tiver data
        const hoje = new Date().toISOString().split('T')[0];
        handleFieldUpdate('data_emissao', hoje);
      }
      
      // Feedback ao usuário
      toast.success('QR Code processado com sucesso! Verifique os dados preenchidos.');
      
      // VERIFICAÇÃO FINAL - garantir que os valores foram aplicados
      setTimeout(() => {
        verificarPreenchimentoCampos(originalQrCode);
      }, 500);
      
      console.log('DEBUG > ============ FIM DO PROCESSAMENTO DO QR CODE ============');
      
    } catch (extractionError) {
      // Esconder modal de carregamento em caso de erro
      setIsExtracting(false);
      console.error('DEBUG > Erro crítico ao extrair dados:', extractionError);
      toast.error('Falha ao extrair dados do QR code. Preenchendo campos obrigatórios.');
      
      // Mesmo em caso de erro, garantir que o número do documento seja preenchido
      handleFieldUpdate('numero_documento', originalQrCode);
      
      // Preencher com valores padrão em caso de erro
      handleFieldUpdate('valor', '0,00');
      const hoje = new Date().toISOString().split('T')[0];
      handleFieldUpdate('data_emissao', hoje);
      
      console.log('DEBUG > ============ FIM COM ERRO DO PROCESSAMENTO DO QR CODE ============');
    }
  };
  
  // Função para processar valor em qualquer formato para número
  const processarValor = (valorStr: string): number => {
    console.log('DEBUG > Processando valor bruto:', valorStr);
    
    // Limpar o valor
    const valorLimpo = String(valorStr).trim();
    
    // Verificar diferentes formatos
    if (valorLimpo.includes(',')) {
      // Formato brasileiro: 1.234,56
      return parseFloat(valorLimpo.replace(/\./g, '').replace(',', '.'));
    } else if (valorLimpo.includes('.')) {
      // Formato americano: 1,234.56
      return parseFloat(valorLimpo);
    } else if (/^\d+$/.test(valorLimpo)) {
      // Apenas números, verificar se é centavos ou inteiro
      const valorInt = parseInt(valorLimpo, 10);
      return valorInt > 999 ? valorInt / 100 : valorInt;
    }
    
    // Última tentativa - converter diretamente
    return parseFloat(valorLimpo);
  };
  
  // Função para processar data em qualquer formato para YYYY-MM-DD
  const processarData = (dataStr: string): string | null => {
    console.log('DEBUG > Processando data bruta:', dataStr);
    
    // Limpar a data
    const dataLimpa = String(dataStr).trim();
    
    // Verificar diferentes formatos
    // Formato DD/MM/YYYY
    const formatoBR = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const matchBR = dataLimpa.match(formatoBR);
    if (matchBR) {
      const [_, dia, mes, ano] = matchBR;
      return `${ano}-${mes}-${dia}`;
    }
    
    // Formato DD-MM-YYYY
    const formatoTraco = /^(\d{2})-(\d{2})-(\d{4})$/;
    const matchTraco = dataLimpa.match(formatoTraco);
    if (matchTraco) {
      const [_, dia, mes, ano] = matchTraco;
      return `${ano}-${mes}-${dia}`;
    }
    
    // Formato YYYY-MM-DD (já no formato correto)
    const formatoISO = /^(\d{4})-(\d{2})-(\d{2})$/;
    const matchISO = dataLimpa.match(formatoISO);
    if (matchISO) {
      return dataLimpa;
    }
    
    // Não conseguiu reconhecer o formato
    return null;
  };
  
  // Função para atualizar campos com dupla garantia (state + DOM)
  const handleFieldUpdate = (fieldName: string, value: string) => {
    console.log(`DEBUG > Atualizando campo ${fieldName} com valor:`, value);
    
    // Atualizar via state
    setFormData(prev => {
      const newState = { ...prev, [fieldName]: value };
      console.log(`DEBUG > Novo estado para ${fieldName}:`, newState);
      return newState;
    });
    
    // Atualizar via DOM direto
    try {
      // Selecionar o elemento apropriado
      let inputElement: HTMLInputElement | null = null;
      
      if (fieldName === 'numero_documento' && numeroDocumentoRef.current) {
        inputElement = numeroDocumentoRef.current;
      } else if (fieldName === 'valor' && valorRef.current) {
        inputElement = valorRef.current;
      } else if (fieldName === 'data_emissao' && dataEmissaoRef.current) {
        inputElement = dataEmissaoRef.current;
      } else {
        // Buscar pelo nome do campo como fallback
        inputElement = document.querySelector(`input[name="${fieldName}"]`) as HTMLInputElement;
      }
      
      if (inputElement) {
        console.log(`DEBUG > Atualizando DOM direto para ${fieldName}:`, value);
        inputElement.value = value;
        
        // Disparar eventos necessários para que o React detecte a mudança
        const event = new Event('input', { bubbles: true });
        inputElement.dispatchEvent(event);
        
        const changeEvent = new Event('change', { bubbles: true });
        inputElement.dispatchEvent(changeEvent);
      } else {
        console.log(`DEBUG > Elemento DOM não encontrado para ${fieldName}`);
      }
    } catch (error) {
      console.error(`DEBUG > Erro ao atualizar DOM para ${fieldName}:`, error);
    }
  };
  
  // Verificação final para garantir que os campos foram preenchidos corretamente
  const verificarPreenchimentoCampos = (qrCodeOriginal: string) => {
    console.log('DEBUG > Verificação final dos campos:');
    
    // Verificar número do documento
    if (formData.numero_documento !== qrCodeOriginal) {
      console.log('DEBUG > ERRO: número_documento não manteve o valor correto!');
      console.log(`DEBUG > Esperado: ${qrCodeOriginal}`);
      console.log(`DEBUG > Atual (state): ${formData.numero_documento}`);
      
      // Tentar corrigir
      handleFieldUpdate('numero_documento', qrCodeOriginal);
    } else {
      console.log('DEBUG > OK: número_documento tem o valor correto');
    }
    
    // Verificar se valor está preenchido
    if (!formData.valor) {
      console.log('DEBUG > ERRO: valor está vazio!');
      handleFieldUpdate('valor', '0,00');
    } else {
      console.log(`DEBUG > OK: valor está preenchido com ${formData.valor}`);
    }
    
    // Verificar se data está preenchida
    if (!formData.data_emissao) {
      console.log('DEBUG > ERRO: data_emissao está vazia!');
      const hoje = new Date().toISOString().split('T')[0];
      handleFieldUpdate('data_emissao', hoje);
    } else {
      console.log(`DEBUG > OK: data_emissao está preenchida com ${formData.data_emissao}`);
    }
  };
  
  // Handler para logs de depuração do scanner
  const handleScannerDebugLog = (message: string) => {
    console.log(message);
    setScannerLogs(prev => [...prev, message]);
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
        .insert(documentoData);
      
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
                  {formData.tipo === 'cupom_fiscal' && (
                    <Button
                      type="button"
                      variant="info"
                      onClick={handleScanQR}
                      disabled={showScanner}
                      className="w-8 h-8 min-w-[2rem] flex items-center justify-center rounded-full"
                      aria-label="Ler QR Code"
                    >
                      <FaQrcode size={16} />
                    </Button>
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
          
          {showScanner && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
              <div className="bg-white p-4 rounded-lg shadow-lg max-w-lg w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-blue-800">Ler QR Code do Cupom Fiscal</h3>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowScanner(false)}
                    className="text-sm p-2"
                    aria-label="Fechar"
                  >
                    ✕
                  </Button>
                </div>
                <div className="text-sm text-gray-600 mb-4 space-y-2">
                  <p className="font-medium">Para melhor resultado:</p>
                  <ul className="list-disc pl-5">
                    <li>Mantenha o QR Code bem iluminado</li>
                    <li>Posicione o código dentro da área destacada</li>
                    <li>Aproxime a câmera para códigos pequenos</li>
                    <li>Se necessário, use o botão de lanterna</li>
                  </ul>
                </div>
                <QrCodeScanner 
                  onScanSuccess={handleQrCodeResult}
                  onScanError={handleQrCodeError}
                  onDebugLog={handleScannerDebugLog}
                />
                <div className="mt-3 text-center">
                  <p className="text-xs text-gray-500">Se estiver com dificuldades para ler o QR Code, tente usar os botões acima para alternativas.</p>
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