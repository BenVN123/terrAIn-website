import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold text-xl">Dirt Mesh LA</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link to="/" className="transition-colors hover:text-foreground/80">
              Home
            </Link>
            <Link to="/realtime" className="transition-colors hover:text-foreground/80">
              Real-time Data
            </Link>
            <Link to="/insights" className="transition-colors hover:text-foreground/80">
              AI Insights
            </Link>
            {/* API Explorer link removed */}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
