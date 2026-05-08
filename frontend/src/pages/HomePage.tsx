import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/* ─── Animated count-up hook ─────────────────────────────────── */
function useCountUp(target: number, duration = 2000, trigger = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!trigger || target === 0) { setCount(0); return; }
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * target));
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, trigger, duration]);
  return count;
}

const API = 'http://localhost:8000';

const HomePage: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalTryons, setTotalTryons] = useState(0);
  const [countersVisible, setCountersVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  /* animated counter values */
  const usersCount   = useCountUp(totalUsers,   2200, countersVisible);
  const tryonsCount  = useCountUp(totalTryons,  2000, countersVisible);
  const vitonAcc     = useCountUp(87,            1800, countersVisible);
  const knnAcc       = useCountUp(82,            1600, countersVisible);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);

    const checkAuthStatus = () => {
      const storedUser = localStorage.getItem('user');
      const storedRole = localStorage.getItem('role');
      setIsLoggedIn(!!storedUser);
      setUserRole(storedRole);
    };
    checkAuthStatus();
    window.addEventListener('storage', checkAuthStatus);

    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    /* fetch best sellers */
    fetch(`${API}/api/recommendations/popular?top_k=4`)
      .then(r => r.json())
      .then(d => setBestSellers(d.recommendations || []))
      .catch(() => {});

    /* fetch stats */
    fetch(`${API}/api/admin/stats`)
      .then(r => r.json())
      .then(d => {
        setTotalUsers(d.total_users || 0);
        setTotalTryons(d.total_tryons || 0);
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('storage', checkAuthStatus);
    };
  }, []);

  /* intersection observer for counter trigger */
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { setCountersVisible(entry.isIntersecting); },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div style={wrapperStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }

        .viton-header { opacity:0; transform:translateY(-20px); transition:opacity 0.8s ease,transform 0.8s ease; }
        .viton-header.loaded { opacity:1; transform:translateY(0); }
        .viton-header.scrolled { opacity:0; transform:translateY(-30px); pointer-events:none; }

        .viton-logo-link { text-decoration:none; color:inherit; transition:opacity 0.3s ease; }
        .viton-logo-link:hover { opacity:0.7; }

        .viton-hero-text { opacity:0; transform:translateY(40px); transition:opacity 1.2s ease,transform 1.2s ease; }
        .viton-hero-text.loaded { opacity:1; transform:translateY(0); }
        .viton-hero-sub { opacity:0; transform:translateY(30px); transition:opacity 1s ease 0.4s,transform 1s ease 0.4s; }
        .viton-hero-sub.loaded { opacity:1; transform:translateY(0); }
        .viton-hero-cta { opacity:0; transition:opacity 0.8s ease 0.8s; }
        .viton-hero-cta.loaded { opacity:1; }

        .viton-btn-primary { display:inline-block; padding:34px 66px; background:#fff; color:#1a1a1a; text-decoration:none; font-family:'Montserrat',sans-serif; font-size:20px; font-weight:500; letter-spacing:3px; text-transform:uppercase; transition:background 0.3s ease,color 0.3s ease; }
        .viton-btn-primary:hover { background:#c9a96e; color:#fff; }
        .viton-btn-secondary { display:inline-block; padding:34px 66px; background:transparent; color:#fff; text-decoration:none; font-family:'Montserrat',sans-serif; font-size:20px; font-weight:500; letter-spacing:3px; text-transform:uppercase; border:1px solid rgba(255,255,255,0.6); transition:border-color 0.3s ease,background 0.3s ease; }
        .viton-btn-secondary:hover { border-color:#c9a96e; background:rgba(201,169,110,0.15); }

        .viton-stat { border-left:1px solid #333; }

        .viton-marquee-inner { animation:marquee 18s linear infinite; white-space:nowrap; }
        @keyframes marquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }

        .viton-section-link { display:inline-flex; align-items:center; gap:8px; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:500; letter-spacing:3px; text-transform:uppercase; color:#1a1a1a; text-decoration:none; border-bottom:1px solid #1a1a1a; padding-bottom:2px; transition:color 0.3s,border-color 0.3s; }
        .viton-section-link:hover { color:#c9a96e; border-color:#c9a96e; }

        .viton-login-btn { display:inline-flex; align-items:center; justify-content:center; width:42px; height:42px; border-radius:999px; border:1.5px solid rgba(255,255,255,0.75); background:rgba(255,255,255,0.15); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); cursor:pointer; transition:border-color 0.25s ease,background 0.25s ease,transform 0.25s ease,box-shadow 0.25s ease; pointer-events:auto; text-decoration:none; box-shadow:0 2px 12px rgba(0,0,0,0.3); }
        .viton-login-btn:hover { border-color:#c9a96e; background:rgba(201,169,110,0.25); transform:translateY(-2px); box-shadow:0 4px 16px rgba(201,169,110,0.4); }
        .viton-login-btn svg { width:18px; height:18px; stroke:rgba(255,255,255,0.95); stroke-width:2; }
        .viton-login-btn:hover svg { stroke:#ffffff; }

        .viton-nav-link { font-family:'Montserrat',sans-serif; font-size:10px; font-weight:500; letter-spacing:2.5px; text-transform:uppercase; color:rgba(255,255,255,0.8); text-decoration:none; pointer-events:auto; transition:color 0.25s ease; white-space:nowrap; }
        .viton-nav-link:hover { color:#c9a96e; }

        /* best sellers */
        .bs-card { background:#fff; border:1px solid #e8e4de; overflow:hidden; transition:box-shadow 0.3s ease,transform 0.3s ease; cursor:pointer; text-decoration:none; display:flex; flex-direction:column; }
        .bs-card:hover { box-shadow:0 8px 32px rgba(0,0,0,0.10); transform:translateY(-4px); }
        .bs-card:hover .bs-img { transform:scale(1.04); }
        .bs-img { width:100%; aspect-ratio:3/4; object-fit:cover; transition:transform 0.5s ease; display:block; }
        .bs-img-wrap { overflow:hidden; }

        /* stat counter */
        .stat-counter { display:flex; flex-direction:column; align-items:center; padding:56px 36px; position:relative; }
        .stat-counter + .stat-counter::before { content:''; position:absolute; left:0; top:50%; transform:translateY(-50%); height:48px; width:1px; background:rgba(255,255,255,0.12); }
        .stat-value { font-family:'Cormorant Garamond',serif; font-size:clamp(40px,6vw,68px); font-weight:300; color:#c9a96e; line-height:1; margin-bottom:12px; }
        .stat-label { font-family:'Montserrat',sans-serif; font-size:10px; font-weight:500; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.45); text-align:center; }
        .stat-suffix { color:#c9a96e; }

        /* accuracy bar */
        .acc-bar-bg { width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:16px; overflow:hidden; }
        .acc-bar-fill { height:100%; background:#c9a96e; border-radius:2px; transition:width 2s cubic-bezier(0.22,1,0.36,1); }

        @media (max-width:900px) { .viton-center-nav { display:none !important; } }
        @media (max-width:768px) {
          .bs-grid { grid-template-columns: repeat(2,1fr) !important; }
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width:480px) {
          .bs-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <header className={`viton-header ${loaded ? 'loaded' : ''} ${scrolled ? 'scrolled' : ''}`} style={headerStyle}>
        <Link to="/" className="viton-logo-link" style={{ pointerEvents: 'auto' }}>
          <h1 style={logoStyle}>TOP LABLE</h1>
        </Link>
        <nav className="viton-center-nav" style={centerNavStyle}>
          <Link to="/" className="viton-nav-link">Home</Link>
          <Link to="/products" className="viton-nav-link">Products</Link>
          <Link to="/virtual-tryon" className="viton-nav-link">Try On</Link>
          <Link to="/body-recommend" className="viton-nav-link">Body Fit</Link>
          <Link to="/about" className="viton-nav-link">About</Link>
        </nav>
        <div style={headerButtonsRowStyle}>
          {isLoggedIn && userRole === 'admin' ? (
            <Link to="/admin" className="viton-login-btn" aria-label="Admin Dashboard">
              <svg viewBox="0 0 24 24" fill="none"><path d="M20 21a8 8 0 0 0-16 0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          ) : isLoggedIn ? (
            <Link to="/profile" className="viton-login-btn" aria-label="Your Profile">
              <svg viewBox="0 0 24 24" fill="none"><path d="M20 21a8 8 0 0 0-16 0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          ) : (
            <Link to="/login" className="viton-login-btn" aria-label="Login">
              <svg viewBox="0 0 24 24" fill="none"><path d="M20 21a8 8 0 0 0-16 0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
            <h1 style={heroTitleStyle}>WEAR IT<br /><em style={{ fontStyle:'italic', fontWeight:300 }}>BEFORE</em><br />YOU BUY IT</h1>
          </div>
          <div className={`viton-hero-sub ${loaded ? 'loaded' : ''}`} style={heroSubContainerStyle}>
            <p style={heroSubtitleStyle}>Experience AI-powered virtual try-on technology<br />that lets you see how clothes look on <em>your</em> body.</p>
          </div>
          <div className={`viton-hero-cta ${loaded ? 'loaded' : ''}`} style={heroCTAStyle}>
            <Link to="/products" className="viton-btn-primary">Browse Collection</Link>
            <Link to="/virtual-tryon" className="viton-btn-secondary">Try It On</Link>
          </div>
        </div>
        <div style={heroCornerStyle}>
          <span style={heroCornerTextStyle}>Virtual Try-On →</span>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div style={marqueeStyle}>
        <div className="viton-marquee-inner">
          {[...Array(2)].map((_, i) => (
            <span key={i} style={marqueeTextStyle}>
              Virtual Try-On&nbsp;&nbsp;·&nbsp;&nbsp;AI Recommendations&nbsp;&nbsp;·&nbsp;&nbsp;Browse Collection&nbsp;&nbsp;·&nbsp;&nbsp;Personalised Style&nbsp;&nbsp;·&nbsp;&nbsp;Fashion Forward&nbsp;&nbsp;·&nbsp;&nbsp;Sri Lankan Design&nbsp;&nbsp;·&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* ── BEST SELLERS ── */}
      {bestSellers.length > 0 && (
        <section style={bsSectionStyle}>
          <div style={bsHeaderStyle}>
            <p style={bsOverlineStyle}>Trending Now</p>
            <h2 style={bsTitleStyle}>Best Selling<br /><em>Clothing</em></h2>
            <Link to="/products" className="viton-section-link" style={{ marginTop:'8px' }}>Shop All →</Link>
          </div>
          <div className="bs-grid" style={bsGridStyle}>
            {bestSellers.map((p: any) => (
              <Link to={`/products`} key={p.id} className="bs-card">
                <div className="bs-img-wrap">
                  <img
                    className="bs-img"
                    src={p.image_url || `${API}/static/products/placeholder.jpg`}
                    alt={p.name}
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x533?text=No+Image'; }}
                  />
                </div>
                <div style={bsCardBodyStyle}>
                  <p style={bsCategoryStyle}>{p.category}</p>
                  <h3 style={bsNameStyle}>{p.name}</h3>
                  <p style={bsPriceStyle}>LKR {(p.price || 0).toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── ANIMATED STATS ── */}
      <section ref={statsRef} style={statsSectionStyle}>
        <div style={statsInnerStyle}>
          <p style={statsOverlineStyle}>By The Numbers</p>
          <h2 style={statsTitleStyle}>Platform<br /><em>Performance</em></h2>
        </div>
        <div className="stats-grid" style={statsGridStyle}>
          {/* Users */}
          <div className="stat-counter">
            <p className="stat-value">{usersCount.toLocaleString()}<span className="stat-suffix">+</span></p>
            <p className="stat-label">Users Signed Up</p>
          </div>
          {/* Try-ons */}
          <div className="stat-counter">
            <p className="stat-value">{tryonsCount.toLocaleString()}<span className="stat-suffix">+</span></p>
            <p className="stat-label">Try-Ons Generated</p>
          </div>
          {/* VITON-HD accuracy */}
          <div className="stat-counter">
            <p className="stat-value">{vitonAcc}<span className="stat-suffix">%</span></p>
            <p className="stat-label">VITON-HD Accuracy</p>
            <div className="acc-bar-bg">
              <div className="acc-bar-fill" style={{ width: countersVisible ? `${vitonAcc}%` : '0%' }} />
            </div>
          </div>
          {/* KNN accuracy */}
          <div className="stat-counter">
            <p className="stat-value">{knnAcc}<span className="stat-suffix">%</span></p>
            <p className="stat-label">KNN Accuracy</p>
            <div className="acc-bar-bg">
              <div className="acc-bar-fill" style={{ width: countersVisible ? `${knnAcc}%` : '0%' }} />
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

/* ─── Styles ─────────────────────────────────────────────────── */

const wrapperStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", background:'#fff', color:'#1a1a1a', overflowX:'hidden' };

const headerStyle: React.CSSProperties = { position:'fixed', top:0, left:0, right:0, zIndex:100, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'28px 48px', background:'transparent', pointerEvents:'none' };
const centerNavStyle: React.CSSProperties = { display:'flex', alignItems:'center', gap:'32px', pointerEvents:'auto' };
const headerButtonsRowStyle: React.CSSProperties = { display:'flex', alignItems:'center', gap:'12px', pointerEvents:'auto' };
const logoStyle: React.CSSProperties = { fontFamily:"'Cormorant Garamond',serif", fontSize:'32px', fontWeight:300, letterSpacing:'8px', color:'#fff', textTransform:'uppercase', margin:0, pointerEvents:'auto', textShadow:'0 2px 8px rgba(0,0,0,0.3)' };

const heroSectionStyle: React.CSSProperties = { position:'relative', minHeight:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', overflow:'hidden', background:'linear-gradient(160deg,#2c2416 0%,#3d3022 30%,#1a1a1a 70%,#0f0f0f 100%)' };
const heroVideoStyle: React.CSSProperties = { position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center', zIndex:0, pointerEvents:'none' };
const heroOverlayStyle: React.CSSProperties = { position:'absolute', inset:0, background:'rgba(15,12,8,0.55)', zIndex:1, pointerEvents:'none' };
const heroGradientStyle: React.CSSProperties = { position:'absolute', inset:0, background:'linear-gradient(to bottom,rgba(0,0,0,0.2) 0%,transparent 40%,rgba(0,0,0,0.6) 100%)', zIndex:2, pointerEvents:'none' };
const heroContentStyle: React.CSSProperties = { position:'relative', zIndex:3, padding:'0 48px', maxWidth:'900px' };
const heroTitleStyle: React.CSSProperties = { fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(72px,12vw,140px)', fontWeight:300, lineHeight:0.9, color:'#fff', letterSpacing:'-2px', marginBottom:'40px' };
const heroSubContainerStyle: React.CSSProperties = { maxWidth:'420px', marginBottom:'48px' };
const heroSubtitleStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'13px', fontWeight:300, lineHeight:1.9, color:'rgba(255,255,255,0.65)', letterSpacing:'0.5px' };
const heroCTAStyle: React.CSSProperties = { display:'flex', gap:'16px', flexWrap:'wrap' };
const heroCornerStyle: React.CSSProperties = { position:'absolute', bottom:'32px', right:'48px', zIndex:3 };
const heroCornerTextStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'10px', fontWeight:400, letterSpacing:'2.5px', textTransform:'uppercase', color:'rgba(255,255,255,0.4)' };

const marqueeStyle: React.CSSProperties = { background:'#c9a96e', overflow:'hidden', padding:'14px 0' };
const marqueeTextStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'10px', fontWeight:500, letterSpacing:'3px', textTransform:'uppercase', color:'#fff', display:'inline-block' };

/* best sellers */
const bsSectionStyle: React.CSSProperties = { padding:'80px 48px', background:'#fafaf8', borderTop:'1px solid #e8e4de' };
const bsHeaderStyle: React.CSSProperties = { marginBottom:'48px', display:'flex', flexDirection:'column', gap:'8px' };
const bsOverlineStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'10px', fontWeight:500, letterSpacing:'3px', textTransform:'uppercase', color:'#c9a96e' };
const bsTitleStyle: React.CSSProperties = { fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(32px,5vw,52px)', fontWeight:300, lineHeight:1.2, color:'#1a1a1a' };
const bsGridStyle: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'24px' };
const bsCardBodyStyle: React.CSSProperties = { padding:'20px 16px 24px' };
const bsCategoryStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'9px', fontWeight:500, letterSpacing:'2.5px', textTransform:'uppercase', color:'#c9a96e', marginBottom:'6px' };
const bsNameStyle: React.CSSProperties = { fontFamily:"'Cormorant Garamond',serif", fontSize:'18px', fontWeight:400, color:'#1a1a1a', marginBottom:'8px', lineHeight:1.2 };
const bsPriceStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'12px', fontWeight:400, color:'#6b6560' };

/* stats */
const statsSectionStyle: React.CSSProperties = { background:'#1a1a1a', padding:'0 48px 72px' };
const statsInnerStyle: React.CSSProperties = { paddingTop:'72px', marginBottom:'16px' };
const statsOverlineStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'10px', fontWeight:500, letterSpacing:'3px', textTransform:'uppercase', color:'#c9a96e', marginBottom:'16px' };
const statsTitleStyle: React.CSSProperties = { fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(32px,5vw,52px)', fontWeight:300, lineHeight:1.2, color:'#fff' };
const statsGridStyle: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(4,1fr)', marginTop:'48px' };

export default HomePage;
