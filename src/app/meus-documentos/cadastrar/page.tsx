'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { FaFileInvoice, FaCalendarAlt, FaMoneyBillWave, FaUpload } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

type TipoDocumento = 'nota_servico' | 'nota_venda' | 'imposto';

export default function CadastrarDocumento() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'nota_servico' as TipoDocumento,
    numero_documento: '',
    data_emissao: '',
    valor: '',
    arquivo: null as File | null
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tiposDocumento = [
    { value: 'nota_servico', label: 'Nota Fiscal de Serviço' },
    { value: 'nota_venda', label: 'Nota Fiscal de Venda' },
    { value: 'imposto', label: 'Comprovante de Pagamento de Imposto' }
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Tratamento especial para o campo valor
    if (name === 'valor') {
      // Remove tudo que não for número ou vírgula
      let numericValue = value.replace(/[^\d,]/g, '');
      
      // Substitui vírgula por ponto para processamento interno
      numericValue = numericValue.replace(',', '.');
      
      // Garante apenas um ponto decimal
      const parts = numericValue.split('.');
      let formattedValue = parts[0];
      
      // Limita a parte inteira a 15 dígitos
      if (formattedValue.length > 15) {
        formattedValue = formattedValue.slice(0, 15);
      }
      
      // Adiciona parte decimal limitada a 2 casas
      if (parts.length > 1) {
        formattedValue += '.' + parts[1].slice(0, 2);
      }
      
      // Formata para exibição com vírgula como separador decimal
      const displayValue = formattedValue.replace('.', ',');
      
      setFormData(prev => ({ ...prev, [name]: displayValue }));
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
      // Converter valor com vírgula para formato numérico com ponto
      const valorNumerico = Number(formData.valor.replace(',', '.'));
      if (isNaN(valorNumerico) || valorNumerico <= 0) {
        newErrors.valor = 'Valor deve ser um número positivo';
      }
    }
    
    if (!formData.arquivo) {
      newErrors.arquivo = 'Arquivo é obrigatório';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
      
      // Formatar o valor para garantir 2 casas decimais (convertendo vírgula para ponto)
      const valorNumerico = parseFloat(formData.valor.replace(',', '.'));
      const valorFormatado = parseFloat(valorNumerico.toFixed(2));
      
      // Criar registro do documento no banco de dados
      const { error: insertError } = await supabase
        .from('documentos')
        .insert({
          usuario_id: userId,
          tipo: formData.tipo,
          numero_documento: formData.numero_documento,
          data_emissao: formData.data_emissao,
          valor: valorFormatado,
          arquivo_url: uploadData.path,
          numero_sorteio: numeroSorteio,
          status: 'AGUARDANDO VALIDAÇÃO'
        });
      
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
      <div className="max-w-2xl mx-auto p-4">
        <Card title="Cadastrar Novo Documento" className="bg-white shadow-lg rounded-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="form-group">
                <label htmlFor="tipo" className="block mb-2 text-sm font-medium text-gray-700">
                  Tipo de Documento
                </label>
                <select
                  id="tipo"
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                  className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {tiposDocumento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>
              
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
              />
              
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
              />
              
              <div className="relative">
                <label htmlFor="valor" className="block mb-2 text-sm font-medium text-gray-700">
                  Valor (R$)
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaMoneyBillWave className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="valor"
                    id="valor"
                    className={`pl-10 block w-full border rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                      errors.valor ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0,00"
                    value={formData.valor}
                    onChange={handleChange}
                    required
                  />
                </div>
                {errors.valor && (
                  <p className="mt-1 text-sm text-red-600">{errors.valor}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Digite o valor no formato: 1234,56 (use vírgula como separador decimal)
                </p>
              </div>
              
              <div>
                <label htmlFor="arquivo" className="block mb-2 text-sm font-medium text-gray-700">
                  Arquivo do Documento
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-7">
                      <FaUpload className="w-8 h-8 text-gray-400" />
                      <p className="pt-1 text-sm text-gray-500">
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
                  <p className="mt-2 text-sm text-red-600">{errors.arquivo}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Formatos aceitos: PDF, JPG, JPEG, PNG (máx. 5MB)
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-4">
              <Button 
                type="button" 
                variant="secondary"
                onClick={() => router.push('/meus-documentos')}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                isLoading={isLoading}
              >
                Cadastrar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </Layout>
  );
} 