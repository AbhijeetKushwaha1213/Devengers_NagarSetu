
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, MapPin, Calendar, Award, Settings, LogOut, Edit, Mail, Phone, Home, Clock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Button from '@/components/Button';
import IssueCard from '@/components/IssueCard';
import EditProfileModal from '@/components/EditProfileModal';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { User as UserProfileType, Issue } from '@/types';
import { IssueService } from '@backend/services/issues/issueService';
import { isWorkerOrAuthorityRole } from '@/utils/roleRouting';

const Profile = () => {
  const { currentUser, userProfile: authProfile, logOut } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserProfileType | null>(null);
  const [userIssues, setUserIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    // If no user is logged in, redirect to home
    if (!currentUser) {
      navigate('/');
      return;
    }

    // If official personnel (worker or authority), redirect to official profile
    const activeRole = authProfile?.role || currentUser.role;
    if (isWorkerOrAuthorityRole(activeRole)) {
      navigate('/official/profile', { replace: true });
      return;
    }

    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        if (userProfile && isWorkerOrAuthorityRole(userProfile.role)) {
          navigate('/official/profile', { replace: true });
          return;
        }
        
        if (userProfile && !profileError) {
          setUserData({
            name: userProfile.full_name || currentUser.full_name || "User",
            role: userProfile.role || currentUser.role || 'citizen',
            location: currentUser.municipality_name || "Civic Resident",
            municipalityName: currentUser.municipality_name,
            wardName: currentUser.ward_name,
            departmentName: currentUser.department_name,
            employeeId: userProfile.employee_id,
            joinDate: userProfile.created_at ? new Date(userProfile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "Recently joined",
            badges: ["Active Citizen"],
            email: currentUser.email,
            phone: userProfile.phone || "Not provided",
            stats: {
              issuesReported: 0,
              issuesSolved: 0,
              eventsAttended: 0
            }
          });
        } else {
          // If no profile exists, use basic auth data
          setUserData({
            name: currentUser.full_name || "User",
            role: currentUser.role || 'citizen',
            location: "Civic Resident",
            municipalityName: currentUser.municipality_name,
            wardName: currentUser.ward_name,
            departmentName: currentUser.department_name,
            employeeId: currentUser.employee_id,
            joinDate: "Recently joined",
            badges: ["Active Citizen"],
            email: currentUser.email,
            phone: currentUser.phone || "Not provided",
            stats: {
              issuesReported: 0,
              issuesSolved: 0,
              eventsAttended: 0
            }
          });
        }

        // Fetch user's reported issues via canonical IssueService
        const issues = await IssueService.getIssues({
          reporter_id: currentUser.id,
          limit: 5,
          sortBy: 'newest',
        });
        
        if (issues) {
          const formattedIssues = issues.map(issue => ({
            id: issue.id,
            ...issue,
            date: new Date(issue.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          }));
          
          setUserIssues(formattedIssues);
          
          // Update stats
          setUserData(prev => ({
            ...prev,
            stats: {
              ...prev.stats,
              issuesReported: issues.length
            }
          }));
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser, authProfile?.role, navigate]);

  const handleLogout = async () => {
    try {
      await logOut();
      navigate('/');
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !userData) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="pt-28 pb-20 flex-1">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              {/* Profile Card */}
              <div className="bg-card rounded-xl shadow-subtle overflow-hidden mb-6 animate-slide-up">
                <div className="bg-primary/10 p-6 pb-24 relative">
                  <div className="absolute top-4 right-4">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="px-6 pb-6 relative">
                  <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
                    <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-card">
                      <img 
                        src={userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=random`} 
                        alt={userData.name} 
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-20 text-center">
                    <h2 className="text-2xl font-semibold mb-1">{userData.name}</h2>
                    <div className="flex items-center justify-center text-muted-foreground mb-4">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>{userData.location}</span>
                    </div>
                    
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                      {userData.badges.map((badge: string, index: number) => (
                        <div 
                          key={index} 
                          className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                        >
                          {badge}
                        </div>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center">
                        <div className="text-xl font-semibold">{userData.stats.issuesReported}</div>
                        <div className="text-xs text-muted-foreground">Reported</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-semibold">{userData.stats.issuesSolved}</div>
                        <div className="text-xs text-muted-foreground">Solved</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-semibold">{userData.stats.eventsAttended}</div>
                        <div className="text-xs text-muted-foreground">Events</div>
                      </div>
                    </div>
                    
                    <Button className="w-full" onClick={() => setEditModalOpen(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Contact Info */}
              <div className="bg-card rounded-xl shadow-subtle p-6 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <h3 className="text-lg font-semibold mb-4">Civic & Contact Details</h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <Mail className="h-5 w-5 text-muted-foreground mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm text-muted-foreground">Email</div>
                      <div>{userData.email}</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Phone className="h-5 w-5 text-muted-foreground mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm text-muted-foreground">Phone</div>
                      <div>{userData.phone}</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Home className="h-5 w-5 text-muted-foreground mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm text-muted-foreground">Jurisdiction</div>
                      <div>
                        {userData.municipalityName ? `${userData.municipalityName}${userData.wardName ? ` • ${userData.wardName}` : ''}` : 'Citizen Resident'}
                      </div>
                    </div>
                  </div>
                  {userData.employeeId && (
                    <div className="flex items-start">
                      <User className="h-5 w-5 text-muted-foreground mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm text-muted-foreground">Employee ID</div>
                        <div className="font-mono">{userData.employeeId}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Account Settings */}
              <div className="bg-card rounded-xl shadow-subtle p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <h3 className="text-lg font-semibold mb-4">Account</h3>
                <div className="space-y-2">
                  <button 
                    className="w-full flex items-center justify-between px-3 py-2 text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                    onClick={handleLogout}
                  >
                    <div className="flex items-center">
                      <LogOut className="h-5 w-5 mr-3" />
                      <span>Sign Out</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Civic Profile Summary */}
              <div className="bg-card rounded-xl shadow-subtle p-6 mb-8 animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Civic Profile Summary</h3>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditModalOpen(true)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-foreground/90">
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <span className="text-muted-foreground text-xs block">Assigned Role</span>
                    <span className="font-semibold capitalize">{userData.role?.replace('_', ' ')}</span>
                  </div>
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <span className="text-muted-foreground text-xs block">Municipality</span>
                    <span className="font-semibold">{userData.municipalityName || 'Registered'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/30 flex items-center text-sm text-muted-foreground">
                  <User className="h-4 w-4 mr-2" />
                  <span>Member since</span>
                  <Clock className="h-4 w-4 mx-2" />
                  <span>{userData.joinDate}</span>
                </div>
              </div>
              
              {/* Reported Issues */}
              <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">Issues Reported</h3>
                  <Link to="/issues" className="text-primary text-sm hover:underline">
                    View All
                  </Link>
                </div>
                
                <div className="space-y-6">
                  {userIssues.length > 0 ? (
                    userIssues.map((issue) => (
                      <IssueCard key={issue.id} {...issue} />
                    ))
                  ) : (
                    <div className="text-center py-12 bg-muted/30 rounded-xl">
                      <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <MapPin className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No Issues Reported Yet</h3>
                      <p className="text-muted-foreground max-w-md mx-auto mb-6">
                        You haven't reported any community issues yet. Start making a difference by reporting problems in your neighborhood.
                      </p>
                      <Link to="/issues/report">
                        <Button>
                          Report an Issue
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-secondary/80 py-8 px-4 md:px-6">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center mr-2">
                <MapPin className="h-3 w-3 text-white" />
              </div>
              <span className="text-lg font-semibold">Nagar Setu</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Nagar Setu. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Edit Profile Modal */}
      <EditProfileModal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} />
    </div>
  );
};

export default Profile;
