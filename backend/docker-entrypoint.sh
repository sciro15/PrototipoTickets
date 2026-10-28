#!/bin/sh
# Arranque controlado: espera a MySQL (vía healthcheck de Compose), aplica
# migraciones versionadas (prisma migrate deploy), seed opcional y levanta la API.
set -e

echo "[entrypoint] Aplicando migraciones (prisma migrate deploy)..."
attempts=0
until npx prisma migrate deploy; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 10 ]; then
    echo "[entrypoint] No fue posible aplicar las migraciones tras $attempts intentos." >&2
    exit 1
  fi
  echo "[entrypoint] Base de datos no lista, reintentando en 3s ($attempts/10)..."
  sleep 3
done

if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] Ejecutando seed (idempotente)..."
  npx prisma db seed
fi

echo "[entrypoint] Iniciando API NestJS..."
exec node dist/main
