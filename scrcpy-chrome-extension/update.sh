#!/bin/bash
echo "==================================================="
echo "  Mise à jour de l'extension Chrome ADB Scrcpy..."
echo "==================================================="
echo ""
echo "Téléchargement de la dernière version depuis GitHub..."
curl -L -o scrcpy-extension.zip https://github.com/J055ELIN/Tomtom/raw/arena/01a042d9-tomtom/scrcpy-chrome-extension/scrcpy-extension.zip

echo ""
echo "Extraction des fichiers..."
unzip -o scrcpy-extension.zip

echo ""
echo "==================================================="
echo "  Mise à jour terminée avec succès !"
echo "  1. Allez dans chrome://extensions/"
echo "  2. Cliquez sur l'icône 'Actualiser' (la flèche)"
echo "     sur la carte de l'extension."
echo "==================================================="
