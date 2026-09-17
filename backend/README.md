# FilterByKake — Backend Local

Servidor Node.js + Express com integração real para **Apify** (captura de leads) e **WhatsApp Baileys** (disparos automatizados).

## 1. Pré-requisitos
- Node.js 18 ou superior instalado no seu computador.
- Uma conta no [Apify](https://apify.com) para obter o API Token.
- Um número de WhatsApp para escanear o QR code no painel.

## 2. Instalação Rápida no Windows
Opção A: Dê um duplo clique no arquivo `iniciar_backend.bat`.

Opção B: Via terminal (Prompt de Comando ou PowerShell):
```bash
npm install
copy .env.example .env
npm start
```

## 3. Conexão com o Painel Web
- O servidor rodará na porta `3000` (http://localhost:3000).
- Se o painel estiver na nuvem (Google Cloud / Vercel), abra outro terminal e execute:
```bash
npx ngrok http 3000
```
- Em seguida, acesse a tela de **Configurações** no painel e clique em **Conectar WhatsApp (Gerar QR Code)**.
