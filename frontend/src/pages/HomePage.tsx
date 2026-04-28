import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);

    // ✅ Check login state and role on mount
    const checkAuthStatus = () => {
      const storedUser = localStorage.getItem('user');
      const storedRole = localStorage.getItem('role');
      setIsLoggedIn(!!storedUser);
      setUserRole(storedRole);
    };

    checkAuthStatus();

    // Listen for storage changes (logout from other tabs)
    window.addEventListener('storage', checkAuthStatus);

    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('storage', checkAuthStatus);
    };
  }, []);

  return (
    <div style={wrapperStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        .viton-header {
          opacity: 0;
          transform: translateY(-20px);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .viton-header.loaded {
          opacity: 1;
          transform: translateY(0);
        }
        .viton-header.scrolled {
          opacity: 0;
          transform: translateY(-30px);
          pointer-events: none;
        }
        .viton-logo-link {
          text-decoration: none;
          color: inherit;
          transition: opacity 0.3s ease;
        }
        .viton-logo-link:hover {
          opacity: 0.7;
        }

        .viton-hero-text {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 1.2s ease, transform 1.2s ease;
        }
        .viton-hero-text.loaded {
          opacity: 1;
          transform: translateY(0);
        }
        .viton-hero-sub {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 1s ease 0.4s, transform 1s ease 0.4s;
        }
        .viton-hero-sub.loaded {
          opacity: 1;
          transform: translateY(0);
        }
        .viton-hero-cta {
          opacity: 0;
          transition: opacity 0.8s ease 0.8s;
        }
        .viton-hero-cta.loaded {
          opacity: 1;
        }
        .viton-btn-primary {
          display: inline-block;
          padding: 34px 66px;
          background: #fff;
          color: #1a1a1a;
          text-decoration: none;
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 500;
          letter-spacing: 3px;
          text-transform: uppercase;
          transition: background 0.3s ease, color 0.3s ease;
        }
        .viton-btn-primary:hover {
          background: #c9a96e;
          color: #fff;
        }
        .viton-btn-secondary {
          display: inline-block;
          padding: 34px 66px;
          background: transparent;
          color: #fff;
          text-decoration: none;
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 500;
          letter-spacing: 3px;
          text-transform: uppercase;
          border: 1px solid rgba(255,255,255,0.6);
          transition: border-color 0.3s ease, background 0.3s ease;
        }
        .viton-btn-secondary:hover {
          border-color: #c9a96e;
          background: rgba(201,169,110,0.15);
        }
        .viton-feature-card {
          padding: 48px 36px;
          background: #fafaf8;
          border-top: 1px solid #e8e4de;
          transition: background 0.3s ease;
          cursor: default;
        }
        .viton-feature-card:hover {
          background: #f2ede7;
        }
        .viton-feature-card:hover .viton-feature-icon {
          transform: scale(1.1);
        }
        .viton-feature-icon {
          transition: transform 0.3s ease;
          display: block;
          margin-bottom: 20px;
        }
        .viton-stat {
          border-left: 1px solid #d4cfc8;
        }
        .viton-marquee-inner {
          animation: marquee 18s linear infinite;
          white-space: nowrap;
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .viton-section-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #1a1a1a;
          text-decoration: none;
          border-bottom: 1px solid #1a1a1a;
          padding-bottom: 2px;
          transition: color 0.3s, border-color 0.3s;
        }
        .viton-section-link:hover {
          color: #c9a96e;
          border-color: #c9a96e;
        }

        .viton-footer-link {
          color: rgba(255,255,255,0.75);
          text-decoration: none;
          font-family: 'Montserrat', sans-serif;
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          transition: color 0.25s ease, opacity 0.25s ease;
        }
        .viton-footer-link:hover {
          color: #c9a96e;
        }

        .viton-login-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 1.5px solid rgba(255,255,255,0.75);
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          cursor: pointer;
          transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
          pointer-events: auto;
          text-decoration: none;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3);
        }
        .viton-login-btn:hover {
          border-color: #c9a96e;
          background: rgba(201,169,110,0.25);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(201,169,110,0.4);
        }
        .viton-login-btn svg {
          width: 18px;
          height: 18px;
          stroke: rgba(255,255,255,0.95);
          stroke-width: 2;
        }
        .viton-login-btn:hover svg {
          stroke: #ffffff;
        }

        .viton-recommendations-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 18px;
          border-radius: 999px;
          border: 1.5px solid rgba(255,255,255,0.75);
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          cursor: pointer;
          transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
          pointer-events: auto;
          text-decoration: none;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3);
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.95);
          white-space: nowrap;
        }
        .viton-recommendations-btn:hover {
          border-color: #c9a96e;
          background: rgba(201,169,110,0.25);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(201,169,110,0.4);
          color: #ffffff;
        }
        .viton-recommendations-btn svg {
          width: 16px;
          height: 16px;
          stroke: rgba(255,255,255,0.95);
          stroke-width: 2;
          flex-shrink: 0;
        }
        .viton-recommendations-btn:hover svg {
          stroke: #ffffff;
        }

        .viton-nav-link {
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.8);
          text-decoration: none;
          pointer-events: auto;
          transition: color 0.25s ease;
          white-space: nowrap;
        }
        .viton-nav-link:hover {
          color: #c9a96e;
        }

        @media (max-width: 900px) {
          .viton-center-nav { display: none !important; }
        }
        @media (max-width: 768px) {
          .viton-recommendations-btn span {
            display: none;
          }
          .viton-recommendations-btn {
            padding: 10px 12px;
          }
        }
      `}</style>

      {/* ── HEADER ── */}
      <header
        className={`viton-header ${loaded ? 'loaded' : ''} ${scrolled ? 'scrolled' : ''}`}
        style={headerStyle}
      >
        {/* Logo */}
        <Link to="/" className="viton-logo-link" style={{ pointerEvents: 'auto' }}>
          <h1 style={logoStyle}>TOP LABLE</h1>
        </Link>

        {/* ── CENTER NAV LINKS ── */}
        <nav className="viton-center-nav" style={centerNavStyle}>
          <Link to="/" className="viton-nav-link">Home</Link>
          <Link to="/products" className="viton-nav-link">Products</Link>
          <Link to="/virtual-tryon" className="viton-nav-link">Try On</Link>
          <Link to="/recommendations" className="viton-nav-link">Recommendations</Link>
          <Link to="/body-recommend" className="viton-nav-link">Body Fit</Link>
          <Link to="/about" className="viton-nav-link">About</Link>
        </nav>

        {/* ── RIGHT: Profile / Admin / Login ── */}
        <div style={headerButtonsRowStyle}>
          {isLoggedIn && userRole === 'admin' ? (
            <Link to="/admin" className="viton-login-btn" aria-label="Admin Dashboard" title="Admin Dashboard">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 21a8 8 0 0 0-16 0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ) : isLoggedIn ? (
            <Link to="/profile" className="viton-login-btn" aria-label="Your Profile" title="Profile">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 21a8 8 0 0 0-16 0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ) : (
            <Link to="/login" className="viton-login-btn" aria-label="Login" title="Login">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 21a8 8 0 0 0-16 0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={heroSectionStyle}>
        <video autoPlay muted loop playsInline style={heroVideoStyle}>
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>

        <div style={heroOverlayStyle} />
        <div style={heroGradientStyle} />

<div style={heroContentStyle}>
          <div className={`viton-hero-text ${loaded ? 'loaded' : ''}`}>
            <h1 style={heroTitleStyle}>
              WEAR IT
              <br />
              <em style={{ fontStyle: 'italic', fontWeight: 300 }}>BEFORE</em>
              <br />
              YOU BUY IT
            </h1>
          </div>

          <div className={`viton-hero-sub ${loaded ? 'loaded' : ''}`} style={heroSubContainerStyle}>
            <p style={heroSubtitleStyle}>
              Experience AI-powered virtual try-on technology
              <br />
              that lets you see how clothes look on <em>your</em> body.
            </p>
          </div>

          <div className={`viton-hero-cta ${loaded ? 'loaded' : ''}`} style={heroCTAStyle}>
            <Link to="/products" className="viton-btn-primary">
              Browse Collection
            </Link>
            <Link to="/virtual-tryon" className="viton-btn-secondary">
              Try It On
            </Link>
          </div>
        </div>

        <div style={heroCornerStyle}>
          <span style={heroCornerTextStyle}>Virtual Try-On →</span>
        </div>
      </section>

      {/* ── MARQUEE STRIP ── */}
      <div style={marqueeStyle}>
        <div className="viton-marquee-inner">
          {[...Array(2)].map((_, i) => (
            <span key={i} style={marqueeTextStyle}>
              Virtual Try-On&nbsp;&nbsp;·&nbsp;&nbsp;
              AI Recommendations&nbsp;&nbsp;·&nbsp;&nbsp;
              Browse Collection&nbsp;&nbsp;·&nbsp;&nbsp;
              Personalised Style&nbsp;&nbsp;·&nbsp;&nbsp;
              Fashion Forward&nbsp;&nbsp;·&nbsp;&nbsp;
              Sri Lankan Design&nbsp;&nbsp;·&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* ── ABOUT STRIP ── */}
      <section style={aboutStripStyle}>
        <div style={aboutInnerStyle}>
          <p style={aboutOverlineStyle}>About</p>
          <p style={aboutTextStyle}>
            We create immersive digital fashion experiences that bridge the gap between
            online browsing and the confidence of trying on in person.
          </p>
        </div>
        <Link to="/products" className="viton-section-link" style={{ alignSelf: 'flex-end' }}>
          View Products →
        </Link>
      </section>

      {/* ── FEATURES GRID ── */}
      <section style={featuresSectionStyle}>
        <div style={featuresHeaderStyle}>
          <p style={featuresOverlineStyle}>What We Offer</p>
          <h2 style={featuresTitleStyle}>
            Three Pillars of<br /><em>Modern Shopping</em>
          </h2>
        </div>

        <div style={featuresGridStyle}>
          {[
            {
              num: '01',
              icon: '🛍️',
              title: 'Browse Collection',
              desc: 'Explore our curated catalogue of clothing items, filtered by category, colour, and size.',
              link: '/products',
              linkLabel: 'View Products',
            },
            {
              num: '02',
              icon: '👔',
              title: 'Virtual Try-On',
              desc: 'Upload your photo and see exactly how any garment looks on your unique body shape.',
              link: '/virtual-tryon',
              linkLabel: 'Try It Now',
            },
            {
              num: '03',
              icon: '🤖',
              title: 'AI Recommendations',
              desc: 'Our intelligent engine learns your style and suggests outfits you\'ll love.',
              link: '/recommendations',
              linkLabel: 'Discover More',
            },
          ].map((item) => (
            <div key={item.num} className="viton-feature-card" style={featureCardStyle}>
              <span className="viton-feature-icon" style={featureIconStyle}>{item.icon}</span>
              <p style={featureNumStyle}>{item.num}</p>
              <h3 style={featureTitleStyle}>{item.title}</h3>
              <p style={featureDescStyle}>{item.desc}</p>
              <Link to={item.link} className="viton-section-link" style={{ marginTop: '28px', display: 'inline-flex' }}>
                {item.linkLabel}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS ROW ── */}
      <section style={statsSectionStyle}>
        {[
          { value: 'VITON-HD', label: 'AI Model' },
          { value: '2D', label: 'Try-On Technology' },
          { value: 'KNN', label: 'Recommendation Engine' },
          { value: 'FastAPI', label: 'Powered By' },
        ].map((s, i) => (
          <div key={i} className={i > 0 ? 'viton-stat' : ''} style={statItemStyle}>
            <p style={statValueStyle}>{s.value}</p>
            <p style={statLabelStyle}>{s.label}</p>
          </div>
        ))}
      </section>

      {/* ── FINAL CTA ── */}
      <section style={finalCTAStyle}>
        <div style={finalCTAInnerStyle}>
          <p style={finalCTAOverlineStyle}>Get Started</p>
          <h2 style={finalCTATitleStyle}>
            Ready to Transform<br />
            <em>Your Shopping Experience?</em>
          </h2>
          <div style={finalCTAButtonsStyle}>
            <Link to="/virtual-tryon" className="viton-btn-primary" style={{ background: '#c9a96e', color: '#fff' }}>
              Try On Now
            </Link>
            <Link to="/products" className="viton-btn-secondary" style={{ color: '#1a1a1a', borderColor: '#1a1a1a' }}>
              Shop Collection
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={footerStyle}>
        <div style={footerInnerStyle}>
          <div style={footerColStyle}>
            <h3 style={footerBrandStyle}>VIRTUAL TRY-ON</h3>
            <p style={footerTextStyle}>
              AI-powered virtual try-on experiences designed to help shoppers feel confident before they buy.
              Discover curated fashion, try outfits instantly, and get personalised style suggestions.
            </p>

            <div style={footerMetaRowStyle}>
              <span style={footerMetaPillStyle}>VITON-HD</span>
              <span style={footerMetaPillStyle}>KNN Recs</span>
              <span style={footerMetaPillStyle}>FastAPI</span>
            </div>
          </div>

          <div style={footerColStyle}>
            <p style={footerOverlineStyle}>Quick Links</p>
            <div style={footerLinksColStyle}>
              <Link to="/" className="viton-footer-link">Home</Link>
              <Link to="/products" className="viton-footer-link">Products</Link>
              <Link to="/virtual-tryon" className="viton-footer-link">Virtual Try-On</Link>
              <Link to="/recommendations" className="viton-footer-link">Recommendations</Link>
              <Link to="/about" className="viton-footer-link">About</Link>
            </div>
          </div>

          <div style={footerColStyle}>
            <p style={footerOverlineStyle}>Contact</p>
            <p style={footerTextStyle}>
              Colombo, Sri Lanka<br />
              <span style={{ opacity: 0.85 }}>support@virtualtryon.com</span><br />
              <span style={{ opacity: 0.85 }}>+94 77 123 4567</span>
            </p>

            <div style={footerNewsletterStyle}>
              <p style={footerOverlineStyle}>Newsletter</p>
              <div style={footerFormRowStyle}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  style={footerInputStyle}
                />
                <button type="button" style={footerButtonStyle}>
                  Subscribe
                </button>
              </div>
              <p style={footerTinyStyle}>
                Get new arrivals & AI style picks — no spam.
              </p>
            </div>

            <div style={footerSocialRowStyle}>
              <a className="viton-footer-link" href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">Instagram</a>
              <span style={footerDotStyle}>·</span>
              <a className="viton-footer-link" href="https://tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok">TikTok</a>
              <span style={footerDotStyle}>·</span>
              <a className="viton-footer-link" href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">YouTube</a>
            </div>
          </div>
        </div>

        <div style={footerBottomStyle}>
          <p style={footerTinyStyle}>
            © {new Date().getFullYear()} Virtual Try-On. All rights reserved.
          </p>
          <div style={footerBottomLinksStyle}>
            <a className="viton-footer-link" href="/privacy">Privacy</a>
            <span style={footerDotStyle}>·</span>
            <a className="viton-footer-link" href="/terms">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* ─── Styles ─────────────────────────────────────────────────────────── */

const wrapperStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  background: '#fff',
  color: '#1a1a1a',
  overflowX: 'hidden',
};

const headerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 100,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '28px 48px',
  background: 'transparent',
  pointerEvents: 'none',
};

const centerNavStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '32px',
  pointerEvents: 'auto',
};

const headerButtonsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  pointerEvents: 'auto',
};

const logoStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '32px',
  fontWeight: 300,
  letterSpacing: '8px',
  color: '#fff',
  textTransform: 'uppercase',
  margin: 0,
  pointerEvents: 'auto',
  textShadow: '0 2px 8px rgba(0,0,0,0.3)',
};

const heroSectionStyle: React.CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  overflow: 'hidden',
  background: 'linear-gradient(160deg, #2c2416 0%, #3d3022 30%, #1a1a1a 70%, #0f0f0f 100%)',
};

const heroVideoStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  zIndex: 0,
  pointerEvents: 'none',
};

const heroOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: `
    radial-gradient(ellipse at 70% 40%, rgba(201,169,110,0.12) 0%, transparent 60%),
    radial-gradient(ellipse at 20% 80%, rgba(100,80,40,0.2) 0%, transparent 50%)
  `,
  background: 'rgba(15, 12, 8, 0.55)',
  zIndex: 1,
  pointerEvents: 'none',
};

const heroGradientStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 40%, rgba(0,0,0,0.6) 100%)',
  zIndex: 2,
  pointerEvents: 'none',
};


const heroContentStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 3,
  padding: '0 48px',
  maxWidth: '900px',
};

const heroTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(72px, 12vw, 140px)',
  fontWeight: 300,
  lineHeight: 0.9,
  color: '#fff',
  letterSpacing: '-2px',
  marginBottom: '40px',
};

const heroSubContainerStyle: React.CSSProperties = {
  maxWidth: '420px',
  marginBottom: '48px',
};

const heroSubtitleStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 300,
  lineHeight: 1.9,
  color: 'rgba(255,255,255,0.65)',
  letterSpacing: '0.5px',
};

const heroCTAStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  flexWrap: 'wrap',
};

const heroCornerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '32px',
  right: '48px',
  zIndex: 3,
};

const heroCornerTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 400,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)',
};

const marqueeStyle: React.CSSProperties = {
  background: '#c9a96e',
  overflow: 'hidden',
  padding: '14px 0',
};

const marqueeTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#fff',
  display: 'inline-block',
  paddingRight: '0',
};

const aboutStripStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '40px',
  padding: '72px 48px',
  borderBottom: '1px solid #e8e4de',
  flexWrap: 'wrap',
};

const aboutInnerStyle: React.CSSProperties = {
  maxWidth: '600px',
};

const aboutOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '20px',
};

const aboutTextStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(22px, 3vw, 30px)',
  fontWeight: 300,
  lineHeight: 1.6,
  color: '#1a1a1a',
};

const featuresSectionStyle: React.CSSProperties = {
  padding: '80px 48px',
  background: '#fff',
};

const featuresHeaderStyle: React.CSSProperties = {
  marginBottom: '56px',
};

const featuresOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '16px',
};

const featuresTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(32px, 5vw, 52px)',
  fontWeight: 300,
  lineHeight: 1.2,
  color: '#1a1a1a',
};

const featuresGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '1px',
  background: '#e8e4de',
  border: '1px solid #e8e4de',
};

const featureCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const featureIconStyle: React.CSSProperties = {
  fontSize: '28px',
};

const featureNumStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '13px',
  fontWeight: 400,
  letterSpacing: '2px',
  color: '#c9a96e',
  marginBottom: '12px',
};

const featureTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '26px',
  fontWeight: 400,
  color: '#1a1a1a',
  marginBottom: '16px',
  lineHeight: 1.2,
};

const featureDescStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  lineHeight: 1.9,
  color: '#6b6560',
  flex: 1,
};

const statsSectionStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  background: '#1a1a1a',
};

const statItemStyle: React.CSSProperties = {
  padding: '48px 36px',
};

const statValueStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '28px',
  fontWeight: 300,
  color: '#c9a96e',
  marginBottom: '8px',
  letterSpacing: '1px',
};

const statLabelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 400,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)',
};

const finalCTAStyle: React.CSSProperties = {
  padding: '120px 48px',
  background: '#fafaf8',
  borderTop: '1px solid #e8e4de',
};

const finalCTAInnerStyle: React.CSSProperties = {
  maxWidth: '640px',
};

const finalCTAOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '24px',
};

const finalCTATitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(36px, 5vw, 56px)',
  fontWeight: 300,
  lineHeight: 1.2,
  color: '#1a1a1a',
  marginBottom: '48px',
};

const finalCTAButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  flexWrap: 'wrap',
};

const footerStyle: React.CSSProperties = {
  background: '#0f0f0f',
  color: '#fff',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  padding: '80px 48px 36px',
};

const footerInnerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '48px',
};

const footerColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const footerBrandStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '22px',
  fontWeight: 300,
  letterSpacing: '6px',
  textTransform: 'uppercase',
  margin: 0,
};

const footerOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: 'rgba(201,169,110,0.9)',
  margin: 0,
};

const footerTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  lineHeight: 1.9,
  color: 'rgba(255,255,255,0.65)',
  margin: 0,
  maxWidth: '420px',
};

const footerMetaRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '8px',
};

const footerMetaPillStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  padding: '8px 12px',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '999px',
  color: 'rgba(255,255,255,0.72)',
};

const footerLinksColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const footerNewsletterStyle: React.CSSProperties = {
  marginTop: '6px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const footerFormRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
};

const footerInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: '200px',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff',
  outline: 'none',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  borderRadius: '6px',
};

const footerButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  background: '#c9a96e',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  borderRadius: '6px',
};

const footerSocialRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '10px',
};

const footerBottomStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '44px auto 0',
  paddingTop: '22px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '18px',
  flexWrap: 'wrap',
};

const footerBottomLinksStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
};

const footerTinyStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  letterSpacing: '1px',
  color: 'rgba(255,255,255,0.5)',
  margin: 0,
};

const footerDotStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.35)',
};

export default HomePage;
