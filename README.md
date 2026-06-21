# AGOS Portal DS

Portal interno de gestão de Descrições de Serviço (DS) da AGOS Serviços.

## Stack
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (banco de dados + storage + auth)
- **Vercel** (deploy)

## Setup local

```bash
# 1. Clonar o repositório
git clone https://github.com/alanagrd/agos-portal-ds.git
cd agos-portal-ds

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
# Crie o arquivo .env.local com:
NEXT_PUBLIC_SUPABASE_URL=https://hkfytbajszxequbtxqjm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui

# 4. Rodar localmente
npm run dev
```

## Deploy no Vercel

1. Importe o repositório no Vercel
2. Adicione as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy automático a cada push na branch main

## Criar usuário AGOS

No Supabase → Authentication → Users → Add user:
- Email: alan@agosservicos.com.br (ou o email desejado)
- Password: defina uma senha segura

## Fluxo da DS

1. AGOS cria DS no portal (obra, mês, valor, PDF)
2. AGOS envia para conferência interna (ADMs revisam)
3. AGOS envia para aprovação da obra (link enviado ao cliente)
4. Cliente abre o link, visualiza PDF, aprova ou solicita revisão
5. Se revisão: AGOS corrige, faz upload do novo PDF, reenvia
6. DS aprovada — histórico completo registrado

## Páginas

- `/auth/login` — login da equipe AGOS
- `/dashboard` — lista de todas as DSs com filtros
- `/ds/nova` — criar nova DS
- `/ds/[id]` — detalhe da DS (upload PDF, histórico, avançar status)
- `/obras` — gerenciar obras e responsáveis
- `/aprovar/[token]` — página pública para o cliente aprovar (sem login)
