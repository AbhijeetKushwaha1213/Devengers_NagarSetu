import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  X, 
  MapPin, 
  Calendar, 
  User, 
  MessageSquare, 
  Camera,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface Issue {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  created_at: string;
  image?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface IssueDetailModalProps {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate?: (issueId: string, newStatus: string) => void;
}

export default function IssueDetailModal({ 
  issue, 
  isOpen, 
  onClose, 
  onStatusUpdate 
}: IssueDetailModalProps) {
  if (!issue) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reported': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysAgo = (dateString: string) => {
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl mb-2">{issue.title}</DialogTitle>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={getPriorityColor(issue.priority || 'medium')}>
                  {issue.priority?.toUpperCase()} PRIORITY
                </Badge>
                <Badge className={getStatusColor(issue.status)}>
                  {issue.status.replace('-', ' ').toUpperCase()}
                </Badge>
                <Badge variant="outline">{issue.category}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Issue Image */}
          {issue.image && (
            <div className="relative">
              <img 
                src={issue.image} 
                alt="Issue" 
                className="w-full h-64 object-cover rounded-lg"
              />
              <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center">
                <Camera className="h-3 w-3 mr-1" />
                Photo Evidence
              </div>
            </div>
          )}

          {/* Issue Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm">{issue.location}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-green-500" />
                  Reported
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm">{formatDate(issue.created_at)}</p>
                <p className="text-xs text-gray-500">{getDaysAgo(issue.created_at)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{issue.description}</p>
            </CardContent>
          </Card>

          {/* Status Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-700 mb-2 block">
                    Current Status
                  </label>
                  {onStatusUpdate ? (
                    <Select
                      value={issue.status}
                      onValueChange={(value) => onStatusUpdate(issue.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reported">Reported</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className="text-sm py-2 px-4">
                      {issue.status.replace('_', ' ').replace('-', ' ').toUpperCase()}
                    </Badge>
                  )}
                </div>
                {onStatusUpdate && (
                  <div className="flex flex-col items-center">
                    <Clock className="h-8 w-8 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500">Auto-save</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <User className="h-4 w-4" />
              <span>Issue ID: {issue.id.slice(0, 8)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button>
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Comment
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}