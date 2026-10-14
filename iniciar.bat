@echo off
REM Inicia a API e a interface do Tecnitium
cd /d "%~dp0"
if not exist node_modules (
  echo Primeira execucao: instalando e criando o banco com dados de exemplo...
  call npm run setup
)
start "" http://localhost:5174
call npm run dev
