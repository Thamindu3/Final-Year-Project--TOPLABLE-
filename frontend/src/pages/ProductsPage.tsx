import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productAPI } from '../services/api';
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
  selectedColor: string;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'accessories', 'footwear'];
const API_BASE = 'http://localhost:8000';

// Maps color names to CSS colors for swatches (case-insensitive via getSwatchColor())
const COLOR_SWATCHES: Record<string, string> = {
  // Neutrals
  white: '#f5f5f5', black: '#1a1a1a', gray: '#888888', grey: '#888888',
  charcoal: '#36454f', ivory: '#f9f6e7', cream: '#fffdd0', beige: '#d2b48c',
  // Blues & Navies
  blue: '#4a7dc8', navy: '#1a2860', cobalt: '#0047ab', sky: '#87ceeb',
  powder: '#b0e0e6', 'light blue': '#a0c0e0', 'blue-white': '#6090d0',
  // Greens
  green: '#3a8a4a', olive: '#6b7a3a', emerald: '#2ecc71', teal: '#008080',
  mint: '#3eb489', lime: '#6abf3a',
  // Reds & Pinks
  red: '#c0392b', ruby: '#9b111e', burgundy: '#800020', 'red-white': '#d04040',
  pink: '#e87890', blush: '#f4b8c1', rose: '#e8b4b8', coral: '#e8735a',
  fuchsia: '#cc0066', peach: '#ffcba4',
  // Yellows & Oranges
  yellow: '#f4d03f', mustard: '#e3a857', orange: '#e07830',
  // Browns & Earth
  brown: '#795548', camel: '#c19a6b', rust: '#b7410e', terracotta: '#c16a4f',
  // Purples & Lavender
  purple: '#8040a0', lavender: '#c3a9d4', lilac: '#c8a2c8', sapphire: '#0f52ba',
  // Misc
  turquoise: '#40e0d0', khaki: '#b0a060',
};

const getSwatchColor = (name: string): string =>
  COLOR_SWATCHES[name.toLowerCase()] || '#b0b0b0';

const emptyForm = (): Partial<Product> => ({
  name: '', description: '', price: 0, category: 'tops',
  image_url: '', image_gallery: [], sizes: [], colors: [], stock: 0,
  size_stock: {}, color_size_stock: {},
});

// True when the product has ANY available stock (any color/size combo > 0)
function hasAnyStock(p: Product): boolean {
  const css = p.color_size_stock;
  if (css && Object.keys(css).length > 0) {
    return Object.values(css).some(entry => Object.values(entry).some(qty => qty > 0));
  }
  const ss = p.size_stock;
  if (ss && Object.keys(ss).length > 0) {
    return Object.values(ss).some(qty => qty > 0);
  }
  return (p.stock ?? 0) > 0;
}

// Returns stock for a given color+size, falling back gracefully
function getProductStock(p: Product, color: string, size: string): number {
  const css = p.color_size_stock;
  if (css && color && css[color]) {
    const entry = css[color];
    if (size && entry[size] !== undefined) return entry[size];
    return Object.values(entry).reduce((a, b) => a + b, 0);
  }
  const ss = p.size_stock;
  if (ss && size && ss[size] !== undefined) return ss[size];
  return p.stock ?? 0;
}

const ProductsPage: React.FC = () => {
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [hoveredId, setHoveredId]   = useState<number | null>(null);
  const [imgErrors, setImgErrors]   = useState<Set<number>>(new Set());
  const [isAdmin, setIsAdmin]       = useState(false);

  // Quick-view modal
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  // Per-card interactive selections
  const [cardColors, setCardColors] = useState<Record<number, string>>({});
  const [cardSizes,  setCardSizes]  = useState<Record<number, string>>({});

  // Cart
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('viton_cart') || '[]'); } catch { return []; }
  });
  const [showCart, setShowCart] = useState(false);

  // Order confirmation
  const [orderItem, setOrderItem] = useState<CartItem | null>(null);
  const navigate = useNavigate();

  // ── Filter & sort state ──────────────────────────────────────
  const [filterInStock, setFilterInStock]       = useState(false);
  const [filterOutOfStock, setFilterOutOfStock] = useState(false);
  const [priceMin, setPriceMin]                 = useState(0);
  const [priceMax, setPriceMax]                 = useState(100000);
  const [maxPriceAll, setMaxPriceAll]           = useState(100000);
  const [filterSizes, setFilterSizes]           = useState<Set<string>>(new Set());
  const [filterColors, setFilterColors]         = useState<Set<string>>(new Set());
  const [sortBy, setSortBy]                     = useState('featured');
  const [salesData, setSalesData]               = useState<Record<string, number>>({});
  const [openSections, setOpenSections]         = useState({ availability: true, price: true, size: true, color: true });

  // Admin product management
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [form, setForm]             = useState<Partial<Product>>(emptyForm());
  const [uploading, setUploading]   = useState(false);
  const [colorInput, setColorInput] = useState('');
  const [msg, setMsg]               = useState('');
  const [imgDragOver, setImgDragOver]         = useState(false);
  const [galleryDragOver, setGalleryDragOver] = useState(false);
  const imgInputRef     = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsAdmin(localStorage.getItem('role') === 'admin');
    fetchProducts();
  }, []);

  useEffect(() => {
    localStorage.setItem('viton_cart', JSON.stringify(cart));
  }, [cart]);

  // Initialise per-card selections to the first color+size that has stock
  useEffect(() => {
    const bestColors: Record<number, string> = {};
    const bestSizes: Record<number, string> = {};

    products.forEach(p => {
      const id = p.product_id ?? p.id ?? 0;
      const colors = p.colors?.length ? p.colors : [''];
      const sizes  = p.sizes?.length  ? p.sizes  : [''];

      let foundColor = colors[0];
      let foundSize  = sizes[0];
      let found = false;

      outer: for (const c of colors) {
        for (const s of sizes) {
          if (getProductStock(p, c, s) > 0) {
            foundColor = c;
            foundSize  = s;
            found = true;
            break outer;
          }
        }
      }
      // If no combo has stock, keep first color/size (product is fully OOS)
      bestColors[id] = foundColor;
      bestSizes[id]  = foundSize;
    });

    setCardColors(prev => {
      const next = { ...prev };
      products.forEach(p => {
        const id = p.product_id ?? p.id ?? 0;
        if (!next[id]) next[id] = bestColors[id] || '';
      });
      return next;
    });
    setCardSizes(prev => {
      const next = { ...prev };
      products.forEach(p => {
        const id = p.product_id ?? p.id ?? 0;
        if (!next[id]) next[id] = bestSizes[id] || '';
      });
      return next;
    });
  }, [products]);

  // Sync quick-view modal selections when product changes
  useEffect(() => {
    if (viewProduct) {
      setSelectedSize(viewProduct.sizes?.[0] || '');
      setSelectedColor(viewProduct.colors?.[0] || '');
    }
  }, [viewProduct]);

  // Initialise price range bounds from loaded products
  useEffect(() => {
    if (products.length > 0) {
      const max = Math.ceil(Math.max(...products.map(p => p.price)));
      setMaxPriceAll(max);
      setPriceMax(max);
    }
  }, [products]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const [prodRes, salesRes] = await Promise.all([
        productAPI.getAll(),
        fetch(`${API_BASE}/api/products/sales`)
          .then(r => r.ok ? r.json() : { sales: {} })
          .catch(() => ({ sales: {} })),
      ]);
      setProducts(prodRes.data.products || []);
      // JSON keys arrive as strings ("7", "2" …) — keep as-is
      setSalesData(salesRes.sales || {});
      setError(null);
    } catch (err) {
      setError('Failed to load products. Make sure backend is running at http://localhost:8000');
    } finally {
      setLoading(false);
    }
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  // All unique colours across all products (for sidebar)
  const allColors = useMemo(
    () => Array.from(new Set(products.flatMap(p => p.colors || []))).sort(),
    [products],
  );

  // Filtered + sorted products
  const filteredSorted = useMemo(() => {
    let result = [...products];
    if (filterInStock || filterOutOfStock) {
      result = result.filter(p => {
        const inStk = hasAnyStock(p);
        return (filterInStock && inStk) || (filterOutOfStock && !inStk);
      });
    }
    result = result.filter(p => p.price >= priceMin && p.price <= priceMax);
    if (filterSizes.size > 0) result = result.filter(p => p.sizes?.some(s => filterSizes.has(s)));
    if (filterColors.size > 0) result = result.filter(p => p.colors?.some(c => filterColors.has(c)));
    switch (sortBy) {
      case 'price-low':    return [...result].sort((a, b) => a.price - b.price);
      case 'price-high':   return [...result].sort((a, b) => b.price - a.price);
      case 'alpha-az':     return [...result].sort((a, b) => a.name.localeCompare(b.name));
      case 'alpha-za':     return [...result].sort((a, b) => b.name.localeCompare(a.name));
      case 'best-selling': return [...result].sort((a, b) => {
        // JSON keys are strings — use String() to match
        const aSold = salesData[String(a.product_id ?? a.id)] ?? 0;
        const bSold = salesData[String(b.product_id ?? b.id)] ?? 0;
        return bSold - aSold;   // highest sold first
      });
      default:             return result;
    }
  }, [products, filterInStock, filterOutOfStock, priceMin, priceMax, filterSizes, filterColors, sortBy, salesData]);

  const clearFilters = () => {
    setFilterInStock(false); setFilterOutOfStock(false);
    setPriceMin(0); setPriceMax(maxPriceAll);
    setFilterSizes(new Set()); setFilterColors(new Set());
  };

  const toggleFilterSize = (s: string) =>
    setFilterSizes(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const toggleFilterColor = (c: string) =>
    setFilterColors(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });

  const isFiltered = filterInStock || filterOutOfStock || filterSizes.size > 0 || filterColors.size > 0 || priceMin > 0 || priceMax < maxPriceAll;

  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handleAddToCart = (product: Product, size: string, color: string = '') => {
    const colorSpecificImage = (color && product.color_images?.[color]) || product.image_url;
    const productForCart = colorSpecificImage !== product.image_url
      ? { ...product, image_url: colorSpecificImage }
      : product;
    setCart(prev => {
      const pid = product.product_id ?? product.id;
      const existing = prev.find(i =>
        (i.product.product_id ?? i.product.id) === pid &&
        i.selectedSize === size &&
        i.selectedColor === color
      );
      if (existing) return prev.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: productForCart, quantity: 1, selectedSize: size, selectedColor: color }];
    });
    flash(`"${product.name}" added to cart!`);
  };

  const handleChangeQty = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const q = item.quantity + delta;
      return q < 1 ? item : { ...item, quantity: q };
    }));
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleOrderNow = (product: Product, size: string, color: string = '') => {
    setOrderItem({ product, quantity: 1, selectedSize: size, selectedColor: color });
    setViewProduct(null);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setColorInput('');
    setShowModal(true);
  };

  const parseGallery = (g: any): string[] => {
    if (Array.isArray(g)) return g;
    if (typeof g === 'string') { try { return JSON.parse(g); } catch { return []; } }
    return [];
  };

  const openEdit = (p: Product) => {
    const id = p.product_id ?? p.id ?? null;
    setEditingId(id);
    setForm({
      ...p,
      sizes: p.sizes || [],
      colors: p.colors || [],
      image_gallery: parseGallery(p.image_gallery),
      size_stock: p.size_stock || {},
      color_size_stock: p.color_size_stock || {},
    });
    setColorInput((p.colors || []).join(', '));
    setShowModal(true);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/admin/upload-product-image`, { method: 'POST', body: fd });
      if (res.ok) return (await res.json()).image_url;
    } catch {}
    return null;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadFile(file);
    if (url) setForm(f => ({ ...f, image_url: url }));
    else flash('Image upload failed.');
    setUploading(false);
  };

  const handleImageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setImgDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    const url = await uploadFile(file);
    if (url) setForm(f => ({ ...f, image_url: url }));
    else flash('Image upload failed.');
    setUploading(false);
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const url = await uploadFile(file);
      if (url) setForm(f => ({ ...f, image_gallery: [...(f.image_gallery || []), url] }));
    }
    setUploading(false);
  };

  const handleGalleryDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setGalleryDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const url = await uploadFile(file);
      if (url) setForm(f => ({ ...f, image_gallery: [...(f.image_gallery || []), url] }));
    }
    setUploading(false);
  };

  const removeGalleryImage = (index: number) => {
    setForm(f => ({ ...f, image_gallery: (f.image_gallery || []).filter((_, i) => i !== index) }));
  };

  const toggleSize = (s: string) => {
    setForm(f => {
      const sizes = f.sizes || [];
      const ss = { ...(f.size_stock || {}) };
      const css = { ...(f.color_size_stock || {}) };
      if (sizes.includes(s)) {
        delete ss[s];
        // Remove this size from every color entry
        Object.keys(css).forEach(c => { delete css[c][s]; });
        return { ...f, sizes: sizes.filter(x => x !== s), size_stock: ss, color_size_stock: css };
      } else {
        ss[s] = ss[s] ?? 0;
        return { ...f, sizes: [...sizes, s], size_stock: ss, color_size_stock: css };
      }
    });
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { flash('Name and price are required.'); return; }
    const colors = colorInput.split(',').map(c => c.trim()).filter(Boolean);
    const css = form.color_size_stock || {};
    const sizeStock = form.size_stock || {};
    // Compute total stock from color_size_stock if populated, else from size_stock
    const hasCss = Object.keys(css).length > 0;
    const totalStock = hasCss
      ? Object.values(css).reduce((sum, entry) => sum + Object.values(entry).reduce((a, b) => a + b, 0), 0)
      : Object.values(sizeStock).reduce((a, b) => a + b, 0);

    const payload = {
      ...form,
      colors,
      image_gallery: form.image_gallery || [],
      size_stock: sizeStock,
      color_size_stock: css,
      stock: totalStock,
    };
    try {
      let res: Response;
      if (editingId !== null) {
        res = await fetch(`${API_BASE}/api/products/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        if (res.ok) { flash('Product updated.'); }
        else { flash('Update failed.'); return; }
      } else {
        res = await fetch(`${API_BASE}/api/products`, {
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
      const res = await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) { flash(`"${p.name}" deleted.`); await fetchProducts(); }
      else flash('Delete failed.');
    } catch { flash('Request failed.'); }
  };

  // Parsed list of colors from the admin form's color input
  const formColors = colorInput.split(',').map(c => c.trim()).filter(Boolean);

  if (loading) {
    return (
      <div style={loadingWrapStyle}>
        <style>{fonts}</style>
        <div style={loadingInnerStyle}>
          <div style={loadingBarStyle} />
          <p style={loadingTextStyle}>Loading Collection</p>
        </div>
      </div>
    );
  }

  if (error && !isAdmin) {
    return (
      <div style={errorWrapStyle}>
        <style>{fonts}</style>
        <p style={errorOverlineStyle}>Error</p>
        <h2 style={errorTitleStyle}>Collection Unavailable</h2>
        <p style={errorMsgStyle}>{error}</p>
        <button
          onClick={fetchProducts}
          style={retryBtnStyle}
          onMouseEnter={e => (e.currentTarget.style.background = '#c9a96e')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <style>{fonts + dynamicCSS}</style>
      <Navbar />

      {/* ── PAGE HEADER ── */}
      <header style={pageHeaderStyle}>
        <div style={pageHeaderInnerStyle}>
          <p style={pageOverlineStyle}>Our Collection</p>
          <h1 style={pageTitleStyle}>
            Product<br /><em>Catalogue</em>
          </h1>
        </div>
        <button onClick={() => setShowCart(true)} style={cartIconBtnStyle} title="View Cart">
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }} stroke="currentColor" strokeWidth={1.8}>
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round"/>
            <path d="M16 10a4 4 0 0 1-8 0" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {cartCount > 0 && <span style={cartBadgeStyle}>{cartCount}</span>}
        </button>
      </header>

      <div style={dividerStyle} />
      {msg && <div style={msgStyle}>{msg}</div>}

      {/* ── CONTENT AREA: SIDEBAR + PRODUCTS ── */}
      <div style={contentAreaStyle}>

        {/* ══ FILTER SIDEBAR ══ */}
        <aside style={sidebarStyle}>

          {isFiltered && (
            <button onClick={clearFilters} style={clearFiltersBtnStyle}>
              Clear all filters ✕
            </button>
          )}

          {/* AVAILABILITY */}
          <div style={filterSectionStyle}>
            <button style={filterSectionHeaderStyle} onClick={() => setOpenSections(s => ({ ...s, availability: !s.availability }))}>
              <span>AVAILABILITY</span>
              <span style={filterChevronStyle}>{openSections.availability ? '∧' : '∨'}</span>
            </button>
            {openSections.availability && (
              <div style={filterSectionBodyStyle}>
                {([
                  { label: 'In Stock',     checked: filterInStock,     set: setFilterInStock,     count: products.filter(p => hasAnyStock(p)).length },
                  { label: 'Out of Stock', checked: filterOutOfStock, set: setFilterOutOfStock, count: products.filter(p => !hasAnyStock(p)).length },
                ] as const).map(opt => (
                  <label key={opt.label} style={filterCheckboxLabelStyle}>
                    <input type="checkbox" checked={opt.checked} onChange={e => (opt.set as any)(e.target.checked)} style={{ accentColor: '#c9a96e', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{opt.label}</span>
                    <span style={filterCountStyle}>{opt.count}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* PRICE */}
          <div style={filterSectionStyle}>
            <button style={filterSectionHeaderStyle} onClick={() => setOpenSections(s => ({ ...s, price: !s.price }))}>
              <span>PRICE</span>
              <span style={filterChevronStyle}>{openSections.price ? '∧' : '∨'}</span>
            </button>
            {openSections.price && (
              <div style={{ paddingBottom: '16px' }}>
                {/* Min / Max value boxes */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '4px 0 14px' }}>
                  <div style={priceBoxStyle}>
                    <span style={priceBoxLabelStyle}>MIN</span>
                    <span style={priceBoxValueStyle}>LKR {priceMin.toLocaleString()}</span>
                  </div>
                  <span style={{ color: '#c9a96e', fontSize: '14px', flexShrink: 0 }}>—</span>
                  <div style={priceBoxStyle}>
                    <span style={priceBoxLabelStyle}>MAX</span>
                    <span style={priceBoxValueStyle}>LKR {priceMax.toLocaleString()}</span>
                  </div>
                </div>

                {/* Dual-thumb track */}
                <div className="viton-price-range" style={{ position: 'relative', height: '24px' }}>
                  {/* Grey full track */}
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '4px', background: '#e8e4de', transform: 'translateY(-50%)', borderRadius: '4px' }}>
                    {/* Gold filled range */}
                    <div style={{
                      position: 'absolute',
                      left:  `${(priceMin  / (maxPriceAll || 1)) * 100}%`,
                      right: `${100 - (priceMax / (maxPriceAll || 1)) * 100}%`,
                      height: '100%', background: '#c9a96e', borderRadius: '4px',
                    }} />
                  </div>
                  {/* Min thumb — raised z-index when pushed near the right */}
                  <input type="range" min={0} max={maxPriceAll}
                    step={Math.max(1, Math.floor(maxPriceAll / 200))}
                    value={priceMin}
                    onChange={e => setPriceMin(Math.min(Number(e.target.value), priceMax - 1))}
                    style={{ zIndex: priceMin / (maxPriceAll || 1) > 0.9 ? 5 : 3 }}
                  />
                  {/* Max thumb */}
                  <input type="range" min={0} max={maxPriceAll}
                    step={Math.max(1, Math.floor(maxPriceAll / 200))}
                    value={priceMax}
                    onChange={e => setPriceMax(Math.max(Number(e.target.value), priceMin + 1))}
                    style={{ zIndex: priceMin / (maxPriceAll || 1) > 0.9 ? 3 : 4 }}
                  />
                </div>

                {/* Scale boundary labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={priceScaleLabelStyle}>LKR 0</span>
                  <span style={priceScaleLabelStyle}>LKR {maxPriceAll.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* SIZE */}
          <div style={filterSectionStyle}>
            <button style={filterSectionHeaderStyle} onClick={() => setOpenSections(s => ({ ...s, size: !s.size }))}>
              <span>SIZE</span>
              <span style={filterChevronStyle}>{openSections.size ? '∧' : '∨'}</span>
            </button>
            {openSections.size && (
              <div style={filterSectionBodyStyle}>
                {SIZES.map(sz => {
                  const count = products.filter(p => p.sizes?.includes(sz)).length;
                  if (count === 0) return null;
                  return (
                    <label key={sz} style={filterCheckboxLabelStyle}>
                      <input type="checkbox" checked={filterSizes.has(sz)} onChange={() => toggleFilterSize(sz)} style={{ accentColor: '#c9a96e', cursor: 'pointer', flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{sz}</span>
                      <span style={filterCountStyle}>{count}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* COLOR */}
          <div style={filterSectionStyle}>
            <button style={filterSectionHeaderStyle} onClick={() => setOpenSections(s => ({ ...s, color: !s.color }))}>
              <span>COLOR</span>
              <span style={filterChevronStyle}>{openSections.color ? '∧' : '∨'}</span>
            </button>
            {openSections.color && (
              <div style={filterSectionBodyStyle}>
                {allColors.map(c => {
                  const count = products.filter(p => p.colors?.includes(c)).length;
                  return (
                    <label key={c} style={filterCheckboxLabelStyle}>
                      <input type="checkbox" checked={filterColors.has(c)} onChange={() => toggleFilterColor(c)} style={{ accentColor: '#c9a96e', cursor: 'pointer', flexShrink: 0 }} />
                      <span style={{ display: 'inline-block', width: '13px', height: '13px', borderRadius: '50%', background: getSwatchColor(c), border: '1px solid #d4cfc8', flexShrink: 0 }} />
                      <span style={{ flex: 1, textTransform: 'capitalize' }}>{c}</span>
                      <span style={filterCountStyle}>{count}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ══ MAIN CONTENT: TOOLBAR + GRID ══ */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Toolbar */}
          <div style={toolbarStyle}>
            <p style={toolbarCountStyle}>{filteredSorted.length} product{filteredSorted.length !== 1 ? 's' : ''}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={toolbarSortLabelStyle}>Sort by</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sortSelectStyle}>
                <option value="featured">Featured</option>
                <option value="best-selling">Best Selling</option>
                <option value="alpha-az">Alphabetically, A–Z</option>
                <option value="alpha-za">Alphabetically, Z–A</option>
                <option value="price-low">Price, low to high</option>
                <option value="price-high">Price, high to low</option>
              </select>
            </div>
          </div>

          {/* Product grid */}
          <main style={gridStyle}>
            {filteredSorted.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 40px' }}>
                <p style={emptyStateTextStyle}>No products match your filters.</p>
                <button onClick={clearFilters} style={{ marginTop: '20px', padding: '10px 28px', background: 'transparent', border: '1px solid #1a1a1a', fontFamily: "'Montserrat',sans-serif", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase' as const, cursor: 'pointer' }}>
                  Clear Filters
                </button>
              </div>
            ) : (
              filteredSorted.map((product, i) => {
                const pId = product.product_id || product.id || i;
                const activeColor = cardColors[pId] || product.colors?.[0] || '';
                const activeSize  = cardSizes[pId]  || product.sizes?.[0]  || '';
                const stockQty    = getProductStock(product, activeColor, activeSize);
                const inStock     = stockQty > 0;

                return (
                  <article
                    key={pId}
                    style={{
                      ...cardStyle,
                      animationDelay: `${i * 80}ms`,
                      position: 'relative',
                      transform: hoveredId === pId ? 'translateY(-6px)' : 'translateY(0)',
                      boxShadow: hoveredId === pId ? '0 20px 48px rgba(0,0,0,0.14)' : '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                    className="viton-product-card"
                    onMouseEnter={() => setHoveredId(pId)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Image area */}
                    <div style={cardImageWrapStyle}>
                      <div style={{ ...cardImageStyle, background: `linear-gradient(135deg, ${getCategoryColor(product.category)} 0%, #e8ddd0 100%)`, position: 'relative' }}>
                        {product.image_url && !imgErrors.has(pId as number) ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            onError={() => setImgErrors(prev => { const n = new Set(Array.from(prev)); n.add(pId as number); return n; })}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease', transform: hoveredId === pId ? 'scale(1.07)' : 'scale(1)' }}
                          />
                        ) : (
                          <span style={cardInitialStyle}>{product.name.charAt(0)}</span>
                        )}
                      </div>
                      <div style={{ ...cardOverlayStyle, opacity: hoveredId === pId ? 1 : 0 }}>
                        <button style={quickViewBtnStyle} onClick={() => setViewProduct(product)}>Quick View</button>
                      </div>
                      <span style={categoryBadgeStyle}>{product.category}</span>
                    </div>

                    {/* Card content */}
                    <div style={cardBodyStyle}>
                      <div style={cardTopRowStyle}>
                        <h3 style={cardNameStyle}>{product.name}</h3>
                        <p style={cardPriceStyle}>LKR {product.price.toFixed(0)}</p>
                      </div>
                      <p style={cardDescStyle}>{product.description}</p>

                      {product.colors && product.colors.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <p style={cardSectionLabelStyle}>Color</p>
                          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                            {product.colors.map(color => (
                              <button key={color} title={color}
                                onClick={e => { e.stopPropagation(); setCardColors(prev => ({ ...prev, [pId]: color })); }}
                                style={{ width: '22px', height: '22px', borderRadius: '50%', padding: 0, background: getSwatchColor(color), border: activeColor === color ? '2px solid #c9a96e' : '2px solid #e8e4de', boxShadow: activeColor === color ? '0 0 0 2px #c9a96e' : 'none', cursor: 'pointer', transition: 'all 0.2s', outline: 'none' }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {product.sizes && product.sizes.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <p style={cardSectionLabelStyle}>Size</p>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {product.sizes.map(size => (
                              <button key={size}
                                onClick={e => { e.stopPropagation(); setCardSizes(prev => ({ ...prev, [pId]: size })); }}
                                style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', padding: '5px 10px', cursor: 'pointer', transition: 'all 0.2s', background: activeSize === size ? '#1a1a1a' : 'transparent', color: activeSize === size ? '#fff' : '#6b6560', border: `1px solid ${activeSize === size ? '#1a1a1a' : '#d4cfc8'}` }}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: 500, color: inStock ? '#4caf50' : '#e53935', marginBottom: '14px' }}>
                        {inStock ? `${stockQty} in stock` : 'Out of stock'}
                      </p>

                      <div style={cardFooterStyle}>
                        <button
                          style={{ ...addBtnStyle, background: inStock ? 'transparent' : '#e8e4de', color: inStock ? '#1a1a1a' : '#9a9590', borderColor: inStock ? '#1a1a1a' : '#d4cfc8', cursor: inStock ? 'pointer' : 'not-allowed' }}
                          disabled={!inStock}
                          onClick={e => { e.stopPropagation(); handleAddToCart(product, activeSize, activeColor); }}
                          onMouseEnter={e => { if (inStock) { e.currentTarget.style.background = '#c9a96e'; e.currentTarget.style.borderColor = '#c9a96e'; e.currentTarget.style.color = '#fff'; } }}
                          onMouseLeave={e => { if (inStock) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.color = '#1a1a1a'; } }}
                        >
                          Add to Cart
                        </button>
                        <button
                          style={viewDetailsBtnStyle}
                          onClick={() => navigate(`/products/${product.product_id ?? product.id}`)}
                          onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b6560'; }}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </main>
        </div>
      </div>

      {/* ── ADMIN: PRODUCT MANAGEMENT TABLE ── */}
      {isAdmin && (
        <section style={mgmtSectionStyle}>
          <div style={dividerStyle} />
          <div style={mgmtHeaderStyle}>
            <div>
              <p style={overlineStyle}>Catalogue</p>
              <h2 style={mgmtTitleStyle}>Product<br /><em>Management</em></h2>
            </div>
            <button
              onClick={openAdd}
              style={addProductBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.background = '#b8924e'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#c9a96e'; }}
            >
              + Add New Product
            </button>
          </div>

          {products.length === 0 ? (
            <p style={emptyTableStyle}>No products yet. Click "Add New Product" to get started.</p>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['#', 'Name', 'Category', 'Price (LKR)', 'Stock', 'Colors', 'Sizes', 'Actions'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
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
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            {(p.colors || []).map(c => (
                              <span
                                key={c}
                                title={c}
                                style={{
                                  display: 'inline-block', width: '16px', height: '16px',
                                  borderRadius: '50%', background: getSwatchColor(c),
                                  border: '1px solid #d4cfc8',
                                }}
                              />
                            ))}
                            {(!p.colors || p.colors.length === 0) && <span style={{ color: '#bbb' }}>—</span>}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(p.sizes || []).map(s => <span key={s} style={sizePillStyle}>{s}</span>)}
                            {(!p.sizes || p.sizes.length === 0) && <span style={{ color: '#bbb' }}>—</span>}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => openEdit(p)}
                              style={editBtnStyle}
                              onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1a1a1a'; }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              style={deleteBtnStyle}
                              onMouseEnter={e => (e.currentTarget.style.background = '#c33')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}
                            >
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

      {/* ── PRODUCT QUICK-VIEW MODAL ── */}
      {viewProduct && (
        <div style={overlayStyle} onClick={() => setViewProduct(null)}>
          <div style={detailModalStyle} onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewProduct(null)} style={detailCloseBtnStyle}>✕</button>

            <div style={detailLayoutStyle}>
              {/* Left: image */}
              <div style={detailImagePanelStyle}>
                <div style={{
                  width: '100%', height: '100%', position: 'relative',
                  background: `linear-gradient(135deg, ${getCategoryColor(viewProduct.category)} 0%, #e8ddd0 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {viewProduct.image_url ? (
                    <img
                      src={viewProduct.image_url}
                      alt={viewProduct.name}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '100px', fontWeight: 300, color: 'rgba(26,26,26,0.15)' }}>
                      {viewProduct.name.charAt(0)}
                    </span>
                  )}
                  <span style={{ ...categoryBadgeStyle, top: '20px', left: '20px' }}>{viewProduct.category}</span>
                </div>
              </div>

              {/* Right: details */}
              <div style={detailInfoPanelStyle}>
                <p style={overlineStyle}>Product Details</p>
                <h2 style={detailNameStyle}>{viewProduct.name}</h2>
                <p style={detailPriceStyle}>LKR {Number(viewProduct.price).toFixed(2)}</p>

                <div style={detailDividerStyle} />

                <p style={detailSectionLabelStyle}>Description</p>
                <p style={detailDescStyle}>{viewProduct.description || 'No description available.'}</p>

                <div style={detailDividerStyle} />

                {/* Colors — interactive selector */}
                {viewProduct.colors && viewProduct.colors.length > 0 && (
                  <>
                    <p style={detailSectionLabelStyle}>Color</p>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
                      {viewProduct.colors.map(c => (
                        <button
                          key={c}
                          title={c}
                          onClick={() => setSelectedColor(c)}
                          style={{
                            width: '26px', height: '26px', borderRadius: '50%', padding: 0,
                            background: getSwatchColor(c),
                            border: selectedColor === c ? '2px solid #c9a96e' : '2px solid #e8e4de',
                            boxShadow: selectedColor === c ? '0 0 0 2px #c9a96e' : 'none',
                            cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
                          }}
                        />
                      ))}
                      {selectedColor && (
                        <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '10px', color: '#6b6560', letterSpacing: '1px' }}>
                          {selectedColor}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* Sizes — interactive selector */}
                <p style={detailSectionLabelStyle}>Select Size</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {viewProduct.sizes && viewProduct.sizes.length > 0
                    ? viewProduct.sizes.map(s => (
                        <button
                          key={s}
                          onClick={() => setSelectedSize(s)}
                          style={{
                            ...detailSizeChipStyle,
                            background: selectedSize === s ? '#1a1a1a' : 'transparent',
                            color: selectedSize === s ? '#fff' : '#1a1a1a',
                            cursor: 'pointer',
                            border: `1px solid ${selectedSize === s ? '#1a1a1a' : '#d4cfc8'}`,
                            transition: 'all 0.2s',
                          }}
                        >{s}</button>
                      ))
                    : <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '12px', color: '#9a9590' }}>One size</span>}
                </div>

                {/* Stock for selected color + size */}
                {(() => {
                  const qty = getProductStock(viewProduct, selectedColor, selectedSize);
                  return (
                    <>
                      <p style={detailSectionLabelStyle}>Availability</p>
                      <p style={{
                        fontFamily: "'Montserrat', sans-serif", fontSize: '12px', marginBottom: '28px',
                        color: qty > 0 ? '#4caf50' : '#e53935', fontWeight: 500,
                      }}>
                        {qty > 0 ? `In Stock — ${qty} units` : 'Out of Stock'}
                        {selectedColor && selectedSize && ` (${selectedColor} / ${selectedSize})`}
                      </p>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <button
                          style={orderNowBtnStyle}
                          disabled={qty === 0}
                          onClick={() => handleOrderNow(viewProduct, selectedSize, selectedColor)}
                          onMouseEnter={e => { if (qty > 0) e.currentTarget.style.background = '#333'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; }}
                        >
                          Order Now
                        </button>
                        <button
                          style={addToCartBtnStyle}
                          disabled={qty === 0}
                          onClick={() => handleAddToCart(viewProduct, selectedSize, selectedColor)}
                          onMouseEnter={e => { if (qty > 0) e.currentTarget.style.background = '#b8924e'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#c9a96e'; }}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </>
                  );
                })()}

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {isAdmin && (
                    <button
                      style={{ ...cancelBtnStyle, flex: 'none' }}
                      onClick={() => { setViewProduct(null); openEdit(viewProduct); }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e8e4de'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ef'; }}
                    >
                      Edit Product
                    </button>
                  )}
                  <button
                    style={{ ...cancelBtnStyle, flex: 'none' }}
                    onClick={() => setViewProduct(null)}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e8e4de'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ef'; }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CART DRAWER ── */}
      {showCart && (
        <div style={overlayStyle} onClick={() => setShowCart(false)}>
          <div style={cartDrawerStyle} onClick={e => e.stopPropagation()}>
            <div style={cartHeaderStyle}>
              <div>
                <p style={overlineStyle}>Your Selection</p>
                <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '28px', fontWeight: 300, color: '#1a1a1a' }}>
                  Shopping Cart
                </h2>
              </div>
              <button onClick={() => setShowCart(false)} style={detailCloseBtnStyle}>✕</button>
            </div>

            {cart.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#9a9590' }}>
                <p style={{ fontSize: '40px', marginBottom: '16px' }}>🛍️</p>
                <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '12px', letterSpacing: '1px' }}>Your cart is empty</p>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                  {cart.map((item, i) => (
                    <div key={i} style={cartItemRowStyle}>
                      <div style={{ width: '64px', height: '64px', flexShrink: 0, background: `linear-gradient(135deg, ${getCategoryColor(item.product.category)}, #e8ddd0)`, position: 'relative', overflow: 'hidden' }}>
                        {item.product.image_url && (
                          <img src={item.product.image_url} alt={item.product.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '16px', fontWeight: 400, color: '#1a1a1a', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.product.name}</p>
                        <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '10px', color: '#9a9590', letterSpacing: '1px', marginBottom: '8px' }}>
                          {[item.selectedColor, item.selectedSize && `Size: ${item.selectedSize}`].filter(Boolean).join(' · ')}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button onClick={() => handleChangeQty(i, -1)} style={qtyBtnStyle}>−</button>
                          <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '12px', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                          <button onClick={() => handleChangeQty(i, 1)} style={qtyBtnStyle}>+</button>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '13px', fontWeight: 500, color: '#c9a96e', marginBottom: '8px' }}>
                          LKR {(item.product.price * item.quantity).toFixed(0)}
                        </p>
                        <button onClick={() => handleRemoveFromCart(i)} style={removeItemBtnStyle} title="Remove">✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={cartFooterStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b6560' }}>Total</span>
                    <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '26px', fontWeight: 400, color: '#1a1a1a' }}>LKR {cartTotal.toFixed(2)}</span>
                  </div>
                  <button
                    style={{ ...orderNowBtnStyle, width: '100%', padding: '16px', fontSize: '11px' }}
                    onClick={() => { setShowCart(false); navigate('/order'); }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#333'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; }}
                  >
                    Place Order
                  </button>
                  <button
                    style={{ ...cancelBtnStyle, width: '100%', padding: '14px', marginTop: '10px', textAlign: 'center' }}
                    onClick={() => setShowCart(false)}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e8e4de'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ef'; }}
                  >
                    Continue Shopping
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ORDER CONFIRMATION ── */}
      {orderItem && (
        <div style={overlayStyle} onClick={() => setOrderItem(null)}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '480px', padding: '40px', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setOrderItem(null)} style={detailCloseBtnStyle}>✕</button>
            <p style={overlineStyle}>Confirm Order</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '28px', fontWeight: 300, color: '#1a1a1a', marginBottom: '24px' }}>Order Summary</h2>
            <div style={{ border: '1px solid #e8e4de', padding: '20px', marginBottom: '24px' }}>
              <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '20px', fontWeight: 400, color: '#1a1a1a', marginBottom: '8px' }}>{orderItem.product.name}</p>
              {orderItem.selectedColor && (
                <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '11px', color: '#6b6560', letterSpacing: '1px', marginBottom: '4px' }}>Color: {orderItem.selectedColor}</p>
              )}
              {orderItem.selectedSize && (
                <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '11px', color: '#6b6560', letterSpacing: '1px', marginBottom: '4px' }}>Size: {orderItem.selectedSize}</p>
              )}
              <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '11px', color: '#6b6560', letterSpacing: '1px', marginBottom: '16px' }}>Category: {orderItem.product.category}</p>
              <div style={{ borderTop: '1px solid #e8e4de', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b6560' }}>Total</span>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '24px', color: '#c9a96e' }}>LKR {Number(orderItem.product.price).toFixed(2)}</span>
              </div>
            </div>
            <button
              style={{ ...orderNowBtnStyle, width: '100%', padding: '16px', fontSize: '11px', marginBottom: '10px' }}
              onClick={() => { setOrderItem(null); navigate('/order'); }}
              onMouseEnter={e => { e.currentTarget.style.background = '#333'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; }}
            >
              Confirm Order
            </button>
            <button
              style={{ ...cancelBtnStyle, width: '100%', padding: '14px', textAlign: 'center' }}
              onClick={() => setOrderItem(null)}
              onMouseEnter={e => { e.currentTarget.style.background = '#e8e4de'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ef'; }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT PRODUCT MODAL ── */}
      {showModal && (
        <div style={overlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <p style={{ ...overlineStyle, marginBottom: '4px' }}>
                  {editingId !== null ? 'Edit Product' : 'Add New Product'}
                </p>
                <h2 style={modalTitleStyle}>
                  {editingId !== null ? 'Update Details' : 'General Information'}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} style={closeBtn}>✕</button>
            </div>

            <div style={modalBodyStyle}>
              {/* LEFT column */}
              <div style={modalColStyle}>
                <label style={labelStyle}>Product Name *</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Classic White T-Shirt"
                  value={form.name || ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />

                <label style={labelStyle}>Description</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                  placeholder="Describe the product..."
                  value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />

                <label style={labelStyle}>Price (LKR) *</label>
                <input
                  style={inputStyle}
                  type="number"
                  placeholder="0.00"
                  value={form.price || ''}
                  onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                />

                <label style={labelStyle}>Colors (comma separated)</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. white, black, navy"
                  value={colorInput}
                  onChange={e => setColorInput(e.target.value)}
                />

                <label style={labelStyle}>Available Sizes</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {SIZES.map(s => {
                    const active = (form.sizes || []).includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSize(s)}
                        style={{
                          padding: '8px 14px',
                          fontFamily: "'Montserrat', sans-serif",
                          fontSize: '10px', fontWeight: 500, letterSpacing: '1.5px',
                          border: `1px solid ${active ? '#c9a96e' : '#d4cfc8'}`,
                          background: active ? '#c9a96e' : '#fff',
                          color: active ? '#fff' : '#6b6560',
                          cursor: 'pointer', transition: 'all 0.2s',
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>

                {/* ── Color × Size stock matrix ── */}
                {formColors.length > 0 && (form.sizes || []).length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Stock per Color & Size</label>
                    <div style={{ overflowX: 'auto', border: '1px solid #e8e4de' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: "'Montserrat',sans-serif" }}>
                        <thead>
                          <tr style={{ background: '#f5f3ef' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', color: '#6b6560', borderBottom: '1px solid #e8e4de', whiteSpace: 'nowrap' }}>
                              Color \ Size
                            </th>
                            {(form.sizes || []).map(s => (
                              <th key={s} style={{ padding: '8px 10px', textAlign: 'center', fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', color: '#6b6560', borderBottom: '1px solid #e8e4de' }}>
                                {s}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {formColors.map(color => (
                            <tr key={color} style={{ borderBottom: '1px solid #f0ede8' }}>
                              <td style={{ padding: '6px 10px', fontSize: '10px', color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%',
                                  background: getSwatchColor(color), border: '1px solid #d4cfc8', flexShrink: 0,
                                }} />
                                {color}
                              </td>
                              {(form.sizes || []).map(s => (
                                <td key={s} style={{ padding: '4px 6px', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={(form.color_size_stock?.[color]?.[s]) ?? ''}
                                    onChange={e => {
                                      const val = parseInt(e.target.value) || 0;
                                      setForm(f => ({
                                        ...f,
                                        color_size_stock: {
                                          ...(f.color_size_stock || {}),
                                          [color]: {
                                            ...((f.color_size_stock || {})[color] || {}),
                                            [s]: val,
                                          },
                                        },
                                      }));
                                    }}
                                    style={{
                                      width: '52px', padding: '5px 4px', textAlign: 'center',
                                      border: '1px solid #e8e4de', fontFamily: "'Montserrat',sans-serif",
                                      fontSize: '11px', color: '#1a1a1a', background: '#fafaf8', outline: 'none',
                                    }}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '9px', color: '#9a9590', marginTop: '6px' }}>
                      Total stock is computed automatically from this matrix.
                    </p>
                  </div>
                )}

                {/* Fallback per-size stock (shown when no colors defined) */}
                {formColors.length === 0 && (form.sizes || []).length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Stock per Size</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(form.sizes || []).map(s => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '1px', width: '28px', color: '#1a1a1a' }}>{s}</span>
                          <input
                            style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                            type="number"
                            min="0"
                            placeholder="0"
                            value={(form.size_stock || {})[s] ?? ''}
                            onChange={e => setForm(f => ({
                              ...f,
                              size_stock: { ...(f.size_stock || {}), [s]: parseInt(e.target.value) || 0 },
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT column */}
              <div style={modalColStyle}>
                <label style={labelStyle}>Product Image</label>

                <div
                  style={{ ...uploadBtnStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '20px 12px', background: imgDragOver ? '#f0ead9' : '#f5f3ef', borderColor: imgDragOver ? '#b8944a' : '#c9a96e' }}
                  onClick={() => imgInputRef.current?.click()}
                  onDrop={handleImageDrop}
                  onDragOver={e => { e.preventDefault(); setImgDragOver(true); }}
                  onDragEnter={e => { e.preventDefault(); setImgDragOver(true); }}
                  onDragLeave={() => setImgDragOver(false)}
                >
                  <span style={{ fontSize: '22px', lineHeight: 1 }}>⬆</span>
                  <span>{uploading ? 'Uploading…' : imgDragOver ? 'Drop to upload' : 'Drag & drop or click to upload'}</span>
                  <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploading} />
                </div>

                <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '9px', letterSpacing: '2px', color: '#9a9590', textAlign: 'center', margin: '8px 0', textTransform: 'uppercase' }}>
                  — or paste direct URL —
                </p>
                <input
                  style={inputStyle}
                  placeholder="https://example.com/image.jpg"
                  value={form.image_url || ''}
                  onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                />

                <div style={imgPreviewStyle}>
                  {form.image_url ? (
                    <img
                      src={form.image_url}
                      alt="preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#bbb' }}>
                      <p style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</p>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>No Image</p>
                    </div>
                  )}
                </div>

                <label style={labelStyle}>Gallery Images</label>
                <div
                  style={{ ...uploadBtnStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '20px 12px', marginBottom: '10px', background: galleryDragOver ? '#f0ead9' : '#f5f3ef', borderColor: galleryDragOver ? '#b8944a' : '#c9a96e' }}
                  onClick={() => galleryInputRef.current?.click()}
                  onDrop={handleGalleryDrop}
                  onDragOver={e => { e.preventDefault(); setGalleryDragOver(true); }}
                  onDragEnter={e => { e.preventDefault(); setGalleryDragOver(true); }}
                  onDragLeave={() => setGalleryDragOver(false)}
                >
                  <span style={{ fontSize: '22px', lineHeight: 1 }}>⬆</span>
                  <span>{uploading ? 'Uploading…' : galleryDragOver ? 'Drop to upload' : 'Drag & drop or click (multi-select)'}</span>
                  <input ref={galleryInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleGalleryUpload} disabled={uploading} />
                </div>
                {parseGallery(form.image_gallery).length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {parseGallery(form.image_gallery).map((url, i) => (
                      <div key={i} style={{ position: 'relative', width: '64px', height: '64px', border: '1px solid #e8e4de', overflow: 'hidden' }}>
                        <img src={url} alt={`gallery-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <button
                          onClick={() => removeGalleryImage(i)}
                          style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(26,26,26,0.75)', border: 'none', color: '#fff', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {parseGallery(form.image_gallery).length === 0 && (
                  <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '10px', color: '#9a9590', marginBottom: '14px' }}>No gallery images yet</p>
                )}

                <label style={labelStyle}>Category</label>
                <select
                  style={inputStyle}
                  value={form.category || 'tops'}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={modalFooterStyle}>
              <button
                onClick={() => setShowModal(false)}
                style={cancelBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.background = '#e8e4de'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ef'; }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={saveBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.background = '#b8924e'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#c9a96e'; }}
              >
                {editingId !== null ? 'Update Product' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    tops: '#d4c8b8', bottoms: '#c8d0d4', dresses: '#d4c8cc',
    outerwear: '#c8ccc0', accessories: '#d0d4c8', clothing: '#c9b8a8', footwear: '#bca89c',
  };
  return map[cat?.toLowerCase()] || '#d4cfc8';
}

function catColor(cat: string) {
  const m: Record<string, string> = {
    tops: '#d4c8b8', bottoms: '#c8d0d4', dresses: '#d4c8cc',
    outerwear: '#c8ccc0', accessories: '#d0d4c8', footwear: '#bca89c',
  };
  return m[cat?.toLowerCase()] || '#e0dbd4';
}

/* ─── CSS ─────────────────────────────────────────────────────────────── */

const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
`;

const dynamicCSS = `
  .viton-product-card { animation: fadeSlideUp 0.6s both; }
  @keyframes fadeSlideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }

  /* Dual-thumb price range slider */
  .viton-price-range input[type=range] {
    -webkit-appearance: none; appearance: none;
    position: absolute; width: 100%; height: 100%;
    background: transparent; pointer-events: none;
    outline: none; margin: 0; padding: 0;
  }
  .viton-price-range input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 18px; height: 18px; border-radius: 50%;
    background: #c9a96e; cursor: grab; cursor: ew-resize;
    pointer-events: all;
    border: 3px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.28);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .viton-price-range input[type=range]::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 3px 10px rgba(201,169,110,0.5);
  }
  .viton-price-range input[type=range]::-moz-range-thumb {
    width: 18px; height: 18px; border-radius: 50%;
    background: #c9a96e; cursor: ew-resize;
    pointer-events: all; border: 3px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.28);
  }
  .viton-price-range input[type=range]::-webkit-slider-runnable-track { background: transparent; height: 4px; }
  .viton-price-range input[type=range]::-moz-range-track { background: transparent; height: 4px; }
`;

const wrapperStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", background: '#fff', color: '#1a1a1a', minHeight: '100vh' };

const loadingWrapStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf8' };
const loadingInnerStyle: React.CSSProperties = { textAlign: 'center' };
const loadingBarStyle: React.CSSProperties = { width: '120px', height: '1px', background: '#c9a96e', margin: '0 auto 24px' };
const loadingTextStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '4px', textTransform: 'uppercase', color: '#9a9590' };

const errorWrapStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', background: '#fafaf8', textAlign: 'center' };
const errorOverlineStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '16px' };
const errorTitleStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontSize: '40px', fontWeight: 300, color: '#1a1a1a', marginBottom: '16px' };
const errorMsgStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: '#6b6560', marginBottom: '36px', maxWidth: '400px', lineHeight: 1.8 };
const retryBtnStyle: React.CSSProperties = { padding: '14px 40px', background: '#1a1a1a', color: '#fff', border: 'none', fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.3s ease' };

const pageHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '72px 48px 40px', flexWrap: 'wrap', gap: '20px' };
const pageHeaderInnerStyle: React.CSSProperties = {};
const pageOverlineStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '12px' };
const pageTitleStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 300, lineHeight: 0.95, color: '#1a1a1a' };
const pageCountStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: 400, letterSpacing: '2px', color: '#9a9590', textTransform: 'uppercase' };
const dividerStyle: React.CSSProperties = { height: '1px', background: '#e8e4de', margin: '0 48px' };

const msgStyle: React.CSSProperties = { padding: '14px 48px', background: '#fff', borderBottom: '1px solid #c9a96e', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: '#6b6560' };

const gridWrapStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', margin: '48px' };
const emptyStateStyle: React.CSSProperties = { gridColumn: '1 / -1', background: '#fff', padding: '80px 40px', textAlign: 'center' };
const emptyStateTextStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '14px', color: '#9a9590' };

const cardStyle: React.CSSProperties = { background: '#fff', cursor: 'default', borderRadius: '4px', overflow: 'hidden', transition: 'transform 0.35s ease, box-shadow 0.35s ease' };
const cardImageWrapStyle: React.CSSProperties = { position: 'relative', height: '280px', overflow: 'hidden' };
const cardImageStyle: React.CSSProperties = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.6s ease' };
const cardInitialStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontSize: '80px', fontWeight: 300, color: 'rgba(26,26,26,0.15)', userSelect: 'none' };
const cardOverlayStyle: React.CSSProperties = { position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.3s ease' };
const quickViewBtnStyle: React.CSSProperties = { padding: '12px 28px', background: '#fff', border: 'none', fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', cursor: 'pointer', color: '#1a1a1a' };
const categoryBadgeStyle: React.CSSProperties = { position: 'absolute', top: '16px', left: '16px', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', background: 'rgba(26,26,26,0.7)', padding: '5px 10px' };
const cardBodyStyle: React.CSSProperties = { padding: '20px 24px 24px' };
const cardTopRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '12px' };
const cardNameStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', fontWeight: 400, color: '#1a1a1a', lineHeight: 1.2, flex: 1 };
const cardPriceStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 500, color: '#c9a96e', whiteSpace: 'nowrap' };
const cardDescStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: 300, lineHeight: 1.8, color: '#6b6560', marginBottom: '14px' };
const cardSectionLabelStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '8px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#9a9590', marginBottom: '6px' };
const cardFooterStyle: React.CSSProperties = { display: 'flex', gap: '8px', flexWrap: 'wrap' };
const addBtnStyle: React.CSSProperties = { flex: 1, padding: '10px 14px', background: 'transparent', border: '1px solid #1a1a1a', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', color: '#1a1a1a', transition: 'all 0.3s ease' };
const viewDetailsBtnStyle: React.CSSProperties = { padding: '10px 14px', background: 'transparent', border: '1px solid #d4cfc8', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', color: '#6b6560', transition: 'all 0.3s ease', whiteSpace: 'nowrap' };

const mgmtSectionStyle: React.CSSProperties = { padding: '0 48px 80px' };
const mgmtHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '48px 0 32px', flexWrap: 'wrap', gap: '16px' };
const overlineStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '12px' };
const mgmtTitleStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 300, lineHeight: 1.1, color: '#1a1a1a' };
const addProductBtnStyle: React.CSSProperties = { padding: '14px 28px', background: '#c9a96e', border: 'none', color: '#fff', fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.25s' };
const emptyTableStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: '#9a9590', padding: '40px', textAlign: 'center', border: '1px solid #e8e4de', background: '#fff' };

const tableWrapStyle: React.CSSProperties = { overflowX: 'auto', border: '1px solid #e8e4de' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontFamily: "'Montserrat', sans-serif" };
const thStyle: React.CSSProperties = { padding: '14px 16px', textAlign: 'left', fontSize: '9px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#6b6560', background: '#f5f3ef', borderBottom: '1px solid #e8e4de' };
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: '12px', fontWeight: 300, color: '#1a1a1a', borderBottom: '1px solid #e8e4de', verticalAlign: 'middle' };
const editBtnStyle: React.CSSProperties = { padding: '6px 14px', background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s' };
const deleteBtnStyle: React.CSSProperties = { padding: '6px 14px', background: '#1a1a1a', border: 'none', color: '#fff', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.25s' };
const categoryPillStyle: React.CSSProperties = { display: 'inline-block', padding: '3px 10px', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#1a1a1a' };
const sizePillStyle: React.CSSProperties = { display: 'inline-block', padding: '2px 7px', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', border: '1px solid #d4cfc8', color: '#6b6560' };

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' };
const modalStyle: React.CSSProperties = { background: '#fff', width: '100%', maxWidth: '860px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' };
const modalHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '32px 36px 24px', borderBottom: '1px solid #e8e4de' };
const modalTitleStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', fontWeight: 300, color: '#1a1a1a' };
const closeBtn: React.CSSProperties = { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9a9590', padding: '4px', lineHeight: 1 };
const modalBodyStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', padding: '32px 36px' };
const modalColStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const modalFooterStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '24px 36px', borderTop: '1px solid #e8e4de' };
const labelStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#6b6560', marginBottom: '6px', display: 'block' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #e8e4de', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: '#1a1a1a', background: '#fafaf8', outline: 'none', marginBottom: '16px', transition: 'border-color 0.2s' };
const imgPreviewStyle: React.CSSProperties = { width: '100%', height: '200px', border: '1px solid #e8e4de', background: '#f5f3ef', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '16px' };
const saveBtnStyle: React.CSSProperties = { padding: '12px 32px', background: '#c9a96e', border: 'none', color: '#fff', fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.25s' };
const cancelBtnStyle: React.CSSProperties = { padding: '12px 32px', background: '#f5f3ef', border: '1px solid #e8e4de', color: '#6b6560', fontFamily: "'Montserrat', sans-serif", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.25s' };
const uploadBtnStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '12px', background: '#f5f3ef', border: '2px dashed #c9a96e', color: '#c9a96e', fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', marginBottom: '4px', transition: 'background 0.2s' };

const cartIconBtnStyle: React.CSSProperties = { position: 'relative', background: 'none', border: '1px solid #1a1a1a', color: '#1a1a1a', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.25s' };

/* ── Sidebar + content area ── */
const contentAreaStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '0', padding: '0 0 80px' };
const sidebarStyle: React.CSSProperties = { width: '220px', flexShrink: 0, padding: '28px 24px', borderRight: '1px solid #e8e4de', position: 'sticky', top: '80px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' };

/* Sidebar filter sections */
const filterSectionStyle: React.CSSProperties = { borderBottom: '1px solid #e8e4de', paddingBottom: '0' };
const filterSectionHeaderStyle: React.CSSProperties = { width: '100%', background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', color: '#1a1a1a', cursor: 'pointer', textAlign: 'left' as const };
const filterChevronStyle: React.CSSProperties = { fontSize: '10px', color: '#9a9590' };
const filterSectionBodyStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column' as const, gap: '10px', paddingBottom: '16px' };
const filterCheckboxLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 300, color: '#1a1a1a', cursor: 'pointer' };
const filterCountStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', color: '#9a9590', marginLeft: 'auto', flexShrink: 0 };
const filterPriceTextStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', color: '#6b6560', letterSpacing: '0.5px' };
const priceBoxStyle: React.CSSProperties = { flex: 1, border: '1px solid #e8e4de', padding: '7px 10px', background: '#fafaf8', display: 'flex', flexDirection: 'column', gap: '2px' };
const priceBoxLabelStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: '#9a9590' };
const priceBoxValueStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 500, color: '#1a1a1a' };
const priceScaleLabelStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '9px', color: '#9a9590', letterSpacing: '0.5px' };
const clearFiltersBtnStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', marginBottom: '16px', background: 'transparent', border: '1px solid #c9a96e', color: '#c9a96e', fontFamily: "'Montserrat',sans-serif", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase' as const, cursor: 'pointer', transition: 'all 0.2s' };

/* Toolbar (count + sort) */
const toolbarStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #e8e4de', background: '#fafaf8' };
const toolbarCountStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 400, letterSpacing: '1.5px', color: '#6b6560' };
const toolbarSortLabelStyle: React.CSSProperties = { fontFamily: "'Montserrat',sans-serif", fontSize: '10px', letterSpacing: '1.5px', color: '#9a9590' };
const sortSelectStyle: React.CSSProperties = { padding: '8px 32px 8px 12px', border: '1px solid #d4cfc8', fontFamily: "'Montserrat',sans-serif", fontSize: '11px', color: '#1a1a1a', background: '#fff', outline: 'none', cursor: 'pointer', appearance: 'auto' as any };

/* New product grid inside content area */
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px', padding: '28px 32px' };
const cartBadgeStyle: React.CSSProperties = { position: 'absolute', top: '-8px', right: '-8px', background: '#c9a96e', color: '#fff', borderRadius: '999px', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat',sans-serif", fontSize: '9px', fontWeight: 700 };

const orderNowBtnStyle: React.CSSProperties = { padding: '14px 28px', background: '#1a1a1a', border: 'none', color: '#fff', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.25s', flex: 1 };
const addToCartBtnStyle: React.CSSProperties = { padding: '14px 28px', background: '#c9a96e', border: 'none', color: '#fff', fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.25s', flex: 1 };

const cartDrawerStyle: React.CSSProperties = { background: '#fff', width: '100%', maxWidth: '460px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative', marginLeft: 'auto' };
const cartHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '32px 32px 20px', borderBottom: '1px solid #e8e4de' };
const cartItemRowStyle: React.CSSProperties = { display: 'flex', gap: '16px', alignItems: 'flex-start', paddingBottom: '20px', marginBottom: '20px', borderBottom: '1px solid #f0ede8' };
const cartFooterStyle: React.CSSProperties = { padding: '20px 32px 32px', borderTop: '1px solid #e8e4de' };
const qtyBtnStyle: React.CSSProperties = { width: '28px', height: '28px', background: 'transparent', border: '1px solid #d4cfc8', cursor: 'pointer', fontFamily: "'Montserrat',sans-serif", fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const removeItemBtnStyle: React.CSSProperties = { background: 'none', border: 'none', color: '#9a9590', cursor: 'pointer', fontSize: '13px', padding: '2px' };

const detailModalStyle: React.CSSProperties = { background: '#fff', width: '100%', maxWidth: '960px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' };
const detailCloseBtnStyle: React.CSSProperties = { position: 'absolute', top: '16px', right: '20px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9a9590', zIndex: 10, lineHeight: 1 };
const detailLayoutStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '500px' };
const detailImagePanelStyle: React.CSSProperties = { position: 'relative', minHeight: '400px' };
const detailInfoPanelStyle: React.CSSProperties = { padding: '48px 40px', display: 'flex', flexDirection: 'column' };
const detailNameStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 300, color: '#1a1a1a', lineHeight: 1.1, marginBottom: '12px' };
const detailPriceStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '18px', fontWeight: 500, color: '#c9a96e', marginBottom: '24px' };
const detailDividerStyle: React.CSSProperties = { height: '1px', background: '#e8e4de', margin: '0 0 20px' };
const detailSectionLabelStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#9a9590', marginBottom: '10px' };
const detailDescStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 300, lineHeight: 1.9, color: '#6b6560', marginBottom: '24px' };
const detailSizeChipStyle: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: 500, letterSpacing: '1.5px', color: '#1a1a1a', border: '1px solid #1a1a1a', padding: '6px 14px' };

export default ProductsPage;
