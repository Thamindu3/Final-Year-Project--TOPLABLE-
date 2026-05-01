import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import VirtualTryOnPage from './pages/VirtualTryOnPage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import './App.css';
import BodyRecommendPage from "./pages/BodyRecommendPage";
import AdminPage from './pages/AdminPage';
import UserProfilePage from './pages/UserProfilePage';
import OrderPage from './pages/OrderPage';
import ProductDetailPage from './pages/ProductDetailPage';
import Footer from './components/Footer';

function AppRoutes() {
  const location = useLocation();
  const showFooter = location.pathname !== '/login';

  return (
    <div className="App" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/virtual-tryon" element={<VirtualTryOnPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/body-recommend" element={<BodyRecommendPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/profile" element={<UserProfilePage />} />
        <Route path="/order" element={<OrderPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
      </Routes>
      {showFooter && <Footer />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}



// Inline styles for navigation
const navStyle: React.CSSProperties = {
  backgroundColor: '#2c3e50',
  padding: '1rem 0',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

const navContainerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '0 2rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const logoStyle: React.CSSProperties = {
  color: 'white',
  fontSize: '1.5rem',
  fontWeight: 'bold',
  textDecoration: 'none'
};

const navLinksStyle: React.CSSProperties = {
  display: 'flex',
  gap: '2rem'
};

const linkStyle: React.CSSProperties = {
  color: 'white',
  textDecoration: 'none',
  fontSize: '1rem',
  transition: 'color 0.3s'
};

export default App;