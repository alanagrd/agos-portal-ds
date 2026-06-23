import { StatusDS } from '@/types'

export const STATUS_CONFIG: Record<StatusDS, {
  label: string
  next: StatusDS | null
  bgColor: string
  textColor: string
  dotColor: string
  btnLabel: string | null
}> = {
  'Gerada': {
    label: 'Gerada',
    next: 'Em análise interna',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    dotColor: 'bg-gray-400',
    btnLabel: 'Enviar para análise interna',
  },
  'Em análise interna': {
    label: 'Em análise interna',
    next: null,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    dotColor: 'bg-amber-400',
    btnLabel: null,
  },
  'Alteração solicitada': {
    label: 'Alteração solicitada',
    next: null,
    bgColor: 'bg-orange-50',
    textColor: 'text-[#E87722]',
    dotColor: 'bg-[#E87722]',
    btnLabel: null,
  },
  'Aguardando aprovação da obra': {
    label: 'Aguardando aprovação da obra',
    next: null,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    dotColor: 'bg-blue-400',
    btnLabel: null,
  },
  'Aprovada': {
    label: 'Aprovada',
    next: null,
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    dotColor: 'bg-[#8BAB3E]',
    btnLabel: null,
  },
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateShort(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}
