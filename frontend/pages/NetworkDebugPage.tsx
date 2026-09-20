import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const NetworkDebugPage: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runDiagnostics = async () => {
      const info: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        envVars: {},
        supabaseTest: null,
        networkTest: null,
        dnsTest: null,
      };

      // Check environment variables
      info.envVars = {
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'MISSING',
        VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING',
        VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'MISSING',
        VITE_AUTHORITY_ACCESS_CODE: import.meta.env.VITE_AUTHORITY_ACCESS_CODE ? 'PRESENT' : 'MISSING',
        MODE: import.meta.env.MODE,
        DEV: import.meta.env.DEV,
        PROD: import.meta.env.PROD,
      };

      // Test Supabase connection
      try {
        const { data, error } = await supabase
          .from('issues')
          .select('count')
          .limit(1);
        
        info.supabaseTest = {
          success: !error,
          error: error?.message,
          data: data,
        };
      } catch (err) {
        const error = err as Error;
        info.supabaseTest = {
          success: false,
          error: error.message,
        };
      }

      // Test network connectivity
      try {
        const response = await fetch('https://httpbin.org/json');
        const data = await response.json();
        info.networkTest = {
          success: response.ok,
          status: response.status,
          data: data,
        };
      } catch (err) {
        const error = err as Error;
        info.networkTest = {
          success: false,
          error: error.message,
        };
      }

      // DNS resolution test
      info.dnsTest = {
        hostname: window.location.hostname,
        port: window.location.port,
        protocol: window.location.protocol,
        origin: window.location.origin,
      };

      setDebugInfo(info);
      setLoading(false);
    };

    runDiagnostics();
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    alert('Debug info copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Running diagnostics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Network Debug Information</h1>
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Copy Debug Info
          </button>
        </div>

        <div className="grid gap-6">
          {/* Basic Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            <div className="space-y-2 font-mono text-sm">
              <div><strong>URL:</strong> {debugInfo.url}</div>
              <div><strong>Timestamp:</strong> {debugInfo.timestamp}</div>
              <div><strong>Hostname:</strong> {debugInfo.dnsTest?.hostname}</div>
              <div><strong>Port:</strong> {debugInfo.dnsTest?.port}</div>
              <div><strong>Protocol:</strong> {debugInfo.dnsTest?.protocol}</div>
              <div><strong>Origin:</strong> {debugInfo.dnsTest?.origin}</div>
            </div>
          </div>

          {/* Environment Variables */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
            <div className="space-y-2">
              {Object.entries(debugInfo.envVars || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center border-b pb-2">
                  <span className="font-mono text-sm">{key}</span>
                  <span className={`font-mono text-sm ${
                    value === 'MISSING' ? 'text-red-600' : 
                    value === 'PRESENT' ? 'text-green-600' : 
                    'text-blue-600'
                  }`}>
                    {typeof value === 'string' && value.length > 50 
                      ? `${value.substring(0, 50)}...` 
                      : String(value)
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Supabase Test */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Supabase Connection Test</h2>
            <div className={`p-4 rounded-lg ${
              debugInfo.supabaseTest?.success 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center mb-2">
                <span className={`w-3 h-3 rounded-full mr-2 ${
                  debugInfo.supabaseTest?.success ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                <span className="font-semibold">
                  {debugInfo.supabaseTest?.success ? 'SUCCESS' : 'FAILED'}
                </span>
              </div>
              {debugInfo.supabaseTest?.error && (
                <div className="text-red-600 text-sm font-mono">
                  Error: {debugInfo.supabaseTest.error}
                </div>
              )}
              {debugInfo.supabaseTest?.data && (
                <div className="text-green-600 text-sm font-mono">
                  Data: {JSON.stringify(debugInfo.supabaseTest.data)}
                </div>
              )}
            </div>
          </div>

          {/* Network Test */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">External Network Test</h2>
            <div className={`p-4 rounded-lg ${
              debugInfo.networkTest?.success 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center mb-2">
                <span className={`w-3 h-3 rounded-full mr-2 ${
                  debugInfo.networkTest?.success ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                <span className="font-semibold">
                  {debugInfo.networkTest?.success ? 'SUCCESS' : 'FAILED'}
                </span>
              </div>
              {debugInfo.networkTest?.status && (
                <div className="text-sm font-mono">
                  Status: {debugInfo.networkTest.status}
                </div>
              )}
              {debugInfo.networkTest?.error && (
                <div className="text-red-600 text-sm font-mono">
                  Error: {debugInfo.networkTest.error}
                </div>
              )}
            </div>
          </div>

          {/* Raw Debug Data */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Raw Debug Data</h2>
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-xs overflow-auto max-h-96">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkDebugPage;