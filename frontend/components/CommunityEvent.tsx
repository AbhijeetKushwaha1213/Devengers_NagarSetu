
import React from 'react';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface CommunityEventProps {
  title: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  attendees: number;
  description: string;
}

const CommunityEvent: React.FC<CommunityEventProps> = ({
  title,
  date,
  time,
  location,
  organizer,
  attendees,
  description
}) => {
  const { toast } = useToast();
  
  const handleRSVP = () => {
    toast({
      title: "RSVP Confirmed",
      description: "You've successfully registered for this event.",
    });
  };
  
  return (
    <div className="bg-card border rounded-xl p-6 mb-8">
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 mb-4">
        <div className="flex items-center text-sm">
          <Calendar className="h-4 w-4 mr-2 text-primary" />
          <span>{date}</span>
        </div>
        
        <div className="flex items-center text-sm">
          <Clock className="h-4 w-4 mr-2 text-primary" />
          <span>{time}</span>
        </div>
        
        <div className="flex items-center text-sm">
          <MapPin className="h-4 w-4 mr-2 text-primary" />
          <span>{location}</span>
        </div>
        
        <div className="flex items-center text-sm">
          <Users className="h-4 w-4 mr-2 text-primary" />
          <span>{attendees} attending</span>
        </div>
      </div>
      
      <p className="text-muted-foreground mb-4">{description}</p>
      
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Organized by </span>
          <span className="font-medium">{organizer}</span>
        </div>
        
        <Button onClick={handleRSVP}>
          RSVP Now
        </Button>
      </div>
    </div>
  );
};

export default CommunityEvent;
