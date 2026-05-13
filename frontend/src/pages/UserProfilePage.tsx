// frontend/src/pages/UserProfilePage.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

interface UserData {
  user_id: number;
  name: string;
  email: string;
  mobile_number?: string;
  birthday?: string;
  created_at?: string;
  avatar_url?: string;
  // Body profile
  height?: number | null;
  weight?: number | null;
  gender?: string | null;
  skin_tone?: string | null;
  body_type?: string | null;
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  preferred_style?: string | null;
}

interface TryOnResult {
  result_id: number;
  product_id?: number;
  status: string;
  output_image_path?: string;
  person_image_path?: string;
  cloth_image_path?: string;
  product_name?: string;
  product_category?: string;
  created_at: string;
}

interface OrderItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color?: string;
  image_url: string;
  category: string;
}

interface ProductColorImages {
  product_id: number;
  color_images: Record<string, string>;
}

interface Order {
  order_id: number;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: string;
  address: Record<string, string>;
  created_at: string;
}

const PROFILE_SKIN_TONES = [
  { value: 'Cool',    hint: 'Pink or blush undertones',      swatch: '#c8b8c8' },
  { value: 'Neutral', hint: 'Mix of warm and cool',          swatch: '#d4c4a8' },
  { value: 'Warm',    hint: 'Golden or yellowish undertones', swatch: '#c8944c' },
] as const;

const UserProfilePage: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [tryOnResults, setTryOnResults] = useState<TryOnResult[]>([]);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [productColorImages, setProductColorImages] = useState<Record<number, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tryon-history' | 'order-history' | 'settings'>('overview');
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<UserData>>({});
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const navigate = useNavigate();
  const API_BASE_URL = 'http://localhost:8000';

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    const u = JSON.parse(storedUser);
    if (activeTab === 'order-history') fetchOrders(u.user_id);
    if (activeTab === 'tryon-history') fetchTryOnHistory(u.user_id);
  }, [activeTab]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        navigate('/login');
        return;
      }
      const basic = JSON.parse(storedUser);
      // Fetch full profile (includes body measurements) from API
      const res = await fetch(`${API_BASE_URL}/api/user/${basic.user_id}/profile`);
      if (res.ok) {
        const data = await res.json();
        const fullProfile: UserData = { ...basic, ...data.profile };
        setUser(fullProfile);
        setEditData(fullProfile);
        localStorage.setItem('user', JSON.stringify(fullProfile));
      } else {
        setUser(basic);
        setEditData(basic);
      }
      fetchOrders(basic.user_id);
      setError(null);
    } catch (e: any) {
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async (userId: number) => {
    try {
      const [ordersRes, productsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/user/${userId}/orders`),
        fetch(`${API_BASE_URL}/api/products`),
      ]);
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders || []);
      }
      if (productsRes.ok) {
        const data = await productsRes.json();
        const map: Record<number, Record<string, string>> = {};
        for (const p of (data.products || [])) {
          if (p.color_images && Object.keys(p.color_images).length > 0) {
            map[p.product_id] = p.color_images;
          }
        }
        setProductColorImages(map);
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    }
  };

  const fetchTryOnHistory = async (userId: number) => {
    setTryOnLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tryon/history/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setTryOnResults(data.results || []);
      }
    } catch (e) {
      console.error('Failed to fetch try-on history:', e);
    } finally {
      setTryOnLoading(false);
    }
  };

  const handleDeleteTryOn = async (resultId: number) => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    const u = JSON.parse(storedUser);
    const userId = u?.user_id ?? u?.userId ?? u?.id;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tryon/${resultId}?user_id=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setTryOnResults(prev => prev.filter(r => r.result_id !== resultId));
      }
    } catch (e) {
      console.error('Failed to delete try-on:', e);
    }
  };

  const handleChangePassword = async () => {
    setPwError(''); setPwSuccess('');
    if (!pwForm.current) { setPwError('Please enter your current password.'); return; }
    if (pwForm.next.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match.'); return; }
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    const u = JSON.parse(storedUser);
    setPwLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${u.user_id}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }),
      });
      if (res.ok) {
        setPwSuccess('Password changed successfully.');
        setPwForm({ current: '', next: '', confirm: '' });
        setTimeout(() => { setPwSuccess(''); setShowPasswordForm(false); }, 2500);
      } else {
        const data = await res.json();
        setPwError(data.detail || 'Failed to change password.');
      }
    } catch { setPwError('Network error. Please try again.'); }
    finally { setPwLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    navigate('/');
  };

  const handleEditSave = async () => {
    if (!user) return;
    try {
      // Save basic info
      const infoRes = await fetch(`${API_BASE_URL}/api/user/${user.user_id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     editData.name     || null,
          mobile:   editData.mobile_number || null,
          birthday: editData.birthday || null,
        }),
      });
      if (!infoRes.ok) throw new Error('Failed to save personal info');

      // Auto-derive body_type from BMI
      const _h = Number(editData.height ?? 165);
      const _w = Number(editData.weight ?? 62);
      const _bmi = _w / ((_h / 100) ** 2);
      const _bodyType = _bmi < 18.5 ? 'slim' : _bmi < 25 ? 'average' : _bmi < 30 ? 'overweight' : 'plus';

      // Save body profile
      await fetch(`${API_BASE_URL}/api/user/${user.user_id}/body-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          height:    _h,
          weight:    _w,
          gender:    editData.gender    || null,
          skin_tone: editData.skin_tone || null,
          body_type: _bodyType,
        }),
      });

      const infoData = await infoRes.json();
      const updated: UserData = { ...editData as UserData, ...infoData.profile };
      setUser(updated);
      setEditData(updated);
      localStorage.setItem('user', JSON.stringify(updated));
      setEditMode(false);
      setError(null);
    } catch (e: any) {
      setError('Failed to update profile');
    }
  };

  const handleEditCancel = () => {
    setEditData(user || {});
    setEditMode(false);
  };

  const handleFieldChange = (field: keyof UserData, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div style={loadingWrapStyle}>
        <style>{fonts}</style>
        <div style={loadingInnerStyle}>
          <div style={loadingBarStyle} />
          <p style={loadingTextStyle}>Loading Your Profile</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={errorWrapStyle}>
        <style>{fonts}</style>
        <p style={errorOverlineStyle}>Error</p>
        <h2 style={errorTitleStyle}>Profile Unavailable</h2>
        <p style={errorMsgStyle}>{error || 'Please log in to view your profile.'}</p>
        <Link to="/login" style={retryBtnStyle}>
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <style>{fonts + dynamicCSS}</style>

      <Navbar />

      {/* ── HERO SECTION ── */}
      <section style={heroSectionStyle}>
        <div style={heroInnerStyle}>
          <p style={heroOverlineStyle}>Your Account</p>
          <h1 style={heroTitleStyle}>Profile Settings</h1>
          <p style={heroSubtitleStyle}>
            Manage your account information, view your try-on history, and customize your preferences
          </p>
          <button onClick={handleLogout} style={logoutBtnStyle}>Logout</button>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div style={dividerStyle} />

      {/* ── ERROR BANNER ── */}
      {error && (
        <div style={errorBannerStyle}>
          <span style={errorDotStyle} />
          <p style={errorBannerTextStyle}>{error}</p>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main style={mainStyle}>
        <div style={layoutStyle}>
          {/* ── SIDEBAR (PROFILE CARD) ── */}
          <aside style={sidebarStyle}>
            <div style={profileCardStyle}>
              {/* Avatar */}
              <div style={avatarContainerStyle}>
                <div style={avatarStyle}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} style={avatarImgStyle} />
                  ) : (
                    <span style={avatarInitialStyle}>{user.name?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </div>

              {/* User Basic Info */}
              <h2 style={profileNameStyle}>{user.name}</h2>
              <p style={profileEmailStyle}>{user.email}</p>

              {/* Quick Stats */}
              <div style={statsGridStyle}>
                <div style={statItemStyle}>
                  <p style={statValueStyle}>
                    {new Date(user.created_at || Date.now()).toLocaleDateString()}
                  </p>
                  <p style={statLabelStyle}>Member Since</p>
                </div>
              </div>

              {/* Account Status */}
              <div style={statusBadgeStyle}>
                <span style={statusDotStyle} />
                <span style={statusTextStyle}>Active Account</span>
              </div>

              {/* Quick Actions */}
              <div style={quickActionsStyle}>
                <button
                  onClick={() => setEditMode(!editMode)}
                  style={editBtnStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#c9a96e';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#1a1a1a';
                  }}
                >
                  {editMode ? 'Cancel Edit' : 'Edit Profile'}
                </button>
              </div>
            </div>
          </aside>

          {/* ── MAIN CONTENT AREA ── */}
          <section style={contentAreaStyle}>
            {/* ── TABS ── */}
            <div style={tabsRowStyle}>
              {(['overview', 'tryon-history', 'order-history', 'settings'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setEditMode(false); }}
                  className={`profile-tab ${activeTab === tab ? 'active' : ''}`}
                  style={{ ...tabBtnStyle, ...(activeTab === tab ? tabBtnActiveStyle : {}) }}
                >
                  {tab === 'overview' && '👤 Overview'}
                  {tab === 'tryon-history' && '👔 Try-On History'}
                  {tab === 'order-history' && '🛍️ Order History'}
                  {tab === 'settings' && '⚙️ Settings'}
                </button>
              ))}
            </div>

            <div style={tabDividerStyle} />

            {/* ── TAB CONTENT: OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div style={tabContentStyle}>
                <div style={sectionHeaderStyle}>
                  <p style={sectionOverlineStyle}>Personal Information</p>
                  <h2 style={sectionTitleStyle}>Your Profile Details</h2>
                </div>

                {editMode ? (
                  <div style={editFormStyle}>
                    {/* Name */}
                    <div style={formFieldStyle}>
                      <label style={labelStyle}>Full Name</label>
                      <input
                        type="text"
                        value={editData.name || ''}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    {/* Email */}
                    <div style={formFieldStyle}>
                      <label style={labelStyle}>Email Address</label>
                      <input
                        type="email"
                        value={editData.email || ''}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        style={inputStyle}
                        disabled
                      />
                      <p style={helperTextStyle}>Email cannot be changed</p>
                    </div>

                    {/* Mobile */}
                    <div style={formFieldStyle}>
                      <label style={labelStyle}>Mobile Number</label>
                      <input
                        type="tel"
                        value={editData.mobile_number || ''}
                        onChange={(e) => handleFieldChange('mobile_number', e.target.value)}
                        style={inputStyle}
                        placeholder="+94 77 123 4567"
                      />
                    </div>

                    {/* Birthday */}
                    <div style={formFieldStyle}>
                      <label style={labelStyle}>Birthday</label>
                      <input
                        type="date"
                        value={editData.birthday || ''}
                        onChange={(e) => handleFieldChange('birthday', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    {/* ── Body Profile section ── */}
                    <div style={editSectionDividerStyle}>
                      <span style={editSectionDividerLineStyle} />
                      <span style={editSectionDividerTextStyle}>Body Profile · For Recommendations</span>
                      <span style={editSectionDividerLineStyle} />
                    </div>

                    {/* Gender toggle */}
                    <div style={formFieldStyle}>
                      <label style={labelStyle}>Gender</label>
                      <div style={profileGenderRowStyle}>
                        {(['Female', 'Male'] as const).map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleFieldChange('gender', g)}
                            style={editData.gender === g ? profileGenderBtnActiveStyle : profileGenderBtnStyle}
                          >
                            {g === 'Female' ? '♀ Female' : '♂ Male'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Height slider */}
                    <div style={formFieldStyle}>
                      <div style={profileSliderHeaderStyle}>
                        <label style={labelStyle}>Height</label>
                        <span style={profileSliderValueStyle}>{editData.height ?? 165} cm</span>
                      </div>
                      <input
                        type="range" min={140} max={210} step={1}
                        value={editData.height ?? 165}
                        onChange={e => handleFieldChange('height', e.target.value)}
                        style={{ width: '100%' }}
                        className="profile-body-slider"
                      />
                      <div style={profileSliderMarksStyle}>
                        <span style={profileMarkTextStyle}>140</span>
                        <span style={profileMarkTextStyle}>175</span>
                        <span style={profileMarkTextStyle}>210</span>
                      </div>
                    </div>

                    {/* Weight slider */}
                    <div style={formFieldStyle}>
                      <div style={profileSliderHeaderStyle}>
                        <label style={labelStyle}>Weight</label>
                        <span style={profileSliderValueStyle}>{editData.weight ?? 62} kg</span>
                      </div>
                      <input
                        type="range" min={35} max={150} step={1}
                        value={editData.weight ?? 62}
                        onChange={e => handleFieldChange('weight', e.target.value)}
                        style={{ width: '100%' }}
                        className="profile-body-slider"
                      />
                      <div style={profileSliderMarksStyle}>
                        <span style={profileMarkTextStyle}>35</span>
                        <span style={profileMarkTextStyle}>90</span>
                        <span style={profileMarkTextStyle}>150</span>
                      </div>
                    </div>

                    {/* Live BMI */}
                    {(() => {
                      const h = Number(editData.height ?? 165);
                      const w = Number(editData.weight ?? 62);
                      const _bmi = w / ((h / 100) ** 2);
                      const _cat = _bmi < 18.5 ? 'Slim' : _bmi < 25 ? 'Average' : _bmi < 30 ? 'Overweight' : 'Plus';
                      return (
                        <div style={profileBmiBoxStyle}>
                          <span style={profileBmiLabelStyle}>LIVE BMI</span>
                          <span style={profileBmiValueStyle}>{_bmi.toFixed(1)}</span>
                          <span style={profileBmiCatStyle}>— {_cat}</span>
                        </div>
                      );
                    })()}

                    {/* Skin Undertone cards */}
                    <div style={formFieldStyle}>
                      <label style={labelStyle}>Skin Undertone</label>
                      {PROFILE_SKIN_TONES.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleFieldChange('skin_tone', opt.value)}
                          style={editData.skin_tone === opt.value ? profileSkinBtnActiveStyle : profileSkinBtnStyle}
                        >
                          <span style={{
                            ...profileSwatchStyle,
                            background: opt.swatch,
                            border: editData.skin_tone === opt.value ? '2px solid #c9a96e' : '2px solid transparent',
                          }} />
                          <div style={profileSkinTextStyle}>
                            <span style={profileSkinNameStyle}>{opt.value}</span>
                            <span style={profileSkinHintStyle}>{opt.hint}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div style={formActionsStyle}>
                      <button
                        onClick={handleEditSave}
                        style={saveBtnStyle}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#0c2440')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={handleEditCancel}
                        style={cancelBtnStyle}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f3ef')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Personal Information */}
                    <div style={infoGridStyle}>
                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Full Name</p>
                        <p style={infoValueStyle}>{user.name}</p>
                      </div>

                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Email Address</p>
                        <p style={infoValueStyle}>{user.email}</p>
                      </div>

                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Mobile Number</p>
                        <p style={infoValueStyle}>{user.mobile_number || '—'}</p>
                      </div>

                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Birthday</p>
                        <p style={infoValueStyle}>{user.birthday || '—'}</p>
                      </div>

                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Member Since</p>
                        <p style={infoValueStyle}>
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                            : '—'}
                        </p>
                      </div>

                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Account Status</p>
                        <p style={{ ...infoValueStyle, color: '#155724' }}>✓ Active</p>
                      </div>
                    </div>

                    {/* Body Profile */}
                    <div style={bodySectionHeaderStyle}>
                      <p style={sectionOverlineStyle}>For Recommendations</p>
                      <h3 style={bodySectionTitleStyle}>Body Profile</h3>
                    </div>

                    <div style={infoGridStyle}>
                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Gender</p>
                        <p style={infoValueStyle}>{user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : '—'}</p>
                      </div>
                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Skin Tone</p>
                        <p style={infoValueStyle}>{user.skin_tone ? user.skin_tone.charAt(0).toUpperCase() + user.skin_tone.slice(1) : '—'}</p>
                      </div>
                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Height</p>
                        <p style={infoValueStyle}>{user.height ? `${user.height} cm` : '—'}</p>
                      </div>
                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Weight</p>
                        <p style={infoValueStyle}>{user.weight ? `${user.weight} kg` : '—'}</p>
                      </div>
                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Body Type (BMI)</p>
                        <p style={infoValueStyle}>
                          {user.height && user.weight
                            ? (() => {
                                const _b = Number(user.weight) / ((Number(user.height) / 100) ** 2);
                                return _b < 18.5 ? 'Slim' : _b < 25 ? 'Average' : _b < 30 ? 'Overweight' : 'Plus';
                              })()
                            : '—'}
                        </p>
                      </div>
                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Chest</p>
                        <p style={infoValueStyle}>{user.chest ? `${user.chest} cm` : '—'}</p>
                      </div>
                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Waist</p>
                        <p style={infoValueStyle}>{user.waist ? `${user.waist} cm` : '—'}</p>
                      </div>
                      <div style={infoCardStyle}>
                        <p style={infoLabelStyle}>Hips</p>
                        <p style={infoValueStyle}>{user.hips ? `${user.hips} cm` : '—'}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── TAB CONTENT: TRY-ON HISTORY ── */}
            {activeTab === 'tryon-history' && (
              <div style={tabContentStyle}>
                <div style={sectionHeaderStyle}>
                  <p style={sectionOverlineStyle}>Your Activity</p>
                  <h2 style={sectionTitleStyle}>Try-On History</h2>
                </div>

                {tryOnLoading ? (
                  <div style={emptyStateStyle}>
                    <p style={historyDateStyle}>Loading your try-on history…</p>
                  </div>
                ) : tryOnResults.length === 0 ? (
                  <div style={emptyStateStyle}>
                    <p style={emptyIconStyle}>👔</p>
                    <p style={emptyTitleStyle}>No Try-Ons Yet</p>
                    <p style={emptyDescStyle}>
                      Start exploring our collection and try on some garments to see them here.
                    </p>
                    <Link to="/virtual-tryon" style={tryNowBtnStyle}>
                      Try It Now
                    </Link>
                  </div>
                ) : (
                  <div style={historyGridStyle}>
                    {tryOnResults.map((result) => (
                      <div key={result.result_id} style={{ ...historyCardStyle, position: 'relative' }}
                        className="tryon-history-card"
                      >
                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteTryOn(result.result_id)}
                          style={deleteBtnStyle}
                          title="Delete"
                          className="tryon-delete-btn"
                        >
                          ✕
                        </button>

                        {/* Result image (main) */}
                        <div style={historyImageStyle}>
                          {result.output_image_path ? (
                            <img
                              src={`${API_BASE_URL}${result.output_image_path}`}
                              alt="Try-on result"
                              style={historyImageImgStyle}
                            />
                          ) : (
                            <div style={placeholderStyle}>No Image</div>
                          )}
                        </div>

                        {/* Cloth + person thumbnails */}
                        {(result.cloth_image_path || result.person_image_path) && (
                          <div style={historyThumbRowStyle}>
                            {result.person_image_path && (
                              <div style={historyThumbStyle}>
                                <img
                                  src={`${API_BASE_URL}${result.person_image_path}`}
                                  alt="Model"
                                  style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                />
                                <p style={historyThumbLabelStyle}>Model</p>
                              </div>
                            )}
                            {result.cloth_image_path && (
                              <div style={historyThumbStyle}>
                                <img
                                  src={`${API_BASE_URL}${result.cloth_image_path}`}
                                  alt="Clothing"
                                  style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                />
                                <p style={historyThumbLabelStyle}>Clothing</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div style={historyInfoStyle}>
                          {result.product_name && (
                            <p style={historyStatusStyle}>
                              <span style={{ color: '#c9a96e' }}>{result.product_category}</span>{' '}· {result.product_name}
                            </p>
                          )}
                          <p style={historyDateStyle}>
                            {new Date(result.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}
                          </p>
                          <p style={historyStatusStyle}>
                            Status: <span style={{ color: '#4caf50' }}>{result.status}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB CONTENT: ORDER HISTORY ── */}
            {activeTab === 'order-history' && (
              <div style={tabContentStyle}>
                <div style={sectionHeaderStyle}>
                  <p style={sectionOverlineStyle}>Your Purchases</p>
                  <h2 style={sectionTitleStyle}>Order History</h2>
                </div>

                {orders.length === 0 ? (
                  <div style={emptyStateStyle}>
                    <p style={emptyIconStyle}>🛍️</p>
                    <p style={emptyTitleStyle}>No Orders Yet</p>
                    <p style={emptyDescStyle}>
                      Once you place an order, it will appear here so you can track your purchases.
                    </p>
                    <Link to="/products" style={tryNowBtnStyle}>Shop Now</Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {orders.map(order => (
                      <div key={order.order_id} style={orderCardStyle}>
                        {/* Order header */}
                        <div style={orderCardHeaderStyle}>
                          <div>
                            <p style={orderIdStyle}>Order #{order.order_id}</p>
                            <p style={orderDateStyle}>
                              {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={orderStatusBadgeStyle}>{order.status}</span>
                            <p style={orderTotalStyle}>LKR {order.total.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Items */}
                        <div style={orderItemsStyle}>
                          {order.items.map((item, i) => {
                            const resolvedImg =
                              (item.color && productColorImages[item.product_id]?.[item.color]) ||
                              item.image_url;
                            return (
                              <div key={i} style={orderItemRowStyle}>
                                <div style={orderItemThumbStyle}>
                                  {resolvedImg && (
                                    <img src={resolvedImg} alt={item.name}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  )}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <p style={orderItemNameStyle}>{item.name}</p>
                                  <p style={orderItemMetaStyle}>
                                    {item.size && `Size: ${item.size} · `}
                                    {item.color && `Color: ${item.color} · `}
                                    Qty: {item.quantity}
                                  </p>
                                </div>
                                <p style={orderItemPriceStyle}>LKR {(item.price * item.quantity).toFixed(2)}</p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Footer */}
                        <div style={orderCardFooterStyle}>
                          <span style={orderMetaTextStyle}>
                            Shipped to {order.address.city || '—'} · {order.address.shippingMethod === 'express' ? 'Express' : 'Standard'} delivery
                          </span>
                          <span style={orderMetaTextStyle}>
                            {order.discount > 0 && `Discount: −LKR ${order.discount.toFixed(2)} · `}
                            Shipping: LKR {order.shipping.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB CONTENT: SETTINGS ── */}
            {activeTab === 'settings' && (
              <div style={tabContentStyle}>
                <div style={sectionHeaderStyle}>
                  <p style={sectionOverlineStyle}>Preferences</p>
                  <h2 style={sectionTitleStyle}>Account Settings</h2>
                </div>

                {/* Email Notifications */}
                <div style={settingsSectionStyle}>
                  <h3 style={settingsTitleStyle}>Email Notifications</h3>
                  <div style={settingsItemStyle}>
                    <div style={settingsLabelStyle}>
                      <p style={settingsLabelMainStyle}>Order Updates</p>
                      <p style={settingsLabelSubStyle}>Get notified about order status changes</p>
                    </div>
                    <input type="checkbox" defaultChecked style={checkboxStyle} />
                  </div>

                  <div style={settingsItemStyle}>
                    <div style={settingsLabelStyle}>
                      <p style={settingsLabelMainStyle}>Product Recommendations</p>
                      <p style={settingsLabelSubStyle}>Receive personalized style suggestions</p>
                    </div>
                    <input type="checkbox" defaultChecked style={checkboxStyle} />
                  </div>

                  <div style={settingsItemStyle}>
                    <div style={settingsLabelStyle}>
                      <p style={settingsLabelMainStyle}>New Arrivals</p>
                      <p style={settingsLabelSubStyle}>Be the first to know about new collections</p>
                    </div>
                    <input type="checkbox" defaultChecked style={checkboxStyle} />
                  </div>
                </div>

                {/* Privacy & Security */}
                <div style={settingsSectionStyle}>
                  <h3 style={settingsTitleStyle}>Privacy & Security</h3>

                  {/* Change Password toggle */}
                  <button
                    style={settingsActionBtnStyle}
                    onClick={() => { setShowPasswordForm(v => !v); setPwError(''); setPwSuccess(''); }}
                  >
                    {showPasswordForm ? 'Cancel' : 'Change Password'}
                  </button>

                  {showPasswordForm && (
                    <div style={pwFormStyle}>
                      {['current', 'next', 'confirm'].map((field, idx) => (
                        <div key={field} style={{ marginBottom: '14px' }}>
                          <label style={pwLabelStyle}>
                            {idx === 0 ? 'Current Password' : idx === 1 ? 'New Password' : 'Confirm New Password'}
                          </label>
                          <input
                            type="password"
                            style={pwInputStyle}
                            value={pwForm[field as keyof typeof pwForm]}
                            onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                            placeholder={idx === 0 ? 'Enter current password' : idx === 1 ? 'At least 6 characters' : 'Repeat new password'}
                          />
                        </div>
                      ))}
                      {pwError && <p style={{ color: '#e53935', fontFamily: "'Montserrat',sans-serif", fontSize: '12px', marginBottom: '12px' }}>{pwError}</p>}
                      {pwSuccess && <p style={{ color: '#4caf50', fontFamily: "'Montserrat',sans-serif", fontSize: '12px', marginBottom: '12px' }}>{pwSuccess}</p>}
                      <button
                        style={{ ...pwSaveBtnStyle, opacity: pwLoading ? 0.6 : 1 }}
                        onClick={handleChangePassword}
                        disabled={pwLoading}
                      >
                        {pwLoading ? 'Saving…' : 'Save New Password'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Account Actions */}
                <div style={settingsSectionStyle}>
                  <h3 style={settingsTitleStyle}>Account Actions</h3>
                  <button
                    style={dangerBtnStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#c33')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer style={footerStyle}>
        <p style={footerTextStyle}>
          © {new Date().getFullYear()} TOP LABLE. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

/* ─── STYLES ─────────────────────────────────────────────────────── */

const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;700&family=Oswald:wght@500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
`;

const dynamicCSS = `
  .profile-body-slider {
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
  .profile-body-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #c9a96e;
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 2px 8px rgba(201,169,110,0.45);
  }
  .profile-tab {
    position: relative;
    transition: color 0.3s ease;
  }
  .profile-tab::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -12px;
    height: 1px;
    background: transparent;
    transition: background 0.3s ease;
  }
  .profile-tab.active::after {
    background: #1a1a1a;
  }
`;

/* Loading */
const loadingWrapStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fafaf8',
};
const loadingInnerStyle: React.CSSProperties = { textAlign: 'center' };
const loadingBarStyle: React.CSSProperties = {
  width: '120px',
  height: '1px',
  background: '#c9a96e',
  margin: '0 auto 24px',
};
const loadingTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '4px',
  textTransform: 'uppercase',
  color: '#9a9590',
};

/* Error */
const errorWrapStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px',
  background: '#fafaf8',
  textAlign: 'center',
};
const errorOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '16px',
};
const errorTitleStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '40px',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  fontWeight: 700,
  color: '#1a1a1a',
  marginBottom: '16px',
};
const errorMsgStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  color: '#6b6560',
  marginBottom: '36px',
  maxWidth: '400px',
  lineHeight: 1.8,
};
const retryBtnStyle: React.CSSProperties = {
  padding: '14px 40px',
  background: '#1a1a1a',
  color: '#fff',
  border: 'none',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
  transition: 'background 0.3s ease',
};

/* Wrapper */
const wrapperStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  background: '#fff',
  color: '#1a1a1a',
  minHeight: '100vh',
};

const logoutBtnStyle: React.CSSProperties = {
  marginTop: '24px',
  padding: '10px 24px',
  background: 'transparent',
  border: '1px solid #c9a96e',
  color: '#c9a96e',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'all 0.25s ease',
};

/* Hero */
const heroSectionStyle: React.CSSProperties = {
  padding: '80px 48px 60px',
  background: 'linear-gradient(135deg, #fafaf8 0%, #f5f3ef 100%)',
  borderBottom: '1px solid #e8e4de',
};
const heroInnerStyle: React.CSSProperties = {
  maxWidth: '800px',
  margin: '0 auto',
  textAlign: 'center',
};
const heroOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '16px',
};
const heroTitleStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: 'clamp(40px, 6vw, 62px)',
  fontWeight: 700,
  lineHeight: 1.0,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#1a1a1a',
  marginBottom: '24px',
};
const heroSubtitleStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 300,
  lineHeight: 1.9,
  color: '#6b6560',
  maxWidth: '600px',
  margin: '0 auto',
};

const dividerStyle: React.CSSProperties = {
  height: '1px',
  background: '#e8e4de',
};

/* Error Banner */
const errorBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '16px 48px',
  background: '#fee',
  borderBottom: '1px solid #fcc',
};
const errorDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#c33',
  marginTop: '6px',
  flexShrink: 0,
};
const errorBannerTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  lineHeight: 1.7,
  color: '#c33',
};

/* Main */
const mainStyle: React.CSSProperties = {
  maxWidth: '1400px',
  margin: '0 auto',
  padding: '80px 48px',
};

/* Layout */
const layoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '300px 1fr',
  gap: '60px',
};

/* Sidebar */
const sidebarStyle: React.CSSProperties = {
  position: 'sticky',
  top: '20px',
  height: 'fit-content',
};

const profileCardStyle: React.CSSProperties = {
  padding: '48px 32px',
  background: '#fafaf8',
  border: '1px solid #e8e4de',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '20px',
};

const avatarContainerStyle: React.CSSProperties = {
  marginBottom: '12px',
};

const avatarStyle: React.CSSProperties = {
  width: '120px',
  height: '120px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #c9a96e, #e8ddd0)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '3px solid #fff',
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  overflow: 'hidden',
};

const avatarImgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const avatarInitialStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '48px',
  fontWeight: 700,
  color: '#fff',
};

const profileNameStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '26px',
  fontWeight: 600,
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: '#1a1a1a',
  textAlign: 'center',
  lineHeight: 1.2,
};

const profileEmailStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 300,
  color: '#6b6560',
  letterSpacing: '0.5px',
  textAlign: 'center',
};

const statsGridStyle: React.CSSProperties = {
  width: '100%',
  padding: '20px 0',
  borderTop: '1px solid #e8e4de',
  borderBottom: '1px solid #e8e4de',
  textAlign: 'center',
};

const statItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const statValueStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '20px',
  fontWeight: 600,
  color: '#c9a96e',
};

const statLabelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#9a9590',
};

const statusBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  justifyContent: 'center',
  padding: '12px 16px',
  background: '#e8f5e9',
  border: '1px solid #c8e6c9',
  borderRadius: '4px',
  width: '100%',
};

const statusDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#4caf50',
};

const statusTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  color: '#2e7d32',
};

const quickActionsStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  gap: '8px',
  flexDirection: 'column',
};

const editBtnStyle: React.CSSProperties = {
  padding: '12px 20px',
  background: 'transparent',
  border: '1px solid #1a1a1a',
  color: '#1a1a1a',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
};

/* Content Area */
const contentAreaStyle: React.CSSProperties = {};

const tabsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '40px',
  marginBottom: '24px',
  borderBottom: '1px solid #e8e4de',
};

const tabBtnStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '18px',
  fontWeight: 600,
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: '#1a1a1a',
  padding: '0 0 12px 0',
  position: 'relative',
};

const tabBtnActiveStyle: React.CSSProperties = {
  color: '#1a1a1a',
};

const tabDividerStyle: React.CSSProperties = {
  height: '1px',
  background: '#e8e4de',
  marginBottom: '32px',
};

const tabContentStyle: React.CSSProperties = {};

/* Section Header */
const sectionHeaderStyle: React.CSSProperties = {
  marginBottom: '40px',
};
const bodySectionHeaderStyle: React.CSSProperties = {
  marginTop: '48px',
  marginBottom: '24px',
};
const bodySectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: 'clamp(20px, 3vw, 26px)',
  fontWeight: 700,
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  lineHeight: 1.1,
  color: '#1a1a1a',
};

const sectionOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '12px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: 'clamp(26px, 4vw, 40px)',
  fontWeight: 700,
  lineHeight: 1.1,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#1a1a1a',
};

/* Info Grid (Overview - Read Mode) */
const infoGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '1px',
  background: '#e8e4de',
  border: '1px solid #e8e4de',
};

const infoCardStyle: React.CSSProperties = {
  padding: '32px',
  background: '#fafaf8',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const infoLabelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#9a9590',
};

const infoValueStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '14px',
  fontWeight: 400,
  color: '#1a1a1a',
  lineHeight: 1.6,
};

/* Edit Form */
const editFormStyle: React.CSSProperties = {
  padding: '40px',
  background: '#fafaf8',
  border: '1px solid #e8e4de',
  maxWidth: '600px',
};
const twoColFormStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
};
const selectFormStyle: React.CSSProperties = {
  padding: '14px 16px',
  border: '1px solid #cfcfcf',
  background: '#fff',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 300,
  color: '#1a1a1a',
  outline: 'none',
  width: '100%',
};
const editSectionDividerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  margin: '32px 0 24px',
};
const editSectionDividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: '1px',
  background: '#d8d8d8',
};
const editSectionDividerTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: '#9a9590',
  whiteSpace: 'nowrap',
};

const formFieldStyle: React.CSSProperties = {
  marginBottom: '28px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#6b6560',
};

const inputStyle: React.CSSProperties = {
  padding: '14px 16px',
  border: '1px solid #cfcfcf',
  background: '#fff',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 300,
  color: '#1a1a1a',
  outline: 'none',
  transition: 'border-color 0.3s ease',
};

const helperTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 300,
  color: '#9a9590',
  marginTop: '4px',
};

const formActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginTop: '32px',
};

const saveBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '14px 24px',
  background: '#1a1a1a',
  border: 'none',
  color: '#fff',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'background 0.3s ease',
};

const cancelBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '14px 24px',
  background: 'transparent',
  border: '1px solid #1a1a1a',
  color: '#1a1a1a',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
};

/* Try-On History */
const historyGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: '24px',
};

const historyCardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e8e4de',
  overflow: 'hidden',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
};

const deleteBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '8px',
  right: '8px',
  zIndex: 10,
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(0,0,0,0.55)',
  color: '#fff',
  fontSize: '13px',
  lineHeight: '28px',
  textAlign: 'center',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'background 0.2s',
};

const historyImageStyle: React.CSSProperties = {
  width: '100%',
  height: '280px',
  background: '#fafaf8',
  overflow: 'hidden',
};

const historyImageImgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const historyInfoStyle: React.CSSProperties = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const historyDateStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  color: '#9a9590',
  letterSpacing: '0.5px',
};

const historyStatusStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 400,
  color: '#6b6560',
};

const viewDetailsBtnStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'transparent',
  border: '1px solid #d4cfc8',
  color: '#1a1a1a',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  marginTop: '8px',
  transition: 'all 0.3s ease',
};

/* Empty State */
const emptyStateStyle: React.CSSProperties = {
  padding: '80px 48px',
  textAlign: 'center',
  background: '#fafaf8',
  border: '1px solid #e8e4de',
};

const emptyIconStyle: React.CSSProperties = {
  fontSize: '64px',
  marginBottom: '20px',
};

const emptyTitleStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: '#1a1a1a',
  marginBottom: '12px',
};

const emptyDescStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  color: '#6b6560',
  lineHeight: 1.8,
  marginBottom: '24px',
  maxWidth: '400px',
  margin: '0 auto 24px',
};

const tryNowBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 32px',
  background: '#c9a96e',
  color: '#fff',
  textDecoration: 'none',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  transition: 'background 0.3s ease',
};

const placeholderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  background: '#f5f3ef',
  color: '#9a9590',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
};

/* Settings */
const settingsSectionStyle: React.CSSProperties = {
  marginBottom: '48px',
  paddingBottom: '48px',
  borderBottom: '1px solid #e8e4de',
};

const settingsTitleStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '20px',
  fontWeight: 700,
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: '#1a1a1a',
  marginBottom: '24px',
};

const settingsItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 0',
  borderBottom: '1px solid #f0f0f0',
};

const settingsLabelStyle: React.CSSProperties = {
  flex: 1,
};

const settingsLabelMainStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 400,
  color: '#1a1a1a',
  marginBottom: '4px',
};

const settingsLabelSubStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 300,
  color: '#9a9590',
};

const checkboxStyle: React.CSSProperties = {
  width: '18px',
  height: '18px',
  cursor: 'pointer',
};

const pwFormStyle: React.CSSProperties = {
  background: '#fafaf8',
  border: '1px solid #e8e4de',
  padding: '24px',
  marginTop: '4px',
  marginBottom: '12px',
};
const pwLabelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: "'Montserrat',sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: '#6b6560',
  marginBottom: '6px',
};
const pwInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: '1px solid #e8e4de',
  fontFamily: "'Montserrat',sans-serif",
  fontSize: '13px',
  color: '#1a1a1a',
  background: '#fff',
  outline: 'none',
};
const pwSaveBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  background: '#1a1a1a',
  border: 'none',
  color: '#fff',
  fontFamily: "'Montserrat',sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2.5px',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
};

const settingsActionBtnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '14px 20px',
  background: 'transparent',
  border: '1px solid #d4cfc8',
  color: '#1a1a1a',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  marginBottom: '12px',
  transition: 'all 0.3s ease',
};

const dangerBtnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '14px 20px',
  background: '#1a1a1a',
  border: 'none',
  color: '#fff',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'background 0.3s ease',
};

/* Order History */
const orderCardStyle: React.CSSProperties = {
  border: '1px solid #e8e4de',
  background: '#fff',
};
const orderCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '20px 24px',
  background: '#fafaf8',
  borderBottom: '1px solid #e8e4de',
};
const orderIdStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '16px',
  fontWeight: 600,
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  color: '#1a1a1a',
  marginBottom: '4px',
};
const orderDateStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 300,
  color: '#9a9590',
  letterSpacing: '0.5px',
};
const orderStatusBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  background: '#e8f5e9',
  color: '#2e7d32',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  marginBottom: '6px',
};
const orderTotalStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '20px',
  fontWeight: 700,
  color: '#c9a96e',
};
const orderItemsStyle: React.CSSProperties = {
  padding: '16px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};
const orderItemRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
};
const orderItemThumbStyle: React.CSSProperties = {
  width: '52px',
  height: '52px',
  background: '#f5f3ef',
  flexShrink: 0,
  overflow: 'hidden',
};
const orderItemNameStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '14px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  color: '#1a1a1a',
  marginBottom: '3px',
};
const orderItemMetaStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 300,
  color: '#9a9590',
  letterSpacing: '0.5px',
};
const orderItemPriceStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 500,
  color: '#1a1a1a',
  whiteSpace: 'nowrap',
};
const orderCardFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '8px',
  padding: '12px 24px',
  borderTop: '1px solid #e8e4de',
  background: '#fafaf8',
};
const orderMetaTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 300,
  color: '#9a9590',
};

const historyThumbRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1px',
  background: '#e8e4de',
  borderTop: '1px solid #e8e4de',
};
const historyThumbStyle: React.CSSProperties = {
  position: 'relative',
  height: '100px',
  overflow: 'hidden',
  background: '#fafaf8',
};
const historyThumbLabelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '4px 6px',
  background: 'rgba(0,0,0,0.45)',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: '#fff',
  textAlign: 'center',
};

/* Footer */
const footerStyle: React.CSSProperties = {
  padding: '32px 48px',
  textAlign: 'center',
  borderTop: '1px solid #e8e4de',
  background: '#fafaf8',
};

const footerTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 300,
  color: '#9a9590',
  letterSpacing: '1px',
};

/* ── Body-profile edit styles (profile page) ── */
const profileGenderRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
};
const profileGenderBtnStyle: React.CSSProperties = {
  padding: '13px',
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
const profileGenderBtnActiveStyle: React.CSSProperties = {
  ...profileGenderBtnStyle,
  background: '#1a1a1a',
  borderColor: '#1a1a1a',
  color: '#fff',
};
const profileSliderHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '2px',
};
const profileSliderValueStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '22px',
  fontWeight: 600,
  color: '#c9a96e',
};
const profileSliderMarksStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '4px',
};
const profileMarkTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 300,
  color: '#9a9590',
};
const profileBmiBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  background: '#fafaf8',
  border: '1px solid #e8e4de',
};
const profileBmiLabelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: '#9a9590',
};
const profileBmiValueStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '26px',
  fontWeight: 700,
  color: '#c9a96e',
};
const profileBmiCatStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  color: '#6b6560',
};
const profileSkinBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  padding: '11px 13px',
  background: '#fff',
  border: '1px solid #d4cfc8',
  cursor: 'pointer',
  textAlign: 'left' as const,
  width: '100%',
  marginBottom: '6px',
  transition: 'all 0.25s ease',
};
const profileSkinBtnActiveStyle: React.CSSProperties = {
  ...profileSkinBtnStyle,
  borderColor: '#c9a96e',
  background: '#fdf8f2',
};
const profileSwatchStyle: React.CSSProperties = {
  width: '26px',
  height: '26px',
  borderRadius: '50%',
  flexShrink: 0,
  transition: 'border 0.25s ease',
};
const profileSkinTextStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  textAlign: 'left' as const,
};
const profileSkinNameStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: '14px',
  fontWeight: 600,
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  color: '#1a1a1a',
};
const profileSkinHintStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 300,
  color: '#6b6560',
};

export default UserProfilePage;
