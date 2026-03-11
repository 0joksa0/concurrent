import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar.jsx';
import { TracePage } from '../pages/TracePage.jsx';
import { TheoryPage } from '../pages/TheoryPage.jsx';

export function App() {
  return (
    <div>
      <Navbar />
      <Routes>
        <Route path="/" element={<TracePage />} />
        <Route path="/theory" element={<TheoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
