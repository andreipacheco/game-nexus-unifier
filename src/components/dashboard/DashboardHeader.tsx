
import { Link } from "react-router-dom"; // Import Link
import { Button } from "@/components/ui/button";
import { Gamepad2, Settings, Library, Plug } from "lucide-react";

interface DashboardHeaderProps {
  activeView: 'library' | 'connections';
  onViewChange: (view: 'library' | 'connections') => void;
}

export const DashboardHeader = ({ activeView, onViewChange }: DashboardHeaderProps) => {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Gamepad2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">GameVault</h1>
              <p className="text-sm text-muted-foreground">Unified Game Library</p>
            </div>
          </div>
          
          <nav className="flex items-center space-x-2">
            <Button
              variant={activeView === 'library' ? 'default' : 'ghost'}
              onClick={() => onViewChange('library')}
              className="flex items-center space-x-2"
            >
              <Library className="h-4 w-4" />
              <span>Library</span>
            </Button>
            <Button
              variant={activeView === 'connections' ? 'default' : 'ghost'}
              onClick={() => onViewChange('connections')}
              className="flex items-center space-x-2"
            >
              <Plug className="h-4 w-4" />
              <span>Platforms</span>
            </Button>
            <Link to="/configuration">
              <Button variant="ghost" size="icon" aria-label="Configuration">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};
