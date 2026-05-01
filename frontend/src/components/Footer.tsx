import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => (
  <>
    <style>{footerCSS}</style>
    <footer style={footerStyle}>
      <div style={innerStyle}>
        <div style={brandColStyle}>
          <span className="ft-logo">TOP LABLE</span>
          <p style={taglineStyle}>Luxury fashion, virtually yours.</p>
        </div>

        <div style={linksGroupStyle}>
          <span className="ft-heading">Shop</span>
          <Link to="/products" className="ft-link">All Products</Link>
          <Link to="/virtual-tryon" className="ft-link">Virtual Try-On</Link>
          <Link to="/body-recommend" className="ft-link">Body Fit</Link>
        </div>

        <div style={linksGroupStyle}>
          <span className="ft-heading">Company</span>
          <Link to="/about" className="ft-link">About Us</Link>
          <Link to="/login" className="ft-link">My Account</Link>
        </div>
      </div>

      <div style={bottomBarStyle}>
        <span style={copyrightStyle}>© {new Date().getFullYear()} TOP LABLE. All rights reserved.</span>
      </div>
    </footer>
  </>
);

const footerCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Montserrat:wght@300;400;500&display=swap');

  .ft-logo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 20px;
    font-weight: 300;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: #fff;
  }

  .ft-heading {
    font-family: 'Montserrat', sans-serif;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    margin-bottom: 12px;
    display: block;
  }

  .ft-link {
    font-family: 'Montserrat', sans-serif;
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 1px;
    color: rgba(255,255,255,0.65);
    text-decoration: none;
    transition: color 0.25s;
    display: block;
    margin-bottom: 8px;
  }
  .ft-link:hover { color: #c9a96e; }
`;

const footerStyle: React.CSSProperties = {
  background: '#0f0f0f',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  marginTop: 'auto',
};

const innerStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '48px 48px 32px',
  display: 'flex',
  gap: 64,
  flexWrap: 'wrap',
};

const brandColStyle: React.CSSProperties = {
  flex: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const taglineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 11,
  letterSpacing: 1,
  color: 'rgba(255,255,255,0.4)',
  margin: 0,
};

const linksGroupStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 120,
};

const bottomBarStyle: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.06)',
  padding: '16px 48px',
  maxWidth: 1200,
  margin: '0 auto',
  width: '100%',
  boxSizing: 'border-box',
};

const copyrightStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 10,
  letterSpacing: 1,
  color: 'rgba(255,255,255,0.3)',
};

export default Footer;
