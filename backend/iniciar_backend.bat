@echo off
title FILTERBYKAKE - Servidor Backend
echo ========================================================
echo   FILTERBYKAKE - SERVIDOR LOCAL NODE.JS + BAILEYS
echo ========================================================
echo.

if not exist node_modules (
    echo [1/3] Instalando dependencias do Node.js (aguarde)...
    call npm install
) else (
    echo [1/3] Dependencias ja instaladas.
)

if not exist .env (
    echo [2/3] Criando arquivo .env a partir do .env.example...
    copy .env.example .env
) else (
    echo [2/3] Arquivo .env configurado.
)

echo [3/3] Iniciando o servidor na porta 3000...
echo.
echo Para conectar com o painel em nuvem, execute em outro terminal:
echo npx ngrok http 3000
echo.
call npm start
pause
