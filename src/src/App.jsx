import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X, Check, Lock,
  ChevronLeft, Copy, RefreshCw, LogOut, Settings, ClipboardList,
  Smartphone, Package, ArrowRight, AlertCircle, CheckCircle2,
  Clock, XCircle, Eye, EyeOff, ImagePlus, ImageOff
} from "lucide-react";
import {
  fetchProducts, saveProductDoc, deleteProductDoc,
  fetchOrders, saveOrderDoc,
  fetchSettings, saveSettingsDoc,
} from "./lib/store";

const CART_KEY = "zero-store:cart";
const MAX_IMAGES = 3;

const BRANDS = [
  { id: "samsung", label: "سامسونگ" },
  { id: "xiaomi", label: "شیائومی" },
  { id: "apple", label: "آیفون" },
];

const STATUS_META = {
  pending: { label: "در انتظار تایید", color: "text-amber-400", bg: "bg-amber-400/10", ring: "ring-amber-400/30", icon: Clock },
  confirmed: { label: "تایید شده", color: "text-emerald-400", bg: "bg-emerald-400/10", ring: "ring-emerald-400/30", icon: CheckCircle2 },
  outofstock: { label: "ناموجود / بازگشت وجه", color: "text-rose-400", bg: "bg-rose-400/10", ring: "ring-rose-400/30", icon: AlertCircle },
  cancelled: { label: "لغو شده", color: "text-zinc-500", bg: "bg-zinc-500/10", ring: "ring-zinc-500/30", icon: XCircle },
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function orderCode(id) {
  return "ZR-" + id.slice(-6).toUpperCase();
}
function toToman(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("fa-IR") + " تومان";
}
function totalStock(product) {
  if (!product.colors || product.colors.length === 0) return 0;
  return product.colors.reduce((s, c) => s + (Number(c.stock) || 0), 0);
}
function compressImage(file, maxDim = 640, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("تصویر خوانده نشد"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("فایل خوانده نشد"));
    reader.readAsDataURL(file);
  });
}

const DEFAULT_SETTINGS = {
  cardNumber: "6219861973917106",
  cardHolder: "",
  storePhone: "",
  adminPassword: "zero1404",
};

export default function ZeroStore() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [cart, setCart] = useState([]);

  const [page, setPage] = useState("home");
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastOrderCode, setLastOrderCode] = useState(null);
  const [toast, setToast] = useState(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState("products");

  async function refreshAll() {
    const [p, o, s] = await Promise.all([
      fetchProducts(),
      fetchOrders(),
      fetchSettings(DEFAULT_SETTINGS),
    ]);
    setProducts(p);
    setOrders(o);
    setSettings(s);
  }

  useEffect(() => {
    (async () => {
      try {
        await refreshAll();
      } catch (e) {
        console.error(e);
      }
      try {
        const raw = localStorage.getItem(CART_KEY);
        setCart(raw ? JSON.parse(raw) : []);
      } catch (e) {
        setCart([]);
      }
      setLoading(false);
    })();
  }, []);

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2600);
  }

  function persistCart(next) {
    setCart(next);
    localStorage.setItem(CART_KEY, JSON.stringify(next));
  }

  async function upsertProduct(product) {
    await saveProductDoc(product);
    await refreshAll();
  }
  async function removeProductById(id) {
    await deleteProductDoc(id);
    await refreshAll();
  }
  async function upsertOrder(order) {
    await saveOrderDoc(order);
    await refreshAll();
  }
  async function saveSettings(next) {
    await saveSettingsDoc(next);
    setSettings(next);
  }

  async function refreshLive() {
    await refreshAll();
    showToast("به‌روزرسانی شد");
  }

  const cartItems = useMemo(() => {
    return cart
      .map((c) => {
        const p = products.find((p) => p.id === c.productId);
        if (!p) return null;
        const color = (p.colors || []).find((cl) => cl.id === c.colorId);
        if (!color) return null;
        return { ...p, color, qty: c.qty, key: p.id + "::" + color.id };
      })
      .filter(Boolean);
  }, [cart, products]);

  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.price * i.qty, 0), [cartItems]);
  const cartCount = useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart]);

  function addToCart(productId, colorId, qty = 1) {
    const existing = cart.find((c) => c.productId === productId && c.colorId === colorId);
    let next;
    if (existing) {
      next = cart.map((c) => (c.productId === productId && c.colorId === colorId ? { ...c, qty: c.qty + qty } : c));
    } else {
      next = [...cart, { productId, colorId, qty }];
    }
    persistCart(next);
    showToast("به سبد خرید اضافه شد");
  }
  function updateQty(productId, colorId, qty) {
    if (qty <= 0) {
      persistCart(cart.filter((c) => !(c.productId === productId && c.colorId === colorId)));
      return;
    }
    persistCart(cart.map((c) => (c.productId === productId && c.colorId === colorId ? { ...c, qty } : c)));
  }
  function removeFromCart(productId, colorId) {
    persistCart(cart.filter((c) => !(c.productId === productId && c.colorId === colorId)));
  }

  const brandProducts = useCallback((brandId) => products.filter((p) => p.brand === brandId), [products]);
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    return products.filter((p) => p.model.includes(q) || p.title?.includes(q));
  }, [products, searchQuery]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;

  function goHome() {
    setPage("home");
    setSelectedBrand(null);
    setSelectedProductId(null);
  }
  function openProduct(id) {
    setSelectedProductId(id);
    setPage("product");
  }
  function doSearch(q) {
    setSearchQuery(q);
    if (q.trim()) setPage("search");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-zinc-400 text-sm tracking-wide">در حال بارگذاری زرو…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100" dir="rtl">
      {toast && <Toast msg={toast.msg} kind={toast.kind} />}

      {page !== "admin" && page !== "admin-login" && (
        <StoreHeader
          cartCount={cartCount}
          onHome={goHome}
          onCart={() => setPage("cart")}
          onTrack={() => setPage("track")}
          onSearch={doSearch}
          onAdmin={() => setPage(isAdmin ? "admin" : "admin-login")}
          searchQuery={searchQuery}
        />
      )}

      {page === "home" && (
        <HomePage products={products} onPickBrand={(b) => { setSelectedBrand(b); setPage("brand"); }} onOpenProduct={openProduct} />
      )}
      {page === "brand" && (
        <BrandPage brand={selectedBrand} products={brandProducts(selectedBrand)} onBack={goHome} onOpenProduct={openProduct} />
      )}
      {page === "search" && (
        <SearchResultsPage query={searchQuery} results={searchResults} onBack={goHome} onOpenProduct={openProduct} />
      )}
      {page === "product" && selectedProduct && (
        <ProductPage product={selectedProduct} onBack={() => setPage(selectedBrand ? "brand" : "home")} onAdd={addToCart} />
      )}
      {page === "cart" && (
        <CartPage items={cartItems} total={cartTotal} onQty={updateQty} onRemove={removeFromCart} onBack={goHome} onCheckout={() => setPage("checkout")} />
      )}
      {page === "checkout" && (
        <CheckoutPage
          items={cartItems}
          total={cartTotal}
          settings={settings}
          onBack={() => setPage("cart")}
          onSubmit={async (customer, paymentRef) => {
            const id = genId();
            const order = {
              id,
              code: orderCode(id),
              items: cartItems.map((i) => ({
                productId: i.id, title: i.title, brand: i.brand, model: i.model,
                price: i.price, qty: i.qty, colorId: i.color.id, colorName: i.color.name,
              })),
              customer, paymentRef, total: cartTotal,
              status: "pending", adminNote: "", createdAt: Date.now(),
            };
            await upsertOrder(order);
            persistCart([]);
            setLastOrderCode(order.code);
            setPage("success");
          }}
        />
      )}
      {page === "success" && <SuccessPage code={lastOrderCode} onHome={goHome} onTrack={() => setPage("track")} />}
      {page === "track" && <TrackPage orders={orders} onRefresh={refreshLive} onBack={goHome} />}
      {page === "admin-login" && (
        <AdminLogin expected={settings.adminPassword} onSuccess={() => { setIsAdmin(true); setPage("admin"); }} onBack={goHome} />
      )}
      {page === "admin" && isAdmin && (
        <AdminPanel
          tab={adminTab}
          setTab={setAdminTab}
          products={products}
          orders={orders}
          settings={settings}
          onUpsertProduct={upsertProduct}
          onRemoveProduct={removeProductById}
          onUpsertOrder={upsertOrder}
          onSaveSettings={saveSettings}
          onExit={() => { setIsAdmin(false); goHome(); }}
          onRefresh={refreshLive}
          onToast={showToast}
        />
      )}

      <SiteFooter />
    </div>
  );
}

function Toast({ msg, kind }) {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100]">
      <div className={`flex items-center gap-2 px-5 py-3 rounded-lg shadow-2xl ring-1 text-sm font-medium ${
        kind === "error" ? "bg-rose-950 text-rose-300 ring-rose-800" : "bg-zinc-900 text-amber-300 ring-amber-500/30"
      }`}>
        {kind === "error" ? <AlertCircle size={16} /> : <Check size={16} />}
        {msg}
      </div>
    </div>
  );
}
function Logo({ size = "text-2xl" }) {
  return (
    <div className={`flex items-center gap-2 font-extrabold tracking-wide ${size}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.6)]" />
      زرو
    </div>
  );
}
function BrandChip({ id }) {
  const b = BRANDS.find((x) => x.id === id);
  return <span className="text-amber-300/90">{b ? b.label : id}</span>;
}
function EmptyState({ icon: Icon = Package, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="w-14 h-14 rounded-full border border-zinc-800 flex items-center justify-center mb-5 text-zinc-600">
        <Icon size={22} />
      </div>
      <p className="text-zinc-300 font-medium mb-1">{title}</p>
      {hint && <p className="text-zinc-500 text-sm max-w-xs">{hint}</p>}
    </div>
  );
}
function ProductThumb({ product, className = "" }) {
  const img = product.images && product.images[0];
  return img ? (
    <img src={img} alt={product.model} className={`w-full h-full object-cover ${className}`} />
  ) : (
    <Smartphone className="text-zinc-700" size={32} />
  );
}
function ProductCard({ product, onOpen }) {
  const stock = totalStock(product);
  return (
    <button onClick={() => onOpen(product.id)} className="group text-right bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-lg overflow-hidden transition-all hover:-translate-y-0.5">
      <div className="aspect-[4/3] bg-zinc-950 flex items-center justify-center relative overflow-hidden border-b border-zinc-800">
        <ProductThumb product={product} />
        {stock <= 0 && <div className="absolute inset-0 bg-zinc-950/80 flex items-center justify-center text-xs text-rose-400 font-medium">ناموجود</div>}
      </div>
      <div className="p-4">
        <div className="text-[11px] mb-1"><BrandChip id={product.brand} /></div>
        <h3 className="font-semibold text-sm text-zinc-100 mb-2 leading-relaxed">{product.model}</h3>
        <div className="flex items-center justify-between">
          <span className="text-amber-400 font-bold text-sm">{toToman(product.price)}</span>
          <span className="text-zinc-600 group-hover:text-amber-400 transition-colors"><ArrowRight size={16} className="rotate-180" /></span>
        </div>
      </div>
    </button>
  );
}

function StoreHeader({ cartCount, onHome, onCart, onTrack, onSearch, onAdmin, searchQuery }) {
  const [q, setQ] = useState(searchQuery || "");
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-5 py-4 flex items-center gap-4 flex-wrap">
        <button onClick={onHome} className="shrink-0"><Logo /></button>
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch(q)}
            placeholder="نام مدل گوشی رو جست‌وجو کنید…"
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/50 rounded-full py-2.5 pr-9 pl-4 text-sm outline-none placeholder:text-zinc-600 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onTrack} className="text-xs text-zinc-400 hover:text-amber-300 px-3 py-2 rounded-md hover:bg-zinc-900 transition-colors">پیگیری سفارش</button>
          <button onClick={onAdmin} className="text-zinc-500 hover:text-amber-300 p-2 rounded-md hover:bg-zinc-900 transition-colors" title="پنل مدیریت"><Settings size={17} /></button>
          <button onClick={onCart} className="relative p-2 rounded-md hover:bg-zinc-900 text-zinc-200 transition-colors">
            <ShoppingCart size={19} />
            {cartCount > 0 && <span className="absolute -top-1 -left-1 bg-amber-400 text-zinc-950 text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">{cartCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}

function HomePage({ products, onPickBrand, onOpenProduct }) {
  const latest = [...products].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  return (
    <main>
      <section className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 700px 350px at 50% 0%, rgba(251,191,36,0.08), transparent 70%)" }} />
        <div className="max-w-6xl mx-auto px-5 py-20 text-center relative">
          <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.25em] text-amber-300/80 uppercase mb-6">
            <span className="w-6 h-px bg-amber-500/60" /> محافظ گوشی، با استاندارد زرو <span className="w-6 h-px bg-amber-500/60" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-[1.5] max-w-2xl mx-auto">
            گاردی که مدل گوشی شما را <span className="text-amber-400">می‌شناسد</span>
          </h1>
          <p className="text-zinc-400 mt-5 max-w-md mx-auto leading-loose text-sm md:text-base">
            برند خودتون رو انتخاب کنید، مدل گوشی‌تون رو پیدا کنید، رنگ دلخواه رو انتخاب کنید و سفارش بدید.
          </p>
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-5 py-14">
        <div className="grid grid-cols-3 gap-3 md:gap-5">
          {BRANDS.map((b) => (
            <button key={b.id} onClick={() => onPickBrand(b.id)} className="group bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-xl py-10 px-4 text-center transition-all hover:-translate-y-0.5">
              <Smartphone className="mx-auto mb-3 text-zinc-600 group-hover:text-amber-400 transition-colors" size={26} />
              <div className="font-bold">{b.label}</div>
              <div className="text-[11px] text-zinc-600 mt-1">{products.filter((p) => p.brand === b.id).length} مدل</div>
            </button>
          ))}
        </div>
      </section>
      {latest.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 pb-20">
          <div className="flex items-center justify-between mb-6 border-b border-zinc-800 pb-4"><h2 className="font-bold text-lg">تازه‌ترین مدل‌ها</h2></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{latest.map((p) => <ProductCard key={p.id} product={p} onOpen={onOpenProduct} />)}</div>
        </section>
      )}
      {products.length === 0 && <EmptyState title="هنوز محصولی اضافه نشده" hint="از پنل مدیریت (آیکون چرخ‌دنده بالا) اولین گارد گوشی رو اضافه کنید." />}
    </main>
  );
}

function BrandPage({ brand, products, onBack, onOpenProduct }) {
  const label = BRANDS.find((b) => b.id === brand)?.label || brand;
  return (
    <main className="max-w-6xl mx-auto px-5 py-10">
      <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-500 hover:text-amber-300 text-sm mb-6 transition-colors"><ChevronLeft size={16} /> بازگشت</button>
      <h1 className="text-2xl font-extrabold mb-1">{label}</h1>
      <p className="text-zinc-500 text-sm mb-8">{products.length} مدل موجود در این دسته</p>
      {products.length === 0 ? <EmptyState title={`فعلاً مدلی برای ${label} ثبت نشده`} hint="به‌زودی مدل‌های بیشتری اضافه می‌شود." /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{products.map((p) => <ProductCard key={p.id} product={p} onOpen={onOpenProduct} />)}</div>
      )}
    </main>
  );
}

function SearchResultsPage({ query, results, onBack, onOpenProduct }) {
  return (
    <main className="max-w-6xl mx-auto px-5 py-10">
      <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-500 hover:text-amber-300 text-sm mb-6 transition-colors"><ChevronLeft size={16} /> بازگشت</button>
      <h1 className="text-xl font-bold mb-1">نتایج جست‌وجو برای «{query}»</h1>
      <p className="text-zinc-500 text-sm mb-8">{results.length} مدل پیدا شد</p>
      {results.length === 0 ? <EmptyState icon={Search} title="مدلی پیدا نشد" hint="نام مدل گوشی رو دقیق‌تر یا با هجی دیگه امتحان کنید." /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{results.map((p) => <ProductCard key={p.id} product={p} onOpen={onOpenProduct} />)}</div>
      )}
    </main>
  );
}

function ProductPage({ product, onBack, onAdd }) {
  const images = product.images && product.images.length ? product.images : [null];
  const [activeImg, setActiveImg] = useState(0);
  const colors = product.colors || [];
  const firstAvailable = colors.find((c) => Number(c.stock) > 0) || colors[0] || null;
  const [colorId, setColorId] = useState(firstAvailable ? firstAvailable.id : null);
  const [qty, setQty] = useState(1);
  const selectedColor = colors.find((c) => c.id === colorId) || null;
  const inStock = selectedColor && Number(selectedColor.stock) > 0;

  return (
    <main className="max-w-4xl mx-auto px-5 py-10">
      <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-500 hover:text-amber-300 text-sm mb-6 transition-colors"><ChevronLeft size={16} /> بازگشت</button>
      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <div className="aspect-square bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center overflow-hidden mb-3">
            {images[activeImg] ? <img src={images[activeImg]} alt={product.model} className="w-full h-full object-cover" /> : <Smartphone className="text-zinc-700" size={70} />}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, idx) => (
                <button key={idx} onClick={() => setActiveImg(idx)} className={`w-16 h-16 rounded-lg overflow-hidden border shrink-0 transition-colors ${activeImg === idx ? "border-amber-400" : "border-zinc-800 hover:border-zinc-700"}`}>
                  {img ? <img src={img} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-zinc-900 flex items-center justify-center"><Smartphone size={18} className="text-zinc-700" /></div>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs mb-2"><BrandChip id={product.brand} /></div>
          <h1 className="text-2xl font-extrabold mb-5 leading-relaxed">{product.model}</h1>
          {colors.length > 0 && (
            <div className="mb-6">
              <div className="text-xs text-zinc-500 mb-2.5">رنگ{selectedColor ? <span className="text-zinc-300"> — {selectedColor.name}</span> : ""}</div>
              <div className="flex items-center gap-2.5 flex-wrap">
                {colors.map((c) => {
                  const available = Number(c.stock) > 0;
                  const active = colorId === c.id;
                  return (
                    <button key={c.id} onClick={() => available && setColorId(c.id)} disabled={!available} title={c.name + (available ? "" : " (ناموجود)")}
                      className={`relative w-9 h-9 rounded-full border-2 transition-all ${active ? "border-amber-400 scale-110" : "border-zinc-700"} ${!available ? "opacity-30 cursor-not-allowed" : "hover:border-amber-400/60"}`}
                      style={{ backgroundColor: c.hex || "#3f3f46" }}>
                      {!available && <span className="absolute inset-0 flex items-center justify-center"><span className="w-full h-px bg-zinc-300 rotate-45" /></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 border-y border-zinc-800 py-5 mb-6">
            <span className="text-2xl font-extrabold text-amber-400">{toToman(product.price)}</span>
            {inStock ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-zinc-800 rounded-lg overflow-hidden">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2 hover:bg-zinc-900 text-zinc-400"><Minus size={13} /></button>
                  <span className="w-8 text-center text-sm">{qty.toLocaleString("fa-IR")}</span>
                  <button onClick={() => setQty((q) => q + 1)} className="p-2 hover:bg-zinc-900 text-zinc-400"><Plus size={13} /></button>
                </div>
                <button onClick={() => onAdd(product.id, colorId, qty)} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-6 py-3 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap">
                  <ShoppingCart size={16} /> افزودن به سبد
                </button>
              </div>
            ) : (
              <span className="text-rose-400 text-sm font-medium flex items-center gap-1.5"><AlertCircle size={14} /> ناموجود</span>
            )}
          </div>
          {product.description && (
            <div>
              <h2 className="text-xs font-bold text-zinc-400 mb-2">توضیحات و مشخصات</h2>
              <p className="text-zinc-400 text-sm leading-loose whitespace-pre-line">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function CartPage({ items, total, onQty, onRemove, onBack, onCheckout }) {
  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-500 hover:text-amber-300 text-sm mb-6 transition-colors"><ChevronLeft size={16} /> ادامه خرید</button>
      <h1 className="text-xl font-extrabold mb-8">سبد خرید</h1>
      {items.length === 0 ? <EmptyState icon={ShoppingCart} title="سبد خرید خالیه" hint="محصولی رو از دسته‌بندی‌ها انتخاب کنید." /> : (
        <>
          <div className="space-y-3 mb-8">
            {items.map((it) => (
              <div key={it.key} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="w-16 h-16 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden"><ProductThumb product={it} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] mb-0.5"><BrandChip id={it.brand} /></div>
                  <div className="font-medium text-sm truncate">{it.model}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-3 h-3 rounded-full border border-zinc-700 shrink-0" style={{ backgroundColor: it.color.hex || "#3f3f46" }} />
                    <span className="text-zinc-500 text-xs">{it.color.name}</span>
                  </div>
                  <div className="text-amber-400 text-sm font-bold mt-1">{toToman(it.price)}</div>
                </div>
                <div className="flex items-center border border-zinc-800 rounded-lg overflow-hidden shrink-0">
                  <button onClick={() => onQty(it.id, it.color.id, it.qty - 1)} className="p-2 hover:bg-zinc-950 text-zinc-400"><Minus size={13} /></button>
                  <span className="w-8 text-center text-sm">{it.qty.toLocaleString("fa-IR")}</span>
                  <button onClick={() => onQty(it.id, it.color.id, it.qty + 1)} className="p-2 hover:bg-zinc-950 text-zinc-400"><Plus size={13} /></button>
                </div>
                <button onClick={() => onRemove(it.id, it.color.id)} className="text-zinc-600 hover:text-rose-400 p-2 transition-colors shrink-0"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <div className="border-t border-zinc-800 pt-6 flex items-center justify-between">
            <div><div className="text-zinc-500 text-xs mb-1">مبلغ قابل پرداخت</div><div className="text-xl font-extrabold text-amber-400">{toToman(total)}</div></div>
            <button onClick={onCheckout} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-8 py-3.5 rounded-lg transition-colors">ثبت سفارش</button>
          </div>
        </>
      )}
    </main>
  );
}

function CheckoutPage({ items, total, settings, onBack, onSubmit }) {
  const [form, setForm] = useState({ name: "", phone: "", province: "", city: "", address: "", postalCode: "", note: "" });
  const [paymentRef, setPaymentRef] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function copyCard() {
    if (navigator.clipboard) navigator.clipboard.writeText(settings.cardNumber).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  function validate() {
    if (!form.name.trim()) return "نام و نام‌خانوادگی رو وارد کنید";
    if (!form.phone.trim() || form.phone.trim().length < 10) return "شماره تماس معتبر وارد کنید";
    if (!form.province.trim()) return "استان رو وارد کنید";
    if (!form.city.trim()) return "شهر رو وارد کنید";
    if (!form.address.trim()) return "آدرس کامل پستی رو وارد کنید";
    if (!form.postalCode.trim() || form.postalCode.trim().length < 10) return "کد پستی ۱۰ رقمی رو وارد کنید";
    return "";
  }
  async function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setSubmitting(true);
    await onSubmit(form, paymentRef);
    setSubmitting(false);
  }
  return (
    <main className="max-w-4xl mx-auto px-5 py-10">
      <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-500 hover:text-amber-300 text-sm mb-6 transition-colors"><ChevronLeft size={16} /> بازگشت به سبد خرید</button>
      <h1 className="text-xl font-extrabold mb-8">تکمیل سفارش</h1>
      <div className="grid md:grid-cols-5 gap-8">
        <div className="md:col-span-3 space-y-5">
          <h2 className="text-sm font-bold text-zinc-300 flex items-center gap-2"><Package size={15} className="text-amber-400" /> مشخصات گیرنده برای پست</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="نام و نام‌خانوادگی" value={form.name} onChange={(v) => set("name", v)} full />
            <Field label="شماره تماس" value={form.phone} onChange={(v) => set("phone", v)} inputMode="numeric" full />
            <Field label="استان" value={form.province} onChange={(v) => set("province", v)} />
            <Field label="شهر" value={form.city} onChange={(v) => set("city", v)} />
            <Field label="کد پستی (۱۰ رقم)" value={form.postalCode} onChange={(v) => set("postalCode", v)} inputMode="numeric" />
          </div>
          <Field label="آدرس کامل پستی" value={form.address} onChange={(v) => set("address", v)} textarea />
          <Field label="توضیحات سفارش (اختیاری)" value={form.note} onChange={(v) => set("note", v)} textarea />
          <div className="bg-zinc-900 border border-amber-500/20 rounded-lg p-4 text-xs text-zinc-400 leading-loose flex gap-2">
            <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
            هزینه ارسال به‌صورت پس‌کرایه است و هنگام تحویل بسته توسط پست دریافت می‌شود؛ مبلغ زیر فقط بابت خود محصول است.
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 sticky top-24">
            <h2 className="text-sm font-bold text-zinc-300 mb-4">خلاصه سفارش</h2>
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pl-1">
              {items.map((it) => (
                <div key={it.key} className="flex justify-between text-xs">
                  <span className="text-zinc-400 truncate ml-2">{it.model} ({it.color.name}) × {it.qty.toLocaleString("fa-IR")}</span>
                  <span className="text-zinc-300 shrink-0">{toToman(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-zinc-800 pt-4 flex justify-between items-center mb-5">
              <span className="text-zinc-400 text-sm">مبلغ کل</span>
              <span className="text-amber-400 font-extrabold text-lg">{toToman(total)}</span>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 mb-4">
              <div className="text-[11px] text-zinc-500 mb-2">پرداخت مستقیم به شماره کارت</div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold tracking-wider text-amber-300 text-sm" dir="ltr">{settings.cardNumber}</span>
                <button onClick={copyCard} className="text-zinc-500 hover:text-amber-300 p-1.5 rounded-md hover:bg-zinc-900 transition-colors">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
              </div>
              {settings.cardHolder && <div className="text-[11px] text-zinc-500 mt-2">به نام: {settings.cardHolder}</div>}
            </div>
            <Field label="کد پیگیری واریز (اختیاری)" value={paymentRef} onChange={setPaymentRef} placeholder="مثلاً کد پیگیری بانک" />
            {error && <div className="text-rose-400 text-xs mt-3 flex items-center gap-1.5"><AlertCircle size={13} /> {error}</div>}
            <button onClick={handleSubmit} disabled={submitting} className="w-full mt-5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-zinc-950 font-bold py-3.5 rounded-lg transition-colors">
              {submitting ? "در حال ثبت…" : "مبلغ رو واریز کردم، سفارش رو ثبت کن"}
            </button>
            <p className="text-[11px] text-zinc-600 mt-3 leading-relaxed">پس از واریز، سفارش شما در انتظار تایید فروشنده قرار می‌گیرد و پس از تایید موجودی، پردازش می‌شود.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, textarea, full, inputMode, placeholder }) {
  const cls = "w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/50 rounded-lg px-3.5 py-2.5 text-sm outline-none placeholder:text-zinc-600 transition-colors";
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs text-zinc-500 mb-1.5">{label}</label>
      {textarea ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={cls} placeholder={placeholder} /> : <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} className={cls} placeholder={placeholder} />}
    </div>
  );
}

function SuccessPage({ code, onHome, onTrack }) {
  return (
    <main className="max-w-lg mx-auto px-5 py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mx-auto mb-6"><Check className="text-amber-400" size={26} /></div>
      <h1 className="text-xl font-extrabold mb-3">سفارش شما ثبت شد</h1>
      <p className="text-zinc-400 text-sm mb-6 leading-loose">سفارش‌تون در انتظار تایید فروشنده‌ست. کد سفارش رو یادداشت کنید تا بتونید وضعیتش رو پیگیری کنید.</p>
      <div className="inline-block bg-zinc-900 border border-amber-500/30 rounded-lg px-6 py-3 font-bold text-amber-300 tracking-widest mb-8" dir="ltr">{code}</div>
      <div className="flex items-center justify-center gap-3">
        <button onClick={onTrack} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-6 py-3 rounded-lg transition-colors">پیگیری سفارش</button>
        <button onClick={onHome} className="border border-zinc-800 hover:border-zinc-700 px-6 py-3 rounded-lg text-sm transition-colors">بازگشت به فروشگاه</button>
      </div>
    </main>
  );
}

function TrackPage({ orders, onRefresh, onBack }) {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(undefined);
  function search() {
    const found = orders.find((o) => o.code.toLowerCase() === code.trim().toLowerCase() && o.customer.phone.trim() === phone.trim());
    setResult(found || null);
  }
  return (
    <main className="max-w-lg mx-auto px-5 py-14">
      <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-500 hover:text-amber-300 text-sm mb-6 transition-colors"><ChevronLeft size={16} /> بازگشت</button>
      <h1 className="text-xl font-extrabold mb-2">پیگیری سفارش</h1>
      <p className="text-zinc-500 text-sm mb-8">کد سفارش و شماره تماسی که هنگام خرید وارد کردید رو وارد کنید.</p>
      <div className="space-y-4 mb-6">
        <Field label="کد سفارش" value={code} onChange={setCode} placeholder="ZR-XXXXXX" />
        <Field label="شماره تماس" value={phone} onChange={setPhone} inputMode="numeric" />
      </div>
      <button onClick={search} className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-lg transition-colors">جست‌وجو</button>
      {result === null && <div className="mt-8 text-center text-rose-400 text-sm flex items-center justify-center gap-2"><XCircle size={16} /> سفارشی با این مشخصات پیدا نشد</div>}
      {result && (
        <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold tracking-wide text-amber-300" dir="ltr">{result.code}</span>
            <StatusBadge status={result.status} />
          </div>
          <div className="space-y-1.5 text-xs text-zinc-400 mb-4">
            {result.items.map((it, idx) => (
              <div key={idx} className="flex justify-between"><span>{it.model} ({it.colorName}) × {it.qty.toLocaleString("fa-IR")}</span><span>{toToman(it.price * it.qty)}</span></div>
            ))}
          </div>
          <div className="border-t border-zinc-800 pt-3 flex justify-between text-sm font-bold"><span className="text-zinc-400 font-normal">مبلغ کل</span><span className="text-amber-400">{toToman(result.total)}</span></div>
          {result.adminNote && <div className="mt-4 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-400 leading-relaxed"><span className="text-zinc-500">پیام فروشگاه: </span>{result.adminNote}</div>}
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ring-1 ${meta.bg} ${meta.color} ${meta.ring}`}><Icon size={11} /> {meta.label}</span>;
}

function AdminLogin({ expected, onSuccess, onBack }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  function submit() { if (pw === expected) onSuccess(); else setErr("رمز اشتباهه"); }
  return (
    <main className="min-h-[80vh] flex items-center justify-center px-5" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <button onClick={onBack} className="mb-6"><Logo size="text-xl" /></button>
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4"><Lock className="text-amber-400" size={18} /></div>
          <h1 className="font-bold text-lg">ورود به پنل مدیریت</h1>
          <p className="text-zinc-500 text-xs mt-1">مخصوص مدیر فروشگاه</p>
        </div>
        <div className="relative mb-3">
          <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="رمز عبور" className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/50 rounded-lg px-4 py-3 text-sm outline-none pl-10" />
          <button onClick={() => setShow((s) => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        {err && <div className="text-rose-400 text-xs mb-3">{err}</div>}
        <button onClick={submit} className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-lg transition-colors">ورود</button>
        <p className="text-[11px] text-zinc-600 mt-4 text-center leading-relaxed">رمز پیش‌فرض: <span dir="ltr" className="text-zinc-500">zero1404</span> — بعد از ورود از تب تنظیمات تغییرش بدید.</p>
      </div>
    </main>
  );
}

function AdminPanel({ tab, setTab, products, orders, settings, onUpsertProduct, onRemoveProduct, onUpsertOrder, onSaveSettings, onExit, onRefresh, onToast }) {
  return (
    <div className="min-h-screen" dir="rtl">
      <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6"><Logo size="text-xl" /><span className="text-xs text-zinc-500 hidden sm:block">پنل مدیریت فروشگاه</span></div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="text-zinc-500 hover:text-amber-300 p-2 rounded-md hover:bg-zinc-900 transition-colors" title="به‌روزرسانی"><RefreshCw size={16} /></button>
            <button onClick={onExit} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-rose-300 px-3 py-2 rounded-md hover:bg-zinc-900 transition-colors"><LogOut size={14} /> خروج</button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-5 flex gap-1 border-t border-zinc-900">
          <TabBtn active={tab === "products"} onClick={() => setTab("products")} icon={Package}>محصولات</TabBtn>
          <TabBtn active={tab === "orders"} onClick={() => setTab("orders")} icon={ClipboardList}>
            سفارش‌ها {orders.filter((o) => o.status === "pending").length > 0 && <span className="mr-1.5 bg-amber-400 text-zinc-950 text-[10px] font-bold px-1.5 rounded-full">{orders.filter((o) => o.status === "pending").length}</span>}
          </TabBtn>
          <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={Settings}>تنظیمات</TabBtn>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-5 py-8">
        {tab === "products" && <AdminProducts products={products} onUpsert={onUpsertProduct} onRemove={onRemoveProduct} onToast={onToast} />}
        {tab === "orders" && <AdminOrders orders={orders} onUpsert={onUpsertOrder} onToast={onToast} />}
        {tab === "settings" && <AdminSettings settings={settings} onSave={onSaveSettings} onToast={onToast} />}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }) {
  return <button onClick={onClick} className={`flex items-center gap-1.5 text-sm px-4 py-3 border-b-2 transition-colors ${active ? "border-amber-400 text-amber-300" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}><Icon size={14} /> {children}</button>;
}
function FilterChip({ active, onClick, children }) {
  return <button onClick={onClick} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active ? "bg-amber-500 border-amber-500 text-zinc-950 font-bold" : "border-zinc-800 text-zinc-400 hover:border-zinc-700"}`}>{children}</button>;
}

function ImagePicker({ images, onChange, onToast }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) { onToast(`حداکثر ${MAX_IMAGES} عکس برای هر محصول مجازه`, "error"); return; }
    setBusy(true);
    try {
      const picked = files.slice(0, room);
      const compressed = [];
      for (const f of picked) compressed.push(await compressImage(f));
      onChange([...images, ...compressed]);
      if (files.length > room) onToast(`فقط ${room} عکس اضافه شد (حداکثر ${MAX_IMAGES} عکس)`, "error");
    } catch (e) {
      onToast("مشکلی توی بارگذاری عکس پیش اومد", "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  function removeAt(idx) { onChange(images.filter((_, i) => i !== idx)); }
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5">تصاویر محصول (حداکثر {MAX_IMAGES} عکس)</label>
      <div className="grid grid-cols-4 gap-2">
        {images.map((img, idx) => (
          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-800 group">
            <img src={img} className="w-full h-full object-cover" />
            <button type="button" onClick={() => removeAt(idx)} className="absolute top-1 left-1 bg-zinc-950/80 text-rose-300 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
            {idx === 0 && <span className="absolute bottom-1 right-1 bg-amber-400 text-zinc-950 text-[9px] font-bold px-1.5 py-0.5 rounded">اصلی</span>}
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button type="button" onClick={() => inputRef.current && inputRef.current.click()} disabled={busy} className="aspect-square rounded-lg border border-dashed border-zinc-700 hover:border-amber-500/50 flex flex-col items-center justify-center gap-1.5 text-zinc-500 hover:text-amber-300 transition-colors disabled:opacity-50">
            {busy ? <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> : <><ImagePlus size={18} /><span className="text-[10px]">افزودن از گالری</span></>}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      {images.length === 0 && <p className="text-[11px] text-zinc-600 mt-2 flex items-center gap-1.5"><ImageOff size={12} /> بدون عکس، جای خالی محصول نمایش داده می‌شه</p>}
    </div>
  );
}

const COLOR_PRESETS = [
  { name: "مشکی", hex: "#18181b" },
  { name: "سفید", hex: "#f4f4f5" },
  { name: "طلایی", hex: "#d4af37" },
  { name: "آبی", hex: "#3b82f6" },
  { name: "قرمز", hex: "#ef4444" },
];

function ColorEditor({ colors, onChange }) {
  function updateColor(id, patch) { onChange(colors.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
  function addColor(preset) { onChange([...colors, { id: genId(), name: preset?.name || "", hex: preset?.hex || "#71717a", stock: "" }]); }
  function removeColor(id) { onChange(colors.filter((c) => c.id !== id)); }
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5">رنگ‌ها و موجودی هر رنگ</label>
      <div className="space-y-2 mb-3">
        {colors.map((c) => (
          <div key={c.id} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-2">
            <input type="color" value={c.hex || "#71717a"} onChange={(e) => updateColor(c.id, { hex: e.target.value })} className="w-8 h-8 rounded-md border border-zinc-700 bg-transparent shrink-0 cursor-pointer" />
            <input value={c.name} onChange={(e) => updateColor(c.id, { name: e.target.value })} placeholder="نام رنگ" className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-amber-500/50" />
            <input value={c.stock} onChange={(e) => updateColor(c.id, { stock: e.target.value.replace(/[^0-9]/g, "") })} inputMode="numeric" placeholder="موجودی" className="w-16 shrink-0 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5 text-xs outline-none focus:border-amber-500/50 text-center" />
            <button type="button" onClick={() => removeColor(c.id)} className="text-zinc-600 hover:text-rose-400 p-1.5 shrink-0"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button type="button" onClick={() => addColor()} className="text-xs px-3 py-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:border-amber-500/40 hover:text-amber-300 transition-colors flex items-center gap-1"><Plus size={12} /> رنگ دلخواه</button>
        {COLOR_PRESETS.map((p) => (
          <button key={p.name} type="button" onClick={() => addColor(p)} className="text-xs px-2.5 py-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:border-amber-500/40 hover:text-amber-300 transition-colors flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-zinc-700" style={{ backgroundColor: p.hex }} />{p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

const emptyProductForm = () => ({ brand: "samsung", model: "", price: "", images: [], colors: [], description: "" });

function AdminProducts({ products, onUpsert, onRemove, onToast }) {
  const [form, setForm] = useState(emptyProductForm());
  const [editingId, setEditingId] = useState(null);
  const [filterBrand, setFilterBrand] = useState("all");
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function resetForm() { setForm(emptyProductForm()); setEditingId(null); }

  async function save() {
    if (!form.model.trim() || !form.price) { onToast("مدل گوشی و قیمت رو وارد کنید", "error"); return; }
    if (form.colors.length === 0) { onToast("حداقل یک رنگ اضافه کنید", "error"); return; }
    if (form.colors.some((c) => !c.name.trim())) { onToast("نام همه رنگ‌ها رو وارد کنید", "error"); return; }

    setSaving(true);
    try {
      const id = editingId || genId();
      const existing = editingId ? products.find((p) => p.id === editingId) : null;

      const cleanColors = form.colors.map((c) => ({ ...c, stock: Number(c.stock) || 0 }));
      const product = {
        id,
        brand: form.brand,
        model: form.model.trim(),
        title: form.model.trim(),
        price: Number(form.price),
        images: form.images,
        colors: cleanColors,
        description: form.description.trim(),
        createdAt: existing ? existing.createdAt : Date.now(),
      };
      await onUpsert(product);
      onToast(editingId ? "محصول ویرایش شد" : "محصول اضافه شد");
      resetForm();
    } catch (e) {
      console.error(e);
      if (String(e?.message || "").includes("longer than")) {
        onToast("حجم عکس‌ها زیاده — تعداد عکس رو کمتر کن", "error");
      } else {
        onToast("ذخیره محصول با خطا مواجه شد", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  function editProduct(p) {
    setForm({ brand: p.brand, model: p.model, price: String(p.price), images: p.images || [], colors: (p.colors || []).map((c) => ({ ...c, stock: String(c.stock) })), description: p.description || "" });
    setEditingId(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id) {
    await onRemove(id);
    onToast("محصول حذف شد");
    if (editingId === id) resetForm();
  }

  const filtered = filterBrand === "all" ? products : products.filter((p) => p.brand === filterBrand);

  return (
    <div className="grid lg:grid-cols-5 gap-8">
      <div className="lg:col-span-2">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 sticky top-28">
          <h2 className="font-bold text-sm mb-5 flex items-center gap-2">{editingId ? <>✎ ویرایش محصول</> : <><Plus size={15} className="text-amber-400" /> افزودن گارد گوشی جدید</>}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">برند</label>
              <div className="grid grid-cols-3 gap-2">
                {BRANDS.map((b) => (
                  <button key={b.id} type="button" onClick={() => set("brand", b.id)} className={`text-xs py-2 rounded-md border transition-colors ${form.brand === b.id ? "bg-amber-500 text-zinc-950 border-amber-500 font-bold" : "border-zinc-800 text-zinc-400 hover:border-zinc-700"}`}>{b.label}</button>
                ))}
              </div>
            </div>
            <Field label="مدل گوشی (مثلاً Galaxy S24 Ultra)" value={form.model} onChange={(v) => set("model", v)} />
            <Field label="قیمت (تومان)" value={form.price} onChange={(v) => set("price", v.replace(/[^0-9]/g, ""))} inputMode="numeric" />
            <ImagePicker images={form.images} onChange={(v) => set("images", v)} onToast={onToast} />
            <ColorEditor colors={form.colors} onChange={(v) => set("colors", v)} />
            <Field label="توضیحات و مشخصات" value={form.description} onChange={(v) => set("description", v)} textarea />
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={save} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-zinc-950 font-bold py-2.5 rounded-lg text-sm transition-colors">
              {saving ? "در حال ذخیره…" : editingId ? "ذخیره تغییرات" : "افزودن محصول"}
            </button>
            {editingId && <button onClick={resetForm} className="px-4 py-2.5 rounded-lg text-sm border border-zinc-800 text-zinc-400 hover:border-zinc-700 transition-colors">انصراف</button>}
          </div>
        </div>
      </div>
      <div className="lg:col-span-3">
        <div className="flex items-center gap-2 mb-4">
          <FilterChip active={filterBrand === "all"} onClick={() => setFilterBrand("all")}>همه ({products.length})</FilterChip>
          {BRANDS.map((b) => <FilterChip key={b.id} active={filterBrand === b.id} onClick={() => setFilterBrand(b.id)}>{b.label} ({products.filter((p) => p.brand === b.id).length})</FilterChip>)}
        </div>
        {filtered.length === 0 ? <EmptyState title="محصولی در این دسته نیست" /> : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const stock = totalStock(p);
              return (
                <div key={p.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <div className="w-12 h-12 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden"><ProductThumb product={p} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] mb-0.5"><BrandChip id={p.brand} /><span className="text-zinc-600">· {(p.colors || []).length} رنگ</span>{stock <= 0 && <span className="text-rose-400">ناموجود</span>}</div>
                    <div className="font-medium text-sm truncate">{p.model}</div>
                  </div>
                  <div className="text-amber-400 text-sm font-bold shrink-0">{toToman(p.price)}</div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => editProduct(p)} className="text-zinc-500 hover:text-amber-300 p-2 rounded-md hover:bg-zinc-950 transition-colors">✎</button>
                    <button onClick={() => remove(p.id)} className="text-zinc-500 hover:text-rose-400 p-2 rounded-md hover:bg-zinc-950 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminOrders({ orders, onUpsert, onToast }) {
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);

  async function setStatus(order, status, note) {
    await onUpsert({ ...order, status, adminNote: note !== undefined ? note : order.adminNote });
    onToast("وضعیت سفارش به‌روزرسانی شد");
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>همه ({orders.length})</FilterChip>
        {Object.entries(STATUS_META).map(([key, meta]) => <FilterChip key={key} active={filter === key} onClick={() => setFilter(key)}>{meta.label} ({orders.filter((o) => o.status === key).length})</FilterChip>)}
      </div>
      {sorted.length === 0 ? <EmptyState icon={ClipboardList} title="سفارشی در این وضعیت نیست" /> : (
        <div className="space-y-3">
          {sorted.map((o) => {
            const isOpen = openId === o.id;
            return (
              <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <button onClick={() => { setOpenId(isOpen ? null : o.id); setNoteDraft(o.adminNote || ""); }} className="w-full flex items-center justify-between gap-3 p-4 text-right">
                  <div className="flex items-center gap-3 min-w-0"><span className="font-bold text-amber-300 text-sm shrink-0" dir="ltr">{o.code}</span><span className="text-zinc-500 text-xs truncate hidden sm:block">{o.customer.name} — {o.customer.phone}</span></div>
                  <div className="flex items-center gap-3 shrink-0"><span className="text-sm font-bold text-zinc-200">{toToman(o.total)}</span><StatusBadge status={o.status} /></div>
                </button>
                {isOpen && (
                  <div className="border-t border-zinc-800 p-4">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-400 mb-2">اقلام سفارش</h4>
                        <div className="space-y-1.5 mb-4">
                          {o.items.map((it, idx) => <div key={idx} className="flex justify-between text-xs text-zinc-400"><span><BrandChip id={it.brand} /> · {it.model} ({it.colorName}) × {it.qty.toLocaleString("fa-IR")}</span><span className="text-zinc-300">{toToman(it.price * it.qty)}</span></div>)}
                        </div>
                        <h4 className="text-xs font-bold text-zinc-400 mb-2">مشخصات ارسال</h4>
                        <div className="text-xs text-zinc-400 space-y-1 leading-relaxed">
                          <div>{o.customer.name} — {o.customer.phone}</div>
                          <div>{o.customer.province}، {o.customer.city}</div>
                          <div>{o.customer.address}</div>
                          <div>کد پستی: <span dir="ltr">{o.customer.postalCode}</span></div>
                          {o.customer.note && <div className="text-zinc-500">یادداشت: {o.customer.note}</div>}
                          {o.paymentRef && <div className="text-amber-300/80">کد پیگیری واریز: <span dir="ltr">{o.paymentRef}</span></div>}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-400 mb-2">تغییر وضعیت سفارش</h4>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <button onClick={() => setStatus(o, "confirmed")} className="text-xs py-2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors">تایید سفارش</button>
                          <button onClick={() => setStatus(o, "outofstock")} className="text-xs py-2 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors">ناموجود / بازگشت وجه</button>
                          <button onClick={() => setStatus(o, "pending")} className="text-xs py-2 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors">در انتظار تایید</button>
                          <button onClick={() => setStatus(o, "cancelled")} className="text-xs py-2 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-800/70 transition-colors">لغو سفارش</button>
                        </div>
                        <label className="block text-xs text-zinc-500 mb-1.5">پیام برای مشتری (مثلاً پیشنهاد مدل جایگزین)</label>
                        <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500/50 rounded-lg px-3 py-2 text-xs outline-none mb-2" />
                        <button onClick={() => setStatus(o, o.status, noteDraft)} className="text-xs px-4 py-2 rounded-md border border-zinc-700 text-zinc-300 hover:border-amber-500/50 hover:text-amber-300 transition-colors">ذخیره پیام</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminSettings({ settings, onSave, onToast }) {
  const [form, setForm] = useState(settings);
  const [pw2, setPw2] = useState("");
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  async function save() {
    if (form.adminPassword !== settings.adminPassword && form.adminPassword !== pw2) { onToast("تکرار رمز جدید مطابقت نداره", "error"); return; }
    await onSave(form);
    onToast("تنظیمات ذخیره شد");
  }
  return (
    <div className="max-w-lg">
      <h2 className="font-bold text-sm mb-5">تنظیمات پرداخت و فروشگاه</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <Field label="شماره کارت بانکی" value={form.cardNumber} onChange={(v) => set("cardNumber", v.replace(/[^0-9]/g, ""))} inputMode="numeric" />
        <Field label="نام صاحب کارت" value={form.cardHolder} onChange={(v) => set("cardHolder", v)} />
        <Field label="شماره تماس پشتیبانی فروشگاه" value={form.storePhone} onChange={(v) => set("storePhone", v)} inputMode="numeric" />
      </div>
      <h2 className="font-bold text-sm mt-8 mb-5">تغییر رمز پنل مدیریت</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <Field label="رمز جدید" value={form.adminPassword} onChange={(v) => set("adminPassword", v)} />
        <Field label="تکرار رمز جدید" value={pw2} onChange={setPw2} />
        <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5"><AlertCircle size={13} className="shrink-0 mt-0.5" />این رمز فقط از داخل مرورگر بررسی می‌شود؛ برای امنیت بیشتر بعداً می‌شه Firebase Authentication رو هم اضافه کرد.</p>
      </div>
      <button onClick={save} className="mt-6 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-8 py-3 rounded-lg text-sm transition-colors">ذخیره تنظیمات</button>
    </div>
  );
}

function SiteFooter() {
  return <footer className="border-t border-zinc-900 py-8 mt-10"><div className="max-w-6xl mx-auto px-5 text-center text-xs text-zinc-600">© زرو — محافظ اختصاصی گوشی موبایل</div></footer>;
}
