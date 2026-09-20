import React from 'react';
import { Calendar, Users, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import Navbar from '@/components/Navbar';
import { useNavigate } from 'react-router-dom';

const Events: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="pt-32 pb-20 px-4 md:px-6 container mx-auto">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full mb-6">
            <Calendar className="w-10 h-10" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Community Drives & Civic Events
          </h1>

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" /> Feature Coming Soon
          </div>

          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            We are working with municipal corporations and ward offices to bring neighborhood clean-up drives, tree plantation campaigns, and volunteer civic initiatives to NagarSetu.
          </p>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-left mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> What to expect:
            </h2>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Ward-level sanitation and cleanliness drives with municipal equipment</li>
              <li>• Community awareness programs and tree plantation events</li>
              <li>• Real-time volunteer RSVP and coordination with department officers</li>
              <li>• Recognition badges for active civic volunteers</li>
            </ul>
          </div>

          <div className="flex justify-center gap-4">
            <Button 
              onClick={() => navigate('/issues')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Browse Civic Issues
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Events;
