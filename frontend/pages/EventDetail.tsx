import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';

const EventDetail: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="pt-32 pb-20 px-4 md:px-6 container mx-auto">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full mb-4">
            <Calendar className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Civic Event
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Civic events and community drives are coming soon to NagarSetu.
          </p>
          <Button 
            variant="outline" 
            onClick={() => navigate('/events')}
            className="inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EventDetail;