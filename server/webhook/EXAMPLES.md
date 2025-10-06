# Ejemplos de Integración - Webhook

## 📝 Tabla de Contenidos

- [JavaScript / Node.js](#javascript--nodejs)
- [Python](#python)
- [PHP](#php)
- [Ruby](#ruby)
- [Java](#java)
- [C# / .NET](#c--net)
- [Go](#go)
- [TypeScript](#typescript)

---

## JavaScript / Node.js

### Con fetch (nativo)

```javascript
const lead = {
  nombre: "Juan Pérez",
  telefono: "1155667788",
  auto: "Fiat Cronos",
  localidad: "Buenos Aires",
  comentarios: "Consulta por financiación"
};

fetch('http://localhost:5000/api/webhook/lead-webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(lead)
})
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('Lead creado:', data.leadId);
    } else {
      console.error('Error:', data.error);
    }
  })
  .catch(error => console.error('Error de red:', error));
```

### Con axios

```javascript
const axios = require('axios');

const lead = {
  nombre: "María González",
  telefono: "1166778899",
  auto: "Toyota Corolla"
};

axios.post('http://localhost:5000/api/webhook/lead-webhook', lead)
  .then(response => {
    console.log('Lead creado:', response.data.leadId);
    console.log('Datos:', response.data.data);
  })
  .catch(error => {
    if (error.response) {
      console.error('Error de validación:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  });
```

### Con async/await

```javascript
async function crearLead(leadData) {
  try {
    const response = await fetch('http://localhost:5000/api/webhook/lead-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(leadData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al crear lead');
    }

    return data;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Uso
crearLead({
  nombre: "Carlos Díaz",
  telefono: "1177889900",
  auto: "Chevrolet Onix"
}).then(result => {
  console.log('Lead creado exitosamente:', result.leadId);
});
```

---

## Python

### Con requests

```python
import requests
import json

url = 'http://localhost:5000/api/webhook/lead-webhook'

lead = {
    'nombre': 'Ana Martínez',
    'telefono': '1122334455',
    'auto': 'Peugeot 208',
    'localidad': 'Córdoba',
    'comentarios': 'Interesada en financiación a 60 meses'
}

response = requests.post(url, json=lead)

if response.status_code == 201:
    data = response.json()
    print(f"Lead creado: {data['leadId']}")
    print(f"Datos: {data['data']}")
else:
    error = response.json()
    print(f"Error: {error['error']}")
    if 'details' in error:
        print(f"Detalles: {error['details']}")
```

### Con manejo de errores

```python
import requests
from typing import Dict, Optional

def crear_lead(lead_data: Dict) -> Optional[Dict]:
    """
    Crea un lead mediante webhook

    Args:
        lead_data: Diccionario con los datos del lead

    Returns:
        Datos del lead creado o None en caso de error
    """
    url = 'http://localhost:5000/api/webhook/lead-webhook'

    try:
        response = requests.post(url, json=lead_data, timeout=10)
        response.raise_for_status()

        result = response.json()

        if result.get('success'):
            return result['data']
        else:
            print(f"Error: {result.get('error')}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Error de conexión: {e}")
        return None
    except json.JSONDecodeError:
        print("Error al decodificar respuesta JSON")
        return None

# Uso
lead = {
    'nombre': 'Pedro López',
    'telefono': '3512345678',
    'auto': 'VW Polo'
}

resultado = crear_lead(lead)
if resultado:
    print(f"Lead ID: {resultado['id']}")
```

---

## PHP

### Con cURL

```php
<?php

$url = 'http://localhost:5000/api/webhook/lead-webhook';

$lead = [
    'nombre' => 'Roberto Sánchez',
    'telefono' => '1155443322',
    'auto' => 'Ford Focus',
    'localidad' => 'La Plata',
    'comentarios' => 'Requiere test drive'
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($lead));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($response, true);

if ($httpCode === 201) {
    echo "Lead creado: " . $data['leadId'] . "\n";
    echo "Datos: " . print_r($data['data'], true);
} else {
    echo "Error: " . $data['error'] . "\n";
}
```

### Función reutilizable

```php
<?php

function crearLead($leadData) {
    $url = 'http://localhost:5000/api/webhook/lead-webhook';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($leadData),
        CURLOPT_TIMEOUT => 10
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['success' => false, 'error' => $error];
    }

    $data = json_decode($response, true);

    return [
        'success' => $httpCode === 201,
        'httpCode' => $httpCode,
        'data' => $data
    ];
}

// Uso
$lead = [
    'nombre' => 'Laura Fernández',
    'telefono' => '1144556677'
];

$resultado = crearLead($lead);

if ($resultado['success']) {
    echo "Lead creado exitosamente: " . $resultado['data']['leadId'];
} else {
    echo "Error: " . $resultado['data']['error'];
}
```

---

## Ruby

### Con Net::HTTP

```ruby
require 'net/http'
require 'json'
require 'uri'

url = URI.parse('http://localhost:5000/api/webhook/lead-webhook')

lead = {
  nombre: 'Sofía Ramírez',
  telefono: '1133445566',
  auto: 'Renault Sandero',
  localidad: 'Mendoza'
}

http = Net::HTTP.new(url.host, url.port)
request = Net::HTTP::Post.new(url.path, {'Content-Type' => 'application/json'})
request.body = lead.to_json

response = http.request(request)
data = JSON.parse(response.body)

if response.code == '201'
  puts "Lead creado: #{data['leadId']}"
  puts "Datos: #{data['data']}"
else
  puts "Error: #{data['error']}"
end
```

---

## Java

### Con HttpClient (Java 11+)

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.google.gson.Gson;
import java.util.HashMap;
import java.util.Map;

public class WebhookClient {

    public static void main(String[] args) throws Exception {
        String url = "http://localhost:5000/api/webhook/lead-webhook";

        Map<String, String> lead = new HashMap<>();
        lead.put("nombre", "Diego Martínez");
        lead.put("telefono", "1166778899");
        lead.put("auto", "Fiat Argo");
        lead.put("localidad", "Rosario");

        Gson gson = new Gson();
        String jsonBody = gson.toJson(lead);

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();

        HttpResponse<String> response = client.send(request,
            HttpResponse.BodyHandlers.ofString());

        System.out.println("Status: " + response.statusCode());
        System.out.println("Response: " + response.body());
    }
}
```

---

## C# / .NET

### Con HttpClient

```csharp
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class WebhookClient
{
    private static readonly HttpClient client = new HttpClient();

    public static async Task Main()
    {
        var url = "http://localhost:5000/api/webhook/lead-webhook";

        var lead = new
        {
            nombre = "Patricia Gómez",
            telefono = "1155667788",
            auto = "Chevrolet Cruze",
            localidad = "CABA",
            comentarios = "Interesada en plan de ahorro"
        };

        var json = JsonSerializer.Serialize(lead);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            var response = await client.PostAsync(url, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                Console.WriteLine("Lead creado exitosamente");
                Console.WriteLine(responseBody);
            }
            else
            {
                Console.WriteLine($"Error: {response.StatusCode}");
                Console.WriteLine(responseBody);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error de conexión: {ex.Message}");
        }
    }
}
```

---

## Go

### Con net/http

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

type Lead struct {
    Nombre      string `json:"nombre"`
    Telefono    string `json:"telefono"`
    Auto        string `json:"auto,omitempty"`
    Localidad   string `json:"localidad,omitempty"`
    Comentarios string `json:"comentarios,omitempty"`
}

type WebhookResponse struct {
    Success bool        `json:"success"`
    LeadID  int         `json:"leadId"`
    Message string      `json:"message"`
    Data    interface{} `json:"data"`
}

func crearLead(lead Lead) (*WebhookResponse, error) {
    url := "http://localhost:5000/api/webhook/lead-webhook"

    jsonData, err := json.Marshal(lead)
    if err != nil {
        return nil, err
    }

    resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var result WebhookResponse
    err = json.Unmarshal(body, &result)
    if err != nil {
        return nil, err
    }

    return &result, nil
}

func main() {
    lead := Lead{
        Nombre:    "Gabriel Torres",
        Telefono:  "1122334455",
        Auto:      "Honda Civic",
        Localidad: "Tucumán",
    }

    result, err := crearLead(lead)
    if err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }

    if result.Success {
        fmt.Printf("Lead creado: %d\n", result.LeadID)
    } else {
        fmt.Printf("Error: %s\n", result.Message)
    }
}
```

---

## TypeScript

### Con axios y tipos

```typescript
import axios, { AxiosError } from 'axios';

interface LeadData {
  nombre: string;
  telefono: string;
  auto?: string;
  localidad?: string;
  comentarios?: string;
  source?: string;
}

interface WebhookSuccessResponse {
  success: true;
  leadId: number;
  message: string;
  data: {
    id: number;
    nombre: string;
    telefono: string;
    auto: string | null;
    localidad: string | null;
    comentarios: string | null;
    source: string;
    createdAt: string;
    updatedAt: string;
  };
}

interface WebhookErrorResponse {
  success: false;
  error: string;
  details?: any;
}

type WebhookResponse = WebhookSuccessResponse | WebhookErrorResponse;

class WebhookClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }

  async crearLead(leadData: LeadData): Promise<WebhookSuccessResponse> {
    try {
      const response = await axios.post<WebhookResponse>(
        `${this.baseUrl}/api/webhook/lead-webhook`,
        leadData
      );

      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<WebhookErrorResponse>;
        if (axiosError.response?.data) {
          throw new Error(
            axiosError.response.data.error ||
            'Error desconocido del servidor'
          );
        }
      }
      throw error;
    }
  }
}

// Uso
async function main() {
  const client = new WebhookClient();

  try {
    const lead: LeadData = {
      nombre: 'Martín Álvarez',
      telefono: '1144332211',
      auto: 'Nissan Versa',
      localidad: 'San Juan',
      comentarios: 'Primera compra de auto'
    };

    const result = await client.crearLead(lead);

    console.log('Lead creado exitosamente');
    console.log('ID:', result.leadId);
    console.log('Datos:', result.data);
  } catch (error) {
    console.error('Error al crear lead:', (error as Error).message);
  }
}

main();
```

---

## 🧪 Ejemplos de Testing

### Jest (JavaScript/TypeScript)

```typescript
import axios from 'axios';

describe('Webhook Lead API', () => {
  const baseUrl = 'http://localhost:5000';

  test('debe crear un lead con todos los campos', async () => {
    const lead = {
      nombre: 'Test Usuario',
      telefono: '1122334455',
      auto: 'Test Auto',
      localidad: 'Test City',
      comentarios: 'Test comment'
    };

    const response = await axios.post(
      `${baseUrl}/api/webhook/lead-webhook`,
      lead
    );

    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
    expect(response.data.leadId).toBeDefined();
  });

  test('debe validar campos requeridos', async () => {
    const leadSinNombre = {
      telefono: '1122334455'
    };

    try {
      await axios.post(
        `${baseUrl}/api/webhook/lead-webhook`,
        leadSinNombre
      );
      fail('Debería haber lanzado un error');
    } catch (error: any) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('Datos inválidos');
    }
  });
});
```

---

## 📚 Recursos Adicionales

- [Documentación completa](./README.md)
- [Guía rápida](./QUICK_START.md)
- [Arquitectura del sistema](./README.md#arquitectura)
