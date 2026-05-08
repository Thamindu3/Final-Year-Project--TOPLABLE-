// frontend/src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const BP_SKIN_TONES = [
  { value: 'Cool',    hint: 'Pink or blush undertones',   swatch: '#c8b8c8' },
  { value: 'Neutral', hint: 'Mix of warm and cool',       swatch: '#d4c4a8' },
  { value: 'Warm',    hint: 'Golden or yellowish undertones', swatch: '#c8944c' },
] as const;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [tab, setTab] = useState<'signin' | 'create' | 'admin'>('signin');

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  const [cEmail,   setCEmail]   = useState('');
  const [cPassword,setCPassword]= useState('');
  const [cConfirm, setCConfirm] = useState('');
  const [cName,    setCName]    = useState('');
  const [cMobile,  setCMobile]  = useState('');
  const [bDay,     setBDay]     = useState('');
  const [bMonth,   setBMonth]   = useState('');
  const [bYear,    setBYear]    = useState('');

  // Body profile (optional, for recommendations)
  const [bpGender,   setBpGender]   = useState('');          // '' | 'Female' | 'Male'
  const [bpHeight,   setBpHeight]   = useState(165);         // cm
  const [bpWeight,   setBpWeight]   = useState(62);          // kg
  const [bpSkinTone, setBpSkinTone] = useState('Neutral');   // 'Cool' | 'Neutral' | 'Warm'

  const [adminEmail,    setAdminEmail]    = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [showPassword,      setShowPassword]      = useState(false);
  const [showCPassword,     setShowCPassword]     = useState(false);
  const [showCConfirm,      setShowCConfirm]      = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);

  // ── Sign In handler ─────────────────────────────────────────
  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!email || !password) {
      setMsg('Please enter your email and password.');
      return;
    }
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        // ✅ Check if the backend returns a role, default to 'user'
        const role = data.role || 'user';
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('role', role);

        setMsg('✅ Signed in successfully! Redirecting...');

        // ✅ Redirect based on role
        setTimeout(() => {
          if (role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/profile');
          }
        }, 800);
      } else {
        setMsg(data.detail || 'Login failed.');
      }
    } catch {
      setMsg('Could not connect to the server.');
    }
  };

  // ── Create Account handler ──────────────────────────────────
  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!cEmail || !cPassword || !cConfirm || !cName ||
        !cMobile || !bDay || !bMonth || !bYear) {
      setMsg('Please fill all fields.');
      return;
    }
    if (cPassword !== cConfirm) {
      setMsg('Passwords do not match.');
      return;
    }
    if (cPassword.length < 6) {
      setMsg('Password must be at least 6 characters.');
      return;
    }
    const onlyDigits = cMobile.replace(/\D/g, '');
    if (onlyDigits.length < 7) {
      setMsg('Please enter a valid mobile number.');
      return;
    }

    const birthday = `${bDay}/${bMonth}/${bYear}`;

    try {
      const res = await fetch('http://localhost:8000/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     cName,
          email:    cEmail,
          password: cPassword,
          mobile:   `+94${cMobile}`,
          birthday,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Save body profile only if the user explicitly chose a gender
        if (bpGender && data.user?.user_id) {
          const _bmi = bpWeight / ((bpHeight / 100) ** 2);
          const _bodyType = _bmi < 18.5 ? 'slim'
                          : _bmi < 25   ? 'average'
                          : _bmi < 30   ? 'overweight'
                          :               'plus';
          await fetch(`http://localhost:8000/api/user/${data.user.user_id}/body-profile`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gender:    bpGender,
              height:    bpHeight,
              weight:    bpWeight,
              skin_tone: bpSkinTone,
              body_type: _bodyType,
            }),
          });
        }

        setMsg('✅ Account created! You can now sign in.');
        setCEmail(''); setCPassword(''); setCConfirm('');
        setCName('');  setCMobile('');
        setBDay('');   setBMonth(''); setBYear('');
        setBpGender(''); setBpHeight(165); setBpWeight(62); setBpSkinTone('Neutral');
        setTimeout(() => setTab('signin'), 1000);
      } else {
        setMsg(data.detail || 'Registration failed.');
      }
    } catch {
      setMsg('Could not connect to the server.');
    }
  };

  // ── Admin Login handler ─────────────────────────────────────
  const onAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!adminEmail || !adminPassword) {
      setMsg('Please enter admin credentials.');
      return;
    }
    try {
      const res = await fetch('http://localhost:8000/api/auth/admin/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        // ✅ Store both 'user' and 'admin' keys so both HomePage checks work
        localStorage.setItem('user', JSON.stringify(data.admin));
        localStorage.setItem('admin', JSON.stringify(data.admin));
        localStorage.setItem('role', 'admin');
        setMsg('✅ Admin login successful! Redirecting...');
        setTimeout(() => navigate('/admin'), 800);
      } else {
        setMsg(data.detail || 'Invalid admin credentials.');
      }
    } catch {
      setMsg('Could not connect to the server.');
    }
  };

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));

  return (
    <div style={wrapperStyle}>
      <style>{fonts + css}</style>

      <Navbar />

      <main style={mainStyle}>
        <div style={cardStyle}>

          <div style={tabsRowStyle}>
            <button
              type="button"
              onClick={() => { setTab('signin'); setMsg(null); }}
              className={`viton-tab ${tab === 'signin' ? 'active' : ''}`}
              style={tabBtnStyle}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab('create'); setMsg(null); }}
              className={`viton-tab ${tab === 'create' ? 'active' : ''}`}
              style={tabBtnStyle}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => { setTab('admin'); setMsg(null); }}
              className={`viton-tab ${tab === 'admin' ? 'active' : ''}`}
              style={tabBtnStyle}
            >
              Admin
            </button>
          </div>

          <div style={tabDividerStyle} />

          {msg && (
            <div style={msgStyle}>
              <span style={msgDotStyle} />
              <p style={msgTextStyle}>{msg}</p>
            </div>
          )}

          {/* ── SIGN IN FORM ── */}
          {tab === 'signin' && (
            <form onSubmit={onSignIn} style={formStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>EMAIL ADDRESS *</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  style={inputStyle}
                  placeholder=""
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>PASSWORD *</label>
                <div style={pwWrapStyle}>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    style={pwInputStyle}
                    placeholder=""
                  />
                  <button type="button" style={eyeBtnStyle} onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <div style={metaRowStyle}>
                <button
                  type="button"
                  className="viton-link"
                  style={metaLinkStyle}
                  onClick={() => setMsg('Forgot password (demo). Add your reset flow.')}
                >
                  Forgot Password?
                </button>
                <span style={requiredStyle}>* Required</span>
              </div>

              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={checkboxStyle}
                />
                <span style={checkboxTextStyle}>
                  Remember me - I want TOP LABLE to personalize my shopping
                  experience.&nbsp;
                  <span className="viton-link" style={inlineLinkStyle}>Details</span>
                </span>
              </label>

              <button type="submit" style={primaryBtnStyle} className="viton-primary-btn">
                SIGN IN
              </button>

              <p style={bottomHintStyle}>
                New here?{' '}
                <button
                  type="button"
                  className="viton-link"
                  style={inlineBtnLinkStyle}
                  onClick={() => setTab('create')}
                >
                  Create an account
                </button>
              </p>
            </form>
          )}

          {/* ── CREATE ACCOUNT FORM ── */}
          {tab === 'create' && (
            <form onSubmit={onCreate} style={formStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>EMAIL ADDRESS *</label>
                <input
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  style={inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>PASSWORD *</label>
                <div style={pwWrapStyle}>
                  <input
                    value={cPassword}
                    onChange={(e) => setCPassword(e.target.value)}
                    type={showCPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    style={pwInputStyle}
                  />
                  <button type="button" style={eyeBtnStyle} onClick={() => setShowCPassword(v => !v)} tabIndex={-1}>
                    <EyeIcon open={showCPassword} />
                  </button>
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>RE-ENTER PASSWORD *</label>
                <div style={pwWrapStyle}>
                  <input
                    value={cConfirm}
                    onChange={(e) => setCConfirm(e.target.value)}
                    type={showCConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    style={pwInputStyle}
                  />
                  <button type="button" style={eyeBtnStyle} onClick={() => setShowCConfirm(v => !v)} tabIndex={-1}>
                    <EyeIcon open={showCConfirm} />
                  </button>
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>NAME *</label>
                <input
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  type="text"
                  autoComplete="name"
                  style={inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>MOBILE NUMBER *</label>
                <div style={phoneRowStyle}>
                  <div style={countryCodeStyle}>+94</div>
                  <input
                    value={cMobile}
                    onChange={(e) => setCMobile(e.target.value)}
                    type="tel"
                    inputMode="tel"
                    style={phoneInputStyle}
                    placeholder="77 123 4567"
                  />
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>BIRTHDAY *</label>
                <div style={birthdayRowStyle}>
                  <select value={bDay} onChange={(e) => setBDay(e.target.value)} style={selectStyle}>
                    <option value="">DAY</option>
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={bMonth} onChange={(e) => setBMonth(e.target.value)} style={selectStyle}>
                    <option value="">MONTH</option>
                    {months.map((m, idx) => {
                      const val = String(idx + 1).padStart(2, '0');
                      return <option key={m} value={val}>{m}</option>;
                    })}
                  </select>
                  <select value={bYear} onChange={(e) => setBYear(e.target.value)} style={selectStyle}>
                    <option value="">YEAR</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {/* ── BODY PROFILE (OPTIONAL) ── */}
              <div style={optionalDividerStyle}>
                <span style={optionalDividerLineStyle} />
                <span style={optionalDividerTextStyle}>Body Profile · Optional · For Personalised Recommendations</span>
                <span style={optionalDividerLineStyle} />
              </div>

              {/* Gender toggle */}
              <div style={fieldStyle}>
                <label style={labelStyle}>GENDER</label>
                <div style={bpGenderRowStyle}>
                  {(['Female', 'Male'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setBpGender(g)}
                      style={bpGender === g ? bpGenderBtnActiveStyle : bpGenderBtnStyle}
                    >
                      {g === 'Female' ? '♀ Female' : '♂ Male'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Height slider */}
              <div style={fieldStyle}>
                <div style={bpSliderHeaderStyle}>
                  <label style={labelStyle}>HEIGHT</label>
                  <span style={bpSliderValueStyle}>{bpHeight} cm</span>
                </div>
                <input
                  type="range" min={140} max={210} step={1}
                  value={bpHeight}
                  onChange={e => setBpHeight(Number(e.target.value))}
                  style={{ width: '100%' }}
                  className="reg-body-slider"
                />
                <div style={bpSliderMarksStyle}>
                  <span style={bpMarkTextStyle}>140</span>
                  <span style={bpMarkTextStyle}>175</span>
                  <span style={bpMarkTextStyle}>210</span>
                </div>
              </div>

              {/* Weight slider */}
              <div style={fieldStyle}>
                <div style={bpSliderHeaderStyle}>
                  <label style={labelStyle}>WEIGHT</label>
                  <span style={bpSliderValueStyle}>{bpWeight} kg</span>
                </div>
                <input
                  type="range" min={35} max={150} step={1}
                  value={bpWeight}
                  onChange={e => setBpWeight(Number(e.target.value))}
                  style={{ width: '100%' }}
                  className="reg-body-slider"
                />
                <div style={bpSliderMarksStyle}>
                  <span style={bpMarkTextStyle}>35</span>
                  <span style={bpMarkTextStyle}>90</span>
                  <span style={bpMarkTextStyle}>150</span>
                </div>
              </div>

              {/* Live BMI */}
              {(() => {
                const _bmi = bpWeight / ((bpHeight / 100) ** 2);
                const _cat = _bmi < 18.5 ? 'Slim'
                           : _bmi < 25   ? 'Average'
                           : _bmi < 30   ? 'Overweight'
                           :               'Plus';
                return (
                  <div style={bpBmiBoxStyle}>
                    <span style={bpBmiLabelStyle}>LIVE BMI</span>
                    <span style={bpBmiValueStyle}>{_bmi.toFixed(1)}</span>
                    <span style={bpBmiCatStyle}>— {_cat}</span>
                  </div>
                );
              })()}

              {/* Skin Undertone cards */}
              <div style={fieldStyle}>
                <label style={labelStyle}>SKIN UNDERTONE</label>
                {BP_SKIN_TONES.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBpSkinTone(opt.value)}
                    style={bpSkinTone === opt.value ? bpSkinBtnActiveStyle : bpSkinBtnStyle}
                  >
                    <span style={{
                      ...bpSwatchStyle,
                      background: opt.swatch,
                      border: bpSkinTone === opt.value ? '2px solid #c9a96e' : '2px solid transparent',
                    }} />
                    <div style={bpSkinTextStyle}>
                      <span style={bpSkinNameStyle}>{opt.value}</span>
                      <span style={bpSkinHintStyle}>{opt.hint}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div style={metaRowStyle}>
                <span style={requiredStyle}>* Required</span>
              </div>

              <button type="submit" style={primaryBtnStyle} className="viton-primary-btn">
                CREATE ACCOUNT
              </button>

              <p style={bottomHintStyle}>
                Already have an account?{' '}
                <button
                  type="button"
                  className="viton-link"
                  style={inlineBtnLinkStyle}
                  onClick={() => setTab('signin')}
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* ── ADMIN LOGIN FORM ── */}
          {tab === 'admin' && (
            <form onSubmit={onAdminLogin} style={formStyle}>
              <div style={adminNoticeStyle}>
                <span style={adminNoticeDotStyle} />
                <p style={adminNoticeTextStyle}>
                  This area is restricted to authorised administrators only.
                </p>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>ADMIN EMAIL *</label>
                <input
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  style={inputStyle}
                  placeholder="admin@toplable.com"
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>ADMIN PASSWORD *</label>
                <div style={pwWrapStyle}>
                  <input
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    type={showAdminPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    style={pwInputStyle}
                  />
                  <button type="button" style={eyeBtnStyle} onClick={() => setShowAdminPassword(v => !v)} tabIndex={-1}>
                    <EyeIcon open={showAdminPassword} />
                  </button>
                </div>
              </div>

              <p style={adminHintStyle}>
                Default credentials: admin@toplable.com / admin123
              </p>

              <button type="submit" style={adminBtnStyle} className="viton-admin-btn">
                ADMIN LOGIN
              </button>

              <p style={bottomHintStyle}>
                Not an admin?{' '}
                <button
                  type="button"
                  className="viton-link"
                  style={inlineBtnLinkStyle}
                  onClick={() => setTab('signin')}
                >
                  Sign in as user
                </button>
              </p>
            </form>
          )}

        </div>
      </main>

      <footer style={footerStyle}>
        <p style={footerTextStyle}>
          © {new Date().getFullYear()} Virtual Try-On. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

/* ─── Styles ──────────────────────────────────────────────────────────── */

const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
`;

const css = `
  .reg-body-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 2px;
    background: #e8e4de;
    outline: none;
    border-radius: 2px;
    cursor: pointer;
    display: block;
    margin: 8px 0;
  }
  .reg-body-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #c9a96e;
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 2px 8px rgba(201,169,110,0.45);
  }
  .viton-tab {
    position: relative;
  }
  .viton-tab::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -12px;
    height: 1px;
    background: transparent;
    transition: background 0.25s ease;
  }
  .viton-tab.active::after {
    background: #1a1a1a;
  }
  .viton-link {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    color: #1a1a1a;
    text-decoration: none;
    border-bottom: 1px solid rgba(26,26,26,0.6);
    padding-bottom: 2px;
    transition: color 0.25s ease, border-color 0.25s ease;
    font-family: 'Montserrat', sans-serif;
    letter-spacing: 1px;
  }
  .viton-link:hover {
    color: #c9a96e;
    border-color: #c9a96e;
  }
  .viton-primary-btn:hover {
    background: #0c2440 !important;
  }
  .viton-admin-btn:hover {
    background: #7a1a1a !important;
  }
`;

const wrapperStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  background: '#f6f6f6',
  color: '#1a1a1a',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
};
const topBarStyle: React.CSSProperties = {
  padding: '28px 48px',
  display: 'flex',
  justifyContent: 'center',
};
const brandLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '20px',
  fontWeight: 300,
  letterSpacing: '6px',
  color: '#1a1a1a',
};
const mainStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 20px',
};
const cardStyle: React.CSSProperties = {
  width: 'min(760px, 92vw)',
  background: '#fff',
  border: '1px solid #d8d8d8',
  padding: '54px 56px 42px',
};
const tabsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '60px',
  alignItems: 'flex-end',
};
const tabBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '36px',
  fontWeight: 300,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: '#1a1a1a',
  padding: 0,
};
const tabDividerStyle: React.CSSProperties = {
  height: '1px',
  background: '#d8d8d8',
  marginTop: '20px',
  marginBottom: '38px',
};
const msgStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  padding: '14px 16px',
  background: '#fafaf8',
  border: '1px solid #e8e4de',
  marginBottom: '18px',
};
const msgDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#c9a96e',
  marginTop: '6px',
  flexShrink: 0,
};
const msgTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  lineHeight: 1.7,
  color: '#6b6560',
};
const formStyle: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
};
const fieldStyle: React.CSSProperties = {
  marginBottom: '22px',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#6b6560',
  marginBottom: '10px',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '18px 18px',
  border: '1px solid #cfcfcf',
  outline: 'none',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 300,
  color: '#1a1a1a',
  background: '#fff',
  transition: 'border-color 0.25s ease',
};
const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px',
  marginTop: '6px',
  marginBottom: '18px',
};
const metaLinkStyle: React.CSSProperties = { fontSize: '11px' };
const inlineLinkStyle: React.CSSProperties = { fontSize: '11px' };
const requiredStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 300,
  letterSpacing: '1px',
  color: '#6b6560',
};
const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '26px',
  cursor: 'pointer',
};
const checkboxStyle: React.CSSProperties = {
  width: '16px',
  height: '16px',
  marginTop: '2px',
};
const checkboxTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  lineHeight: 1.6,
  color: '#1a1a1a',
};
const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '18px 18px',
  background: '#0c2440',
  border: 'none',
  color: '#fff',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'background 0.25s ease',
  marginTop: '10px',
};
const bottomHintStyle: React.CSSProperties = {
  marginTop: '20px',
  textAlign: 'center',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 300,
  color: '#6b6560',
};
const inlineBtnLinkStyle: React.CSSProperties = { fontSize: '11px' };
const phoneRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '72px 1fr',
  gap: '10px',
  alignItems: 'stretch',
};
const countryCodeStyle: React.CSSProperties = {
  border: '1px solid #cfcfcf',
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 400,
  color: '#6b6560',
  letterSpacing: '1px',
};
const phoneInputStyle: React.CSSProperties = { ...inputStyle };
const birthdayRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '10px',
};
const twoColStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
};
const optionalDividerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  margin: '28px 0 24px',
};
const optionalDividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: '1px',
  background: '#d8d8d8',
};
const optionalDividerTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: '#9a9590',
  whiteSpace: 'nowrap',
};
const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '18px 18px',
  border: '1px solid #cfcfcf',
  background: '#fff',
  outline: 'none',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  color: '#1a1a1a',
};
const adminNoticeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  padding: '14px 16px',
  background: '#fdf8f2',
  border: '1px solid #c9a96e',
  marginBottom: '28px',
};
const adminNoticeDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#c9a96e',
  marginTop: '5px',
  flexShrink: 0,
};
const adminNoticeTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 300,
  lineHeight: 1.7,
  color: '#6b6560',
  letterSpacing: '0.5px',
};
const adminHintStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 300,
  color: '#9a9590',
  letterSpacing: '0.5px',
  marginBottom: '8px',
  marginTop: '-8px',
};
const adminBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '18px 18px',
  background: '#8b1a1a',
  border: 'none',
  color: '#fff',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'background 0.25s ease',
  marginTop: '10px',
};
const footerStyle: React.CSSProperties = {
  padding: '18px 20px 26px',
  textAlign: 'center',
};
const footerTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 300,
  color: '#9a9590',
  letterSpacing: '1px',
};

/* ── Body-profile section styles (registration form) ── */
const bpGenderRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
};
const bpGenderBtnStyle: React.CSSProperties = {
  padding: '14px',
  background: '#fff',
  border: '1px solid #d4cfc8',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 400,
  letterSpacing: '1px',
  color: '#6b6560',
  cursor: 'pointer',
  transition: 'all 0.25s ease',
};
const bpGenderBtnActiveStyle: React.CSSProperties = {
  ...bpGenderBtnStyle,
  background: '#1a1a1a',
  borderColor: '#1a1a1a',
  color: '#fff',
};
const bpSliderHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '4px',
};
const bpSliderValueStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '22px',
  fontWeight: 400,
  color: '#c9a96e',
};
const bpSliderMarksStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '4px',
};
const bpMarkTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 300,
  color: '#9a9590',
};
const bpBmiBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  background: '#fafaf8',
  border: '1px solid #e8e4de',
};
const bpBmiLabelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: '#9a9590',
};
const bpBmiValueStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '26px',
  fontWeight: 400,
  color: '#c9a96e',
};
const bpBmiCatStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  color: '#6b6560',
};
const bpSkinBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  padding: '12px 14px',
  background: '#fff',
  border: '1px solid #d4cfc8',
  cursor: 'pointer',
  textAlign: 'left' as const,
  width: '100%',
  marginBottom: '6px',
  transition: 'all 0.25s ease',
};
const bpSkinBtnActiveStyle: React.CSSProperties = {
  ...bpSkinBtnStyle,
  borderColor: '#c9a96e',
  background: '#fdf8f2',
};
const bpSwatchStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  flexShrink: 0,
  transition: 'border 0.25s ease',
};
const bpSkinTextStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  textAlign: 'left' as const,
};
const bpSkinNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '17px',
  fontWeight: 400,
  color: '#1a1a1a',
};
const bpSkinHintStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 300,
  color: '#6b6560',
};

const EyeIcon: React.FC<{ open: boolean }> = ({ open }) =>
  open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

const pwWrapStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};
const pwInputStyle: React.CSSProperties = {
  ...inputStyle,
  paddingRight: '48px',
};
const eyeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  right: '14px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  color: '#9a9590',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 0,
};

export default LoginPage;