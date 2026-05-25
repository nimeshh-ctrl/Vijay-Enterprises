import { useState, useEffect, useRef } from "react";
import {
  collection, doc, onSnapshot,
  addDoc, updateDoc, deleteDoc,
} from "firebase/firestore";
import upiQR from "./assets/upi-qr.jpg";
import { db, auth } from "./firebase";

// ── Utilities ──────────────────────────────────────────────────────────────
const fmt     = n  => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = s  => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDT   = s  => s ? new Date(s).toLocaleString('en-IN',     { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const now     = () => new Date().toISOString();
const billNo  = () => 'VE-' + Date.now().toString().slice(-5);
const isValidIndianMobile = (num) => /^[6-9]\d{9}$/.test(num);

// ── Theme ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#f0fdf4', card: '#ffffff', primary: '#16a34a', dark: '#14532d',
  light: '#dcfce7', border: '#bbf7d0', accent: '#d97706', accentLight: '#fef3c7',
  danger: '#dc2626', dangerLight: '#fee2e2', muted: '#6b7280', text: '#111827',
  upi: '#7c3aed', upiLight: '#ede9fe', shadow: '0 2px 10px rgba(22,163,74,0.10)',
};
const inp = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: `1.5px solid ${C.border}`, fontSize: 15, fontFamily: 'inherit',
  outline: 'none', background: '#fff', boxSizing: 'border-box', color: C.text,
  transition: 'border-color 0.2s',
};
const lbl = { display: 'block', fontWeight: 700, fontSize: 12, marginBottom: 5, color: C.dark, letterSpacing: 0.3, textTransform: 'uppercase' };
const mkBtn = (v = 'primary') => ({
  padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 800,
  fontSize: 14, fontFamily: 'inherit', transition: 'all 0.18s',
  background: v === 'primary' ? C.primary : v === 'danger' ? C.danger : v === 'amber' ? C.accent : v === 'upi' ? C.upi : '#fff',
  color: ['primary','danger','amber','upi'].includes(v) ? '#fff' : C.primary,
  boxShadow: v === 'primary' ? '0 2px 8px rgba(22,163,74,0.25)' : 'none',
  border: v === 'outline' ? `2px solid ${C.primary}` : 'none',
});
const mkCard  = { background: C.card, borderRadius: 16, padding: 18, boxShadow: C.shadow, border: `1px solid ${C.border}` };
const mkBadge = color => ({
  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, display: 'inline-block',
  background: color === 'green' ? C.light : color === 'amber' ? C.accentLight : '#f3f4f6',
  color: color === 'green' ? C.dark : color === 'amber' ? '#92400e' : C.muted,
});

// ── Payment Toggle ─────────────────────────────────────────────────────────
function PayToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[
        { id: 'cash', label: '💵 Cash', color: C.primary, bg: C.light },
        { id: 'upi',  label: '📲 UPI',  color: C.upi,    bg: C.upiLight },
      ].map(opt => (
        <button key={opt.id} onClick={() => onChange(opt.id)}
          style={{ flex: 1, padding: '13px 0', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s',
            border: `2.5px solid ${value === opt.id ? opt.color : C.border}`,
            background: value === opt.id ? opt.bg : '#fff',
            color: value === opt.id ? opt.color : C.muted }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── PayBadge ───────────────────────────────────────────────────────────────
const PayBadge = ({ method }) => (
  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
    background: method === 'upi' ? C.upiLight : C.light,
    color: method === 'upi' ? C.upi : C.dark,
    border: `1px solid ${method === 'upi' ? '#ddd6fe' : C.border}` }}>
    {method === 'upi' ? '📲 UPI' : '💵 Cash'}
  </span>
);

// ── App Root ───────────────────────────────────────────────────────────────
export default function App() {
  const [page,      setPage]      = useState('loading');
  const [user,      setUser]      = useState(null);
  const [stock,     setStock]     = useState([]);
  const [orders,    setOrders]    = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart,      setCart]      = useState([]);

  useEffect(() => {
    const st = document.createElement('style');
    st.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fraunces:opsz,wght@9..144,700&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; background: #f0fdf4; }
      input:focus, textarea:focus, select:focus { border-color: #16a34a !important; box-shadow: 0 0 0 3px rgba(22,163,74,0.12); }
      button:active { opacity: 0.88; transform: scale(0.97); }
      ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #bbf7d0; border-radius: 4px; }
    `;
    
st.textContent += `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

button:hover {
  transform: translateY(-2px);
  transition: all 0.2s ease;
}
`;
document.head.appendChild(st);

    const sess = localStorage.getItem('groc_session');
    if (sess) { const u = JSON.parse(sess); setUser(u); setPage(u.type === 'owner' ? 'owner' : 'customer'); }
    else setPage('auth');
    const u1 = onSnapshot(collection(db, 'stock'),     s => setStock(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'orders'),    s => setOrders(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, 'customers'), s => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); };
  }, []);

  const doLogin  = u => { setUser(u); localStorage.setItem('groc_session', JSON.stringify(u)); setPage(u.type === 'owner' ? 'owner' : 'customer'); };
  const doLogout = () => { setUser(null); setCart([]); localStorage.removeItem('groc_session'); setPage('auth'); };
  const wrap = { fontFamily: "'Nunito', sans-serif", minHeight: '100vh', background: C.bg, color: C.text };

  if (page === 'loading') return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 60 }}>🏪</div>
        <p style={{ fontWeight: 800, color: C.primary, marginTop: 12 }}>Loading...</p>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      
      {page === 'auth'     && <AuthPage customers={customers} onLogin={doLogin} />}
      {page === 'owner'    && <OwnerPage stock={stock} orders={orders} customers={customers} onLogout={doLogout} />}
      {page === 'customer' && <CustomerPage user={user} stock={stock} orders={orders} cart={cart} setCart={setCart} onLogout={doLogout} />}
    </div>
  );
}

// ── Auth Page ──────────────────────────────────────────────────────────────
function AuthPage({ customers, onLogin }) {
  const [tab,      setTab]      = useState('login');
  const [f,        setF]        = useState({});
  const [err,      setErr]      = useState('');
  const [ok,       setOk]       = useState('');
  const [loading,  setLoading]  = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);

  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErr(''); };

  const handleLogoTap = () => {
    const next = logoTaps + 1; setLogoTaps(next);
    if (next >= 5) { setTab('owner'); setLogoTaps(0); setF({}); setErr(''); }
  };

  const handleCustLogin = () => {
    if (!isValidIndianMobile(f.mobile)) { setErr('Valid 10-digit mobile daalo'); return; }
    const c = customers.find(x => x.mobile === f.mobile.trim());
    if (!c) { setErr('Mobile nahi mila. Pehle Sign Up karo.'); return; }
    onLogin({ type: 'customer', ...c });
  };

  
const handleSignup = async () => {
    const { name, storeName, address, mobile } = f;

    if (!name?.trim() || !storeName?.trim() || !address?.trim() || !mobile?.trim()) {
      setErr('Sab fields bharna zaroori hai!');
      return;
    }

    if (!isValidIndianMobile(mobile)) {
      setErr('Valid Indian mobile number daalo');
      return;
    }

    if (customers.find(c => c.mobile === mobile)) {
      setErr('Yeh mobile already registered hai.');
      return;
    }

    setLoading(true);
    setErr('');

    try {
      await addDoc(collection(db, 'customers'), {
        name: f.name.trim(),
        storeName: f.storeName.trim(),
        address: f.address.trim(),
        mobile: f.mobile,
        createdAt: now(),
      });

      setOk('✅ Account ban gaya! Ab Login karo.');
      setF({});

      setTimeout(() => {
        setOk('');
        setTab('login');
      }, 2500);

    } catch {
      setErr('Error aaya, dobara try karo');
    }

    setLoading(false);
  };


  const handleOwnerLogin = () => {
    if (f.username === 'admin' && f.password === 'grocery123') onLogin({ type: 'owner', name: 'Admin' });
    else setErr('Galat username ya password');
  };

  const resetTab = id => { setTab(id); setF({}); setErr(''); setOk(''); setStage('form'); setOtp(''); };
  const TABS = tab === 'owner'
    ? [{ id:'login', label:'Customer Login' }, { id:'signup', label:'Naya Account' }, { id:'owner', label:'🔑 Owner' }]
    : [{ id:'login', label:'Customer Login' }, { id:'signup', label:'Naya Account' }];

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, background:'linear-gradient(160deg,#dcfce7 0%,#f0fdf4 55%,#ecfdf5 100%)' }}>
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <div onClick={handleLogoTap} style={{ width:72, height:72, background:`linear-gradient(135deg,${C.dark},${C.primary})`, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, margin:'0 auto 12px', boxShadow:'0 8px 24px rgba(22,163,74,0.25)', userSelect:'none', cursor:'default' }}>🏪</div>
        <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:28, fontWeight:700, color:C.dark, margin:0 }}>Vijay Enterprises</h1>
        <p style={{ color:C.muted, marginTop:4, fontSize:13, fontWeight:600 }}>Aapka Bharosemand Supplier</p>
      </div>

      <div style={{ ...mkCard, width:'100%', maxWidth:380 }}>
        <div style={{ display:'flex', background:C.bg, borderRadius:12, padding:4, marginBottom:22, gap:3 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => resetTab(t.id)}
              style={{ flex:1, padding:'8px 4px', border:'none', borderRadius:9, cursor:'pointer', fontFamily:'inherit', fontWeight:tab===t.id?800:600, fontSize:12, background:tab===t.id?C.primary:'transparent', color:tab===t.id?'#fff':C.muted, transition:'all 0.18s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {err && <div style={{ background:C.dangerLight, color:C.danger, padding:'10px 14px', borderRadius:10, marginBottom:14, fontSize:13, fontWeight:700 }}>{err}</div>}
        {ok  && <div style={{ background:C.light, color:C.dark, padding:'10px 14px', borderRadius:10, marginBottom:14, fontSize:13, fontWeight:700 }}>{ok}</div>}

        {tab==='login' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div><label style={lbl}>Mobile Number</label>
              <input style={inp} type="tel" placeholder="10-digit mobile daalo" maxLength={10} value={f.mobile||''} onChange={e=>set('mobile',e.target.value)} />
            </div>
            <button style={{ ...mkBtn('primary'), width:'100%', padding:13, fontSize:15 }} onClick={handleCustLogin}>Login Karo →</button>
          </div>
        )}

        {tab==='signup' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div><label style={lbl}>Aapka Naam</label><input style={inp} placeholder="Ramesh Kumar" value={f.name||''} onChange={e=>set('name',e.target.value)} /></div>
            <div><label style={lbl}>Dukan / Store ka Naam</label><input style={inp} placeholder="Kumar Kirana Store" value={f.storeName||''} onChange={e=>set('storeName',e.target.value)} /></div>
            <div><label style={lbl}>Poora Address</label><textarea style={{ ...inp, resize:'none', height:72 }} placeholder="Gali, mohalla, sheher..." value={f.address||''} onChange={e=>set('address',e.target.value)} /></div>
            <div><label style={lbl}>Mobile Number</label><input style={inp} type="tel" placeholder="10-digit (OTP aayega)" maxLength={10} value={f.mobile||''} onChange={e=>set('mobile',e.target.value)} /></div>
            <button style={{ ...mkBtn('primary'), width:'100%', padding:13, fontSize:15, opacity:loading?0.7:1 }} onClick={handleSignup} disabled={loading}>
              {loading ? '⏳ OTP bhej raha hun...' : '📱 OTP Bhejo'}
            </button>
          </div>
        )}

        

        {tab==='owner' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ padding:'10px 12px', background:C.accentLight, borderRadius:10, fontSize:12, color:'#92400e', fontWeight:700 }}>🔐 Sirf owner ke liye</div>
            <div><label style={lbl}>Username</label><input style={inp} placeholder="admin" value={f.username||''} onChange={e=>set('username',e.target.value)} /></div>
            <div><label style={lbl}>Password</label><input style={inp} type="password" placeholder="Password" value={f.password||''} onChange={e=>set('password',e.target.value)} /></div>
            <button style={{ ...mkBtn('primary'), width:'100%', padding:13, fontSize:15 }} onClick={handleOwnerLogin}>Owner Login →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Owner Page ─────────────────────────────────────────────────────────────
function OwnerPage({ stock, orders, customers, onLogout }) {
  const [tab, setTab] = useState('orders');
  const pendingCount  = orders.filter(o => o.status === 'pending').length;
  const TABS = [
    { id:'orders',   label:'📦 Orders',   badge: pendingCount },
    { id:'stock',    label:'🏪 Stock' },
    { id:'salesman', label:'🧾 Salesman' },
    { id:'office',   label:'🖥️ Office' },
  ];
  return (
    <div style={{ maxWidth:640, margin:'0 auto', minHeight:'100vh', paddingBottom:32 }}>
      <div style={{ background:`linear-gradient(135deg,${C.dark},${C.primary})`, padding:'20px 20px 0', color:'#fff' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, margin:0 }}>Owner Dashboard</h1>
            <p style={{ margin:'3px 0 0', opacity:0.75, fontSize:12, fontWeight:600 }}>Vijay Enterprises · Business Control</p>
          </div>
          <button onClick={onLogout} style={{ background:'rgba(255,255,255,0.18)', border:'1.5px solid rgba(255,255,255,0.3)', color:'#fff', padding:'8px 14px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'inherit' }}>Logout</button>
        </div>
        <div style={{ display:'flex', gap:2, overflowX:'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex:'0 0 auto', padding:'10px 14px', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:tab===t.id?800:500, fontSize:12, background:tab===t.id?'#fff':'transparent', color:tab===t.id?C.dark:'rgba(255,255,255,0.8)', borderRadius:'10px 10px 0 0', transition:'all 0.18s', whiteSpace:'nowrap' }}>
              {t.label}
              {t.badge > 0 && <span style={{ marginLeft:5, background:'#ef4444', color:'#fff', borderRadius:20, padding:'1px 6px', fontSize:10, fontWeight:900 }}>{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding:16 }}>
        {tab==='orders'   && <OrdersManager orders={orders} />}
        {tab==='stock'    && <StockManager  stock={stock} />}
        {tab==='salesman' && <SalesmanPanel stock={stock} />}
        {tab==='office'   && <OfficeDisplay orders={orders} />}
      </div>
    </div>
  );
}

// ── Stock Manager ──────────────────────────────────────────────────────────
function StockManager({ stock }) {
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [f,        setF]        = useState({});
  const [err,      setErr]      = useState('');
  const [saving,   setSaving]   = useState(false);
  const set = (k,v) => { setF(p=>({...p,[k]:v})); setErr(''); };
  const openAdd  = ()  => { setShowForm(true); setEditId(null); setF({}); setErr(''); };
  const openEdit = p   => { setShowForm(true); setEditId(p.id); setF({ name:p.name, price:p.price, unit:p.unit, quantity:p.quantity }); setErr(''); };
  const cancel   = ()  => { setShowForm(false); setEditId(null); setF({}); setErr(''); };
  const handleSave = async () => {
    const { name, price, unit, quantity } = f;
    if (!name?.trim()||!price||!unit||!quantity) { setErr('Sab fields zaroori hain'); return; }
    setSaving(true);
    try {
      if (editId) await updateDoc(doc(db,'stock',editId), { name:name.trim(), price:+price, unit, quantity:+quantity });
      else        await addDoc(collection(db,'stock'), { name:name.trim(), price:+price, unit, quantity:+quantity });
      cancel();
    } catch { setErr('Error aaya, dobara try karo'); }
    setSaving(false);
  };
  const handleDelete = async id => { if (!window.confirm('Delete karein?')) return; await deleteDoc(doc(db,'stock',id)); };
  const UNITS = ['kg','g','250g','500g','litre','500ml','packet','dozen','piece','box','bag','bottle','bundle'];
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ margin:0, fontWeight:900, fontSize:18, color:C.dark }}>Stock Management</h2>
        <button style={mkBtn('primary')} onClick={openAdd}>+ Add Karo</button>
      </div>
      {showForm && (
        <div style={{ ...mkCard, marginBottom:16, borderColor:C.primary, borderWidth:2 }}>
          <h3 style={{ margin:'0 0 14px', fontWeight:800, color:C.dark }}>{editId?'✏️ Edit':'➕ Naya Product'}</h3>
          {err && <div style={{ color:C.danger, fontSize:13, fontWeight:700, marginBottom:10 }}>{err}</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div><label style={lbl}>Product Ka Naam</label><input style={inp} placeholder="Basmati Rice..." value={f.name||''} onChange={e=>set('name',e.target.value)} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={lbl}>Price (₹)</label><input style={inp} type="number" placeholder="85" value={f.price||''} onChange={e=>set('price',e.target.value)} /></div>
              <div><label style={lbl}>Unit</label>
                <select style={inp} value={f.unit||''} onChange={e=>set('unit',e.target.value)}>
                  <option value="">Select</option>
                  {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div><label style={lbl}>Stock Quantity</label><input style={inp} type="number" placeholder="100" value={f.quantity||''} onChange={e=>set('quantity',e.target.value)} /></div>
            <div style={{ display:'flex', gap:10 }}>
              <button style={{ ...mkBtn('outline'), flex:1 }} onClick={cancel}>Cancel</button>
              <button style={{ ...mkBtn('primary'), flex:2, opacity:saving?0.7:1 }} onClick={handleSave} disabled={saving}>{saving?'Saving...':editId?'Update ✓':'Add Karo ✓'}</button>
            </div>
          </div>
        </div>
      )}
      {stock.length===0
        ? <div style={{ textAlign:'center', padding:48, color:C.muted }}><div style={{ fontSize:48 }}>📦</div><p style={{ fontWeight:700 }}>Koi stock nahi. Add karo.</p></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {stock.map(p => (
              <div key={p.id} style={{ ...mkCard, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px' }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>{p.name}</div>
                  <div style={{ fontSize:13, color:C.muted, marginTop:3 }}>{fmt(p.price)}/{p.unit} <span style={{ marginLeft:8, fontWeight:700, color:p.quantity<10?C.danger:C.primary }}>· Stock: {p.quantity} {p.unit}</span></div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>openEdit(p)} style={{ ...mkBtn('outline'), padding:'6px 12px', fontSize:13 }}>Edit</button>
                  <button onClick={()=>handleDelete(p.id)} style={{ ...mkBtn('danger'), padding:'6px 12px', fontSize:13 }}>Del</button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Salesman Panel (Bill Style) ────────────────────────────────────────────
function SalesmanPanel({ stock }) {
  const [cust,          setCust]          = useState({ name:'', mobile:'', storeName:'', address:'' });
  const [quantities,    setQuantities]    = useState({});
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount,    setPaidAmount]    = useState('');
  const [placing,       setPlacing]       = useState(false);
  const [successBill,   setSuccessBill]   = useState(null);
  const [err,           setErr]           = useState('');

  const setCustField = (k, v) => { setCust(p => ({...p, [k]:v})); setErr(''); };
  const setQty = (id, val) => {
    const n = val==='' ? '' : Math.max(0, parseInt(val)||0);
    setQuantities(p => ({...p, [id]: n}));
  };

  const orderItems = stock.filter(p => quantities[p.id] > 0).map(p => ({
    productId: p.id, name: p.name, price: p.price, unit: p.unit,
    quantity: +quantities[p.id], subtotal: p.price * +quantities[p.id],
  }));
  const total    = orderItems.reduce((s,i) => s + i.subtotal, 0);
  const paid     = parseFloat(paidAmount) || 0;
  const balance  = Math.max(0, total - paid);
  const overpaid = paid > total ? paid - total : 0;

  const resetForm = () => {
    setCust({ name:'', mobile:'', storeName:'', address:'' });
    setQuantities({}); setPaymentMethod('cash'); setPaidAmount(''); setErr('');
  };

  const placeBill = async () => {
    if (!cust.name.trim()) { setErr('Customer ka naam zaroori hai'); return; }
    if (!orderItems.length) { setErr('Koi bhi product select nahi kiya'); return; }
    setPlacing(true);
    try {
      const bn = billNo();
      await addDoc(collection(db, 'orders'), {
        billNumber:      bn,
        customerId:      null,
        customerName:    cust.name.trim(),
        customerMobile:  cust.mobile.trim(),
        customerStore:   cust.storeName.trim(),
        customerAddress: cust.address.trim(),
        items:           orderItems,
        total,
        paidAmount:      paid,
        balance,
        paymentMethod,
        status:          'confirmed',
        placedBy:        'salesman',
        placedAt:        now(),
        confirmedAt:     now(),
        deliveryDate:    null,
        deliveredAt:     null,
      });
      setSuccessBill({ billNumber:bn, customerName:cust.name, customerStore:cust.storeName, items:orderItems, total, paid, balance, paymentMethod });
      resetForm();
    } catch { setErr('Error aaya, dobara try karo'); }
    setPlacing(false);
  };

  // Bill Preview Modal
  if (successBill) return (
    <div style={{ textAlign:'center' }}>
      <div style={{ ...mkCard, maxWidth:400, margin:'0 auto', borderColor:C.primary, borderWidth:2 }}>
        <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
        <h3 style={{ fontWeight:900, color:C.dark, margin:'0 0 4px' }}>Bill Save Ho Gaya!</h3>
        <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Bill No: #{successBill.billNumber}</div>
        <div style={{ textAlign:'left', background:C.bg, borderRadius:12, padding:14, marginBottom:14 }}>
          <div style={{ fontWeight:800 }}>{successBill.customerStore || successBill.customerName}</div>
          <div style={{ fontSize:13, color:C.muted }}>{successBill.customerName}</div>
          <div style={{ borderTop:`1px dashed ${C.border}`, margin:'10px 0' }} />
          {successBill.items.map((it,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0' }}>
              <span>{it.name} × {it.quantity} {it.unit}</span>
              <span style={{ fontWeight:700 }}>{fmt(it.subtotal)}</span>
            </div>
          ))}
          <div style={{ borderTop:`1px dashed ${C.border}`, margin:'10px 0' }} />
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:16 }}><span>Total</span><span>{fmt(successBill.total)}</span></div>
          {successBill.paid > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:C.primary, fontWeight:700 }}><span>💵 Diya</span><span>{fmt(successBill.paid)}</span></div>}
          {successBill.balance > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:C.danger, fontWeight:700 }}><span>⚠️ Baaki</span><span>{fmt(successBill.balance)}</span></div>}
        </div>
        <div style={{ marginBottom:16 }}><PayBadge method={successBill.paymentMethod} /></div>
        <button style={{ ...mkBtn('primary'), width:'100%', padding:13 }} onClick={() => setSuccessBill(null)}>
          + Naya Bill Banao
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:C.light, borderRadius:14 }}>
        <span style={{ fontSize:28 }}>🧾</span>
        <div><div style={{ fontWeight:900, color:C.dark }}>Salesman — Bill Banao</div>
          <div style={{ fontSize:12, color:C.muted }}>Customer details bharo, products select karo, bill save karo</div>
        </div>
      </div>

      {err && <div style={{ background:C.dangerLight, color:C.danger, padding:'10px 14px', borderRadius:10, fontSize:13, fontWeight:700 }}>{err}</div>}

      {/* ── Customer Details ── */}
      <div style={mkCard}>
        <h3 style={{ margin:'0 0 14px', fontWeight:800, color:C.dark, fontSize:15 }}>👤 Customer Ki Details</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={lbl}>Naam *</label>
              <input style={inp} placeholder="Ramesh Kumar" value={cust.name} onChange={e=>setCustField('name',e.target.value)} />
            </div>
            <div><label style={lbl}>Mobile No.</label>
              <input style={inp} type="tel" placeholder="9876543210" maxLength={10} value={cust.mobile} onChange={e=>setCustField('mobile',e.target.value)} />
            </div>
          </div>
          <div><label style={lbl}>Dukan / Store ka Naam</label>
            <input style={inp} placeholder="Kumar Kirana Store" value={cust.storeName} onChange={e=>setCustField('storeName',e.target.value)} />
          </div>
          <div><label style={lbl}>Address</label>
            <textarea style={{ ...inp, resize:'none', height:60 }} placeholder="Gali, mohalla, sheher..." value={cust.address} onChange={e=>setCustField('address',e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Products ── */}
      <div style={mkCard}>
        <h3 style={{ margin:'0 0 14px', fontWeight:800, color:C.dark, fontSize:15 }}>📦 Products & Quantity</h3>
        {stock.length===0
          ? <p style={{ color:C.muted, fontWeight:600 }}>Koi stock nahi</p>
          : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {stock.map(p => {
                const q = quantities[p.id];
                const sub = (q > 0) ? p.price * q : 0;
                return (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px dashed ${C.border}` }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize:12, color:C.muted }}>{fmt(p.price)} / {p.unit}</div>
                    </div>
                    <input
                      type="number" min="0" placeholder="0"
                      value={q===undefined?'':q}
                      onChange={e => setQty(p.id, e.target.value)}
                      style={{ ...inp, width:72, textAlign:'center', fontWeight:800, fontSize:16, padding:'7px 8px' }}
                    />
                    <span style={{ fontSize:12, color:C.muted, width:36 }}>{p.unit}</span>
                    <div style={{ minWidth:70, textAlign:'right', fontWeight:800, fontSize:13, color: sub>0?C.dark:C.muted }}>
                      {sub > 0 ? fmt(sub) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </div>

      {/* ── Bill Summary ── */}
      {orderItems.length > 0 && (
        <div style={{ ...mkCard, borderColor:C.primary, borderWidth:2 }}>
          <h3 style={{ margin:'0 0 12px', fontWeight:800, color:C.dark, fontSize:15 }}>📋 Bill Summary</h3>
          {orderItems.map((it,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0', borderBottom:`1px dashed ${C.border}` }}>
              <span style={{ color:C.muted }}>{it.name} × {it.quantity} {it.unit}</span>
              <span style={{ fontWeight:700, color:C.dark }}>{fmt(it.subtotal)}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:19, color:C.dark, marginTop:10, paddingTop:10, borderTop:`2px solid ${C.border}` }}>
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        </div>
      )}

      {/* ── Payment ── */}
      <div style={mkCard}>
        <h3 style={{ margin:'0 0 12px', fontWeight:800, color:C.dark, fontSize:15 }}>💳 Payment</h3>
        
<PayToggle value={paymentMethod} onChange={setPaymentMethod} />

            {paymentMethod === 'upi' && (
              <div style={{
                marginTop: 16,
                background: '#fff',
                borderRadius: 16,
                padding: 18,
                textAlign: 'center',
                border: `2px solid ${C.upiLight}`,
                animation: 'fadeIn 0.35s ease'
              }}>
                <img
                  src={upiQR}
                  alt="UPI QR"
                  style={{
                    width: '100%',
                    maxWidth: 260,
                    borderRadius: 14,
                    marginBottom: 14
                  }}
                />

                <div style={{
                  fontWeight: 900,
                  color: C.upi,
                  fontSize: 17
                }}>
                  Q242432638@ybl
                </div>
              </div>
            )}


        {/* Partial Payment */}
        <div style={{ marginTop:14 }}>
          <label style={lbl}>Kitna Paisa Diya? (khali chhodein agar puri payment)</label>
          <input style={inp} type="number" placeholder={`Max: ${fmt(total)}`}
            value={paidAmount} onChange={e => { setPaidAmount(e.target.value); setErr(''); }} />
        </div>

        {/* Balance Summary */}
        {paidAmount !== '' && total > 0 && (
          <div style={{ marginTop:12, borderRadius:10, overflow:'hidden' }}>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px', background:C.light }}>
              <span style={{ fontWeight:700, color:C.dark }}>Total</span>
              <span style={{ fontWeight:900, color:C.dark }}>{fmt(total)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px', background:'#f0fdf4' }}>
              <span style={{ fontWeight:700, color:C.primary }}>💵 Diya Gaya</span>
              <span style={{ fontWeight:900, color:C.primary }}>{fmt(paid)}</span>
            </div>
            {balance > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', background:C.dangerLight }}>
                <span style={{ fontWeight:700, color:C.danger }}>⚠️ Baaki hai</span>
                <span style={{ fontWeight:900, color:C.danger }}>{fmt(balance)}</span>
              </div>
            )}
            {overpaid > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', background:'#fef3c7' }}>
                <span style={{ fontWeight:700, color:'#92400e' }}>↩️ Vapas karo</span>
                <span style={{ fontWeight:900, color:'#92400e' }}>{fmt(overpaid)}</span>
              </div>
            )}
            {balance===0 && overpaid===0 && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', background:C.light }}>
                <span style={{ fontWeight:700, color:C.primary }}>✅ Puri Payment</span>
                <span style={{ fontWeight:900, color:C.primary }}>Clear!</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Save Bill ── */}
      <button
        style={{ ...mkBtn('primary'), width:'100%', padding:16, fontSize:17, borderRadius:14, opacity: placing?0.7:1, boxShadow:'0 4px 16px rgba(22,163,74,0.3)' }}
        onClick={placeBill} disabled={placing}>
        {placing ? '⏳ Bill save ho raha hai...' : `🧾 Bill Save Karo · ${paymentMethod==='cash'?'💵 Cash':'📲 UPI'}${balance>0?' · Baaki: '+fmt(balance):''}`}
      </button>
    </div>
  );
}

// ── Orders Manager ─────────────────────────────────────────────────────────
function OrdersManager({ orders }) {
  const [filter,       setFilter]       = useState('pending');
  const [confirmOrder, setConfirmOrder] = useState(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [detailOrder,  setDetailOrder]  = useState(null);
  const sorted   = [...orders].sort((a,b) => new Date(b.placedAt)-new Date(a.placedAt));
  const filtered = filter==='all' ? sorted : sorted.filter(o=>o.status===filter);
  const doConfirm = async () => {
    if (!deliveryDate) { alert('Delivery date zaroori hai!'); return; }
    await updateDoc(doc(db,'orders',confirmOrder.id), { status:'confirmed', confirmedAt:now(), deliveryDate });
    setConfirmOrder(null); setDeliveryDate('');
  };
  const doDeliver = async id => updateDoc(doc(db,'orders',id), { status:'delivered', deliveredAt:now() });
  const STATUS = {
    pending:   { color:'amber', label:'⏳ Pending' },
    confirmed: { color:'green', label:'✅ Confirmed' },
    delivered: { color:'gray',  label:'🚚 Delivered' },
  };
  const stats = ['pending','confirmed','delivered'].map(s=>({ s, count:orders.filter(o=>o.status===s).length }));
  return (
    <div>
      {/* Confirm Modal */}
      {confirmOrder && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ ...mkCard, width:'100%', maxWidth:380 }}>
            <h3 style={{ margin:'0 0 6px', fontWeight:900, color:C.dark }}>✅ Order Confirm Karo</h3>
            <p style={{ margin:'0 0 16px', color:C.muted, fontSize:14 }}><strong>{confirmOrder.customerStore||confirmOrder.customerName}</strong></p>
            <label style={lbl}>Delivery Date</label>
            <input type="date" style={inp} value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button style={{ ...mkBtn('outline'), flex:1 }} onClick={()=>setConfirmOrder(null)}>Cancel</button>
              <button style={{ ...mkBtn('primary'), flex:2 }} onClick={doConfirm}>Confirm ✓</button>
            </div>
          </div>
        </div>
      )}
      {/* Detail Modal */}
      {detailOrder && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={()=>setDetailOrder(null)}>
          <div style={{ ...mkCard, width:'100%', maxWidth:440, maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div>
                {detailOrder.billNumber && <div style={{ fontSize:12, fontWeight:700, color:C.primary, marginBottom:4 }}>Bill #{detailOrder.billNumber}</div>}
                <div style={{ fontWeight:900, fontSize:17, color:C.dark }}>{detailOrder.customerStore||detailOrder.customerName}</div>
                <div style={{ fontSize:13, color:C.muted }}>{detailOrder.customerName} · 📞 {detailOrder.customerMobile}</div>
                <div style={{ fontSize:12, color:C.muted }}>📍 {detailOrder.customerAddress}</div>
               <div style={{ marginTop:6, display:'flex', gap:6 }}>
  <PayBadge method={detailOrder.paymentMethod || 'cash'} />
  {detailOrder.placedBy==='salesman' && (
    <span style={{ ...mkBadge('gray'), fontSize:10 }}>
      🧾 Salesman
    </span>
  )}
</div>
              </div>
              <button onClick={()=>setDetailOrder(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:C.muted }}>✕</button>
            </div>
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12, marginBottom:12 }}>
              {detailOrder.items.map((it,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom: i<detailOrder.items.length-1?`1px dashed ${C.border}`:'none', fontSize:14 }}>
                  <span style={{ fontWeight:600 }}>{it.name} <span style={{ color:C.muted }}>({it.quantity} {it.unit})</span></span>
                  <span style={{ fontWeight:800, color:C.dark }}>{fmt(it.subtotal)}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:18, color:C.dark, marginBottom:8 }}>
              <span>Total</span><span>{fmt(detailOrder.total)}</span>
            </div>
            {detailOrder.paidAmount > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:C.primary, fontWeight:700, marginBottom:4 }}>
                <span>💵 Diya Gaya</span><span>{fmt(detailOrder.paidAmount)}</span>
              </div>
            )}
            {detailOrder.balance > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:C.danger, fontWeight:700, padding:'8px 0' }}>
                <span>⚠️ Baaki Hai</span><span>{fmt(detailOrder.balance)}</span>
              </div>
            )}
            {detailOrder.deliveryDate && (
              <div style={{ background:C.light, color:C.dark, padding:'10px 12px', borderRadius:10, fontWeight:700, fontSize:14, marginTop:8 }}>
                🚚 Delivery: {fmtDate(detailOrder.deliveryDate+'T00:00:00')}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
        {stats.map(({s,count}) => (
          <div key={s} style={{ background:s==='pending'?C.accentLight:s==='confirmed'?C.light:'#f3f4f6', borderRadius:14, padding:'12px 8px', textAlign:'center' }}>
            <div style={{ fontSize:24, fontWeight:900, color:s==='pending'?'#92400e':s==='confirmed'?C.dark:C.muted }}>{count}</div>
            <div style={{ fontSize:12, fontWeight:700, color:s==='pending'?'#92400e':s==='confirmed'?C.dark:C.muted, textTransform:'capitalize' }}>{s}</div>
          </div>
        ))}
      </div>
      {/* Filter */}
      <div style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto', paddingBottom:2 }}>
        {['all','pending','confirmed','delivered'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{ ...mkBtn(filter===f?'primary':'outline'), padding:'6px 14px', fontSize:12, whiteSpace:'nowrap', boxShadow:'none' }}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>
      {filtered.length===0
        ? <div style={{ textAlign:'center', padding:40, color:C.muted }}><div style={{ fontSize:40 }}>📭</div><p style={{ fontWeight:700 }}>Koi order nahi</p></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {filtered.map(o => (
              <div key={o.id} style={{ ...mkCard, padding:'14px 16px', borderLeft:`4px solid ${o.status==='confirmed'?C.primary:o.status==='pending'?C.accent:C.muted}` }}>
                {o.billNumber && <div style={{ fontSize:11, fontWeight:700, color:C.primary, marginBottom:4 }}>Bill #{o.billNumber}</div>}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:15 }}>{o.customerStore||o.customerName}</div>
                    <div style={{ fontSize:13, color:C.muted }}>👤 {o.customerName} · 📞 {o.customerMobile}</div>
                    <div style={{ marginTop:4, display:'flex', gap:6 }}>
                      <PayBadge method={o.paymentMethod||'cash'} />
                      {o.placedBy==='salesman' && <span style={{ ...mkBadge('gray'), fontSize:10 }}>🧾 Salesman</span>}
                    </div>
                  </div>
                  <span style={mkBadge(STATUS[o.status].color)}>{STATUS[o.status].label}</span>
                </div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>{o.items.length} item(s) · {fmtDT(o.placedAt)}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <span style={{ fontWeight:900, color:C.dark, fontSize:17 }}>{fmt(o.total)}</span>
                    {o.balance > 0 && <span style={{ marginLeft:8, fontSize:12, color:C.danger, fontWeight:700 }}>⚠️ Baaki: {fmt(o.balance)}</span>}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>setDetailOrder(o)} style={{ ...mkBtn('outline'), padding:'6px 12px', fontSize:12, boxShadow:'none' }}>Details</button>
                    {o.status==='pending'   && <button onClick={()=>{ setConfirmOrder(o); setDeliveryDate(''); }} style={{ ...mkBtn('primary'), padding:'6px 14px', fontSize:12 }}>Confirm ✓</button>}
                    {o.status==='confirmed' && <button onClick={()=>doDeliver(o.id)} style={{ ...mkBtn('amber'), padding:'6px 14px', fontSize:12 }}>Deliver ✓</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Office Display ─────────────────────────────────────────────────────────
function OfficeDisplay({ orders }) {
  const pending   = [...orders].filter(o=>o.status==='pending').sort((a,b)=>new Date(b.placedAt)-new Date(a.placedAt));
  const confirmed = [...orders].filter(o=>o.status==='confirmed').sort((a,b)=>new Date(a.deliveryDate)-new Date(b.deliveryDate));
  const OCard = ({ o, type }) => (
    <div style={{ ...mkCard, borderLeft:`5px solid ${type==='new'?C.accent:C.primary}`, padding:'14px 16px' }}>
      {o.billNumber && <div style={{ fontSize:11, fontWeight:700, color:C.primary, marginBottom:4 }}>Bill #{o.billNumber}</div>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:15 }}>{o.customerStore||o.customerName}</div>
          <div style={{ fontSize:13, color:C.muted }}>👤 {o.customerName} · 📞 {o.customerMobile}</div>
          <div style={{ fontSize:12, color:C.muted }}>📍 {o.customerAddress}</div>
          <div style={{ marginTop:5, display:'flex', gap:6 }}>
            <PayBadge method={o.paymentMethod||'cash'} />
            {o.placedBy==='salesman' && <span style={{ background:'#f3f4f6', color:C.muted, padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:800 }}>🧾 Salesman</span>}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontWeight:900, color:C.dark, fontSize:16 }}>{fmt(o.total)}</div>
          {o.balance > 0 && <div style={{ fontSize:12, color:C.danger, fontWeight:700 }}>⚠️ Baaki: {fmt(o.balance)}</div>}
        </div>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, margin:'8px 0' }}>
        {o.items.map((it,i) => (
          <span key={i} style={{ background:C.light, color:C.dark, padding:'3px 9px', borderRadius:7, fontSize:12, fontWeight:700 }}>
            {it.name} × {it.quantity} {it.unit}
          </span>
        ))}
      </div>
      {type==='confirmed' && o.deliveryDate && (
        <div style={{ marginTop:8, background:C.light, color:C.dark, padding:'7px 12px', borderRadius:8, fontWeight:800, fontSize:13 }}>
          📅 Delivery: {fmtDate(o.deliveryDate+'T00:00:00')}
        </div>
      )}
      <div style={{ marginTop:6, fontSize:11, color:C.muted }}>Order: {fmtDT(o.placedAt)}</div>
    </div>
  );
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:'12px 16px', background:C.light, borderRadius:14 }}>
        <span style={{ fontSize:28 }}>🖥️</span>
        <div><div style={{ fontWeight:900, color:C.dark }}>Office Display</div><div style={{ fontSize:12, color:C.muted }}>Dispatch team ke liye</div></div>
      </div>
      <h3 style={{ fontWeight:800, color:'#92400e', margin:'0 0 10px', display:'flex', alignItems:'center', gap:6 }}>
        ⏳ Naye Orders <span style={{ background:C.accentLight, color:'#92400e', padding:'2px 10px', borderRadius:20, fontSize:13 }}>{pending.length}</span>
      </h3>
      {pending.length===0 ? <p style={{ color:C.muted, fontSize:14, marginBottom:20, fontWeight:600 }}>Koi naya order nahi</p>
        : <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>{pending.map(o=><OCard key={o.id} o={o} type="new"/>)}</div>}
      <h3 style={{ fontWeight:800, color:C.dark, margin:'0 0 10px', display:'flex', alignItems:'center', gap:6 }}>
        ✅ Confirmed <span style={{ background:C.light, color:C.dark, padding:'2px 10px', borderRadius:20, fontSize:13 }}>{confirmed.length}</span>
      </h3>
      {confirmed.length===0 ? <p style={{ color:C.muted, fontSize:14, fontWeight:600 }}>Koi confirmed nahi</p>
        : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{confirmed.map(o=><OCard key={o.id} o={o} type="confirmed"/>)}</div>}
    </div>
  );
}

// ── Customer Page ──────────────────────────────────────────────────────────
function CustomerPage({ user, stock, orders, cart, setCart, onLogout }) {
  const [view,          setView]          = useState('shop');
  const [showCart,      setShowCart]      = useState(false);
  const [justOrdered,   setJustOrdered]   = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const myOrders  = [...orders].filter(o=>o.customerId===user.id).sort((a,b)=>new Date(b.placedAt)-new Date(a.placedAt));
  const newNotifs = myOrders.filter(o=>o.status==='confirmed').length;
  const cartTotal = cart.reduce((s,i)=>s+i.subtotal, 0);
  const cartCount = cart.reduce((s,i)=>s+i.quantity, 0);

  const getQty = pid => cart.find(i=>i.productId===pid)?.quantity||0;
  const setQty = (p, qty) => {
    setCart(prev => {
      if (qty<=0) return prev.filter(i=>i.productId!==p.id);
      const ex = prev.find(i=>i.productId===p.id);
      if (ex) return prev.map(i=>i.productId===p.id?{...i,quantity:qty,subtotal:qty*p.price}:i);
      return [...prev, { productId:p.id, name:p.name, price:p.price, unit:p.unit, quantity:qty, subtotal:qty*p.price }];
    });
  };

  const placeOrder = async () => {
    if (!cart.length) return;
    await addDoc(collection(db,'orders'), {
      customerId:user.id, customerName:user.name, customerStore:user.storeName,
      customerAddress:user.address, customerMobile:user.mobile,
      items:cart, total:cartTotal, status:'pending',
      paymentMethod, placedBy:'customer', paidAmount:0, balance:cartTotal,
      placedAt:now(), confirmedAt:null, deliveryDate:null, deliveredAt:null,
    });
    setCart([]); setShowCart(false); setJustOrdered(true); setPaymentMethod('cash');
    setTimeout(()=>setJustOrdered(false), 4000);
    setView('myorders');
  };

  const STATUS = {
    pending:   { color:'amber', label:'⏳ Pending' },
    confirmed: { color:'green', label:'✅ Confirm ho gaya!' },
    delivered: { color:'gray',  label:'🚚 Deliver ho gaya' },
  };

  return (
    <div style={{ maxWidth:620, margin:'0 auto', minHeight:'100vh', paddingBottom:90 }}>
      <div style={{ background:`linear-gradient(135deg,${C.dark},${C.primary})`, padding:'16px 16px 0', color:'#fff' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:700, margin:0 }}>👋 {user.storeName}</h1>
            <p style={{ margin:'2px 0 0', opacity:0.75, fontSize:12, fontWeight:600 }}>{user.name} · {user.mobile}</p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {view==='shop' && (
              <button onClick={()=>setShowCart(true)} style={{ position:'relative', background:'rgba(255,255,255,0.18)', border:'1.5px solid rgba(255,255,255,0.3)', color:'#fff', padding:'8px 14px', borderRadius:10, cursor:'pointer', fontWeight:800, fontSize:18, fontFamily:'inherit' }}>
                🛒
                {cartCount>0 && <span style={{ position:'absolute', top:-5, right:-5, background:'#ef4444', color:'#fff', borderRadius:'50%', width:19, height:19, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900 }}>{cartCount}</span>}
              </button>
            )}
            <button onClick={onLogout} style={{ background:'rgba(255,255,255,0.18)', border:'1.5px solid rgba(255,255,255,0.3)', color:'#fff', padding:'8px 12px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:12, fontFamily:'inherit' }}>Logout</button>
          </div>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {[{id:'shop',label:'🏪 Shopping'},{id:'myorders',label:'📦 Mere Orders'}].map(t=>(
            <button key={t.id} onClick={()=>setView(t.id)}
              style={{ flex:1, padding:'10px 8px', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:view===t.id?800:500, fontSize:13, background:view===t.id?'#fff':'transparent', color:view===t.id?C.dark:'rgba(255,255,255,0.8)', borderRadius:'10px 10px 0 0', transition:'all 0.18s' }}>
              {t.label}
              {t.id==='myorders' && newNotifs>0 && <span style={{ marginLeft:4, background:'#ef4444', color:'#fff', borderRadius:20, padding:'1px 7px', fontSize:10, fontWeight:900 }}>{newNotifs}</span>}
            </button>
          ))}
        </div>
      </div>

      {justOrdered && (
        <div style={{ background:C.light, borderBottom:`2px solid ${C.primary}`, padding:'12px 18px', fontWeight:800, color:C.dark, fontSize:14 }}>
          🎉 Order place ho gaya! Owner confirm karte hi notification milega.
        </div>
      )}

      {/* Cart */}
      {showCart && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ ...mkCard, width:'100%', maxWidth:620, maxHeight:'92vh', overflowY:'auto', borderRadius:'20px 20px 0 0', padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0, fontWeight:900, color:C.dark }}>🛒 Aapka Cart</h3>
              <button onClick={()=>setShowCart(false)} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', fontSize:18 }}>✕</button>
            </div>
            {cart.length===0
              ? <div style={{ textAlign:'center', padding:'32px 0', color:C.muted }}><div style={{ fontSize:44 }}>🛒</div><p style={{ fontWeight:700 }}>Cart khali hai</p></div>
              : <>
                  {cart.map((item,i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px dashed ${C.border}` }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:14 }}>{item.name}</div>
                        <div style={{ fontSize:12, color:C.muted }}>{fmt(item.price)}/{item.unit} × {item.quantity}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontWeight:900, color:C.dark }}>{fmt(item.subtotal)}</span>
                        <button onClick={()=>setQty({id:item.productId,name:item.name,price:item.price,unit:item.unit},0)} style={{ background:C.dangerLight, color:C.danger, border:'none', borderRadius:7, width:28, height:28, cursor:'pointer', fontSize:16 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ margin:'16px 0 8px' }}>
                    <div style={{ fontWeight:800, color:C.dark, fontSize:14, marginBottom:10 }}>💳 Payment Method</div>
                    <PayToggle value={paymentMethod} onChange={setPaymentMethod} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 0', fontWeight:900, fontSize:19, color:C.dark }}>
                    <span>Total</span><span>{fmt(cartTotal)}</span>
                  </div>
                  <button style={{ ...mkBtn('primary'), width:'100%', padding:14, fontSize:16 }} onClick={placeOrder}>
                    ✅ Order Place Karo · {paymentMethod==='cash'?'💵 Cash':'📲 UPI'}
                  </button>
                </>
            }
          </div>
        </div>
      )}

      <div style={{ padding:16 }}>
        {view==='shop' && (
          <>
            <h2 style={{ margin:'0 0 16px', fontWeight:900, fontSize:18, color:C.dark }}>Available Products</h2>
            {stock.length===0
              ? <div style={{ textAlign:'center', padding:48, color:C.muted }}><div style={{ fontSize:48 }}>📦</div><p style={{ fontWeight:700 }}>Koi product nahi abhi</p></div>
              : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {stock.map(p => {
                    const qty = getQty(p.id);
                    return (
                      <div key={p.id} style={{ ...mkCard, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 16px' }}>
                        <div>
                          <div style={{ fontWeight:800, fontSize:15 }}>{p.name}</div>
                          <div style={{ fontSize:13, color:C.muted, marginTop:3, fontWeight:600 }}>{fmt(p.price)} / {p.unit}</div>
                        </div>
                        {qty===0
                          ? <button onClick={()=>setQty(p,1)} style={{ ...mkBtn('primary'), padding:'8px 18px', fontSize:14 }}>+ Add</button>
                          : <div style={{ display:'flex', alignItems:'center', gap:6, background:C.light, borderRadius:12, padding:'4px 6px' }}>
                              <button onClick={()=>setQty(p,qty-1)} style={{ background:'#fff', border:'none', borderRadius:8, width:32, height:32, cursor:'pointer', fontWeight:900, fontSize:20, color:C.dark }}>−</button>
                              <span style={{ fontWeight:900, minWidth:26, textAlign:'center', color:C.dark, fontSize:16 }}>{qty}</span>
                              <button onClick={()=>setQty(p,qty+1)} style={{ background:C.primary, border:'none', borderRadius:8, width:32, height:32, cursor:'pointer', fontWeight:900, fontSize:20, color:'#fff' }}>+</button>
                            </div>
                        }
                      </div>
                    );
                  })}
                </div>
            }
          </>
        )}

        {view==='myorders' && (
          <>
            <h2 style={{ margin:'0 0 16px', fontWeight:900, fontSize:18, color:C.dark }}>Mere Orders</h2>
            {myOrders.length===0
              ? <div style={{ textAlign:'center', padding:48, color:C.muted }}><div style={{ fontSize:48 }}>📭</div><p style={{ fontWeight:700 }}>Koi order nahi abhi tak</p></div>
              : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {myOrders.map(o => (
                    <div key={o.id} style={{ ...mkCard, borderLeft:`5px solid ${o.status==='confirmed'?C.primary:o.status==='pending'?C.accent:C.muted}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                        <div>
                          <div style={{ fontWeight:800, fontSize:15, color:C.dark }}>{o.items.length} item(s) · {fmt(o.total)}</div>
                          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>🕐 {fmtDT(o.placedAt)}</div>
                          <div style={{ marginTop:4 }}><PayBadge method={o.paymentMethod||'cash'} /></div>
                        </div>
                        <span style={mkBadge(STATUS[o.status].color)}>{STATUS[o.status].label}</span>
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                        {o.items.map((it,i) => <span key={i} style={{ background:'#f3f4f6', color:C.muted, padding:'3px 9px', borderRadius:7, fontSize:12, fontWeight:600 }}>{it.name} ×{it.quantity}</span>)}
                      </div>
                      {o.status==='confirmed' && o.deliveryDate && (
                        <div style={{ background:C.light, color:C.dark, padding:'12px 14px', borderRadius:12, fontWeight:800, fontSize:14 }}>
                          🎉 Order confirm ho gaya!
                          <div style={{ marginTop:4, fontSize:15, color:C.primary }}>📅 Delivery: {fmtDate(o.deliveryDate+'T00:00:00')}</div>
                        </div>
                      )}
                      {o.status==='pending' && <div style={{ background:C.accentLight, color:'#92400e', padding:'9px 12px', borderRadius:10, fontSize:13, fontWeight:700 }}>⏳ Owner review kar raha hai...</div>}
                      {o.status==='delivered' && <div style={{ background:'#f3f4f6', color:C.muted, padding:'9px 12px', borderRadius:10, fontSize:13, fontWeight:700 }}>✅ Deliver ho gaya — {fmtDate(o.deliveredAt)}</div>}
                    </div>
                  ))}
                </div>
            }
          </>
        )}
      </div>

      {view==='shop' && cartCount>0 && (
        <div style={{ position:'fixed', bottom:20, left:0, right:0, display:'flex', justifyContent:'center', zIndex:50 }}>
          <button onClick={()=>setShowCart(true)} style={{ ...mkBtn('primary'), padding:'14px 28px', fontSize:15, borderRadius:18, boxShadow:'0 6px 24px rgba(22,163,74,0.35)', display:'flex', alignItems:'center', gap:10 }}>
            <span>🛒 Cart Dekhein</span>
            <span style={{ background:'rgba(255,255,255,0.25)', padding:'3px 10px', borderRadius:20, fontWeight:900 }}>{cartCount} · {fmt(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
