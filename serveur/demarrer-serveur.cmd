@echo off
rem EPS + : d?marre le serveur local (double-clic). Laisser la fen?tre ouverte pendant les cours.
title EPS + serveur
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installe la version LTS depuis https://nodejs.org puis relance ce fichier.
  pause
  exit /b 1
)
node "%~dp0serveur.js"
pause
