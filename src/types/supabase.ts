export type Usuario = {
  id: string;
  email: string;
  nome_completo: string;
  cpf_cnpj: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  created_at: string;
  role: 'admin' | 'contribuinte';
  master: 'S' | 'N';
};

export type Documento = {
  id: string;
  usuario_id: string;
  tipo: 'nota_servico' | 'nota_venda' | 'imposto';
  numero_documento: string;
  data_emissao: string;
  valor: number;
  arquivo_url: string;
  numero_sorteio: string;
  status: 'VALIDADO' | 'INVÁLIDO' | 'AGUARDANDO VALIDAÇÃO';
  created_at: string;
};

export type FaixaNumeroSorte = {
  id: string;
  descricao: string;
  valor_de: number;
  valor_ate: number;
  quantidade_numeros: number;
  created_at: string;
  updated_at: string;
};

export type NumerosSorteDocumento = {
  id: string;
  documento_id: string;
  numero_sorte: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: Usuario;
        Insert: Omit<Usuario, 'id' | 'created_at'>;
        Update: Partial<Omit<Usuario, 'id' | 'created_at'>>;
      };
      documentos: {
        Row: Documento;
        Insert: Omit<Documento, 'id' | 'created_at' | 'numero_sorteio'>;
        Update: Partial<Omit<Documento, 'id' | 'created_at' | 'numero_sorteio'>>;
      };
      faixas_numero_sorte: {
        Row: FaixaNumeroSorte;
        Insert: Omit<FaixaNumeroSorte, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<FaixaNumeroSorte, 'id' | 'created_at' | 'updated_at'>>;
      };
      numeros_sorte_documento: {
        Row: NumerosSorteDocumento;
        Insert: Omit<NumerosSorteDocumento, 'id' | 'created_at'>;
        Update: Partial<Omit<NumerosSorteDocumento, 'id' | 'created_at'>>;
      };
    };
  };
}; 