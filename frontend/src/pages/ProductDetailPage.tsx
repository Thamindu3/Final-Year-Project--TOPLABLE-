import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';

interface Product {
  id?: number;
  product_id?: number;
  name: string;
  price: number;
  category: string;
  description: string;
  image_url: string;
  image_gallery?: string[];
  sizes?: string[];
  colors?: string[];
  stock?: number;
  size_stock?: Record<string, number>;
  color_size_stock?: Record<string, Record<string, number>>;
  color_images?: Record<string, string>;
}

interface CartItem {
  product: Product;
  quantity: number;
  selectedSize: string;
  selectedColor?: string;
}

interface PersonImage {
  id: string;
  filename: string;
  url: string;
}

const COLOR_SWATCHES: Record<string, string> = {
  white: '#f0f0f0', black: '#1a1a1a', gray: '#888888', grey: '#888888',
  blue: '#4a7dc8', navy: '#1a2860', red: '#c83232', green: '#3a8a4a',
  yellow: '#d4c040', pink: '#e87890', purple: '#8040a0', orange: '#e07830',
  brown: '#8a5a30', beige: '#c8b49a', cream: '#f5f0e0', khaki: '#b0a060',
  'blue-white': '#6090d0', 'red-white': '#d04040', 'light blue': '#a0c0e0',
};

const API_BASE = 'http://localhost:8000';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct]           = useState<Product | null>(null);
  const [loading, setLoading]           = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity]         = useState(1);
  const [openSection, setOpenSection]   = useState<string | null>('description');
  const [activeImg, setActiveImg]       = useState(0);
  const [flash, setFlash]               = useState('');

  // ── Try-On modal state ──
  const [showTryOn, setShowTryOn]               = useState(false);
  const [tryOnPersons, setTryOnPersons]         = useState<PersonImage[]>([]);
  const [tryOnPersonsLoading, setTryOnPersonsLoading] = useState(false);
  const [tryOnTab, setTryOnTab]                 = useState<'models' | 'upload'>('models');
  const [tryOnPerson, setTryOnPerson]           = useState<PersonImage | null>(null);
  const [tryOnPersonPreview, setTryOnPersonPreview] = useState('');
  const [tryOnUploading, setTryOnUploading]     = useState(false);
  const [tryOnUploadMsg, setTryOnUploadMsg]     = useState('');
  const [tryOnUploadedId, setTryOnUploadedId]   = useState<string | null>(null);
  const [tryOnLoading, setTryOnLoading]         = useState(false);
  const [tryOnProgress, setTryOnProgress]       = useState('');
  const [tryOnResult, setTryOnResult]           = useState('');
  const [tryOnPersonUrl, setTryOnPersonUrl]     = useState('');
  const [tryOnClothUrl, setTryOnClothUrl]       = useState('');
  const [tryOnError, setTryOnError]             = useState('');
  const [tryOnColor, setTryOnColor]             = useState('');
  const tryOnPersonUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/products/${id}`);
        const data = await res.json();
        if (data.success && data.product) {
          setProduct(data.product);
          setSelectedSize(data.product.sizes?.[0] || '');
          setSelectedColor(data.product.colors?.[0] || '');
        }
      } catch {
        // handled by loading state
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2800);
  };

  const handleAddToCart = () => {
    if (!product) return;
    try {
      const cart: CartItem[] = JSON.parse(localStorage.getItem('viton_cart') || '[]');
      const pid = product.product_id ?? product.id;
      const existing = cart.find(i =>
        (i.product.product_id ?? i.product.id) === pid &&
        i.selectedSize === selectedSize &&
        i.selectedColor === selectedColor
      );
      const colorSpecificImage = (selectedColor && product.color_images?.[selectedColor]) || product.image_url;
      const productForCart = colorSpecificImage !== product.image_url
        ? { ...product, image_url: colorSpecificImage }
        : product;
      if (existing) {
        existing.quantity += quantity;
      } else {
        cart.push({ product: productForCart, quantity, selectedSize, selectedColor });
      }
      localStorage.setItem('viton_cart', JSON.stringify(cart));
      showFlash(`"${product.name}" added to cart!`);
    } catch { /* ignore */ }
  };

  const handleOrderNow = () => {
    handleAddToCart();
    navigate('/order');
  };

  // ── Try-On handlers ──

  const openTryOn = () => {
    setShowTryOn(true);
    setTryOnColor(selectedColor || product?.colors?.[0] || '');
    if (tryOnPersons.length === 0 && !tryOnPersonsLoading) {
      setTryOnPersonsLoading(true);
      axios.get(`${API_BASE}/persons`, { timeout: 10000 })
        .then(r => { if (r.data.persons?.length) setTryOnPersons(r.data.persons); })
        .catch(() => {})
        .finally(() => setTryOnPersonsLoading(false));
    }
  };

  const closeTryOn = () => {
    setShowTryOn(false);
    setTryOnPerson(null);
    setTryOnPersonPreview('');
    setTryOnUploading(false);
    setTryOnUploadMsg('');
    setTryOnUploadedId(null);
    setTryOnLoading(false);
    setTryOnProgress('');
    setTryOnResult('');
    setTryOnPersonUrl('');
    setTryOnClothUrl('');
    setTryOnError('');
    setTryOnColor('');
    if (tryOnPersonUploadRef.current) tryOnPersonUploadRef.current.value = '';
  };

  // Maps color → image URL: colors[0]→image_url, colors[1]→gallery[0], etc.
  const getClothImageForColor = (color: string): string => {
    if (!product) return '';
    const gallery: string[] = (() => {
      const raw = (product as any).image_gallery;
      if (Array.isArray(raw)) return raw.filter(Boolean);
      if (typeof raw === 'string') { try { return (JSON.parse(raw) as string[]).filter(Boolean); } catch { return []; } }
      return [];
    })();
    const colors = product.colors || [];
    const idx = colors.indexOf(color);
    if (idx <= 0) return product.image_url;
    return gallery[idx - 1] || product.image_url;
  };

  const handleTryOnPersonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTryOnUploading(true);
    setTryOnUploadMsg('Uploading your photo...');
    setTryOnError('');
    setTryOnResult('');
    try {
      const form = new FormData();
      form.append('file', file);
      setTryOnUploadMsg('Processing your photo (30–60 s)...');
      const resp = await axios.post(`${API_BASE}/upload/person`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
        onUploadProgress: (ev) => {
          const pct = Math.round((ev.loaded * 100) / (ev.total || 1));
          setTryOnUploadMsg(pct < 100 ? `Uploading: ${pct}%` : 'Running AI preprocessing...');
        },
      });
      if (resp.data.status === 'success') {
        const p: PersonImage = { id: resp.data.person_id, filename: resp.data.filename, url: resp.data.preview_url };
        setTryOnUploadedId(resp.data.person_id);
        setTryOnPerson(p);
        setTryOnPersonPreview(`${API_BASE}${resp.data.preview_url}`);
        setTryOnUploadMsg('Photo processed!');
        setTimeout(() => { setTryOnUploadMsg(''); setTryOnUploading(false); }, 3000);
      } else { throw new Error('Upload failed'); }
    } catch (err: any) {
      let msg = 'Failed to process photo. ';
      if (err.code === 'ECONNABORTED') msg += 'Timed out.';
      else if (err.response?.status === 500) msg += err.response.data?.detail || 'Server error.';
      else if (err.response?.status === 400) msg += err.response.data?.detail || 'Invalid image.';
      else if (err.request) msg += 'Cannot connect to backend.';
      else msg += err.message;
      setTryOnError(msg);
      setTryOnUploading(false);
      setTryOnUploadMsg('');
    }
  };

  const handleTryOnGenerate = async () => {
    if (!product || !tryOnPerson) {
      setTryOnError('Please select or upload a person image first.');
      return;
    }
    setTryOnLoading(true);
    setTryOnError('');
    setTryOnResult('');
    setTryOnPersonUrl('');
    setTryOnClothUrl('');
    setTryOnProgress('Preparing clothing image...');
    try {
      const clothImg = getClothImageForColor(tryOnColor) || product.image_url;
      setTryOnProgress('Uploading clothing...');
      await axios.post(
        `${API_BASE}/upload/cloth-from-static`,
        {},
        { params: { image_url: clothImg }, timeout: 30000 }
      );

      setTryOnProgress('Generating cloth mask...');
      try { await axios.post(`${API_BASE}/preprocess/cloth-mask`, {}, { timeout: 30000 }); } catch (_) {}

      setTryOnProgress('Running AI try-on (30–60 s)...');
      const resp = await axios.post(`${API_BASE}/run`, {}, {
        params: { person_name: tryOnPerson.filename },
        timeout: 150000,
      });

      if (resp.data.status === 'success') {
        setTryOnResult(`${API_BASE}${resp.data.view_url}`);
        setTryOnPersonUrl(`${API_BASE}${resp.data.person_url}`);
        setTryOnClothUrl(`${API_BASE}${resp.data.cloth_url}`);
        setTryOnProgress('Complete!');
      } else { throw new Error(resp.data.error || 'Inference failed'); }
    } catch (err: any) {
      let msg = 'Failed to generate try-on. ';
      if (err.code === 'ECONNABORTED') msg += 'Request timed out.';
      else if (err.response?.status === 500) msg += 'Backend processing error.';
      else if (err.response?.status === 404) msg += 'Product image not found on server.';
      else if (err.response?.status === 400) msg += err.response.data?.detail || 'Invalid request.';
      else if (err.response) msg += `Server error (${err.response.status}).`;
      else if (err.request) msg += 'Cannot connect to backend — make sure the server is running.';
      else msg += err.message;
      setTryOnError(msg);
    } finally { setTryOnLoading(false); }
  };

  const handleTryOnDownload = () => {
    if (!tryOnResult) return;
    const a = document.createElement('a');
    a.href = tryOnResult;
    a.download = `tryon-${Date.now()}.jpg`;
    a.click();
  };

  const getCategoryColor = (cat: string) => {
    const m: Record<string, string> = {
      tops: '#d4c8b8', bottoms: '#c8d0d4', dresses: '#d4c8cc',
      outerwear: '#c8ccc0', accessories: '#d0d4c8', footwear: '#bca89c',
    };
    return m[cat?.toLowerCase()] || '#d4cfc8';
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <style>{fonts}</style>
        <Navbar />
        <div style={centerStyle}>
          <div style={loadingBarStyle} />
          <p style={loadingTextStyle}>Loading Product</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={pageStyle}>
        <style>{fonts}</style>
        <Navbar />
        <div style={centerStyle}>
          <p style={overlineStyle}>Not Found</p>
          <h2 style={notFoundTitleStyle}>Product Unavailable</h2>
          <Link to="/products" style={backBtnStyle}>Back to Products</Link>
        </div>
      </div>
    );
  }

  const colorSizeStock: Record<string, Record<string, number>> = (product as any).color_size_stock || {};
  const sizeStock: Record<string, number> = (product as any).size_stock || {};

  const resolveStock = (color: string, size: string): number => {
    if (color && colorSizeStock[color]) {
      const entry = colorSizeStock[color];
      if (size && entry[size] !== undefined) return entry[size];
      return Object.values(entry).reduce((a, b) => a + b, 0);
    }
    if (size && sizeStock[size] !== undefined) return sizeStock[size];
    return product.stock ?? 0;
  };

  const sizeQty = resolveStock(selectedColor, selectedSize);
  const inStock = sizeQty > 0;
  const catColor = getCategoryColor(product.category);

  const rawImgGallery: string[] = (() => {
    const g = (product as any).image_gallery;
    if (Array.isArray(g)) return g;
    if (typeof g === 'string') { try { return JSON.parse(g); } catch { return []; } }
    return [];
  })();

  const gallery: { label: string; src: string; overlay: string }[] = [];
  if (product.image_url) gallery.push({ label: 'Main', src: product.image_url, overlay: '' });
  rawImgGallery.forEach((url, i) => {
    if (url) gallery.push({ label: `View ${i + 1}`, src: url, overlay: '' });
  });
  if (gallery.length === 0) gallery.push({ label: 'Main', src: '', overlay: '' });

  return (
    <div style={pageStyle}>
      <style>{fonts + dynamicCSS}</style>
      <Navbar />

      {/* Flash */}
      {flash && <div style={flashStyle}>{flash}</div>}

      {/* Breadcrumb */}
      <nav style={breadcrumbStyle}>
        <Link to="/" style={breadcrumbLinkStyle}>Home</Link>
        <span style={breadcrumbSepStyle}>›</span>
        <Link to="/products" style={breadcrumbLinkStyle}>Products</Link>
        <span style={breadcrumbSepStyle}>›</span>
        <span style={breadcrumbCurrentStyle}>{product.name}</span>
      </nav>

      {/* Main layout */}
      <div style={layoutStyle}>

        {/* ── LEFT: IMAGE GALLERY ── */}
        <div style={imageSideStyle}>
          <div style={thumbStripStyle}>
            {gallery.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                style={{
                  ...thumbBtnStyle,
                  borderColor: activeImg === i ? '#1a1a1a' : 'transparent',
                  background: `linear-gradient(135deg, ${catColor} 0%, #e8ddd0 100%)`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {img.src && (
                  <img
                    src={img.src}
                    alt={img.label}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                {img.overlay && (
                  <div style={{ position: 'absolute', inset: 0, background: img.overlay }} />
                )}
                <span style={thumbLabelStyle}>{img.label}</span>
              </button>
            ))}
          </div>

          <div style={{
            ...mainImageStyle,
            background: `linear-gradient(135deg, ${catColor} 0%, #e8ddd0 100%)`,
          }}>
            {gallery[activeImg].src ? (
              <>
                <img
                  src={gallery[activeImg].src}
                  alt={product.name}
                  style={mainImgTagStyle}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {gallery[activeImg].overlay && (
                  <div style={{ position: 'absolute', inset: 0, background: gallery[activeImg].overlay }} />
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <span style={mainInitialStyle}>{product.name.charAt(0)}</span>
                <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '10px', letterSpacing: '2px', color: 'rgba(26,26,26,0.3)', textTransform: 'uppercase', marginTop: '12px' }}>
                  {gallery[activeImg].label} View
                </p>
              </div>
            )}
            <span style={categoryBadgeStyle}>{product.category}</span>

            {activeImg > 0 && (
              <button onClick={() => setActiveImg(i => i - 1)} style={{ ...arrowBtnStyle, left: '12px' }}>‹</button>
            )}
            {activeImg < gallery.length - 1 && (
              <button onClick={() => setActiveImg(i => i + 1)} style={{ ...arrowBtnStyle, right: '12px' }}>›</button>
            )}

            <div style={imgCounterStyle}>{activeImg + 1} / {gallery.length}</div>
          </div>
        </div>

        {/* ── RIGHT: INFO ── */}
        <div style={infoSideStyle}>
          <p style={overlineStyle}>Product Details</p>
          <h1 style={productNameStyle}>{product.name}</h1>
          <p style={priceStyle}>LKR {Number(product.price).toFixed(2)}</p>

          <div style={dividerStyle} />

          {/* Color selector */}
          {product.colors && product.colors.length > 0 && (
            <div style={sectionBlockStyle}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
                <p style={{ ...sectionLabelStyle, marginBottom: 0 }}>Color</p>
                {selectedColor && (
                  <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 300, color: '#1a1a1a', letterSpacing: '0.5px' }}>
                    — {selectedColor}
                  </span>
                )}
              </div>
              <div style={colorRowStyle}>
                {product.colors.map(c => (
                  <button
                    key={c}
                    title={c}
                    onClick={() => {
                      setSelectedColor(c);
                      const colorImg = product.color_images?.[c];
                      if (colorImg) {
                        const allImgs = [product.image_url, ...(product.image_gallery || [])];
                        const idx = allImgs.indexOf(colorImg);
                        if (idx >= 0) setActiveImg(idx);
                      }
                    }}
                    style={{
                      width: '32px', height: '32px', borderRadius: '50%', padding: 0,
                      background: COLOR_SWATCHES[c] || '#999',
                      border: selectedColor === c ? '2.5px solid #c9a96e' : '2.5px solid transparent',
                      outline: selectedColor === c ? '2px solid #c9a96e' : '1px solid #d4cfc8',
                      outlineOffset: selectedColor === c ? '2px' : '0px',
                      cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: selectedColor === c ? '0 0 0 1px #c9a96e' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Size selector */}
          {product.sizes && product.sizes.length > 0 && (
            <div style={sectionBlockStyle}>
              <p style={sectionLabelStyle}>Select Size</p>
              <div style={sizeRowStyle}>
                {product.sizes.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    style={{
                      ...sizeBtnStyle,
                      background: selectedSize === s ? '#1a1a1a' : '#fff',
                      color: selectedSize === s ? '#fff' : '#1a1a1a',
                      borderColor: selectedSize === s ? '#1a1a1a' : '#d4cfc8',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div style={sectionBlockStyle}>
            <p style={sectionLabelStyle}>Quantity</p>
            <div style={qtyRowStyle}>
              <button style={qtyBtnStyle} onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
              <span style={qtyValueStyle}>{String(quantity).padStart(2, '0')}</span>
              <button style={qtyBtnStyle} onClick={() => setQuantity(q => q + 1)}>+</button>
            </div>
          </div>

          {/* Availability */}
          <p style={{ ...stockStyle, color: inStock ? '#4caf50' : '#e53935' }}>
            {inStock
              ? `In Stock — ${sizeQty} units available${selectedSize ? ` (Size ${selectedSize})` : ''}`
              : `Out of Stock${selectedSize ? ` in Size ${selectedSize}` : ''}`}
          </p>

          {/* Action buttons */}
          <div style={actionRowStyle}>
            <button
              style={{ ...addToCartBtnStyle, opacity: inStock ? 1 : 0.5, cursor: inStock ? 'pointer' : 'not-allowed' }}
              disabled={!inStock}
              onClick={handleAddToCart}
              className="btn-cart"
            >
              Add to Cart
            </button>
            <button
              style={{ ...orderNowBtnStyle, opacity: inStock ? 1 : 0.5, cursor: inStock ? 'pointer' : 'not-allowed' }}
              disabled={!inStock}
              onClick={handleOrderNow}
              className="btn-order"
            >
              Order Now
            </button>
          </div>

          {/* Virtual Try-On button */}
          <button style={tryOnBtnStyle} onClick={openTryOn} className="btn-tryon">
            Virtual Try-On
          </button>

          <div style={dividerStyle} />

          {/* Accordion sections */}
          {[
            {
              key: 'description',
              title: 'Description',
              content: product.description || 'No description available.',
            },
            {
              key: 'details',
              title: 'Details',
              content: `Category: ${product.category}\nSizes: ${(product.sizes || []).join(', ') || 'N/A'}\nColors: ${(product.colors || []).join(', ') || 'N/A'}`,
            },
            {
              key: 'shipping',
              title: 'Shipping & Returns',
              content: 'Standard delivery: 3–5 business days (LKR 299)\nExpress delivery: 1–2 business days (LKR 599)\nFree returns within 14 days of delivery.',
            },
          ].map(sec => (
            <div key={sec.key} style={accordionStyle}>
              <button
                style={accordionHeaderStyle}
                onClick={() => setOpenSection(openSection === sec.key ? null : sec.key)}
              >
                <span>{sec.title}</span>
                <span style={{ fontSize: '18px', color: '#9a9590', transition: 'transform 0.2s', transform: openSection === sec.key ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ∨
                </span>
              </button>
              {openSection === sec.key && (
                <div style={accordionBodyStyle}>
                  {sec.content.split('\n').map((line, i) => (
                    <p key={i} style={{ marginBottom: '6px' }}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── VIRTUAL TRY-ON MODAL ── */}
      {showTryOn && (
        <div style={toOverlayStyle} onClick={e => { if (e.target === e.currentTarget) closeTryOn(); }}>
          <div style={toModalStyle}>

            {/* Header */}
            <div style={toHeaderStyle}>
              <div>
                <p style={toOverlineStyle}>AI-Powered</p>
                <h2 style={toTitleStyle}>Virtual Try-On</h2>
              </div>
              <button style={toCloseBtnStyle} onClick={closeTryOn}>✕</button>
            </div>

            {/* Clothing preview + color picker */}
            <div style={toClothRowStyle}>
              <img
                src={getClothImageForColor(tryOnColor) || product.image_url}
                alt={product.name}
                style={toClothThumbStyle}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div style={{ flex: 1 }}>
                <p style={toSectionLabelStyle}>Selected Clothing</p>
                <p style={toClothNameStyle}>{product.name}</p>
                <p style={toClothPriceStyle}>LKR {Number(product.price).toFixed(2)}</p>

                {product.colors && product.colors.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <p style={{ ...toSectionLabelStyle, marginBottom: '8px' }}>
                      Color{tryOnColor
                        ? <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0, color: '#1a1a1a' }}> — {tryOnColor}</span>
                        : null}
                    </p>
                    <div style={toColorRowStyle}>
                      {product.colors.map(c => (
                        <button
                          key={c}
                          title={c}
                          onClick={() => { setTryOnColor(c); setTryOnResult(''); setTryOnError(''); setTryOnProgress(''); }}
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%', padding: 0, cursor: 'pointer',
                            background: COLOR_SWATCHES[c] || '#999',
                            border: tryOnColor === c ? '2.5px solid #c9a96e' : '2.5px solid transparent',
                            outline: tryOnColor === c ? '2px solid #c9a96e' : '1px solid #d4cfc8',
                            outlineOffset: tryOnColor === c ? '2px' : '0px',
                            boxShadow: tryOnColor === c ? '0 0 0 1px #c9a96e' : 'none',
                            transition: 'all 0.15s',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={toDividerStyle} />

            {/* Person selection tabs */}
            <div style={toTabRowStyle}>
              <button
                style={{ ...toTabBtnStyle, ...(tryOnTab === 'models' ? toTabActiveBtnStyle : {}) }}
                onClick={() => setTryOnTab('models')}
              >
                Pre-loaded Models
              </button>
              <button
                style={{ ...toTabBtnStyle, ...(tryOnTab === 'upload' ? toTabActiveBtnStyle : {}) }}
                onClick={() => setTryOnTab('upload')}
              >
                Upload Your Photo
              </button>
            </div>

            {/* Tab content */}
            {tryOnTab === 'models' ? (
              <div style={toTabContentStyle}>
                {tryOnPersonsLoading ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={toLoadBarStyle} />
                    <p style={toLoadTextStyle}>Loading models...</p>
                  </div>
                ) : tryOnPersons.length === 0 ? (
                  <p style={toLoadTextStyle}>No pre-loaded models found.</p>
                ) : (
                  <div style={toModelGridStyle}>
                    {tryOnPersons.map(p => (
                      <div
                        key={p.id || p.filename}
                        onClick={() => { setTryOnPerson(p); setTryOnPersonPreview(`${API_BASE}${p.url}`); setTryOnUploadedId(null); setTryOnError(''); setTryOnResult(''); }}
                        className="to-model-card"
                        style={{
                          ...toModelCardStyle,
                          ...(tryOnPerson?.filename === p.filename && !tryOnUploadedId ? toModelCardSelectedStyle : {}),
                        }}
                      >
                        <div style={{ ...toModelImgStyle, backgroundImage: `url(${API_BASE}${p.url})` }} />
                        <p style={toModelLabelStyle}>{p.filename.replace(/_00\.jpg$/, '').replace(/_/g, ' ')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={toTabContentStyle}>
                <input ref={tryOnPersonUploadRef} type="file" accept="image/*" onChange={handleTryOnPersonUpload} style={{ display: 'none' }} />
                <div style={toUploadBoxStyle}>
                  <button
                    onClick={() => tryOnPersonUploadRef.current?.click()}
                    disabled={tryOnUploading}
                    style={{ ...toUploadBtnStyle, ...(tryOnUploading ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                    className="to-upload-btn"
                  >
                    {tryOnUploading ? 'Processing...' : 'Choose Photo'}
                  </button>
                  {tryOnUploadMsg && <p style={toProgressTextStyle}>{tryOnUploadMsg}</p>}
                  {tryOnUploadedId && (
                    <div style={toSuccessBadgeStyle}>
                      <span style={toSuccessDotStyle} />
                      <span style={toSuccessTextStyle}>Photo ready: {tryOnUploadedId}</span>
                    </div>
                  )}
                  {tryOnPersonPreview && tryOnUploadedId && (
                    <img src={tryOnPersonPreview} alt="Uploaded person" style={toPersonPreviewStyle} />
                  )}
                  <div style={toTipsStyle}>
                    <p style={toTipsTitleStyle}>For best results:</p>
                    <ul style={toTipsListStyle}>
                      <li>Full body visible — head to feet in frame</li>
                      <li>Stand straight, arms at your sides</li>
                      <li>Plain solid-color background, good lighting</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Selected person preview (models tab) */}
            {tryOnPersonPreview && !tryOnUploadedId && (
              <div style={{ textAlign: 'center', margin: '0 0 16px' }}>
                <img src={tryOnPersonPreview} alt="Selected model" style={toPersonPreviewStyle} />
              </div>
            )}

            <div style={toDividerStyle} />

            {/* Error */}
            {tryOnError && (
              <div style={toErrorStyle}>
                <span style={toErrorDotStyle} />
                <p style={toErrorTextStyle}>{tryOnError}</p>
              </div>
            )}

            {/* Progress */}
            {tryOnProgress && (
              <div style={toProgressBoxStyle}>
                <div style={toProgressBarStyle} />
                <p style={toProgressBoxTextStyle}>{tryOnProgress}</p>
              </div>
            )}

            {/* Result */}
            {tryOnResult && (
              <div style={toResultSectionStyle}>
                <p style={toSectionLabelStyle}>Try-On Result</p>
                <div style={toResultGridStyle}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={toResultCardLabelStyle}>Model</p>
                    <img src={tryOnPersonUrl} alt="Model" style={toResultImgStyle} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={toResultCardLabelStyle}>Clothing</p>
                    <img src={tryOnClothUrl} alt="Clothing" style={toResultImgStyle} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={toResultCardLabelStyle}>Result</p>
                    <img src={tryOnResult} alt="Try-On Result" style={toResultImgStyle} />
                  </div>
                </div>
                <button style={toDownloadBtnStyle} onClick={handleTryOnDownload} className="to-download-btn">
                  Download Result
                </button>
              </div>
            )}

            {/* Generate / Reset */}
            <div style={toActionRowStyle}>
              <button
                onClick={handleTryOnGenerate}
                disabled={!tryOnPerson || tryOnLoading}
                style={{ ...toGenerateBtnStyle, ...(!tryOnPerson || tryOnLoading ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
                className="to-generate-btn"
              >
                {tryOnLoading ? 'Generating...' : 'Generate Try-On'}
              </button>
              <button
                onClick={() => {
                  setTryOnPerson(null); setTryOnPersonPreview(''); setTryOnUploadedId(null);
                  setTryOnResult(''); setTryOnPersonUrl(''); setTryOnClothUrl('');
                  setTryOnError(''); setTryOnProgress('');
                  if (tryOnPersonUploadRef.current) tryOnPersonUploadRef.current.value = '';
                }}
                style={toResetBtnStyle}
                className="to-reset-btn"
              >
                Reset
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

/* ── Styles ── */
const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
`;
const dynamicCSS = `
  .btn-cart:hover  { background: #b8924e !important; }
  .btn-order:hover { background: #333 !important; }
  .btn-tryon:hover { background: #1a1a1a !important; color: #fff !important; border-color: #1a1a1a !important; }
  .to-model-card { transition: all 0.2s; cursor: pointer; }
  .to-model-card:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,0.1); }
  .to-upload-btn:hover:not(:disabled) { background: #c9a96e !important; border-color: #c9a96e !important; color: #fff !important; }
  .to-generate-btn:hover:not(:disabled) { background: #0c2440 !important; }
  .to-reset-btn:hover    { background: #6b6560 !important; }
  .to-download-btn:hover { background: #c9a96e !important; border-color: #c9a96e !important; color: #fff !important; }
`;

const pageStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", background: '#fff', minHeight: '100vh', color: '#1a1a1a' };
const centerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '48px' };
const loadingBarStyle: React.CSSProperties = { width: '80px', height: '1px', background: '#c9a96e', margin: '0 auto 20px' };
const loadingTextStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#9a9590' };
const notFoundTitleStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond',serif", fontSize: '36px', fontWeight: 300, color: '#1a1a1a', margin: '8px 0 24px' };
const backBtnStyle: React.CSSProperties = { padding: '13px 32px', background: '#1a1a1a', color: '#fff', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase', textDecoration: 'none' };

const flashStyle: React.CSSProperties = { position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '12px 28px', fontFamily: "'Montserrat',sans-serif", fontSize: '11px', letterSpacing: '1px', zIndex: 999, whiteSpace: 'nowrap' };

const breadcrumbStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '18px 48px', borderBottom: '1px solid #f0ede8' };
const breadcrumbLinkStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', letterSpacing: '1.5px', color: '#c9a96e', textDecoration: 'none', textTransform: 'uppercase' };
const breadcrumbSepStyle: React.CSSProperties = { color: '#d4cfc8', fontSize: '12px' };
const breadcrumbCurrentStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', letterSpacing: '1.5px', color: '#6b6560', textTransform: 'uppercase' };

const layoutStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 'calc(100vh - 120px)' };

const thumbStripStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 0 16px 16px', overflowY: 'auto', width: '100px', flexShrink: 0 };
const thumbBtnStyle: React.CSSProperties = { width: '80px', height: '96px', border: '2px solid transparent', cursor: 'pointer', flexShrink: 0, transition: 'border-color 0.2s' };
const thumbLabelStyle: React.CSSProperties = { position: 'absolute', bottom: '4px', left: 0, right: 0, textAlign: 'center', fontFamily: "'Montserrat',sans-serif", fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)', background: 'rgba(255,255,255,0.7)', padding: '2px 0' };
const arrowBtnStyle: React.CSSProperties = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.85)', border: 'none', width: '36px', height: '36px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, color: '#1a1a1a' };
const imgCounterStyle: React.CSSProperties = { position: 'absolute', bottom: '14px', right: '16px', fontFamily: "'Montserrat',sans-serif", fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.9)', background: 'rgba(26,26,26,0.5)', padding: '4px 10px' };

const imageSideStyle: React.CSSProperties = { position: 'sticky', top: '65px', height: 'calc(100vh - 65px)', borderRight: '1px solid #f0ede8', display: 'flex', flexDirection: 'row' };
const mainImageStyle: React.CSSProperties = { flex: 1, height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
const mainImgTagStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 };
const mainInitialStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond',serif", fontSize: '160px', fontWeight: 300, color: 'rgba(26,26,26,0.1)', userSelect: 'none' };
const categoryBadgeStyle: React.CSSProperties = { position: 'absolute', top: '24px', left: '24px', fontFamily: "'Montserrat',sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', background: 'rgba(26,26,26,0.7)', padding: '6px 12px' };

const infoSideStyle: React.CSSProperties = { padding: '56px 56px 80px', overflowY: 'auto' };
const overlineStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '12px' };
const productNameStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(32px,4vw,52px)', fontWeight: 300, color: '#1a1a1a', lineHeight: 1.05, marginBottom: '14px' };
const priceStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '18px', fontWeight: 500, color: '#c9a96e', marginBottom: '28px' };
const dividerStyle: React.CSSProperties = { height: '1px', background: '#e8e4de', margin: '24px 0' };

const sectionBlockStyle: React.CSSProperties = { marginBottom: '24px' };
const sectionLabelStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#9a9590', marginBottom: '12px' };

const colorRowStyle: React.CSSProperties = { display: 'flex', gap: '8px', flexWrap: 'wrap' };
const sizeRowStyle: React.CSSProperties = { display: 'flex', gap: '8px', flexWrap: 'wrap' };
const sizeBtnStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 500, letterSpacing: '1px', padding: '10px 18px', border: '1px solid #d4cfc8', cursor: 'pointer', transition: 'all 0.2s', minWidth: '52px', textAlign: 'center' };

const qtyRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0', border: '1px solid #d4cfc8', width: 'fit-content' };
const qtyBtnStyle: React.CSSProperties = { width: '44px', height: '44px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'Montserrat',sans-serif", fontSize: '18px', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const qtyValueStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '13px', fontWeight: 500, width: '52px', textAlign: 'center', borderLeft: '1px solid #d4cfc8', borderRight: '1px solid #d4cfc8', height: '44px', lineHeight: '44px' };

const stockStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 500, marginBottom: '24px' };

const actionRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' };
const addToCartBtnStyle: React.CSSProperties = { padding: '16px', background: '#c9a96e', border: 'none', color: '#fff', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', transition: 'background 0.25s' };
const orderNowBtnStyle: React.CSSProperties = { padding: '16px', background: '#1a1a1a', border: 'none', color: '#fff', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', transition: 'background 0.25s' };

const tryOnBtnStyle: React.CSSProperties = { width: '100%', padding: '15px', background: 'transparent', border: '1.5px solid #1a1a1a', color: '#1a1a1a', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s', marginBottom: '16px' };

const accordionStyle: React.CSSProperties = { borderBottom: '1px solid #e8e4de' };
const accordionHeaderStyle: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#1a1a1a' };
const accordionBodyStyle: React.CSSProperties = { paddingBottom: '18px', fontFamily: "'Montserrat',sans-serif", fontSize: '12px', fontWeight: 300, lineHeight: 1.9, color: '#6b6560' };

/* ── Try-On modal styles ── */
const toOverlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
const toModalStyle: React.CSSProperties = { background: '#fff', width: '100%', maxWidth: '860px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' };
const toHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '32px 36px 24px', borderBottom: '1px solid #e8e4de' };
const toOverlineStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '6px' };
const toTitleStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond',serif", fontSize: '30px', fontWeight: 300, color: '#1a1a1a' };
const toCloseBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9a9590', lineHeight: 1, padding: '4px 8px' };
const toDividerStyle: React.CSSProperties = { height: '1px', background: '#e8e4de', margin: '0 36px' };

const toClothRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 36px' };
const toClothThumbStyle: React.CSSProperties = { width: '72px', height: '88px', objectFit: 'cover', border: '1px solid #e8e4de', flexShrink: 0 };
const toSectionLabelStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#9a9590', marginBottom: '6px' };
const toClothNameStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond',serif", fontSize: '20px', fontWeight: 300, color: '#1a1a1a' };
const toClothPriceStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '12px', fontWeight: 500, color: '#c9a96e', marginTop: '4px' };
const toColorRowStyle: React.CSSProperties = { display: 'flex', gap: '6px', flexWrap: 'wrap' };

const toTabRowStyle: React.CSSProperties = { display: 'flex', padding: '20px 36px 0', borderBottom: '1px solid #e8e4de' };
const toTabBtnStyle: React.CSSProperties = { padding: '10px 20px', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#9a9590', transition: 'all 0.2s' };
const toTabActiveBtnStyle: React.CSSProperties = { borderBottomColor: '#c9a96e', color: '#1a1a1a' };
const toTabContentStyle: React.CSSProperties = { padding: '20px 36px' };

const toModelGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', maxHeight: '320px', overflowY: 'auto' };
const toModelCardStyle: React.CSSProperties = { border: '2px solid #e8e4de', background: '#fafaf8', overflow: 'hidden', cursor: 'pointer' };
const toModelCardSelectedStyle: React.CSSProperties = { borderColor: '#c9a96e', boxShadow: '0 0 0 2px #c9a96e' };
const toModelImgStyle: React.CSSProperties = { width: '100%', height: '160px', backgroundSize: 'cover', backgroundPosition: 'top center' };
const toModelLabelStyle: React.CSSProperties = { padding: '7px 6px', textAlign: 'center', fontFamily: "'Montserrat',sans-serif", fontSize: '9px', letterSpacing: '1px', color: '#1a1a1a', borderTop: '1px solid #e8e4de', textTransform: 'uppercase', background: '#fafaf8' };

const toUploadBoxStyle: React.CSSProperties = { padding: '32px 24px', border: '2px dashed #d4cfc8', background: '#fafaf8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' };
const toUploadBtnStyle: React.CSSProperties = { padding: '12px 28px', background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s' };
const toPersonPreviewStyle: React.CSSProperties = { maxWidth: '180px', maxHeight: '220px', objectFit: 'contain', border: '1px solid #e8e4de' };

const toTipsStyle: React.CSSProperties = { padding: '12px 16px', background: '#fffbf0', border: '1px solid #e8d9b0', textAlign: 'left', width: '100%', maxWidth: '360px' };
const toTipsTitleStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '8px' };
const toTipsListStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 300, lineHeight: 2, color: '#6b6560', paddingLeft: '14px' };

const toLoadBarStyle: React.CSSProperties = { width: '80px', height: '1px', background: '#c9a96e', margin: '0 auto 16px' };
const toLoadTextStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: '#9a9590' };
const toSuccessBadgeStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#d4edda', border: '1px solid #c3e6cb' };
const toSuccessDotStyle: React.CSSProperties = { width: '7px', height: '7px', borderRadius: '50%', background: '#155724', flexShrink: 0 };
const toSuccessTextStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '11px', color: '#155724' };
const toProgressTextStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 400, color: '#c9a96e' };

const toErrorStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 36px', background: '#fee', borderTop: '1px solid #fcc' };
const toErrorDotStyle: React.CSSProperties = { width: '7px', height: '7px', borderRadius: '50%', background: '#c33', marginTop: '4px', flexShrink: 0 };
const toErrorTextStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 300, color: '#c33' };
const toProgressBoxStyle: React.CSSProperties = { padding: '16px 36px', background: '#e7f3ff', borderTop: '1px solid #bee5eb', textAlign: 'center' };
const toProgressBarStyle: React.CSSProperties = { width: '60px', height: '1px', background: '#0066cc', margin: '0 auto 12px' };
const toProgressBoxTextStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 500, color: '#0066cc' };

const toResultSectionStyle: React.CSSProperties = { padding: '24px 36px', borderTop: '1px solid #e8e4de' };
const toResultGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', margin: '16px 0 20px' };
const toResultCardLabelStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#6b6560', marginBottom: '10px' };
const toResultImgStyle: React.CSSProperties = { width: '100%', maxHeight: '260px', objectFit: 'contain', border: '1px solid #e8e4de', background: '#fafaf8', display: 'block' };
const toDownloadBtnStyle: React.CSSProperties = { padding: '12px 28px', background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s', display: 'block', margin: '0 auto' };

const toActionRowStyle: React.CSSProperties = { display: 'flex', gap: '12px', padding: '24px 36px', borderTop: '1px solid #e8e4de', justifyContent: 'center', flexWrap: 'wrap' };
const toGenerateBtnStyle: React.CSSProperties = { padding: '15px 40px', background: '#1a1a1a', border: 'none', color: '#fff', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.25s' };
const toResetBtnStyle: React.CSSProperties = { padding: '15px 40px', background: '#9a9590', border: 'none', color: '#fff', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.25s' };

export default ProductDetailPage;
