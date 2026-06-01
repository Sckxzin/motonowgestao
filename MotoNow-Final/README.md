# MotoNow Gestão — Sistema ERP para Concessionárias Shineray

Sistema completo de gestão multi-filial: estoque de motos e peças, vendas, CRM de clientes, revisões, emplacamentos e financeiro.

---

## ✅ Pré-requisitos

- **Node.js v18+** → [nodejs.org](https://nodejs.org)  
- **npm** (vem junto com o Node)

Verifique com:
```bash
node -v   # deve mostrar v18 ou maior
npm -v
```

---

## 🚀 Como rodar local (primeira vez)

### 1. Backend

```bash
cd backend
npm install
npm run setup    # cria o banco e popula com dados iniciais
npm start        # inicia o servidor na porta 3001
```

Deve aparecer:
```
🚀 MotoNow API rodando em http://localhost:3001
   Banco: ./motonow.db
```

### 2. Frontend (em outro terminal)

```bash
cd frontend
npm install
npm start        # abre automaticamente em http://localhost:3000
```

---

## 🔑 Logins para teste

| Usuário      | Senha       | Acesso              |
|--------------|-------------|---------------------|
| `diretoria`  | `admin123`  | Total (todas filiais + admin) |
| `escada`     | `filial123` | Filial Escada       |
| `ipojuca`    | `filial123` | Filial Ipojuca      |
| `ribeirao`   | `filial123` | Filial Ribeirão     |
| `catende`    | `filial123` | Filial Catende      |
| `saojose`    | `filial123` | Filial São José     |
| `xexeu`      | `filial123` | Filial Xexeu        |
| `maragogi`   | `filial123` | Filial Maragogi     |

---

## 📁 Estrutura do Projeto

```
MotoNow-Final/
├── backend/
│   ├── server.js      ← API Express (todas as rotas)
│   ├── db.js          ← Banco SQLite + criação de tabelas
│   ├── helpers.js     ← Filiais, repasse Santander, comissões
│   ├── seed.js        ← Dados iniciais (rodar uma vez)
│   ├── .env           ← Configurações (porta, JWT secret)
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.js           ← Rotas e proteção de acesso
    │   ├── api.js           ← Axios com interceptors JWT
    │   ├── utils.js         ← Helpers, constantes, auth
    │   ├── styles.css       ← Design system dark/vermelho
    │   ├── components/
    │   │   └── Topbar.jsx
    │   ├── hooks/
    │   │   └── useToast.js
    │   └── pages/
    │       ├── Login.jsx
    │       ├── Home.jsx           ← Estoque peças + motos
    │       ├── Carrinho.jsx       ← Venda de peças
    │       ├── Nota.jsx           ← Nota fiscal 58mm
    │       ├── Clientes.jsx       ← Lista de clientes
    │       ├── ClienteDetalhe.jsx ← Perfil + histórico
    │       ├── Revisoes.jsx
    │       ├── Admin.jsx          ← Dashboard diretoria
    │       ├── Vendas.jsx         ← Histórico vendas peças
    │       ├── VendasMotos.jsx    ← Histórico vendas motos
    │       ├── Pendentes.jsx      ← Aprovar/recusar vendas
    │       ├── Emplacamentos.jsx
    │       └── Financeiro.jsx
    └── package.json
```

---

## 🌐 Como publicar na web (Railway)

### Backend

1. Crie um projeto no [railway.app](https://railway.app)
2. Adicione um serviço **PostgreSQL** no projeto
3. Faça deploy da pasta `backend/`
4. Nas variáveis de ambiente do serviço, adicione:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=uma_senha_forte_aqui
   PORT=3001
   ```
5. Troque o driver no `db.js` de `better-sqlite3` para `pg` (o arquivo já tem os comentários explicando)

### Frontend

1. Faça deploy da pasta `frontend/` no Railway (ou Vercel/Netlify)
2. Adicione variável de ambiente:
   ```
   REACT_APP_API_URL=https://seu-backend.up.railway.app
   ```

---

## 🔄 Como migrar SQLite → PostgreSQL

O `db.js` usa SQLite localmente. Para produção:

1. No `backend/package.json`, adicione `"pg": "^8.11.3"` nas dependências
2. Substitua o `db.js` conforme comentários no arquivo
3. O `server.js` usa queries SQL padrão que funcionam em ambos

---

## 🛠 Comandos úteis

```bash
# Backend — modo dev (reinicia ao salvar)
cd backend && npm run dev

# Resetar banco (apaga tudo e recria)
cd backend && rm motonow.db && npm run setup

# Build do frontend para produção
cd frontend && npm run build
```

---

## 💡 Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Login** | JWT 8h, proteção de rotas por cargo |
| **Estoque Motos** | Cadastro, filtros, status, transferência entre filiais |
| **Estoque Peças** | Cadastro, entrada, transferência, carrinho de vendas |
| **Venda de Moto** | Fluxo: solicitação → aprovação diretoria → confirmado |
| **Carrinho** | Venda de peças com desconto 5% PIX/À VISTA |
| **Clientes** | CRM completo: perfil, motos vinculadas, histórico |
| **Revisões** | Registro e controle de ordens de serviço |
| **Admin** | Dashboard KPIs, gestão de usuários, ranking filiais |
| **Emplacamentos** | Controle de custo/lucro por emplacamento |
| **Financeiro** | Registro diário com histórico |
| **Nota Fiscal** | Impressão térmica 58mm |

---

## ⚙️ Variáveis de ambiente (backend/.env)

```env
PORT=3001
JWT_SECRET=motonow_secret_2024_troque_em_producao
DB_PATH=./motonow.db

# Para PostgreSQL em produção:
# DATABASE_URL=postgresql://user:pass@host:5432/db
```
