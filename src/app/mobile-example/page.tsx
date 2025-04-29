'use client';

import { useState } from 'react';

export default function MobileExamplePage() {
  const [apiUrl, setApiUrl] = useState(
    typeof window !== 'undefined' ? `${window.location.origin}/api/fiscal-receipt-mobile` : ''
  );

  // Código de exemplo para Flutter com _result escapado para evitar erros de lint
  const flutterCode = `import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:intl/intl.dart';

class FiscalReceiptScanner extends StatefulWidget {
  @override
  _FiscalReceiptScannerState createState() => _FiscalReceiptScannerState();
}

class _FiscalReceiptScannerState extends State<FiscalReceiptScanner> {
  final TextEditingController _controller = TextEditingController();
  bool _isLoading = false;
  String? _error;
  Map<String, dynamic>? _result;

  Future<void> extractData() async {
    if (_controller.text.isEmpty) {
      setState(() {
        _error = 'Por favor, insira o link do QR Code';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
      _result = null;
    });

    try {
      final response = await http.post(
        Uri.parse('${apiUrl}'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'qrCodeLink': _controller.text}),
      );

      final data = jsonDecode(response.body);
      
      setState(() {
        if (data['error'] != null) {
          _error = data['error'];
        } else {
          _result = data;
        }
      });
    } catch (e) {
      setState(() {
        _error = 'Erro ao comunicar com o servidor';
      });
      print(e);
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Extrator de Cupom Fiscal'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _controller,
              decoration: InputDecoration(
                labelText: 'Link do QR Code',
                border: OutlineInputBorder(),
                hintText: 'Cole o link do QR Code aqui',
              ),
            ),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: _isLoading ? null : extractData,
              child: Text(_isLoading ? 'Processando...' : 'Extrair Dados'),
            ),
            if (_isLoading)
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Center(child: CircularProgressIndicator()),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 16.0),
                child: Text(
                  _error!,
                  style: TextStyle(color: Colors.red),
                ),
              ),
            if (_result != null)
              Padding(
                padding: const EdgeInsets.only(top: 16.0),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Dados Extraídos:',
                          style: Theme.of(context).textTheme.headline6,
                        ),
                        SizedBox(height: 8),
                        if (_result!['valor'] != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 8.0),
                            child: Row(
                              children: [
                                Text(
                                  'Valor Total: ',
                                  style: TextStyle(fontWeight: FontWeight.bold),
                                ),
                                Text('R\\$ \${_result!['valor']}'),
                              ],
                            ),
                          ),
                        if (_result!['dataEmissao'] != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 8.0),
                            child: Row(
                              children: [
                                Text(
                                  'Data de Emissão: ',
                                  style: TextStyle(fontWeight: FontWeight.bold),
                                ),
                                Text(
                                  DateFormat('dd/MM/yyyy').format(
                                    DateTime.parse(_result!['dataEmissao']),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Uso do Extrator de Cupom Fiscal em Aplicativos Móveis</h1>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">Instruções para Uso em Dispositivos Móveis:</h2>
        <p className="mb-3">
          Para usar o extrator de dados de cupons fiscais em dispositivos móveis, você precisa fazer uma
          requisição HTTP para o endpoint abaixo e passar o link do QR Code do cupom fiscal.
        </p>
        <div className="bg-gray-100 p-3 rounded font-mono text-sm mb-3 break-all">
          {apiUrl}
        </div>
        <p>
          O endpoint retornará os dados extraídos do cupom fiscal em formato JSON.
        </p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Exemplo com React Native:</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          {`import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';

export default function FiscalReceiptScanner() {
  const [qrCodeLink, setQrCodeLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const extractData = async () => {
    if (!qrCodeLink) {
      setError('Por favor, insira o link do QR Code');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('${apiUrl}', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrCodeLink }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('Erro ao comunicar com o servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Extrator de Cupom Fiscal</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Cole o link do QR Code aqui"
        value={qrCodeLink}
        onChangeText={setQrCodeLink}
      />
      
      <Button
        title={loading ? 'Processando...' : 'Extrair Dados'}
        onPress={extractData}
        disabled={loading}
      />
      
      {loading && <ActivityIndicator style={styles.loader} size="large" color="#0000ff" />}
      
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}
      
      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.subtitle}>Dados Extraídos:</Text>
          
          {result.valor && (
            <Text style={styles.resultItem}>
              <Text style={styles.label}>Valor Total: </Text>
              R$ {result.valor}
            </Text>
          )}
          
          {result.dataEmissao && (
            <Text style={styles.resultItem}>
              <Text style={styles.label}>Data de Emissão: </Text>
              {new Date(result.dataEmissao).toLocaleDateString('pt-BR')}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  loader: {
    marginTop: 20,
  },
  error: {
    color: 'red',
    marginTop: 20,
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultItem: {
    marginBottom: 8,
    fontSize: 16,
  },
  label: {
    fontWeight: 'bold',
  },
});`}
        </pre>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Exemplo com Flutter:</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          {flutterCode}
        </pre>
      </div>
    </div>
  );
} 