import React, { useState } from 'react';
import { Copy, RefreshCw, Eye, EyeOff, Shield, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { isAuthorityAccessCodeConfigured } from "@/utils/authValidation";

/**
 * Admin Access Code Manager Component
 * 
 * This component is for development/admin use only.
 * It helps manage and test authority access codes.
 * 
 * Usage: Add this component to a protected admin page
 */
const AdminAccessCodeManager: React.FC = () => {
  const [showCurrentCode, setShowCurrentCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const { toast } = useToast();

  // Get current access code from environment
  const currentCode = import.meta.env.VITE_AUTHORITY_ACCESS_CODE;
  const isConfigured = isAuthorityAccessCodeConfigured();

  // Generate a new secure access code
  const generateNewCode = () => {
    const year = new Date().getFullYear();
    const randomPart = Math.random().toString(36).substring(2, 15).toUpperCase();
    const newCode = `NAGAR_SETU_${year}_${randomPart}`;
    setGeneratedCode(newCode);
    
    toast({
      title: "New code generated",
      description: "Copy the code and update your environment variables",
    });
  };

  // Copy code to clipboard
  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "Copied to clipboard",
        description: "Access code has been copied",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the code manually",
        variant: "destructive",
      });
    }
  };

  // Test the current configuration
  const testConfiguration = () => {
    if (isConfigured) {
      toast({
        title: "Configuration valid",
        description: "Authority access code is properly configured",
      });
    } else {
      toast({
        title: "Configuration error",
        description: "Authority access code is not configured",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg border">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-6 w-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Authority Access Code Manager</h2>
      </div>

      <div className="space-y-6">
        {/* Current Configuration */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            Current Configuration
            {isConfigured ? (
              <span className="text-green-600 text-sm">✓ Configured</span>
            ) : (
              <span className="text-red-600 text-sm">✗ Not Configured</span>
            )}
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Environment Variable: VITE_AUTHORITY_ACCESS_CODE
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-white border rounded font-mono text-sm">
                  {isConfigured ? (
                    showCurrentCode ? currentCode : '••••••••••••••••••••••••••'
                  ) : (
                    <span className="text-red-500">Not configured</span>
                  )}
                </div>
                {isConfigured && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCurrentCode(!showCurrentCode)}
                    >
                      {showCurrentCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(currentCode)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            <Button onClick={testConfiguration} variant="outline" size="sm">
              Test Configuration
            </Button>
          </div>
        </div>

        {/* Generate New Code */}
        <div className="p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Generate New Access Code</h3>
          
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Generate a new secure access code for authority verification. 
              Remember to update your environment variables after generation.
            </p>
            
            <Button onClick={generateNewCode} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Generate New Code
            </Button>
            
            {generatedCode && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Generated Code:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-white border rounded font-mono text-sm">
                    {generatedCode}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generatedCode)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">Next Steps:</p>
                      <ol className="list-decimal list-inside mt-1 space-y-1">
                        <li>Copy the generated code</li>
                        <li>Update VITE_AUTHORITY_ACCESS_CODE in your .env.local file</li>
                        <li>Restart your development server</li>
                        <li>Distribute the new code securely to authority personnel</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-green-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Management Instructions</h3>
          <div className="text-sm text-gray-700 space-y-2">
            <p><strong>For Development:</strong> Use the current code in .env.local</p>
            <p><strong>For Production:</strong> Set the environment variable in your hosting platform</p>
            <p><strong>Distribution:</strong> Share codes securely with legitimate authority personnel only</p>
            <p><strong>Security:</strong> Rotate codes quarterly and monitor authority account creation</p>
            <p><strong>Documentation:</strong> See AUTHORITY_ACCESS_CODE_MANAGEMENT.md for detailed instructions</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAccessCodeManager;