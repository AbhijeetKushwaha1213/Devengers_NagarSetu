import React, { useState } from 'react';
import { validateAuthorityAccessCode, sanitizeAccessCode, isAuthorityAccessCodeConfigured } from '@/utils/authValidation';

/**
 * Debug component to test access code validation
 * Add this temporarily to your app to test
 */
const DebugAccessCode: React.FC = () => {
  const [testCode, setTestCode] = useState('');
  const [result, setResult] = useState<string>('');

  const handleTest = async () => {
    const sanitized = sanitizeAccessCode(testCode);
    const isValid = await validateAuthorityAccessCode(sanitized);
    
    const envCode = import.meta.env.VITE_AUTHORITY_ACCESS_CODE;
    const isConfigured = isAuthorityAccessCodeConfigured();
    
    setResult(`
Environment Code: ${envCode || 'NOT SET'}
Is Configured: ${isConfigured ? 'YES' : 'NO'}
Your Input: "${testCode}"
Sanitized: "${sanitized}"
Is Valid: ${isValid ? '✅ YES' : '❌ NO'}
Match: ${sanitized === envCode ? '✅ EXACT MATCH' : '❌ NO MATCH'}
    `);
  };

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '20px', 
      right: '20px', 
      background: 'white', 
      padding: '20px', 
      border: '2px solid #ccc',
      borderRadius: '8px',
      zIndex: 9999,
      maxWidth: '400px'
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>🔍 Access Code Debug</h3>
      <input
        type="text"
        value={testCode}
        onChange={(e) => setTestCode(e.target.value)}
        placeholder="Enter access code to test"
        style={{
          width: '100%',
          padding: '8px',
          marginBottom: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
      />
      <button
        onClick={handleTest}
        style={{
          width: '100%',
          padding: '8px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Test Code
      </button>
      {result && (
        <pre style={{
          marginTop: '10px',
          padding: '10px',
          background: '#f5f5f5',
          borderRadius: '4px',
          fontSize: '12px',
          whiteSpace: 'pre-wrap'
        }}>
          {result}
        </pre>
      )}
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        <strong>Expected Code:</strong><br/>
        NAGAR_SETU_AUTH_2024_SECURE
      </div>
    </div>
  );
};

export default DebugAccessCode;
