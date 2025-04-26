import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Realtime from './pages/Realtime';
// ApiExplorer import removed

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/realtime" element={<Realtime />} />
            {/* API Explorer route removed */}
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
