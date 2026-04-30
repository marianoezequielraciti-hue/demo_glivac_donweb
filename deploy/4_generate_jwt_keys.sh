#!/bin/bash
# ============================================================
# GLIVAC — Script 4: Generar JWT_SECRET y claves anon/service_role
# Ejecutar en el servidor: bash 4_generate_jwt_keys.sh
# Requiere: node (para firmar el JWT)
# ============================================================

# 1. Generar secretos aleatorios
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -d '\n')
REALTIME_SECRET=$(openssl rand -base64 32 | tr -d '\n')
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n/+=' | cut -c1-32)

echo ""
echo "=========================================="
echo "  Secretos generados — copiar al .env"
echo "=========================================="
echo "JWT_SECRET=$JWT_SECRET"
echo "SECRET_KEY_BASE=$SECRET_KEY_BASE"
echo "REALTIME_SECRET=$REALTIME_SECRET"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo ""

# 2. Generar ANON_KEY (JWT con role=anon, firmado con JWT_SECRET)
ANON_PAYLOAD='{"role":"anon","iss":"supabase","iat":1700000000,"exp":9999999999}'
ANON_HEADER='{"alg":"HS256","typ":"JWT"}'

sign_jwt() {
  local header=$1
  local payload=$2
  local secret=$3

  local header_b64=$(echo -n "$header" | base64 | tr '+/' '-_' | tr -d '=\n')
  local payload_b64=$(echo -n "$payload" | base64 | tr '+/' '-_' | tr -d '=\n')
  local signing_input="${header_b64}.${payload_b64}"
  local sig=$(echo -n "$signing_input" | openssl dgst -sha256 -hmac "$secret" -binary | base64 | tr '+/' '-_' | tr -d '=\n')
  echo "${signing_input}.${sig}"
}

ANON_KEY=$(sign_jwt "$ANON_HEADER" "$ANON_PAYLOAD" "$JWT_SECRET")
SERVICE_PAYLOAD='{"role":"service_role","iss":"supabase","iat":1700000000,"exp":9999999999}'
SERVICE_ROLE_KEY=$(sign_jwt "$ANON_HEADER" "$SERVICE_PAYLOAD" "$JWT_SECRET")

echo "=========================================="
echo "  Claves JWT para el frontend"
echo "=========================================="
echo "ANON_KEY=$ANON_KEY"
echo "SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
echo ""
echo "=> Copiar ANON_KEY como VITE_SUPABASE_ANON_KEY en /opt/glivac/app/.env.production"
echo "=> Copiar SERVICE_ROLE_KEY como SUPABASE_SERVICE_ROLE_KEY"
echo "=> Copiar JWT_SECRET, POSTGRES_PASSWORD, etc. en /opt/glivac/supabase/.env"
