
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, Bell, MapPin, LogOut, Shield } from 'lucide-react';
import Button from './Button';
import AuthModal from './AuthModal';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { getDashboardRouteForRole, isWorkerOrAuthorityRole } from '@/utils/roleRouting';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const location = useLocation();
  const { currentUser, userProfile, logOut } = useAuth();
  const { unreadCount, toggleNotificationCenter } = useNotifications();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu when navigating
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const effectiveRole = userProfile?.role || currentUser?.role;
  const homePath = currentUser ? '/dashboard' : '/';
  const profilePath = isWorkerOrAuthorityRole(effectiveRole) ? '/official/profile' : '/profile';

  const navLinks = [
    { name: 'Home', path: homePath },
    { name: 'Issues', path: '/issues' },
    { name: 'Events', path: '/events' }
  ];



  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleNotificationClick = () => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    toggleNotificationCenter();
  };

  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!currentUser || !currentUser.displayName) return "U";
    const names = currentUser.displayName.split(" ");
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'glass shadow-subtle py-3' : 'py-5'
      }`}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to={currentUser ? '/dashboard' : '/'} className="flex items-center">
            <div className="relative h-10 w-10 rounded-full bg-primary flex items-center justify-center mr-2">
              <MapPin className="h-5 w-5 text-white absolute animate-spin-slow" />
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold">Nagar Setu</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm transition-colors duration-300 ${
                  isActive(link.path) 
                    ? 'font-medium text-primary' 
                    : 'text-foreground/80 hover:text-foreground'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <button 
              id="navbar-notification-bell"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              className="relative p-2 rounded-full hover:bg-secondary/80 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
              onClick={handleNotificationClick}
            >
              <Bell className="h-5 w-5 text-foreground/80" />
              {unreadCount > 0 && (
                <span 
                  id="navbar-notification-badge"
                  className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full shadow-sm animate-in zoom-in-50 duration-200"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            
            {currentUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentUser.photoURL || undefined} />
                      <AvatarFallback>{getUserInitials()}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">{currentUser.displayName || currentUser.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isWorkerOrAuthorityRole(effectiveRole) && (
                    <DropdownMenuItem>
                      <Link to={getDashboardRouteForRole(effectiveRole)} className="flex items-center w-full font-medium text-blue-600">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Authority Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>
                    <Link to={profilePath} className="flex items-center w-full">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="font-normal" onClick={() => setAuthModalOpen(true)}>
                  <User className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
                <Button onClick={() => setAuthModalOpen(true)}>Get Started</Button>
              </>
            )}
          </div>

          {/* Mobile Right Actions */}
          <div className="md:hidden flex items-center space-x-1">
            <button 
              id="navbar-mobile-top-bell"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              className="relative p-2 rounded-full hover:bg-secondary/80 transition-colors"
              onClick={handleNotificationClick}
            >
              <Bell className="h-5 w-5 text-foreground/80" />
              {unreadCount > 0 && (
                <span 
                  id="navbar-mobile-top-badge"
                  className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-red-600 rounded-full shadow-sm"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              className="p-2 rounded-full hover:bg-secondary/80 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden glass mt-3 py-5 px-4 mx-4 rounded-xl animate-scale-in">
          <div className="flex flex-col space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`py-2 px-3 rounded-lg transition-colors ${
                  isActive(link.path) 
                    ? 'font-medium text-primary bg-secondary/50' 
                    : 'text-foreground/80 hover:bg-secondary/30'
                }`}
              >
                {link.name}
              </Link>
            ))}
            <div className="border-t border-border/30 my-2"></div>
            
            {currentUser ? (
              <>
                <div className="flex items-center p-2">
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarImage src={currentUser.photoURL || undefined} />
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium truncate">{currentUser.displayName || currentUser.email}</span>
                </div>
                <button
                  id="navbar-mobile-notification-drawer-btn"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    toggleNotificationCenter();
                  }}
                  className="flex items-center justify-between w-full py-2 px-3 rounded-lg text-foreground/80 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center">
                    <Bell className="h-4 w-4 mr-2" />
                    <span>Notifications</span>
                  </div>
                  {unreadCount > 0 && (
                    <span 
                      id="navbar-mobile-drawer-badge"
                      className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-bold text-white bg-red-600 rounded-full"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {isWorkerOrAuthorityRole(effectiveRole) && (
                  <Link to={getDashboardRouteForRole(effectiveRole)} className="w-full">
                    <Button className="w-full justify-center text-blue-600 font-medium" variant="ghost">
                      <Shield className="h-4 w-4 mr-2" />
                      Authority Dashboard
                    </Button>
                  </Link>
                )}
                <Link to={profilePath} className="w-full">
                  <Button className="w-full justify-center" variant="ghost">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Button>
                </Link>
                <Button className="w-full justify-center" variant="ghost" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button className="w-full justify-center" variant="ghost" onClick={() => setAuthModalOpen(true)}>
                  <User className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
                <Button className="w-full justify-center" onClick={() => setAuthModalOpen(true)}>Get Started</Button>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </nav>
  );
};

export default Navbar;
