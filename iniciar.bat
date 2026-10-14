@echo off
REM Inicia o Tecnitium (somente interface; os dados ficam no navegador)
cd /d "%~dp0"
if not exist node_modules call npm install
start "" http://localhost:5174
call npm run dev
