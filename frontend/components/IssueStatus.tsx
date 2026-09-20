
import React from 'react';
import { Clock, Users, ThumbsUp, MessageCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

import { IssueStatus as IssueStatusType } from '@/types';

interface IssueStatusProps {
  status: IssueStatusType | string;
  createdAt: string;
  updatedAt: string;
  volunteersCount: number;
  supportCount: number;
  commentsCount: number;
}

const IssueStatus: React.FC<IssueStatusProps> = ({
  status,
  createdAt,
  updatedAt,
  volunteersCount,
  supportCount,
  commentsCount
}) => {
  const { toast } = useToast();
  
  const getStatusColor = () => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-700';
      case 'verified':
        return 'bg-indigo-100 text-indigo-700';
      case 'in_progress':
      case 'in-progress':
        return 'bg-amber-100 text-amber-700';
      case 'resolved':
        return 'bg-green-100 text-green-700';
      case 'escalated':
        return 'bg-red-100 text-red-700';
      case 'rejected':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };
  
  const getStatusText = () => {
    switch (status) {
      case 'submitted':
        return 'Submitted';
      case 'verified':
        return 'Verified';
      case 'in_progress':
      case 'in-progress':
        return 'In Progress';
      case 'resolved':
        return 'Resolved';
      case 'escalated':
        return 'Escalated';
      case 'rejected':
        return 'Rejected';
      default:
        return String(status).replace('_', ' ').toUpperCase();
    }
  };
  
  const handleVolunteer = () => {
    toast({
      title: "You've volunteered!",
      description: "Thank you for offering to help with this issue.",
    });
  };
  
  const handleSupportIssue = () => {
    toast({
      title: "Support Added",
      description: "You've shown your support for this issue.",
    });
  };
  
  return (
    <div className="bg-card border rounded-xl p-6 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4 mr-1.5" />
            <span>Reported {createdAt}</span>
          </div>
          
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4 mr-1.5" />
            <span>Updated {updatedAt}</span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-6 items-center justify-between mt-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-primary mr-2" />
            <span className="font-medium">{volunteersCount} Volunteers</span>
          </div>
          
          <div className="flex items-center">
            <ThumbsUp className="h-5 w-5 text-primary mr-2" />
            <span className="font-medium">{supportCount} Support</span>
          </div>
          
          <div className="flex items-center">
            <MessageCircle className="h-5 w-5 text-primary mr-2" />
            <span className="font-medium">{commentsCount} Comments</span>
          </div>
        </div>
        
        <div className="flex gap-3 mt-4 md:mt-0">
          <Button variant="outline" onClick={handleSupportIssue}>
            <ThumbsUp className="h-4 w-4 mr-2" />
            Support
          </Button>
          <Button onClick={handleVolunteer}>
            <Users className="h-4 w-4 mr-2" />
            Volunteer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IssueStatus;
