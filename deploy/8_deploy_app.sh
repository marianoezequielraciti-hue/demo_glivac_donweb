#!/bin/bash
# ============================================================
# GLIVAC — Script 8: Build y deploy del frontend
# Ejecutar en el servidor cada vez que haya un nuevo release
# Requiere: node, npm, git ya instalados (script 1)
# ============================================================
set -e

APP_DIR="/opt/glivac/app"
REPO="https://github.com/marianoezequielraciti-hue/demo_glivac_donweb.git"
BRANCH="main"

echo ">>> Preparando directorio..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clonar o actualizar el repositorio
if [ -d ".git" ]; then
  echo ">>> Actualizando repo..."
  git fetch origin
  git reset --hard origin/$BRANCH
else
  echo ">>> Clonando repo..."
  git clone --depth=1 --branch=$BRANCH $REPO .
fi

echo ">>> Instalando dependencias..."
npm ci --prefer-offline

echo ">>> Aplicando variables de entorno de producción..."
# El archivo .env.production debe existir en /opt/glivac/app/.env.production
# (nunca commitearlo al repo — ver script 9)
cp /opt/glivac/secrets/.env.production .env.production

echo ">>> Construyendo aplicación..."
npm run build

echo ">>> Recargando Nginx..."
nginx -t && systemctl reload nginx

echo ">>> ✅ Deploy completado. La app está en $APP_DIR/dist"
echo ">>> URL: https://glivac.online"
