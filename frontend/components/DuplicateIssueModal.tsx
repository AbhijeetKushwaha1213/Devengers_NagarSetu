import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, MapPin, Clock, Eye, User, Image as ImageIcon } from 'lucide-react';
import { DuplicateIssue, formatTimeAgo } from '@/services/duplicateDetectionService';
import { useNavigate } from 'react-router-dom';

interface DuplicateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateIssue[];
  confidence: number;
  onProceedAnyway: () => void;
  onCancel: () => void;
}

const DuplicateIssueModal: React.FC<DuplicateIssueModalProps> = ({
  isOpen,
  onClose,
  duplicates,
  confidence,
  onProceedAnyway,
  onCancel
}) => {
  const navigate = useNavigate();

  const handleViewIssue = (issueId: string) => {
    onClose();
    navigate(`/issues/${issueId}`);
  };

  const getMatchTypeColor = (matchType: string) => {
    switch (matchType) {
      case 'both': return 'bg-red-100 text-red-800 border-red-200';
      case 'image': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'location': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getMatchTypeIcon = (matchType: string) => {
    switch (matchType) {
      case 'both': return <AlertTriangle className="h-3 w-3" />;
      case 'image': return <ImageIcon className="h-3 w-3" />;
      case 'location': return <MapPin className="h-3 w-3" />;
      default: return <AlertTriangle className="h-3 w-3" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-red-600';
    if (confidence >= 0.7) return 'text-orange-600';
    return 'text-yellow-600';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Potential Duplicate Issue Detected
              </DialogTitle>
              <p className="text-sm text-gray-600 mt-1">
                We found {duplicates.length} similar issue{duplicates.length > 1 ? 's' : ''} that might be the same as yours
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Confidence Score */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Match Confidence</span>
            <span className={`text-lg font-bold ${getConfidenceColor(confidence)}`}>
              {Math.round(confidence * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                confidence >= 0.8 ? 'bg-red-500' : 
                confidence >= 0.7 ? 'bg-orange-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
        </div>

        {/* Similar Issues List */}
        <div className="space-y-4 mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Similar Issues Found
          </h3>
          
          {duplicates.map((duplicate, index) => (
            <div key={duplicate.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`text-xs ${getMatchTypeColor(duplicate.match_type)}`}>
                      {getMatchTypeIcon(duplicate.match_type)}
                      <span className="ml-1 capitalize">{duplicate.match_type} Match</span>
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(duplicate.similarity_score * 100)}% Similar
                    </Badge>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">{duplicate.title}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">{duplicate.description}</p>
                </div>
                
                {duplicate.image && (
                  <div className="ml-4 flex-shrink-0">
                    <img 
                      src={duplicate.image} 
                      alt="Issue" 
                      className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate max-w-[200px]">{duplicate.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatTimeAgo(duplicate.created_at)}</span>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewIssue(duplicate.id)}
                  className="text-xs h-7"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View Issue
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Warning Message */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800 mb-1">Before proceeding...</h4>
              <p className="text-sm text-yellow-700">
                Duplicate reports can dilute community attention and resources. Please review the similar issues above to see if your concern has already been reported. If your issue is genuinely different or provides new information, you can proceed with submitting it.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 sm:flex-none"
          >
            Cancel Submission
          </Button>
          
          <div className="flex gap-3 flex-1">
            <Button
              variant="outline"
              onClick={() => handleViewIssue(duplicates[0]?.id)}
              className="flex-1"
              disabled={!duplicates[0]}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Top Match
            </Button>
            
            <Button
              onClick={onProceedAnyway}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              Submit Anyway
            </Button>
          </div>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-500 text-center mt-2">
          This check helps maintain issue quality and prevents duplicates. Your submission will be processed normally if you choose to proceed.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateIssueModal;