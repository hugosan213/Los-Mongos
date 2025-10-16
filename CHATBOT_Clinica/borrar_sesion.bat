@echo off
REM Script para borrar la carpeta de sesión de Baileys (baileys_auth)
cd /d %~dp0
rmdir /s /q baileys_auth

echo Carpeta baileys_auth eliminada. Puedes volver a iniciar el bot y escanear el QR.
pause
