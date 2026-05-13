import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const API_BASE = 'http://localhost:8000';

interface Product {
  id?: number;
  product_id?: number;
  name: string;
  price: number;
  category: string;
  image_url: string;
}
interface CartItem {
  product: Product;
  quantity: number;
  selectedSize: string;
  selectedColor?: string;
}

const OrderPage: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<'checkout' | 'success'>('checkout');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cod'>('card');
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '',
    address: '', city: '', postalCode: '', phone: '',
    cardNumber: '', expiry: '', cvv: '', cardName: '',
    discount: '',
  });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [discountApplied, setDiscountApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderSnapshot, setOrderSnapshot] = useState<{
    items: CartItem[]; subtotal: number; shippingCost: number;
    discount: number; total: number; shippingMethod: string; paymentMethod: string;
  } | null>(null);

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem('viton_cart') || '[]')); }
    catch { setCart([]); }
  }, []);

  const subtotal     = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const shippingCost = shippingMethod === 'express' ? 599 : 299;
  const discount     = discountApplied ? subtotal * 0.1 : 0;
  const total        = subtotal + shippingCost - discount;

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const e: Partial<typeof form> = {};
    if (!form.email)     e.email     = 'Required';
    if (!form.firstName) e.firstName = 'Required';
    if (!form.lastName)  e.lastName  = 'Required';
    if (!form.address)   e.address   = 'Required';
    if (!form.city)      e.city      = 'Required';
    if (!form.phone)     e.phone     = 'Required';
    if (paymentMethod === 'card') {
      if (!form.cardNumber) e.cardNumber = 'Required';
      if (!form.expiry)     e.expiry     = 'Required';
      if (!form.cvv)        e.cvv        = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const res = await fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.user_id,
            items: cart.map(i => ({
              product_id: i.product.product_id ?? i.product.id,
              name: i.product.name, price: i.product.price,
              quantity: i.quantity, size: i.selectedSize,
              color: i.selectedColor || '', image_url: i.product.image_url,
              category: i.product.category,
            })),
            subtotal, shipping: shippingCost, discount, total,
            address: {
              firstName: form.firstName, lastName: form.lastName,
              email: form.email, phone: form.phone,
              address: form.address, city: form.city, postalCode: form.postalCode,
              shippingMethod, paymentMethod,
            },
          }),
        });
        const data = await res.json();
        if (data?.order?.order_id) setOrderId(data.order.order_id);
      }
    } catch (e) { console.error('Order save failed:', e); }

    // Snapshot cart + totals before clearing so the success screen can show them
    setOrderSnapshot({ items: cart, subtotal, shippingCost, discount, total, shippingMethod, paymentMethod });
    localStorage.setItem('viton_cart', '[]');
    setCart([]);
    setStep('success');
    setLoading(false);
  };

  const getCategoryColor = (cat: string) => {
    const m: Record<string, string> = { tops: '#d4c8b8', bottoms: '#c8d0d4', dresses: '#d4c8cc', outerwear: '#c8ccc0', accessories: '#d0d4c8', footwear: '#bca89c' };
    return m[cat?.toLowerCase()] || '#d4cfc8';
  };

  if (step === 'success' && orderSnapshot) {
    const snap = orderSnapshot;
    return (
      <div style={pageStyle}>
        <style>{fonts}</style>
        <Navbar />
        <div style={successWrapStyle}>
          <div style={{ ...successBoxStyle, maxWidth: '600px' }}>
            {/* Header */}
            <div style={successIconStyle}>✓</div>
            <p style={overlineStyle}>Thank you</p>
            <h1 style={successTitleStyle}>Order Confirmed</h1>
            <p style={successSubStyle}>
              Your order has been placed successfully. We'll send a confirmation to <strong>{form.email}</strong>.
            </p>

            {/* Order ID */}
            {orderId && (
              <div style={orderIdBadgeStyle}>
                Order <strong>#{String(orderId).padStart(6, '0')}</strong>
              </div>
            )}

            {/* Items */}
            <div style={successItemsStyle}>
              {snap.items.map((item, i) => (
                <div key={i} style={successItemRowStyle}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: '48px', height: '48px', overflow: 'hidden', background: '#f0ede8' }}>
                      {item.product.image_url && (
                        <img src={item.product.image_url} alt={item.product.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <span style={qtyBadgeStyle}>{item.quantity}</span>
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' as const, minWidth: 0 }}>
                    <p style={itemNameStyle}>{item.product.name}</p>
                    {(item.selectedColor || item.selectedSize) && (
                      <p style={itemSubStyle}>{[item.selectedColor, item.selectedSize && `Size: ${item.selectedSize}`].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <p style={itemPriceStyle}>LKR {(item.product.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>

            {/* Cost breakdown */}
            <div style={successBreakdownStyle}>
              <div style={breakdownRowStyle}>
                <span style={summaryLabelStyle}>Subtotal</span>
                <span style={summaryValueStyle}>LKR {snap.subtotal.toFixed(2)}</span>
              </div>
              {snap.discount > 0 && (
                <div style={breakdownRowStyle}>
                  <span style={summaryLabelStyle}>Discount (10%)</span>
                  <span style={{ ...summaryValueStyle, color: '#4caf50' }}>− LKR {snap.discount.toFixed(2)}</span>
                </div>
              )}
              <div style={breakdownRowStyle}>
                <span style={summaryLabelStyle}>
                  Shipping
                  <span style={{ display: 'block', fontSize: '10px', color: '#9a9590' }}>
                    {snap.shippingMethod === 'express' ? 'Express · 1–2 days' : 'Standard · 3–5 days'}
                  </span>
                </span>
                <span style={summaryValueStyle}>LKR {snap.shippingCost.toFixed(2)}</span>
              </div>
              <div style={{ ...breakdownRowStyle, borderTop: '1px solid #e8e4de', paddingTop: '12px', marginTop: '4px' }}>
                <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: '#1a1a1a' }}>Total Paid</span>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', color: '#c9a96e' }}>LKR {snap.total.toFixed(2)}</span>
              </div>
              <div style={{ ...breakdownRowStyle, marginTop: '4px' }}>
                <span style={summaryLabelStyle}>Payment</span>
                <span style={summaryValueStyle}>{snap.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Credit / Debit Card'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' as const }}>
              <Link to="/products" style={primaryBtnStyle}>Continue Shopping</Link>
              <Link to="/" style={secondaryBtnStyle}>Back to Home</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div style={pageStyle}>
        <style>{fonts}</style>
        <Navbar />
        <div style={successWrapStyle}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>🛍️</p>
            <p style={overlineStyle}>Nothing here</p>
            <h2 style={successTitleStyle}>Your Cart is Empty</h2>
            <Link to="/products" style={{ ...primaryBtnStyle, display: 'inline-block', marginTop: '24px' }}>Browse Products</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <style>{fonts + dynamicCSS}</style>
      <Navbar />
      <div style={layoutStyle}>

        {/* ── LEFT: FORM ── */}
        <div style={leftPanelStyle}>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Contact</h2>
            <Field label="Email address" error={errors.email}>
              <input style={inputStyle(!!errors.email)} type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
            </Field>
          </section>

          <div style={dividerStyle} />

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Shipping Address</h2>
            <div style={rowStyle}>
              <Field label="First name" error={errors.firstName}>
                <input style={inputStyle(!!errors.firstName)} placeholder="Thamindu" value={form.firstName} onChange={set('firstName')} />
              </Field>
              <Field label="Last name" error={errors.lastName}>
                <input style={inputStyle(!!errors.lastName)} placeholder="Samarathunga" value={form.lastName} onChange={set('lastName')} />
              </Field>
            </div>
            <Field label="Address" error={errors.address}>
              <input style={inputStyle(!!errors.address)} placeholder="123 Galle Road" value={form.address} onChange={set('address')} />
            </Field>
            <div style={rowStyle}>
              <Field label="City" error={errors.city}>
                <input style={inputStyle(!!errors.city)} placeholder="Colombo" value={form.city} onChange={set('city')} />
              </Field>
              <Field label="Postal code">
                <input style={inputStyle(false)} placeholder="10000" value={form.postalCode} onChange={set('postalCode')} />
              </Field>
            </div>
            <Field label="Phone" error={errors.phone}>
              <input style={inputStyle(!!errors.phone)} placeholder="+94 77 000 0000" value={form.phone} onChange={set('phone')} />
            </Field>
          </section>

          <div style={dividerStyle} />

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Shipping Method</h2>
            <div style={shippingOptionsStyle}>
              {([
                { id: 'standard', label: 'Standard Delivery', sub: '3–5 Business Days', price: 299 },
                { id: 'express',  label: 'Express Delivery',  sub: '1–2 Business Days', price: 599 },
              ] as const).map(opt => (
                <label key={opt.id} style={{ ...shippingOptionStyle, borderColor: shippingMethod === opt.id ? '#c9a96e' : '#e8e4de', background: shippingMethod === opt.id ? '#fdf9f3' : '#fff' }}>
                  <input type="radio" name="shipping" value={opt.id} checked={shippingMethod === opt.id} onChange={() => setShippingMethod(opt.id)} style={{ accentColor: '#c9a96e' }} />
                  <div style={{ flex: 1 }}>
                    <p style={optionLabelStyle}>{opt.label}</p>
                    <p style={optionSubStyle}>{opt.sub}</p>
                  </div>
                  <span style={optionPriceStyle}>LKR {opt.price}</span>
                </label>
              ))}
            </div>
          </section>

          <div style={dividerStyle} />

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Payment</h2>
            <p style={secureNoteStyle}>🔒 All transactions are secure and encrypted.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {([
                { id: 'card', label: 'Credit / Debit Card' },
                { id: 'cod',  label: 'Cash on Delivery' },
              ] as const).map(opt => (
                <label key={opt.id} style={{ ...shippingOptionStyle, borderColor: paymentMethod === opt.id ? '#c9a96e' : '#e8e4de', background: paymentMethod === opt.id ? '#fdf9f3' : '#fff' }}>
                  <input type="radio" name="payment" value={opt.id} checked={paymentMethod === opt.id} onChange={() => setPaymentMethod(opt.id)} style={{ accentColor: '#c9a96e' }} />
                  <span style={optionLabelStyle}>{opt.label}</span>
                </label>
              ))}
            </div>

            {paymentMethod === 'card' && (
              <div style={{ border: '1px solid #e8e4de', padding: '20px', background: '#fafaf8' }}>
                <Field label="Card number" error={errors.cardNumber}>
                  <input style={inputStyle(!!errors.cardNumber)} placeholder="1234 5678 9012 3456" maxLength={19}
                    value={form.cardNumber}
                    onChange={e => setForm(f => ({ ...f, cardNumber: e.target.value.replace(/\D/g,'').replace(/(\d{4})/g,'$1 ').trim() }))} />
                </Field>
                <div style={rowStyle}>
                  <Field label="Expiry (MM / YY)" error={errors.expiry}>
                    <input style={inputStyle(!!errors.expiry)} placeholder="MM / YY" maxLength={7} value={form.expiry} onChange={set('expiry')} />
                  </Field>
                  <Field label="Security code" error={errors.cvv}>
                    <input style={inputStyle(!!errors.cvv)} placeholder="CVV" maxLength={4} value={form.cvv} onChange={set('cvv')} />
                  </Field>
                </div>
                <Field label="Name on card">
                  <input style={inputStyle(false)} placeholder="Full name as on card" value={form.cardName} onChange={set('cardName')} />
                </Field>
              </div>
            )}

            {paymentMethod === 'cod' && (
              <div style={{ border: '1px solid #e8e4de', padding: '20px', background: '#fafaf8', fontFamily: "'Montserrat',sans-serif", fontSize: '12px', color: '#6b6560', lineHeight: 1.8 }}>
                Pay with cash when your order is delivered. Please have the exact amount ready.
              </div>
            )}
          </section>

          <button
            style={{ ...payBtnStyle, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            onClick={handlePlaceOrder}
            disabled={loading}
            className="pay-btn"
          >
            {loading ? 'Processing…' : `Place Order · LKR ${total.toFixed(2)}`}
          </button>

          <p style={termsStyle}>
            By placing your order you agree to our{' '}
            <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</span>{' '}
            and{' '}
            <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>.
          </p>
        </div>

        {/* ── RIGHT: ORDER SUMMARY ── */}
        <div style={rightPanelStyle}>
          <div style={summaryCardStyle}>
            <h3 style={summaryTitleStyle}>Order Summary</h3>
            <div style={{ marginBottom: '24px' }}>
              {cart.map((item, i) => {
                const pid = item.product.product_id ?? item.product.id ?? i;
                return (
                  <div key={`${pid}-${item.selectedSize}`} style={orderItemStyle}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: '56px', height: '56px', background: `linear-gradient(135deg, ${getCategoryColor(item.product.category)}, #e8ddd0)`, position: 'relative', overflow: 'hidden' }}>
                        {item.product.image_url && (
                          <img src={item.product.image_url} alt={item.product.name}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <span style={qtyBadgeStyle}>{item.quantity}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={itemNameStyle}>{item.product.name}</p>
                      {(item.selectedColor || item.selectedSize) && (
                        <p style={itemSubStyle}>{[item.selectedColor, item.selectedSize && `Size: ${item.selectedSize}`].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <p style={itemPriceStyle}>LKR {(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input
                style={{ ...inputStyle(false), marginBottom: 0, flex: 1, fontSize: '11px' }}
                placeholder="Discount code or gift card"
                value={form.discount}
                onChange={set('discount')}
              />
              <button style={applyBtnStyle} onClick={() => {
                if (form.discount.toUpperCase() === 'TOPLABLE10') setDiscountApplied(true);
                else alert('Invalid discount code');
              }}>Apply</button>
            </div>

            <div style={{ borderTop: '1px solid #e8e4de', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={totalRowStyle}>
                <span style={summaryLabelStyle}>Subtotal</span>
                <span style={summaryValueStyle}>LKR {subtotal.toFixed(2)}</span>
              </div>
              {discountApplied && (
                <div style={totalRowStyle}>
                  <span style={summaryLabelStyle}>Discount (10%)</span>
                  <span style={{ ...summaryValueStyle, color: '#4caf50' }}>− LKR {discount.toFixed(2)}</span>
                </div>
              )}
              <div style={totalRowStyle}>
                <span style={summaryLabelStyle}>
                  Shipping
                  <span style={{ display: 'block', fontSize: '10px', color: '#9a9590' }}>
                    {shippingMethod === 'express' ? 'Express · 1–2 days' : 'Standard · 3–5 days'}
                  </span>
                </span>
                <span style={summaryValueStyle}>LKR {shippingCost.toFixed(2)}</span>
              </div>
              <div style={{ ...totalRowStyle, paddingTop: '12px', borderTop: '1px solid #e8e4de' }}>
                <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#1a1a1a' }}>Total</span>
                <div style={{ textAlign: 'right' as const }}>
                  <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '9px', color: '#9a9590', display: 'block', marginBottom: '2px' }}>LKR</span>
                  <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '28px', fontWeight: 300, color: '#1a1a1a' }}>{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

/* ── Field wrapper ── */
const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={labelStyle}>{label}{error && <span style={{ color: '#e53935', marginLeft: '6px' }}>{error}</span>}</label>
    {children}
  </div>
);

/* ── Helpers ── */
const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
`;
const dynamicCSS = `
  .pay-btn:hover { background: #333 !important; }
  input:focus { outline: none; border-color: #c9a96e !important; }
`;

/* ── Styles ── */
const pageStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", background: '#fafaf8', minHeight: '100vh', color: '#1a1a1a' };
const layoutStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 420px', minHeight: 'calc(100vh - 65px)', maxWidth: '1200px', margin: '0 auto' };
const leftPanelStyle: React.CSSProperties = { padding: '40px 48px 60px', borderRight: '1px solid #e8e4de', background: '#fff' };
const rightPanelStyle: React.CSSProperties = { padding: '40px 36px 60px', background: '#fafaf8' };
const sectionStyle: React.CSSProperties = { marginBottom: '4px' };
const sectionTitleStyle: React.CSSProperties = { fontFamily: "'Oswald',sans-serif", fontSize: '18px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: '18px' };
const dividerStyle: React.CSSProperties = { height: '1px', background: '#e8e4de', margin: '24px 0' };
const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' };
const labelStyle: React.CSSProperties = { display: 'block', fontFamily: "'Montserrat',sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#6b6560', marginBottom: '6px' };
const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '12px 14px',
  border: `1px solid ${hasError ? '#e53935' : '#e8e4de'}`,
  fontFamily: "'Montserrat',sans-serif", fontSize: '12px', color: '#1a1a1a',
  background: '#fff', outline: 'none', transition: 'border-color 0.2s',
});
const overlineStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '12px' };
const shippingOptionsStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '8px' };
const shippingOptionStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: '1px solid #e8e4de', cursor: 'pointer', transition: 'all 0.2s' };
const optionLabelStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '12px', fontWeight: 400, color: '#1a1a1a' };
const optionSubStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', color: '#9a9590', marginTop: '2px' };
const optionPriceStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '12px', color: '#1a1a1a', whiteSpace: 'nowrap' };
const secureNoteStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', color: '#9a9590', marginBottom: '14px', letterSpacing: '0.5px' };
const payBtnStyle: React.CSSProperties = { width: '100%', padding: '18px', background: '#1a1a1a', border: 'none', color: '#fff', fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.25s', marginTop: '28px', marginBottom: '16px' };
const termsStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', color: '#9a9590', lineHeight: 1.8, textAlign: 'center' };
const summaryCardStyle: React.CSSProperties = { position: 'sticky', top: '105px' };
const summaryTitleStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', fontWeight: 300, color: '#1a1a1a', marginBottom: '20px' };
const orderItemStyle: React.CSSProperties = { display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' };
const qtyBadgeStyle: React.CSSProperties = { position: 'absolute', top: '-8px', right: '-8px', background: '#1a1a1a', color: '#fff', borderRadius: '999px', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat',sans-serif", fontSize: '9px', fontWeight: 700 };
const itemNameStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond',serif", fontSize: '15px', fontWeight: 400, color: '#1a1a1a', lineHeight: 1.3 };
const itemSubStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', color: '#9a9590', marginTop: '3px', letterSpacing: '0.5px' };
const itemPriceStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '12px', fontWeight: 500, color: '#1a1a1a', whiteSpace: 'nowrap' };
const applyBtnStyle: React.CSSProperties = { padding: '0 20px', background: '#1a1a1a', border: 'none', color: '#fff', fontFamily: "'Montserrat',sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' };
const totalRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const summaryLabelStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 300, color: '#6b6560' };
const summaryValueStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '12px', fontWeight: 400, color: '#1a1a1a' };
const successWrapStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 65px)', padding: '40px 24px' };
const successBoxStyle: React.CSSProperties = { background: '#fff', padding: '56px 48px', maxWidth: '520px', width: '100%', textAlign: 'center', border: '1px solid #e8e4de' };
const successIconStyle: React.CSSProperties = { width: '56px', height: '56px', borderRadius: '999px', background: '#c9a96e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 20px', fontWeight: 300 };
const successTitleStyle: React.CSSProperties = { fontFamily: "'Oswald',sans-serif", fontSize: '32px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: '12px' };
const successSubStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '12px', color: '#6b6560', lineHeight: 1.9, marginBottom: '28px' };
const primaryBtnStyle: React.CSSProperties = { padding: '14px 32px', background: '#1a1a1a', color: '#fff', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block' };
const secondaryBtnStyle: React.CSSProperties = { padding: '14px 32px', background: 'transparent', color: '#1a1a1a', border: '1px solid #d4cfc8', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block' };

const orderIdBadgeStyle: React.CSSProperties = { display: 'inline-block', background: '#fdf9f3', border: '1px solid #e8dcc8', borderRadius: '4px', padding: '6px 16px', fontFamily: "'Montserrat',sans-serif", fontSize: '11px', color: '#6b6560', letterSpacing: '1px', marginBottom: '24px' };
const successItemsStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', textAlign: 'left' };
const successItemRowStyle: React.CSSProperties = { display: 'flex', gap: '14px', alignItems: 'center' };
const successBreakdownStyle: React.CSSProperties = { background: '#fafaf8', border: '1px solid #e8e4de', padding: '16px 20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px' };
const breakdownRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };

export default OrderPage;
