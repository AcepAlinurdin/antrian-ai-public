import React, { useState } from 'react';
import UserPage from './pages/UserPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import RecapPage from './pages/RecapPage';

export default function App() {
  const [currentView, setCurrentView] = useState('user');

  return (
    <>
      {currentView === 'user' && <UserPage onNavigate={setCurrentView} />}
      {currentView === 'login' && <LoginPage onNavigate={setCurrentView} />}
      {currentView === 'admin' && <AdminPage onNavigate={setCurrentView} />}
      {currentView === 'recap' && <RecapPage onNavigate={setCurrentView} />}
    </>
  );
}
