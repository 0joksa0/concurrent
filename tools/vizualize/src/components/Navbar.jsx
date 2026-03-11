import React from 'react';
import { NavLink } from 'react-router-dom';
import './navbar.css';

export function Navbar() {
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
      </div>
    </nav>
  );
}
