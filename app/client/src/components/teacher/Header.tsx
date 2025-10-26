import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bell, LogOut, Search, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps = {}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const displayName = (user.name || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username).trim();
  const initial = displayName.charAt(0).toUpperCase() || 'T';

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden rounded-lg hover:bg-accent/50 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 
          className="text-xl font-display font-semibold cursor-pointer hover:text-primary transition-colors ml-2 select-none"
          onClick={() => navigate('/teacher/dashboard')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              navigate('/teacher/dashboard');
            }
          }}
        >
          Teacher Dashboard
        </h1>
        <div className="ml-auto flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full relative">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary"></span>
            <span className="sr-only">Notifications</span>
          </Button>
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-sm font-medium leading-tight">{displayName}</span>
              <span className="text-xs text-muted-foreground leading-tight">{user.role.toUpperCase()}</span>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={signOut}>
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
