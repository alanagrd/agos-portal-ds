export type StatusDS =
  | 'Gerada'
  | 'Em conferência interna'
  | 'Aguardando aprovação'
  | 'Em revisão'
  | 'Aprovada';

export interface Obra {
  id: string;
  nome: string;
  cliente: string;
  responsavel_nome: string;
  responsavel_email: string;
  emails_copia: string[];
  ativa: boolean;
  criado_em: string;
}

export interface DescricaoServico {
  id: string;
  obra_id: string;
  mes_referencia: string;
  valor_total: string;
  status: StatusDS;
  token_aprovacao: string;
  criado_em: string;
  atualizado_em: string;
  obra?: Obra;
  versoes?: VersaoPDF[];
  historico?: HistoricoAcao[];
}

export interface VersaoPDF {
  id: string;
  ds_id: string;
  numero_versao: number;
  storage_path: string;
  enviado_por: string;
  criado_em: string;
}

export interface HistoricoAcao {
  id: string;
  ds_id: string;
  acao: string;
  autor: string;
  tipo: 'sistema' | 'interno' | 'cliente';
  criado_em: string;
}
