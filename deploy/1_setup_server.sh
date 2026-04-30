#!/bin/bash
# ============================================================
# GLIVAC — Script 1: Preparación del servidor DonWeb
# Ejecutar como root: bash 1_setup_server.sh
# Ubuntu 22.04 LTS
# ============================================================
set -e

echo ">>> Actualizando sistema..."
apt-get update -y && apt-get upgrade -y

echo ">>> Instalando dependencias base..."
apt-get install -y \
  curl wget git unzip \
  ca-certificates gnupg lsb-release \
  software-properties-common

# ── Node.js 20 LTS ────────────────────────────────────────────────
echo ">>> Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v && npm -v

# ── PM2 (gestor de procesos — opcional para preview server) ───────
npm install -g pm2

# ── Docker + Docker Compose ───────────────────────────────────────
echo ">>> Instalando Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker && systemctl start docker
docker compose version

# ── Nginx ─────────────────────────────────────────────────────────
echo ">>> Instalando Nginx..."
apt-get install -y nginx
systemctl enable nginx && systemctl start nginx

# ── Certbot (SSL gratuito Let's Encrypt) ──────────────────────────
echo ">>> Instalando Certbot..."
apt-get install -y certbot python3-certbot-nginx

echo ">>> ✅ Servidor listo. Continuá con el script 2."
