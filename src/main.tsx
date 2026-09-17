import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Easter egg de humor / branding - NÃO é um mecanismo de segurança.
// A segurança real do sistema é provida pelo Content-Security-Policy (CSP) no servidor,
// sanitização de dados no backend, validação de tokens via Firebase Admin SDK
// e regras restritivas do Firestore (firestore.rules).
console.log("%cSenhor ogkake não permite que você injete nada no site, meu parceiro :)) aqui é muito tempo de trampo", "color: #00ffcc; font-size: 14px;");

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

