import React from 'react';
import { getMapplsKey } from '@/services/mapplsService';

const DiagnosticPage: React.FC = () => {
  const mapplsKey = getMapplsKey();
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;

  const envVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '❌ Missing',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Present' : '❌ Missing',
    VITE_MAPPLS_KEY: mapplsKey ? `✅ Present (${mapplsKey.slice(0, 6)}...${mapplsKey.slice(-4)})` : '❌ Missing',
    VITE_GEMINI_API_KEY: geminiKey ? '✅ Present' : '❌ Missing',
    VITE_AUTHORITY_ACCESS_CODE: import.meta.env.VITE_AUTHORITY_ACCESS_CODE ? '✅ Present' : '❌ Missing (defaults to system fallback)',
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Environment Variables Diagnostic</h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Variables Status</h2>
          <div className="space-y-3">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center border-b pb-2">
                <span className="font-mono text-sm">{key}</span>
                <span className={`font-mono text-sm ${value.includes('Missing') ? 'text-red-600' : 'text-green-600'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <li>Your active configuration is read from <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">.env.local</code> and <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">.env</code></li>
            <li>MapMyIndia (Mappls) Key: <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">VITE_MAPPLS_KEY</code></li>
            <li>AI Vision Key: <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">VITE_GEMINI_API_KEY</code></li>
            <li>After modifying environment files, restart your Vite dev server (<code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">npm run dev</code>)</li>
          </ol>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">MapMyIndia (Mappls) Integration Test</h2>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">Active Mappls Key:</p>
              <code className="block bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm font-mono">
                {mapplsKey || 'NOT FOUND - Set VITE_MAPPLS_KEY in .env'}
              </code>
            </div>
            
            {mapplsKey && (
              <div className="text-sm text-green-700 dark:text-green-400 font-medium">
                ✅ MapMyIndia Key configured! Maps, reverse geocoding, search, and navigation are active.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;
