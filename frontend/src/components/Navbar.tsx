import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const Navbar: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const check = () => {
      setIsLoggedIn(!!localStorage.getItem('user'));
      setUserRole(localStorage.getItem('role'));
      try {
        const cart = JSON.parse(localStorage.getItem('viton_cart') || '[]');
        setCartCount(cart.reduce((s: number, i: any) => s + i.quantity, 0));
      } catch { setCartCount(0); }
    };
    check();
    window.addEventListener('storage', check);
    const interval = setInterval(check, 800);
    return () => { window.removeEventListener('storage', check); clearInterval(interval); };
  }, []);

  const userIcon = (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 18, height: 18, stroke: 'rgba(255,255,255,0.95)', strokeWidth: 2 }}>
      <path d="M20 21a8 8 0 0 0-16 0" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <>
      <style>{navCSS}</style>
      <header style={navStyle}>
        <Link to="/" className="nb-logo-link">TOP LABLE</Link>

        <nav className="nb-center-nav">
          <Link to="/" className="nb-link">Home</Link>
          <Link to="/products" className="nb-link">Products</Link>
          <Link to="/virtual-tryon" className="nb-link">Try On</Link>
          <Link to="/body-recommend" className="nb-link">Body Fit</Link>
          <Link to="/about" className="nb-link">About</Link>
        </nav>

        <div style={rightStyle}>
          {/* Cart icon */}
          <Link to="/products" className="nb-icon-btn" title="Cart" style={{ position: 'relative' }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 18, height: 18, stroke: 'rgba(255,255,255,0.95)', strokeWidth: 2 }}>
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round"/>
              <path d="M16 10a4 4 0 0 1-8 0" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {cartCount > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#c9a96e', color: '#fff', borderRadius: '999px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat',sans-serif", fontSize: '8px', fontWeight: 700 }}>
                {cartCount}
              </span>
            )}
          </Link>

          {isLoggedIn && userRole === 'admin' ? (
            <Link to="/admin" className="nb-icon-btn" title="Admin Dashboard">{userIcon}</Link>
          ) : isLoggedIn ? (
            <Link to="/profile" className="nb-icon-btn" title="Profile">{userIcon}</Link>
          ) : (
            <Link to="/login" className="nb-icon-btn" title="Login">{userIcon}</Link>
          )}
        </div>
      </header>
    </>
  );
};

const navCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Montserrat:wght@300;400;500&display=swap');

  .nb-logo-link {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-weight: 300;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: #fff;
    text-decoration: none;
    transition: opacity 0.25s;
  }
  .nb-logo-link:hover { opacity: 0.7; }

  .nb-center-nav {
    display: flex;
    align-items: center;
    gap: 28px;
  }

  .nb-link {
    font-family: 'Montserrat', sans-serif;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.8);
    text-decoration: none;
    transition: color 0.25s;
    white-space: nowrap;
  }
  .nb-link:hover { color: #c9a96e; }

  .nb-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: 1.5px solid rgba(255,255,255,0.45);
    background: rgba(255,255,255,0.08);
    text-decoration: none;
    transition: border-color 0.25s, background 0.25s, transform 0.25s;
  }
  .nb-icon-btn:hover {
    border-color: #c9a96e;
    background: rgba(201,169,110,0.2);
    transform: translateY(-1px);
  }

  @media (max-width: 900px) {
    .nb-center-nav { display: none; }
  }
`;

const navStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '18px 48px',
  background: '#0f0f0f',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const rightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

export default Navbar;
