@echo off
echo ===================================================
echo   Mise a jour de l'extension Chrome ADB Scrcpy...
echo ===================================================
echo.
echo Telechargement de la derniere version depuis GitHub...
curl -L -o scrcpy-extension.zip https://github.com/J055ELIN/Tomtom/raw/arena/01a042d9-tomtom/scrcpy-chrome-extension/scrcpy-extension.zip

echo.
echo Extraction des fichiers...
tar -xf scrcpy-extension.zip

echo.
echo ===================================================
echo   Mise a jour terminee avec succes !
echo   1. Allez dans chrome://extensions/
echo   2. Cliquez sur l'icone "Actualiser" (la fleche) 
echo      sur la carte de l'extension.
echo ===================================================
pause
