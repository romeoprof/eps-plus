@echo off
rem EPS + : choisir le code enseignant du serveur (double-clic).
title EPS + code enseignant
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installe la version LTS depuis https://nodejs.org puis relance ce fichier.
  pause
  exit /b 1
)
node "%~dp0definir-code.js"
pause
