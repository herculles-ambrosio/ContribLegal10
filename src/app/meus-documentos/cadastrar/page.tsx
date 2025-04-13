'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { FaFileInvoice, FaCalendarAlt, FaMoneyBillWave, FaUpload, FaQrcode } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import useDeviceDetect from '@/hooks/useDeviceDetect';

// Extender a interface Window para incluir nossa propriedade
declare global {
  interface Window {
    qrErrorShown?: boolean;
  }
}

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
  const [formData, setFormData] = useState({
    tipo: 'cupom_fiscal' as TipoDocumento,
    numero_documento: '',
    data_emissao: '',
    valor: '',
    arquivo: null as File | null
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    
    if (!formData.arquivo) {
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

  const handleQrCodeResult = (result: string) => {
    // Substituir o valor do campo de número de documento com o resultado do QR code
    setFormData(prev => ({ ...prev, numero_documento: result }));
    
    // Fechar o scanner automaticamente
    setShowScanner(false);
    
    toast.success('QR Code lido com sucesso!');
  };

  const handleQrCodeError = (error: any) => {
    console.error('Erro na leitura do QR code:', error);
    
    // Mensagens mais específicas baseadas no tipo de erro
    let errorMessage = 'Erro ao ler o QR code. Tente novamente.';
    
    if (typeof error === 'string') {
      if (error.includes('Camera access denied')) {
        errorMessage = 'Acesso à câmera negado. Verifique as permissões.';
      } else if (error.includes('No cameras detected')) {
        errorMessage = 'Nenhuma câmera detectada no dispositivo.';
      } else if (error.includes('Falha ao acessar as câmeras')) {
        errorMessage = 'Falha ao acessar as câmeras. Verifique as permissões.';
      }
    }
    
    // Evitar mostrar o mesmo erro repetidamente em um curto período
    if (!window.qrErrorShown) {
      window.qrErrorShown = true;
      toast.error(errorMessage);
      
      // Limpar a flag após um tempo
      setTimeout(() => {
        window.qrErrorShown = false;
      }, 5000);
    }
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
      
      // Verificar tamanho do arquivo
      if (formData.arquivo && formData.arquivo.size > 5 * 1024 * 1024) {
        throw new Error('O arquivo não pode ser maior que 5MB');
      }
      
      // Verificar tipo do arquivo
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (formData.arquivo && !allowedTypes.includes(formData.arquivo.type)) {
        throw new Error('Tipo de arquivo não permitido. Use apenas PDF, JPG ou PNG');
      }
      
      // Gerar nome único para o arquivo
      const fileExt = formData.arquivo!.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !['pdf', 'jpg', 'jpeg', 'png'].includes(fileExt)) {
        throw new Error('Extensão de arquivo inválida');
      }
      
      const fileName = `${userId}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      
      console.log('Iniciando upload do arquivo...', {
        fileName,
        fileSize: formData.arquivo!.size,
        fileType: formData.arquivo!.type
      });
      
      // Fazer upload do arquivo para o Supabase Storage
      const { error: uploadError, data: uploadData } = await supabase
        .storage
        .from('documentos')
        .upload(fileName, formData.arquivo!, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        console.error('Erro detalhado no upload:', uploadError);
        throw new Error(`Erro no upload do arquivo: ${uploadError.message}`);
      }
      
      if (!uploadData?.path) {
        throw new Error('Erro ao obter o caminho do arquivo após upload');
      }
      
      console.log('Arquivo enviado com sucesso:', uploadData);
      
      // Gerar número aleatório para sorteio (entre 000000000 e 999999999)
      const numeroSorteio = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
      
      console.log('Criando registro do documento...');
      console.log('Tipo de documento selecionado:', formData.tipo);
      
      // Formatar o valor para garantir 2 casas decimais (convertendo vírgula para ponto)
      const valorTexto = formData.valor.replace(/\./g, '').replace(',', '.');
      const valorNumerico = parseFloat(valorTexto);
      const valorFormatado = parseFloat(valorNumerico.toFixed(2));
      
      // Preparar os dados a serem inseridos
      const documentoData = {
        usuario_id: userId,
        tipo: formData.tipo, // Garantir que usamos o valor selecionado corretamente
        numero_documento: formData.numero_documento,
        data_emissao: formData.data_emissao,
        valor: valorFormatado,
        arquivo_url: uploadData.path,
        numero_sorteio: numeroSorteio,
        status: 'AGUARDANDO VALIDAÇÃO'
      };
      
      console.log('Dados a serem inseridos:', documentoData);
      
      // Criar registro do documento no banco de dados
      const { error: insertError } = await supabase
        .from('documentos')
        .insert(documentoData);
      
      if (insertError) {
        console.error('Erro ao inserir documento:', insertError);
        
        // Se houver erro na inserção, tentar remover o arquivo
        console.log('Removendo arquivo após erro na inserção...');
        const { error: removeError } = await supabase
          .storage
          .from('documentos')
          .remove([uploadData.path]);
          
        if (removeError) {
          console.error('Erro ao remover arquivo:', removeError);
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
                />
              </div>
              
              <Input
                label="Data de Emissão"
                name="data_emissao"
                type="date"
                icon={FaCalendarAlt}
                value={formData.data_emissao}
                onChange={handleChange}
                error={errors.data_emissao}
                fullWidth
                required
                variant="dark"
              />
              
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
                  />
                </div>
                {errors.valor && (
                  <p className="mt-1 text-sm text-red-400">{errors.valor}</p>
                )}
                <p className="mt-1 text-xs text-blue-200">
                  Digite o valor no formato: 1234,56 (use vírgula como separador decimal)
                </p>
              </div>
              
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
            </div>
            
            <div className="flex items-center gap-4 mt-8 flex-nowrap w-full">
              <Button
                type="button"
                variant="info"
                onClick={handleScanQR}
                disabled={showScanner}
                className="w-10 h-10 min-w-[2.5rem] flex items-center justify-center rounded-full flex-shrink-0"
                aria-label="Escanear código QR"
                style={{ marginRight: '0.5rem' }}
              >
                <FaQrcode size={18} />
              </Button>
              <div className="flex gap-2 md:gap-4 justify-end ml-auto">
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
            </div>
          </form>
          
          {showScanner && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
              <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Escanear QR Code</h3>
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
                <p className="text-sm text-gray-500 mb-4">
                  Posicione o código QR no centro da câmera para escaneá-lo automaticamente.
                </p>
                <QrCodeScanner 
                  onScanSuccess={handleQrCodeResult}
                  onScanError={handleQrCodeError}
                />
              </div>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
} 