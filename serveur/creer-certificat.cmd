@echo off
rem EPS + : cr?e le certificat https du serveur (double-clic).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0creer-certificat.ps1"
pause
