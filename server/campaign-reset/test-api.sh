#!/bin/bash

# Script de prueba para la API de Campaign Reset
# Asegúrate de que el servidor esté corriendo en http://localhost:5000

BASE_URL="http://localhost:5000/api/campaign-reset"

echo "🧪 Testing Campaign Reset API"
echo "================================"
echo ""

# Test 1: Dry run - Reset campaña individual
echo "1️⃣ Test: Dry run - Reset campaña individual (ID 65)"
curl -X POST "${BASE_URL}/65?dryRun=true" \
     -H "Content-Type: application/json" \
     -s | jq '.'
echo ""
echo ""

# Test 2: Dry run - Reset batch
echo "2️⃣ Test: Dry run - Reset batch (todas las finalizadas)"
curl -X POST "${BASE_URL}/batch?dryRun=true" \
     -H "Content-Type: application/json" \
     -s | jq '.'
echo ""
echo ""

# Test 3: Dry run - Reset batch con filtro de fecha
echo "3️⃣ Test: Dry run - Reset batch (antes de 2025-09-01)"
curl -X POST "${BASE_URL}/batch?dryRun=true&beforeDate=2025-09-01" \
     -H "Content-Type: application/json" \
     -s | jq '.'
echo ""
echo ""

echo "✅ Tests completados"
echo ""
echo "Para ejecutar realmente (sin dry-run):"
echo "  curl -X POST '${BASE_URL}/65'"
echo "  curl -X POST '${BASE_URL}/batch'"
