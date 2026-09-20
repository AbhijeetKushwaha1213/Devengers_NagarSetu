
import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight, Calendar, Users } from 'lucide-react';
import Button from './Button';

interface FeaturedIssueProps {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  image?: string;
  date: string;
  volunteerCount: number;
}

const FeaturedIssue: React.FC<FeaturedIssueProps> = ({
  id,
  title,
  description,
  location,
  category,
  image,
  date,
  volunteerCount
}) => {
  return (
    <div className="relative rounded-2xl overflow-hidden glass-dark h-[500px] group">
      <div className="absolute inset-0 overflow-hidden">
        {image ? (
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-2000 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
      </div>
      
      <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
        <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-medium mb-4">
          {category}
        </div>
        
        <h2 className="text-white text-3xl md:text-4xl font-semibold mb-4 max-w-2xl text-balance">
          {title}
        </h2>
        
        <p className="text-white/80 mb-6 max-w-2xl text-balance line-clamp-3 md:line-clamp-none">
          {description}
        </p>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center text-white/90">
              <MapPin className="h-4 w-4 mr-2" />
              <span>{location}</span>
            </div>
            <div className="flex items-center text-white/90">
              <Calendar className="h-4 w-4 mr-2" />
              <span>{date}</span>
            </div>
            <div className="flex items-center text-white/90">
              <Users className="h-4 w-4 mr-2" />
              <span>{volunteerCount} volunteers</span>
            </div>
          </div>
          
          <Link to={`/issues/${id}`}>
            <Button className="group">
              <span>View Issue</span>
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FeaturedIssue;
