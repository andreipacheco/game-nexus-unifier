# Game Nexus Unifier

## Visão Geral

O **Game Nexus Unifier** é uma plataforma para unificar, visualizar e gerenciar bibliotecas de jogos de múltiplas plataformas, com integração direta à Steam e suporte para outras plataformas (ex: Epic, GOG, PlayStation, Xbox, Nintendo Switch). O sistema oferece visualização detalhada dos jogos, busca avançada, filtros por plataforma, caching inteligente de dados, e autenticação via Google.

---

## Funcionalidades Principais

- **Integração com Steam:**  
  Autenticação via Steam, importação automática da biblioteca de jogos, exibição de conquistas, tempo de jogo e imagens oficiais.
- **Integração com Xbox:**  
Autenticação via xbl.io, importação automática da biblioteca de jogos, exibição de conquistas, tempo de jogo e imagens oficiais.
- **Integração com Playstation Network:**  
Autenticação via psn-api, importação automática da biblioteca de jogos, exibição de conquistas, tempo de jogo e imagens oficiais.
- **Busca e Filtros Avançados:**  
  Busca por título, plataforma e gênero. Filtros dinâmicos por plataforma.
- **Visualização Detalhada:**  
  Cards de jogos com capa, conquistas, tempo de jogo, status de instalação, gênero e ano de lançamento.
- **Cache Inteligente com MongoDB:**  
  Dados da Steam são armazenados em cache para acelerar carregamento e reduzir limites de requisições.
- **Interface Moderna:**  
  UI responsiva com shadcn-ui, Tailwind CSS e componentes customizados.
- **Feedback de Erros e Loading:**  
  Mensagens claras de erro e carregamento para integração Steam e outras operações.
- **Configuração de Conexões de Plataforma:**  
  Possibilidade de conectar/desconectar plataformas e reconfigurar integrações.
- **Deploy facilitado via Lovable:**  
  Deploy instantâneo e integração com domínio customizado.
- **Login com Google**
  Google OAuth Credentials
---

## Tecnologias Utilizadas

- **Frontend:**  
  - [Vite](https://vitejs.dev/)  
  - [React](https://react.dev/)  
  - [TypeScript](https://www.typescriptlang.org/)  
  - [shadcn-ui](https://ui.shadcn.com/)  
  - [Tailwind CSS](https://tailwindcss.com/)

- **Backend:**  
  - [Node.js](https://nodejs.org/)  
  - [Express.js](https://expressjs.com/)  
  - [MongoDB](https://www.mongodb.com/) (cache de dados da Steam)

- **Integrações:**  
  - Steam Web API, Xbox (Não Oficial) e PSN (Não Oficial) (autenticação, biblioteca, conquistas)
  - Suporte planejado para Epic, GOG, Nintendo Switch

---

## Como rodar localmente

Pré-requisitos:  
- Node.js & npm instalados ([instale com nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- MongoDB rodando localmente ou em nuvem

```sh
# Clone o repositório
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Instale as dependências
npm i

# Inicie o servidor de desenvolvimento
npm run dev
```

### Configuração do Backend

Crie um arquivo `.env` em `server/` com:

```
# Steam API Key (Required for fetching game data)
STEAM_API_KEY="YOUR_STEAM_API_KEY_HERE"

# MongoDB Connection URI (Required for caching game data)
# Example: mongodb://localhost:27017/your_database_name
MONGODB_URI="YOUR_MONGODB_CONNECTION_STRING_HERE"

# Optional: Port for the server to run on
# PORT=3001

# Google OAuth Credentials
GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID_HERE"
GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET_HERE"

# Xbox Live API Key (Required for fetching Xbox game data from xbl.io)
XBL_API_KEY=
---

## Como contribuir

- Edite arquivos localmente ou via GitHub.
- Use PRs para novas funcionalidades.
- Consulte os últimos commits para acompanhar as melhorias e correções recentes.
---

## Licença
Este projeto é open-source. Consulte o arquivo LICENSE para mais detalhes.