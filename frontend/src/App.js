import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

import Navbar         from './components/Navbar';
import Home           from './pages/Home';
import Elections      from './pages/Elections';
import ElectionDetail from './pages/ElectionDetail';
import Vote           from './pages/Vote';
import Results        from './pages/Results';
import History        from './pages/History';
import Verify         from './pages/Verify';
import Admin          from './pages/Admin';
import Profile        from './pages/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        {/* ── Public ── */}
        <Route path="/"                      element={<Home />} />
        <Route path="/elections"             element={<Elections />} />
        <Route path="/elections/:id"         element={<ElectionDetail />} />
        <Route path="/elections/:id/vote"    element={<Vote />} />
        <Route path="/elections/:id/results" element={<Results />} />
        <Route path="/history"               element={<History />} />
        <Route path="/verify"                element={<Verify />} />
        <Route path="/profile"               element={<Profile />} />

        {/* ── Admin ── */}
        <Route path="/admin"                 element={<Admin />} />

        {/* ── Legacy (keep old bookmarks working) ── */}
        <Route path="/vote"    element={<Elections />} />
        <Route path="/results" element={<Elections />} />
      </Routes>
    </BrowserRouter>
  );
}
