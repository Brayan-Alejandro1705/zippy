@echo off
echo Iniciando Zippy...
echo.

:: Backend
start "Zippy Backend" cmd /k "cd /d C:\Users\aleja\zippy\backend && python main.py"

:: Esperar 3 segundos para que el backend arranque primero
timeout /t 3 /nobreak > nul

:: Frontend
start "Zippy Frontend" cmd /k "cd /d C:\Users\aleja\zippy\frontend && npm start"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3002
echo Docs API: http://localhost:8000/docs
echo.
