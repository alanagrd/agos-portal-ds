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
    next: 'Em conferência interna',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    dotColor: 'bg-gray-400',
    btnLabel: 'Enviar para conferência interna',
  },
  'Em conferência interna': {
    label: 'Em conferência interna',
    next: 'Aguardando aprovação',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    dotColor: 'bg-amber-400',
    btnLabel: 'Enviar para aprovação da obra',
  },
  'Aguardando aprovação': {
    label: 'Aguardando aprovação',
    next: null,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    dotColor: 'bg-blue-400',
    btnLabel: null,
  },
  'Em revisão': {
    label: 'Em revisão',
    next: 'Aguardando aprovação',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    dotColor: 'bg-orange-400',
    btnLabel: 'Reenviar para aprovação da obra',
  },
  'Aprovada': {
    label: 'Aprovada',
    next: null,
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    dotColor: 'bg-green-500',
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
