import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const API = 'http://localhost:8000';

interface User {
  user_id: number;
  name: string;
  email: string;
  mobile_number: string;
  birthday: string;
  created_at: string;
}

interface Product {
  id?: number;
  product_id?: number;
  name: string;
  price: number;
  category: string;
  description: string;
  image_url: string;
  sizes: string[];
  colors: string[];
  stock: number;
  color_images?: Record<string, string>;
}

interface OrderItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
  image_url: string;
  category: string;
}

interface OrderAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  shippingMethod: string;
  paymentMethod: string;
}

interface Order {
  order_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_mobile: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: string;
  address: OrderAddress;
  created_at: string;
}

interface Stats {
  total_users: number;
  total_tryons: number;
  total_products: number;
  total_orders: number;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'accessories', 'footwear'];

const emptyForm = (): Partial<Product> => ({
  name: '', description: '', price: 0, category: 'tops',
  image_url: '', sizes: [], colors: [], stock: 0,
});

const AdminPage: React.FC = () => {
  const [users, setUsers]         = useState<User[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [orders, setOrders]       = useState<Order[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'products' | 'orders'>('users');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  // Product modal state
  const [showModal, setShowModal]       = useState(false);
  const [editingId, setEditingId]       = useState<number | null>(null);
  const [form, setForm]                 = useState<Partial<Product>>(emptyForm());
  const [uploading, setUploading]       = useState(false);
  const [colorInput, setColorInput]     = useState('');
  const [colorImages, setColorImages]   = useState<Record<string, string>>({});

  const navigate = useNavigate();
  const role      = localStorage.getItem('role');

  useEffect(() => {
    if (role !== 'admin' && !localStorage.getItem('admin')) { navigate('/login'); return; }
    fetchAll();
  }, [navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes, prodsRes, ordersRes] = await Promise.all([
        fetch(`${API}/api/admin/users`),
        fetch(`${API}/api/admin/stats`),
        fetch(`${API}/api/products`),
        fetch(`${API}/api/admin/orders`),
      ]);
      setUsers((await usersRes.json()).users || []);
      setStats(await statsRes.json());
      setProducts((await prodsRes.json()).products || []);
      setOrders((await ordersRes.json()).orders || []);
    } catch {
      setMsg('Failed to load data. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  /* ── User delete ── */
  const handleDeleteUser = async (userId: number, name: string) => {
    if (!window.confirm(`Delete user "${name}"?`)) return;
    try {
      const res = await fetch(`${API}/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) { setUsers(p => p.filter(u => u.user_id !== userId)); flash(`User "${name}" deleted.`); }
    } catch { flash('Failed to delete user.'); }
  };

  /* ── Product CRUD ── */
  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setColorInput(''); setColorImages({}); setShowModal(true); };

  const openEdit = (p: Product) => {
    const id = p.product_id ?? p.id ?? null;
    setEditingId(id);
    setForm({ ...p, sizes: p.sizes || [], colors: p.colors || [] });
    setColorInput((p.colors || []).join(', '));
    setColorImages((p as any).color_images || {});
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/api/admin/upload-product-image`, { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setForm(f => ({ ...f, image_url: data.image_url }));
      } else { flash('Image upload failed.'); }
    } catch { flash('Upload error.'); }
    setUploading(false);
  };

  const toggleSize = (s: string) => {
    setForm(f => {
      const sizes = f.sizes || [];
      return { ...f, sizes: sizes.includes(s) ? sizes.filter(x => x !== s) : [...sizes, s] };
    });
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API}/api/products`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch { flash('Failed to refresh products.'); }
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { flash('Name and price are required.'); return; }
    const resolvedColors = colorInput.split(',').map(c => c.trim()).filter(Boolean);
    const payload = { ...form, colors: resolvedColors, color_images: colorImages };
    try {
      let res: Response;
      if (editingId !== null) {
        res = await fetch(`${API}/api/products/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        if (res.ok) { flash('Product updated.'); }
        else { flash('Update failed.'); return; }
      } else {
        res = await fetch(`${API}/api/products`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        if (res.ok) { flash('Product added.'); }
        else { flash('Add failed.'); return; }
      }
      setShowModal(false);
      await fetchProducts();
    } catch { flash('Request failed.'); }
  };

  const handleDeleteProduct = async (p: Product) => {
    const id = p.product_id ?? p.id;
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try {
      const res = await fetch(`${API}/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) { flash(`"${p.name}" deleted.`); await fetchProducts(); }
      else flash('Delete failed.');
    } catch { flash('Request failed.'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('user'); localStorage.removeItem('admin'); localStorage.removeItem('role');
    navigate('/login');
  };

  if (role !== 'admin' && !localStorage.getItem('admin')) return null;

  return (
    <div style={wrapper}>
      <style>{fonts + css}</style>
      <Navbar />

      <main style={mainStyle}>

        {/* ── Title row ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p style={overlineStyle}>Admin Dashboard</p>
            <h1 style={titleStyle}>TOP LABLE<br /><em>Management Panel</em></h1>
          </div>
          <button onClick={handleLogout} style={logoutBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.background = '#c9a96e'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9a96e'; }}>
            Logout
          </button>
        </div>

        {msg && <div style={msgStyle}>{msg}</div>}

        {loading ? (
          <div style={loadingStyle}><div style={loadingBarStyle} /><p style={loadingTextStyle}>Loading...</p></div>
        ) : (
          <>
            {/* ── Stats ── */}
            {stats && (
              <div style={statsGridStyle}>
                {[
                  { label: 'Total Users',     value: stats.total_users    },
                  { label: 'Orders Placed',   value: stats.total_orders ?? orders.length },
                  { label: 'Try-On Results',  value: stats.total_tryons   },
                  { label: 'Products',        value: products.length      },
                ].map((s, i) => (
                  <div key={i} style={statCardStyle}>
                    <p style={statValueStyle}>{s.value}</p>
                    <p style={statLabelStyle}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab bar ── */}
            <div style={tabBarStyle}>
              {([
                { key: 'users',    label: 'User Management'    },
                { key: 'products', label: 'Product Management' },
                { key: 'orders',   label: 'Order Management'   },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{ ...tabBtnStyle, ...(activeTab === t.key ? tabActivStyle : {}) }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ══ USERS TAB ══ */}
            {activeTab === 'users' && (
              <section style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <p style={overlineStyle}>Registered Users</p>
                  <h2 style={sectionTitleStyle}>User<br /><em>Management</em></h2>
                </div>
                {users.length === 0 ? (
                  <p style={emptyStyle}>No users registered yet.</p>
                ) : (
                  <div style={tableWrapStyle}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>{['ID','Name','Email','Mobile','Birthday','Registered','Action'].map(h =>
                          <th key={h} style={thStyle}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {users.map((u, i) => (
                          <tr key={u.user_id} style={{ background: i % 2 === 0 ? '#fafaf8' : '#fff' }}>
                            <td style={tdStyle}>{u.user_id}</td>
                            <td style={tdStyle}>{u.name}</td>
                            <td style={tdStyle}>{u.email}</td>
                            <td style={tdStyle}>{u.mobile_number || '—'}</td>
                            <td style={tdStyle}>{u.birthday || '—'}</td>
                            <td style={tdStyle}>{u.created_at?.split('T')[0]}</td>
                            <td style={tdStyle}>
                              <button onClick={() => handleDeleteUser(u.user_id, u.name)} style={deleteBtnStyle}
                                onMouseEnter={e => (e.currentTarget.style.background = '#c33')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* ══ PRODUCTS TAB ══ */}
            {activeTab === 'products' && (
              <section style={sectionStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={sectionHeaderStyle}>
                    <p style={overlineStyle}>Catalogue</p>
                    <h2 style={sectionTitleStyle}>Product<br /><em>Management</em></h2>
                  </div>
                  <button onClick={openAdd} style={addProductBtnStyle}
                    onMouseEnter={e => { e.currentTarget.style.background = '#b8924e'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#c9a96e'; }}>
                    + Add New Product
                  </button>
                </div>

                {products.length === 0 ? (
                  <p style={emptyStyle}>No products yet. Click "Add New Product" to get started.</p>
                ) : (
                  <div style={tableWrapStyle}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>{['#','Name','Category','Price (LKR)','Stock','Sizes','Actions'].map(h =>
                          <th key={h} style={thStyle}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {products.map((p, i) => {
                          const id = p.product_id ?? p.id ?? i;
                          return (
                            <tr key={id} style={{ background: i % 2 === 0 ? '#fafaf8' : '#fff' }}>
                              <td style={tdStyle}>{id}</td>
                              <td style={{ ...tdStyle, fontWeight: 400 }}>{p.name}</td>
                              <td style={tdStyle}>
                                <span style={{ ...categoryPillStyle, background: catColor(p.category) }}>
                                  {p.category}
                                </span>
                              </td>
                              <td style={tdStyle}>{Number(p.price).toFixed(0)}</td>
                              <td style={tdStyle}>{p.stock ?? '—'}</td>
                              <td style={tdStyle}>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {(p.sizes || []).map(s => <span key={s} style={sizePillStyle}>{s}</span>)}
                                  {(!p.sizes || p.sizes.length === 0) && <span style={{ color: '#bbb' }}>—</span>}
                                </div>
                              </td>
                              <td style={tdStyle}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => openEdit(p)} style={editBtnStyle}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1a1a1a'; }}>
                                    Edit
                                  </button>
                                  <button onClick={() => handleDeleteProduct(p)} style={deleteBtnStyle}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#c33')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}>
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* ══ ORDERS TAB ══ */}
            {activeTab === 'orders' && (
              <section style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <p style={overlineStyle}>All Transactions</p>
                  <h2 style={sectionTitleStyle}>Order<br /><em>Management</em></h2>
                </div>
                <p style={{ fontFamily:"'Montserrat',sans-serif", fontSize:'12px', color:'#9a9590', marginBottom:'28px', marginTop:'8px' }}>
                  {orders.length} order{orders.length !== 1 ? 's' : ''} total — click a row to expand details
                </p>
                {orders.length === 0 ? (
                  <p style={emptyStyle}>No orders placed yet.</p>
                ) : (
                  <div style={tableWrapStyle}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          {['Order ID','Date','Customer','Phone','City','Items','Total (LKR)','Payment','Status',''].map(h =>
                            <th key={h} style={thStyle}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((o, i) => {
                          const addr = o.address || {} as OrderAddress;
                          const customerName = addr.firstName
                            ? `${addr.firstName} ${addr.lastName}`.trim()
                            : o.user_name || '—';
                          const phone    = addr.phone    || o.user_mobile || '—';
                          const city     = addr.city     || '—';
                          const payment  = addr.paymentMethod || '—';
                          const isOpen   = expandedOrder === o.order_id;
                          return (
                            <React.Fragment key={o.order_id}>
                              <tr
                                style={{ background: i % 2 === 0 ? '#fafaf8' : '#fff', cursor:'pointer' }}
                                onClick={() => setExpandedOrder(isOpen ? null : o.order_id)}>
                                <td style={tdStyle}>#{o.order_id}</td>
                                <td style={tdStyle}>{o.created_at?.split('T')[0]}</td>
                                <td style={tdStyle}>
                                  <div style={{ fontWeight:400 }}>{customerName}</div>
                                  <div style={{ fontSize:'10px', color:'#9a9590', marginTop:'2px' }}>{o.user_email || addr.email || '—'}</div>
                                </td>
                                <td style={tdStyle}>{phone}</td>
                                <td style={tdStyle}>{city}</td>
                                <td style={tdStyle}>{o.items.length}</td>
                                <td style={{ ...tdStyle, fontFamily:"'Cormorant Garamond',serif", fontSize:'16px', color:'#c9a96e' }}>
                                  {Number(o.total).toFixed(2)}
                                </td>
                                <td style={tdStyle}>
                                  <span style={paymentPillStyle(payment)}>{payment}</span>
                                </td>
                                <td style={tdStyle}>
                                  <span style={statusPillStyle(o.status)}>{o.status}</span>
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ fontFamily:"'Montserrat',sans-serif", fontSize:'10px', color:'#c9a96e' }}>
                                    {isOpen ? '▲' : '▼'}
                                  </span>
                                </td>
                              </tr>

                              {/* ── Expanded order detail ── */}
                              {isOpen && (
                                <tr style={{ background:'#fdf9f3' }}>
                                  <td colSpan={10} style={{ padding:'0', borderBottom:'1px solid #e8e4de' }}>
                                    <div style={orderDetailStyle}>

                                      {/* Left: items list */}
                                      <div style={{ flex: 2 }}>
                                        <p style={detailHeadStyle}>Items Ordered</p>
                                        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:"'Montserrat',sans-serif" }}>
                                          <thead>
                                            <tr>
                                              {['Image','Product','Size','Color','Qty','Unit Price','Line Total'].map(h =>
                                                <th key={h} style={{ ...thStyle, background:'#f2ede7', fontSize:'8px' }}>{h}</th>)}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {o.items.map((item, idx) => (
                                              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fdf9f3' : '#fff' }}>
                                                <td style={{ ...tdStyle, width:'64px', padding:'10px 12px' }}>
                                                  {item.image_url ? (
                                                    <img
                                                      src={item.image_url}
                                                      alt={item.name}
                                                      style={{ width:'52px', height:'52px', objectFit:'cover', border:'1px solid #e8e4de', display:'block' }}
                                                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                  ) : (
                                                    <div style={{ width:'52px', height:'52px', background:'#f0ece6', border:'1px solid #e8e4de', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                                      <span style={{ fontSize:'18px' }}>👕</span>
                                                    </div>
                                                  )}
                                                </td>
                                                <td style={{ ...tdStyle, fontSize:'11px' }}>
                                                  <div style={{ fontWeight:400 }}>{item.name}</div>
                                                  <div style={{ fontSize:'9px', color:'#9a9590', marginTop:'2px', textTransform:'uppercase', letterSpacing:'1px' }}>{item.category}</div>
                                                </td>
                                                <td style={{ ...tdStyle, fontSize:'11px' }}>{item.size || '—'}</td>
                                                <td style={{ ...tdStyle, fontSize:'11px' }}>{item.color || '—'}</td>
                                                <td style={{ ...tdStyle, fontSize:'11px' }}>{item.quantity}</td>
                                                <td style={{ ...tdStyle, fontSize:'11px' }}>LKR {Number(item.price).toFixed(2)}</td>
                                                <td style={{ ...tdStyle, color:'#c9a96e', fontFamily:"'Cormorant Garamond',serif", fontSize:'14px' }}>
                                                  LKR {(item.price * item.quantity).toFixed(2)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* Right: address + totals */}
                                      <div style={{ flex: 1, display:'flex', flexDirection:'column', gap:'20px' }}>
                                        <div>
                                          <p style={detailHeadStyle}>Shipping Address</p>
                                          <div style={detailBoxStyle}>
                                            <p style={detailLineStyle}><strong>{customerName}</strong></p>
                                            <p style={detailLineStyle}>{addr.address || '—'}</p>
                                            <p style={detailLineStyle}>{[addr.city, addr.postalCode].filter(Boolean).join(', ')}</p>
                                            <p style={detailLineStyle}>{phone}</p>
                                            <p style={detailLineStyle}>{addr.email || o.user_email || '—'}</p>
                                          </div>
                                        </div>

                                        <div>
                                          <p style={detailHeadStyle}>Delivery &amp; Payment</p>
                                          <div style={detailBoxStyle}>
                                            <p style={detailLineStyle}>Shipping: <strong>{addr.shippingMethod || '—'}</strong></p>
                                            <p style={detailLineStyle}>Payment: <strong>{payment}</strong></p>
                                          </div>
                                        </div>

                                        <div>
                                          <p style={detailHeadStyle}>Order Totals</p>
                                          <div style={detailBoxStyle}>
                                            <div style={totalRowStyle}><span>Subtotal</span><span>LKR {Number(o.subtotal).toFixed(2)}</span></div>
                                            <div style={totalRowStyle}><span>Shipping</span><span>LKR {Number(o.shipping).toFixed(2)}</span></div>
                                            {o.discount > 0 && (
                                              <div style={{ ...totalRowStyle, color:'#4caf50' }}>
                                                <span>Discount</span><span>− LKR {Number(o.discount).toFixed(2)}</span>
                                              </div>
                                            )}
                                            <div style={{ ...totalRowStyle, borderTop:'1px solid #e8e4de', paddingTop:'8px', marginTop:'4px', fontWeight:500 }}>
                                              <span>Total</span>
                                              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'18px', color:'#c9a96e' }}>
                                                LKR {Number(o.total).toFixed(2)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* ── Quick links ── */}
            <section style={sectionStyle}>
              <p style={overlineStyle}>Quick Actions</p>
              <div style={actionsGridStyle}>
                {[
                  { to: '/products',        icon: '🛍️', label: 'View Products'  },
                  { to: '/virtual-tryon',   icon: '👔', label: 'Virtual Try-On' },
                  { to: '/recommendations', icon: '🤖', label: 'Recommendations'},
                  { to: '/',                icon: '🏠', label: 'Homepage'       },
                ].map(a => (
                  <Link key={a.to} to={a.to} style={actionCardStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f2ede7')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <p style={actionIconStyle}>{a.icon}</p>
                    <p style={actionLabelStyle}>{a.label}</p>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* ══ ADD / EDIT PRODUCT MODAL ══ */}
      {showModal && (
        <div style={overlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={modalHeaderStyle}>
              <div>
                <p style={{ ...overlineStyle, marginBottom: '4px' }}>{editingId !== null ? 'Edit Product' : 'Add New Product'}</p>
                <h2 style={modalTitleStyle}>{editingId !== null ? 'Update Details' : 'General Information'}</h2>
              </div>
              <button onClick={() => setShowModal(false)} style={closeBtn}>✕</button>
            </div>

            <div style={modalBodyStyle}>
              {/* LEFT column */}
              <div style={modalColStyle}>
                <label style={labelStyle}>Product Name *</label>
                <input style={inputStyle} placeholder="e.g. Classic White T-Shirt"
                  value={form.name || ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                  placeholder="Describe the product..."
                  value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Price (LKR) *</label>
                    <input style={inputStyle} type="number" placeholder="0.00"
                      value={form.price || ''}
                      onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Stock</label>
                    <input style={inputStyle} type="number" placeholder="0"
                      value={form.stock || ''}
                      onChange={e => setForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>

                <label style={labelStyle}>Colors (comma separated)</label>
                <input style={inputStyle} placeholder="e.g. white, black, navy"
                  value={colorInput}
                  onChange={e => setColorInput(e.target.value)} />

                {colorInput.split(',').map(c => c.trim()).filter(Boolean).length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Color Images (image URL per color)</label>
                    {colorInput.split(',').map(c => c.trim()).filter(Boolean).map(c => (
                      <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontFamily:"'Montserrat',sans-serif", fontSize:'11px', fontWeight:500, minWidth:'80px', color:'#1a1a1a' }}>{c}</span>
                        <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                          placeholder={`Image URL for ${c}`}
                          value={colorImages[c] || ''}
                          onChange={e => setColorImages(ci => ({ ...ci, [c]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                )}

                <label style={labelStyle}>Available Sizes</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {SIZES.map(s => {
                    const active = (form.sizes || []).includes(s);
                    return (
                      <button key={s} type="button" onClick={() => toggleSize(s)}
                        style={{
                          padding: '8px 14px',
                          fontFamily: "'Montserrat', sans-serif",
                          fontSize: '10px',
                          fontWeight: 500,
                          letterSpacing: '1.5px',
                          border: `1px solid ${active ? '#c9a96e' : '#d4cfc8'}`,
                          background: active ? '#c9a96e' : '#fff',
                          color: active ? '#fff' : '#6b6560',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT column */}
              <div style={modalColStyle}>
                <label style={labelStyle}>Product Image</label>

                {/* Upload from computer */}
                <label style={uploadBtnStyle}>
                  {uploading ? 'Uploading…' : '⬆ Upload from Computer'}
                  <input type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageUpload} disabled={uploading} />
                </label>

                {/* OR paste URL */}
                <p style={{ fontFamily:"'Montserrat',sans-serif", fontSize:'9px', letterSpacing:'2px', color:'#9a9590', textAlign:'center', margin:'8px 0', textTransform:'uppercase' }}>— or paste direct URL —</p>
                <input style={inputStyle} placeholder="https://example.com/image.jpg"
                  value={form.image_url || ''}
                  onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />

                {/* Image preview */}
                <div style={imgPreviewStyle}>
                  {form.image_url ? (
                    <img src={form.image_url} alt="preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#bbb' }}>
                      <p style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</p>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>No Image</p>
                    </div>
                  )}
                </div>

                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category || 'tops'}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal footer */}
            <div style={modalFooterStyle}>
              <button onClick={() => setShowModal(false)} style={cancelBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.background = '#e8e4de'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ef'; }}>
                Cancel
              </button>
              <button onClick={handleSave} style={saveBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.background = '#b8924e'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#c9a96e'; }}>
                {editingId !== null ? 'Update Product' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Helpers ───────────────────────────────────────────────────────── */
function catColor(cat: string) {
  const m: Record<string,string> = {
    tops:'#d4c8b8', bottoms:'#c8d0d4', dresses:'#d4c8cc',
    outerwear:'#c8ccc0', accessories:'#d0d4c8', footwear:'#bca89c',
  };
  return m[cat?.toLowerCase()] || '#e0dbd4';
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
`;
const css = `
  select option { font-family: 'Montserrat', sans-serif; }
`;

const wrapper: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", background:'#fafaf8', minHeight:'100vh', color:'#1a1a1a' };
const mainStyle: React.CSSProperties = { padding:'64px 48px', maxWidth:'1300px', margin:'0 auto' };

const overlineStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'10px', fontWeight:500, letterSpacing:'3px', textTransform:'uppercase', color:'#c9a96e', marginBottom:'12px' };
const titleStyle: React.CSSProperties = { fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(40px,5vw,60px)', fontWeight:300, lineHeight:1.0, color:'#1a1a1a', marginBottom:'48px' };

const logoutBtnStyle: React.CSSProperties = { padding:'10px 24px', background:'transparent', border:'1px solid #c9a96e', color:'#c9a96e', fontFamily:"'Montserrat',sans-serif", fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', cursor:'pointer', transition:'all 0.25s', alignSelf:'center' };
const msgStyle: React.CSSProperties = { padding:'14px 20px', background:'#fff', border:'1px solid #c9a96e', marginBottom:'24px', fontFamily:"'Montserrat',sans-serif", fontSize:'12px', color:'#6b6560' };
const loadingStyle: React.CSSProperties = { textAlign:'center', padding:'80px 0' };
const loadingBarStyle: React.CSSProperties = { width:'80px', height:'1px', background:'#c9a96e', margin:'0 auto 20px' };
const loadingTextStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'10px', letterSpacing:'4px', textTransform:'uppercase', color:'#9a9590' };

const statsGridStyle: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'1px', background:'#e8e4de', border:'1px solid #e8e4de', marginBottom:'48px' };
const statCardStyle: React.CSSProperties = { padding:'48px 36px', background:'#1a1a1a', textAlign:'center' };
const statValueStyle: React.CSSProperties = { fontFamily:"'Cormorant Garamond',serif", fontSize:'48px', fontWeight:300, color:'#c9a96e', marginBottom:'8px' };
const statLabelStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'10px', letterSpacing:'2.5px', textTransform:'uppercase', color:'rgba(255,255,255,0.5)' };

const tabBarStyle: React.CSSProperties = { display:'flex', borderBottom:'1px solid #e8e4de', marginBottom:'48px', gap:'0' };
const tabBtnStyle: React.CSSProperties = { padding:'14px 28px', background:'transparent', border:'none', fontFamily:"'Montserrat',sans-serif", fontSize:'10px', fontWeight:500, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a9590', cursor:'pointer', borderBottom:'2px solid transparent', transition:'all 0.25s' };
const tabActivStyle: React.CSSProperties = { color:'#1a1a1a', borderBottom:'2px solid #c9a96e' };

const sectionStyle: React.CSSProperties = { marginBottom:'64px' };
const sectionHeaderStyle: React.CSSProperties = { marginBottom:'0' };
const sectionTitleStyle: React.CSSProperties = { fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(28px,4vw,44px)', fontWeight:300, lineHeight:1.1, color:'#1a1a1a' };
const emptyStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'12px', color:'#9a9590', padding:'40px', textAlign:'center', border:'1px solid #e8e4de', background:'#fff' };

const tableWrapStyle: React.CSSProperties = { overflowX:'auto', border:'1px solid #e8e4de' };
const tableStyle: React.CSSProperties = { width:'100%', borderCollapse:'collapse', fontFamily:"'Montserrat',sans-serif" };
const thStyle: React.CSSProperties = { padding:'14px 16px', textAlign:'left', fontSize:'9px', fontWeight:500, letterSpacing:'2px', textTransform:'uppercase', color:'#6b6560', background:'#f5f3ef', borderBottom:'1px solid #e8e4de' };
const tdStyle: React.CSSProperties = { padding:'14px 16px', fontSize:'12px', fontWeight:300, color:'#1a1a1a', borderBottom:'1px solid #e8e4de', verticalAlign:'middle' };

const deleteBtnStyle: React.CSSProperties = { padding:'6px 14px', background:'#1a1a1a', border:'none', color:'#fff', fontFamily:"'Montserrat',sans-serif", fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', cursor:'pointer', transition:'background 0.25s' };
const editBtnStyle: React.CSSProperties = { padding:'6px 14px', background:'transparent', border:'1px solid #1a1a1a', color:'#1a1a1a', fontFamily:"'Montserrat',sans-serif", fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', cursor:'pointer', transition:'all 0.25s' };
const addProductBtnStyle: React.CSSProperties = { padding:'14px 28px', background:'#c9a96e', border:'none', color:'#fff', fontFamily:"'Montserrat',sans-serif", fontSize:'10px', fontWeight:500, letterSpacing:'2px', textTransform:'uppercase', cursor:'pointer', transition:'background 0.25s' };

const categoryPillStyle: React.CSSProperties = { display:'inline-block', padding:'3px 10px', fontFamily:"'Montserrat',sans-serif", fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', color:'#1a1a1a' };
const sizePillStyle: React.CSSProperties = { display:'inline-block', padding:'2px 7px', fontFamily:"'Montserrat',sans-serif", fontSize:'9px', border:'1px solid #d4cfc8', color:'#6b6560' };

const actionsGridStyle: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1px', background:'#e8e4de', border:'1px solid #e8e4de' };
const actionCardStyle: React.CSSProperties = { padding:'48px 36px', background:'#fff', textAlign:'center', textDecoration:'none', display:'block', transition:'background 0.3s' };
const actionIconStyle: React.CSSProperties = { fontSize:'32px', marginBottom:'16px' };
const actionLabelStyle: React.CSSProperties = { fontFamily:"'Cormorant Garamond',serif", fontSize:'22px', fontWeight:400, color:'#1a1a1a' };

/* Modal */
const overlayStyle: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(15,15,15,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'24px' };
const modalStyle: React.CSSProperties = { background:'#fff', width:'100%', maxWidth:'860px', maxHeight:'90vh', overflowY:'auto', display:'flex', flexDirection:'column' };
const modalHeaderStyle: React.CSSProperties = { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'32px 36px 0', borderBottom:'1px solid #e8e4de', paddingBottom:'24px' };
const modalTitleStyle: React.CSSProperties = { fontFamily:"'Cormorant Garamond',serif", fontSize:'28px', fontWeight:300, color:'#1a1a1a' };
const closeBtn: React.CSSProperties = { background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'#9a9590', padding:'4px', lineHeight:1 };
const modalBodyStyle: React.CSSProperties = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'32px', padding:'32px 36px' };
const modalColStyle: React.CSSProperties = { display:'flex', flexDirection:'column', gap:'4px' };
const modalFooterStyle: React.CSSProperties = { display:'flex', justifyContent:'flex-end', gap:'12px', padding:'24px 36px', borderTop:'1px solid #e8e4de' };

const labelStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'9px', fontWeight:500, letterSpacing:'2px', textTransform:'uppercase', color:'#6b6560', marginBottom:'6px', display:'block' };
const inputStyle: React.CSSProperties = { width:'100%', padding:'12px 14px', border:'1px solid #e8e4de', fontFamily:"'Montserrat',sans-serif", fontSize:'12px', color:'#1a1a1a', background:'#fafaf8', outline:'none', marginBottom:'16px', transition:'border-color 0.2s' };
const imgPreviewStyle: React.CSSProperties = { width:'100%', height:'200px', border:'1px solid #e8e4de', background:'#f5f3ef', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', marginBottom:'16px' };

const saveBtnStyle: React.CSSProperties = { padding:'12px 32px', background:'#c9a96e', border:'none', color:'#fff', fontFamily:"'Montserrat',sans-serif", fontSize:'10px', fontWeight:500, letterSpacing:'2px', textTransform:'uppercase', cursor:'pointer', transition:'background 0.25s' };
const cancelBtnStyle: React.CSSProperties = { padding:'12px 32px', background:'#f5f3ef', border:'1px solid #e8e4de', color:'#6b6560', fontFamily:"'Montserrat',sans-serif", fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', cursor:'pointer', transition:'background 0.25s' };
const uploadBtnStyle: React.CSSProperties = { display:'block', width:'100%', padding:'12px', background:'#f5f3ef', border:'2px dashed #c9a96e', color:'#c9a96e', fontFamily:"'Montserrat',sans-serif", fontSize:'10px', fontWeight:500, letterSpacing:'2px', textTransform:'uppercase', cursor:'pointer', textAlign:'center', marginBottom:'4px', transition:'background 0.2s' };

/* Order detail expansion */
const orderDetailStyle: React.CSSProperties = { display:'flex', gap:'32px', padding:'24px 28px', alignItems:'flex-start' };
const detailHeadStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'9px', fontWeight:500, letterSpacing:'2.5px', textTransform:'uppercase', color:'#c9a96e', marginBottom:'10px' };
const detailBoxStyle: React.CSSProperties = { background:'#fff', border:'1px solid #e8e4de', padding:'14px 16px' };
const detailLineStyle: React.CSSProperties = { fontFamily:"'Montserrat',sans-serif", fontSize:'12px', fontWeight:300, color:'#1a1a1a', marginBottom:'4px' };
const totalRowStyle: React.CSSProperties = { display:'flex', justifyContent:'space-between', fontFamily:"'Montserrat',sans-serif", fontSize:'12px', fontWeight:300, color:'#1a1a1a', marginBottom:'6px' };

function statusPillStyle(status: string): React.CSSProperties {
  const colours: Record<string,string> = { confirmed:'#c8d4c8', pending:'#d4d0c8', shipped:'#c8ccd4', delivered:'#c8d4c8', cancelled:'#d4c8c8' };
  return { display:'inline-block', padding:'3px 10px', fontFamily:"'Montserrat',sans-serif", fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', color:'#1a1a1a', background: colours[status?.toLowerCase()] || '#e0dbd4' };
}

function paymentPillStyle(method: string): React.CSSProperties {
  const colours: Record<string,string> = { card:'#c8ccd4', cod:'#d4cfc8', koko:'#d4c8d4' };
  return { display:'inline-block', padding:'3px 10px', fontFamily:"'Montserrat',sans-serif", fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', color:'#1a1a1a', background: colours[method?.toLowerCase()] || '#e0dbd4' };
}

export default AdminPage;
