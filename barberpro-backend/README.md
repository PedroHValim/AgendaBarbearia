# ✂ BarberPro — Backend API

API REST em Node.js + Express para o sistema de agendamento da barbearia.

---

## Estrutura do Projeto

```
barberpro-backend/
├── src/
│   ├── server.js                    ← Ponto de entrada
│   ├── routes/
│   │   ├── auth.js                  ← /api/auth/*
│   │   ├── appointments.js          ← /api/appointments/*
│   │   ├── availability.js          ← /api/availability/*
│   │   ├── barbers.js               ← /api/barbers/*
│   │   ├── services.js              ← /api/services/*
│   │   ├── admin.js                 ← /api/admin/* (requer admin)
│   │   └── whatsapp.js              ← /api/whatsapp/webhook
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── appointmentController.js
│   │   ├── availabilityController.js
│   │   ├── adminController.js
│   │   └── barberController.js
│   ├── middleware/
│   │   └── auth.js                  ← JWT + verificação de role
│   └── services/
│       ├── whatsapp.js              ← Envio de mensagens (Z-API)
│       └── cronJobs.js              ← Lembretes automáticos
├── config/
│   └── supabase.js                  ← Cliente do banco
├── supabase_schema.sql              ← SQL para criar as tabelas
├── GOOGLE_OAUTH_GUIDE.md            ← Guia passo a passo do OAuth
├── .env.example                     ← Variáveis de ambiente (copie para .env)
└── package.json
```

---

## Instalação

```bash
# 1. Entre na pasta
cd barberpro-backend

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com seus dados reais

# 4. Crie as tabelas no Supabase
# Abra o SQL Editor no Supabase e execute o conteúdo de supabase_schema.sql

# 5. Rode em desenvolvimento
npm run dev
```

---

## Endpoints da API

### Autenticação
| Método | Rota                  | Auth? | Descrição                     |
|--------|-----------------------|-------|-------------------------------|
| POST   | /api/auth/register    | ❌    | Cadastro com email/senha       |
| POST   | /api/auth/login       | ❌    | Login com email/senha          |
| POST   | /api/auth/google      | ❌    | Login/cadastro com Google      |
| GET    | /api/auth/me          | ✅    | Dados do usuário logado        |
| PUT    | /api/auth/profile     | ✅    | Atualizar perfil (ex: telefone)|

### Agendamentos (cliente)
| Método | Rota                          | Auth? | Descrição              |
|--------|-------------------------------|-------|------------------------|
| POST   | /api/appointments             | ✅    | Criar agendamento       |
| GET    | /api/appointments/my          | ✅    | Meus agendamentos       |
| PATCH  | /api/appointments/:id/cancel  | ✅    | Cancelar               |
| PATCH  | /api/appointments/:id/confirm | ✅    | Confirmar presença      |

### Disponibilidade (público)
| Método | Rota                     | Auth? | Descrição                                    |
|--------|--------------------------|-------|----------------------------------------------|
| GET    | /api/availability        | ❌    | Slots de um dia: ?barber_id=X&date=YYYY-MM-DD |
| GET    | /api/availability/month  | ❌    | Dias disponíveis: ?barber_id=X&year=Y&month=M |

### Barbeiros e Serviços (público para leitura)
| Método | Rota                      | Auth?  | Descrição            |
|--------|---------------------------|--------|----------------------|
| GET    | /api/barbers              | ❌     | Lista barbeiros       |
| GET    | /api/services             | ❌     | Lista serviços        |
| POST   | /api/barbers              | 🔐 admin | Criar barbeiro      |
| POST   | /api/services             | 🔐 admin | Criar serviço       |

### Admin
| Método | Rota                              | Auth?     | Descrição              |
|--------|-----------------------------------|-----------|------------------------|
| GET    | /api/admin/dashboard              | 🔐 admin  | Métricas do dia        |
| GET    | /api/admin/agenda                 | 🔐 admin  | Agenda (filtros)       |
| PATCH  | /api/admin/appointments/:id/cancel | 🔐 admin | Cancelar agendamento   |
| PATCH  | /api/admin/appointments/:id/complete| 🔐 admin| Marcar concluído       |
| POST   | /api/admin/blocked-slots          | 🔐 admin  | Bloquear horário       |
| DELETE | /api/admin/blocked-slots/:id      | 🔐 admin  | Remover bloqueio       |
| POST   | /api/admin/walk-in                | 🔐 admin  | Adicionar encaixe      |
| GET    | /api/admin/settings               | 🔐 admin  | Ler configurações      |
| PUT    | /api/admin/settings               | 🔐 admin  | Salvar configurações   |
| GET    | /api/admin/notifications          | 🔐 admin  | Notificações do painel |

---

## Cron Jobs (automáticos)

| Horário    | O que faz                                          |
|------------|----------------------------------------------------|
| 09:00 diário | Envia lembretes WhatsApp para agendamentos de amanhã |
| 20:00 diário | Libera horários de quem não confirmou presença     |
| 00:00 diário | Marca atendimentos passados como "concluído"       |

---

## Credenciais do Admin padrão

```
Email: admin@barberpro.com
Senha: admin1234
```
**⚠ Troque imediatamente após o primeiro login!**

---

## Ordem de configuração

1. ✅ Crie o projeto no Supabase
2. ✅ Execute o `supabase_schema.sql`
3. ✅ Copie `.env.example` para `.env` e preencha
4. ✅ Siga `GOOGLE_OAUTH_GUIDE.md` para o OAuth
5. ✅ Configure Z-API para o WhatsApp (opcional por agora)
6. ✅ `npm install && npm run dev`
