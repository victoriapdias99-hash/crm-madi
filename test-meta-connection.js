#!/usr/bin/env node

// Script para probar conexión Meta Ads
// Uso: node test-meta-connection.js

const axios = require('axios');

async function testMetaConnection() {
    const token = process.env.META_ACCESS_TOKEN;
    const accountId = process.env.META_AD_ACCOUNT_ID;
    
    if (!token || !accountId) {
        console.log('❌ Faltan variables de entorno META_ACCESS_TOKEN y/o META_AD_ACCOUNT_ID');
        return;
    }
    
    console.log('🔍 Probando conexión Meta Ads...');
    console.log('📱 Account ID:', accountId);
    console.log('🔑 Token length:', token.length, 'caracteres');
    
    try {
        // Test 1: Validar token básico
        console.log('\n📋 Test 1: Validando token...');
        const meResponse = await axios.get('https://graph.facebook.com/v21.0/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('✅ Token válido para usuario:', meResponse.data.name, '(ID:', meResponse.data.id, ')');
        
        // Test 2: Verificar permisos de cuentas de ads
        console.log('\n📋 Test 2: Verificando acceso a cuentas de ads...');
        const adAccountsResponse = await axios.get('https://graph.facebook.com/v21.0/me/adaccounts', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { fields: 'id,name,account_status' }
        });
        console.log('✅ Cuentas accesibles:', adAccountsResponse.data.data.length);
        adAccountsResponse.data.data.forEach(account => {
            const isTarget = account.id === accountId;
            console.log(`  ${isTarget ? '🎯' : '📊'} ${account.name} (${account.id}) - Status: ${account.account_status}`);
        });
        
        // Test 3: Probar acceso a la cuenta específica
        console.log('\n📋 Test 3: Acceso a cuenta objetivo...');
        const accountResponse = await axios.get(`https://graph.facebook.com/v21.0/${accountId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { fields: 'id,name,account_status,currency,timezone_name' }
        });
        console.log('✅ Acceso exitoso a cuenta objetivo:');
        console.log('   Nombre:', accountResponse.data.name);
        console.log('   Status:', accountResponse.data.account_status);
        console.log('   Moneda:', accountResponse.data.currency);
        console.log('   Zona horaria:', accountResponse.data.timezone_name);
        
        // Test 4: Probar acceso a campañas
        console.log('\n📋 Test 4: Listando campañas recientes...');
        const campaignsResponse = await axios.get(`https://graph.facebook.com/v21.0/${accountId}/campaigns`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { 
                fields: 'id,name,status,objective',
                limit: 5
            }
        });
        console.log('✅ Campañas encontradas:', campaignsResponse.data.data.length);
        campaignsResponse.data.data.forEach(campaign => {
            console.log(`   📈 ${campaign.name} (${campaign.status}) - ${campaign.objective}`);
        });
        
        // Test 5: Probar acceso a insights
        console.log('\n📋 Test 5: Probando acceso a métricas (insights)...');
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const insightsResponse = await axios.get(`https://graph.facebook.com/v21.0/${accountId}/insights`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { 
                fields: 'spend,impressions,clicks,account_currency',
                time_range: JSON.stringify({ since: weekAgo, until: today }),
                level: 'account'
            }
        });
        
        if (insightsResponse.data.data && insightsResponse.data.data.length > 0) {
            const data = insightsResponse.data.data[0];
            console.log('✅ Métricas de la última semana:');
            console.log('   💰 Gasto:', data.spend, data.account_currency);
            console.log('   👁️  Impresiones:', data.impressions);
            console.log('   🖱️  Clics:', data.clicks);
        } else {
            console.log('⚠️  Sin datos de métricas en la última semana');
        }
        
        console.log('\n🎉 CONEXIÓN META ADS EXITOSA - Todos los tests pasaron!');
        console.log('✅ El token está funcionando correctamente');
        console.log('✅ Tienes acceso a la cuenta objetivo');
        console.log('✅ Puedes leer campañas y métricas');
        
    } catch (error) {
        console.log('\n❌ ERROR en la conexión:');
        if (error.response) {
            console.log('   Status:', error.response.status);
            console.log('   Error:', error.response.data?.error?.message || 'Error desconocido');
            console.log('   Tipo:', error.response.data?.error?.type);
            console.log('   Código:', error.response.data?.error?.code);
            
            if (error.response.data?.error?.code === 190) {
                console.log('\n🔧 SOLUCIÓN REQUERIDA:');
                console.log('   El token ha expirado o es inválido');
                console.log('   1. Ve a: https://developers.facebook.com/tools/explorer/');
                console.log('   2. Genera un nuevo token con permisos ads_read y ads_management');
                console.log('   3. Extiende el token en: https://developers.facebook.com/tools/debug/accesstoken/');
                console.log('   4. Actualiza META_ACCESS_TOKEN en Replit Secrets');
            }
        } else {
            console.log('   Error de red:', error.message);
        }
    }
}

testMetaConnection();