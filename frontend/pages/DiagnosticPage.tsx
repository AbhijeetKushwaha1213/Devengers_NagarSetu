import React from 'react';

const DiagnosticPage: React.FC = () => {
  const envVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Present' : '❌ Missing',
    VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '❌ Missing',
    VITE_AUTHORITY_ACCESS_CODE: import.meta.env.VITE_AUTHORITY_ACCESS_CODE ? '✅ Present' : '❌ Missing',
    VITE_GOOGLE_VISION_API_KEY: import.meta.env.VITE_GOOGLE_VISION_API_KEY ? '✅ Present' : '❌ Missing',
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
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>If any variable shows "❌ Missing", check your <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">.env.local</code> file</li>
            <li>After updating <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">.env.local</code>, you MUST restart the dev server</li>
            <li>Press Ctrl+C (or Cmd+C) to stop the server</li>
            <li>Run <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">npm run dev</code> again</li>
            <li>Refresh this page to see updated values</li>
          </ol>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Google Maps API Test</h2>
          <div className="space-y-4">
            <div>
              <p className="mb-2">API Key Status:</p>
              <code className="block bg-gray-100 dark:bg-gray-700 p-3 rounded">
                {import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'NOT FOUND - Restart dev server!'}
              </code>
            </div>
            
            {import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
              <div>
                <p className="text-green-600 font-semibold">✅ API Key is loaded!</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  If the map still doesn't work, the API key might need:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                  <li>Billing enabled in Google Cloud Console</li>
                  <li>Maps JavaScript API enabled</li>
                  <li>Geocoding API enabled</li>
                  <li>Places API enabled</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;
