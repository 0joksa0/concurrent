import React from 'react';
import { NavLink } from 'react-router-dom';
import './navbar.css';

export function Navbar() {
  const [theme, setTheme] = React.useState('light');

  React.useEffect(() => {
    const saved = window.localStorage.getItem('cv_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = saved === 'dark' || saved === 'light' ? saved : (prefersDark ? 'dark' : 'light');
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  function toggleTheme() {
    setTheme((curr) => {
      const next = curr === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      window.localStorage.setItem('cv_theme', next);
      return next;
    });
  }

  return (
    <nav className="app-navbar">
      <div className="brand">Concurrent Viz</div>
      <div className="links">
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Trace
        </NavLink>
        <NavLink to="/theory" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Theory
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Quiz Admin
        </NavLink>
        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </nav>
  );
}
