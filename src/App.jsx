import { useState, useEffect } from "react";
import {
  collection, doc, onSnapshot,
  addDoc, updateDoc, deleteDoc, runTransaction,
} from "firebase/firestore";
import upiQR from "./assets/upi-qr.jpg";
import { db } from "./firebase";

// â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fmt     = n  => `â‚¹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = s  => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'â€”';
const fmtDT   = s  => s ? new Date(s).toLocaleString('en-IN',     { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'â€”';
const now     = () => new Date().toISOString();
const billNo  = () => 'VE-' + Date.now().toString().slice(-5);
const isValidIndianMobile = (num) => /^[6-9]\d{9}$/.test(num);
const getOrderItems = order => Array.isArray(order?.items) ? order.items : [];

// â”€â”€ Theme â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Payment Toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PayToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[
        { id: 'cash', label: 'ðŸ’µ Cash', color: C.primary, bg: C.light },
        { id: 'upi',  label: 'ðŸ“² UPI',  color: C.upi,    bg: C.upiLight },
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

// â”€â”€ PayBadge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PayBadge = ({ method }) => (
  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
    background: method === 'upi' ? C.upiLight : C.light,
    color: method === 'upi' ? C.upi : C.dark,
    border: `1px solid ${method === 'upi' ? '#ddd6fe' : C.border}` }}>
    {method === 'upi' ? 'ðŸ“² UPI' : 'ðŸ’µ Cash'}
  </span>
);

// â”€â”€ App Root â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function App() {
  const [page,      setPage]      = useState('loading');
  const [user,      setUser]      = useState(null);
  const [stock,     setStock]     = useState([]);
  const [orders,    setOrders]    = useState([]);
  const [customers, setCustomers] = useState([]);

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
    if (sess) {
      try {
        const u = JSON.parse(sess);
        if (u?.type === 'owner') { setUser(u); setPage('owner'); }
        else { localStorage.removeItem('groc_session'); setPage('auth'); }
      } catch {
        localStorage.removeItem('groc_session'); setPage('auth');
      }
    } else setPage('auth');
    const u1 = onSnapshot(collection(db, 'stock'),     s => setStock(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'orders'),    s => setOrders(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, 'customers'), s => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); };
  }, []);

  const doLogin  = u => { const owner = { type:'owner', name:u.name || 'Admin' }; setUser(owner); localStorage.setItem('groc_session', JSON.stringify(owner)); setPage('owner'); };
  const doLogout = () => { setUser(null); localStorage.removeItem('groc_session'); setPage('auth'); };
  const wrap = { fontFamily: "'Nunito', sans-serif", minHeight: '100vh', background: C.bg, color: C.text };

  if (page === 'loading') return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 60 }}>ðŸª</div>
        <p style={{ fontWeight: 800, color: C.primary, marginTop: 12 }}>Loading...</p>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      
      {page === 'auth'     && <OwnerLoginPage onLogin={doLogin} />}
      {page === 'owner'    && <OwnerPage stock={stock} orders={orders} customers={customers} onLogout={doLogout} />}
    </div>
  );
}

// â”€â”€ Auth Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function OwnerLoginPage({ onLogin }) {
  const [f, setF] = useState({ username:'', password:'' });
  const [err, setErr] = useState('');

  const set = (k, v) => {
    setF(p => ({ ...p, [k]: v }));
    setErr('');
  };

  const handleOwnerLogin = () => {
    if (f.username === 'admin' && f.password === 'grocery123') {
      onLogin({ type:'owner', name:'Admin' });
    } else {
      setErr('Galat username ya password');
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, background:'linear-gradient(160deg,#dcfce7 0%,#f0fdf4 55%,#ecfdf5 100%)' }}>
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <div style={{ width:72, height:72, background:`linear-gradient(135deg,${C.dark},${C.primary})`, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, margin:'0 auto 12px', boxShadow:'0 8px 24px rgba(22,163,74,0.25)', color:'#fff', fontWeight:900 }}>VE</div>
        <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:28, fontWeight:700, color:C.dark, margin:0 }}>Vijay Enterprises</h1>
        <p style={{ color:C.muted, marginTop:4, fontSize:13, fontWeight:600 }}>Owner Login</p>
      </div>

      <div style={{ ...mkCard, width:'100%', maxWidth:380 }}>
        <div style={{ padding:'10px 12px', background:C.light, borderRadius:10, fontSize:12, color:C.dark, fontWeight:800, marginBottom:16 }}>Sirf owner ke liye</div>
        {err && <div style={{ background:C.dangerLight, color:C.danger, padding:'10px 14px', borderRadius:10, marginBottom:14, fontSize:13, fontWeight:700 }}>{err}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div><label style={lbl}>Username</label><input style={inp} placeholder="admin" value={f.username||''} onChange={e=>set('username',e.target.value)} onKeyDown={e=>{ if (e.key === 'Enter') handleOwnerLogin(); }} /></div>
          <div><label style={lbl}>Password</label><input style={inp} type="password" placeholder="Password" value={f.password||''} onChange={e=>set('password',e.target.value)} onKeyDown={e=>{ if (e.key === 'Enter') handleOwnerLogin(); }} /></div>
          <button style={{ ...mkBtn('primary'), width:'100%', padding:13, fontSize:15 }} onClick={handleOwnerLogin}>Owner Login</button>
        </div>
      </div>
    </div>
  );
}

function OwnerPage({ stock, orders, customers, onLogout }) {
  const [tab, setTab] = useState('orders');
  const pendingCount  = orders.filter(o => o.status === 'pending').length;
  const TABS = [
    { id:'orders',   label:'ðŸ“¦ Orders',   badge: pendingCount },
    { id:'stock',    label:'ðŸª Stock' },
    { id:'salesman', label:'ðŸ§¾ Salesman' },
    { id:'office',   label:'ðŸ–¥ï¸ Office' },
  ];
  return (
    <div style={{ maxWidth:640, margin:'0 auto', minHeight:'100vh', paddingBottom:32 }}>
      <div style={{ background:`linear-gradient(135deg,${C.dark},${C.primary})`, padding:'20px 20px 0', color:'#fff' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, margin:0 }}>Owner Dashboard</h1>
            <p style={{ margin:'3px 0 0', opacity:0.75, fontSize:12, fontWeight:600 }}>Vijay Enterprises Â· Business Control</p>
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
        {tab==='salesman' && <SalesmanBillingPanel stock={stock} customers={customers} />}
        {tab==='office'   && <OfficePage orders={orders} customers={customers} />}
      </div>
    </div>
  );
}

// â”€â”€ Stock Manager â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          <h3 style={{ margin:'0 0 14px', fontWeight:800, color:C.dark }}>{editId?'âœï¸ Edit':'âž• Naya Product'}</h3>
          {err && <div style={{ color:C.danger, fontSize:13, fontWeight:700, marginBottom:10 }}>{err}</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div><label style={lbl}>Product Ka Naam</label><input style={inp} placeholder="Basmati Rice..." value={f.name||''} onChange={e=>set('name',e.target.value)} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={lbl}>Price (â‚¹)</label><input style={inp} type="number" placeholder="85" value={f.price||''} onChange={e=>set('price',e.target.value)} /></div>
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
              <button style={{ ...mkBtn('primary'), flex:2, opacity:saving?0.7:1 }} onClick={handleSave} disabled={saving}>{saving?'Saving...':editId?'Update âœ“':'Add Karo âœ“'}</button>
            </div>
          </div>
        </div>
      )}
      {stock.length===0
        ? <div style={{ textAlign:'center', padding:48, color:C.muted }}><div style={{ fontSize:48 }}>ðŸ“¦</div><p style={{ fontWeight:700 }}>Koi stock nahi. Add karo.</p></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {stock.map(p => (
              <div key={p.id} style={{ ...mkCard, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px' }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>{p.name}</div>
                  <div style={{ fontSize:13, color:C.muted, marginTop:3 }}>{fmt(p.price)}/{p.unit} <span style={{ marginLeft:8, fontWeight:700, color:p.quantity<10?C.danger:C.primary }}>Â· Stock: {p.quantity} {p.unit}</span></div>
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

// â”€â”€ Salesman Panel (Bill Style) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SalesmanBillingPanel({ stock, customers }) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [placing, setPlacing] = useState(false);
  const [successBill, setSuccessBill] = useState(null);
  const [err, setErr] = useState('');
  const [draftBillNumber, setDraftBillNumber] = useState(billNo());

  const sortedCustomers = [...customers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const searchNeedle = customerSearch.trim().toLowerCase();
  const matchedCustomers = sortedCustomers
    .filter(c => {
      if (!searchNeedle) return true;
      return [c.name, c.storeName, c.mobile, c.address].some(v => String(v || '').toLowerCase().includes(searchNeedle));
    })
    .slice(0, 10);

  const selectCustomer = customer => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name || customer.storeName || customer.mobile || '');
    setDraftBillNumber(billNo());
    setErr('');
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setQuantities({});
    setPaidAmount('');
    setErr('');
  };

  const setQty = (product, val) => {
    if (val === '') {
      setQuantities(p => ({ ...p, [product.id]: '' }));
      return;
    }
    const available = Math.max(0, Number(product.quantity || 0));
    const requested = Math.max(0, parseInt(val, 10) || 0);
    setQuantities(p => ({ ...p, [product.id]: Math.min(requested, available) }));
    setErr('');
  };

  const orderItems = stock.filter(p => Number(quantities[p.id]) > 0).map(p => ({
    productId: p.id,
    name: p.name,
    price: Number(p.price || 0),
    unit: p.unit,
    quantity: Number(quantities[p.id]),
    subtotal: Number(p.price || 0) * Number(quantities[p.id]),
  }));
  const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const paid = paidAmount === '' ? total : (parseFloat(paidAmount) || 0);
  const balance = Math.max(0, total - paid);
  const overpaid = paid > total ? paid - total : 0;

  const resetBill = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setQuantities({});
    setPaymentMethod('cash');
    setPaidAmount('');
    setDraftBillNumber(billNo());
    setErr('');
  };

  const placeBill = async () => {
    if (!selectedCustomer) { setErr('Customer select karo'); return; }
    if (!orderItems.length) { setErr('Bill mein kam se kam ek item add karo'); return; }

    setPlacing(true);
    setErr('');
    try {
      const bn = draftBillNumber || billNo();
      const orderRef = doc(collection(db, 'orders'));
      const customerName = (selectedCustomer.name || '').trim();
      const customerStore = (selectedCustomer.storeName || '').trim();
      const customerMobile = (selectedCustomer.mobile || '').trim();
      const customerAddress = (selectedCustomer.address || '').trim();

      await runTransaction(db, async transaction => {
        const stockRefs = orderItems.map(item => doc(db, 'stock', item.productId));
        const stockDocs = [];
        for (const ref of stockRefs) stockDocs.push(await transaction.get(ref));

        stockDocs.forEach((snap, index) => {
          const item = orderItems[index];
          if (!snap.exists()) throw new Error(`${item.name} stock mein nahi mila`);
          const available = Number(snap.data().quantity || 0);
          if (available < item.quantity) throw new Error(`${item.name} ka stock sirf ${available} ${item.unit} hai`);
        });

        transaction.set(orderRef, {
          billNumber: bn,
          orderType: 'bill',
          customerId: selectedCustomer.id,
          customerName,
          customerMobile,
          customerStore,
          customerAddress,
          items: orderItems,
          total,
          paidAmount: paid,
          balance,
          paymentMethod,
          status: 'confirmed',
          placedBy: 'salesman',
          placedAt: now(),
          confirmedAt: now(),
          deliveryDate: null,
          deliveredAt: null,
        });

        stockDocs.forEach((snap, index) => {
          const currentQty = Number(snap.data().quantity || 0);
          transaction.update(stockRefs[index], { quantity: currentQty - orderItems[index].quantity });
        });
      });

      setSuccessBill({ billNumber:bn, customerName, customerStore, items:orderItems, total, paid, balance, paymentMethod });
      resetBill();
    } catch (e) {
      setErr(e?.message || 'Bill save nahi hua, dobara try karo');
    } finally {
      setPlacing(false);
    }
  };

  if (successBill) return (
    <div style={{ textAlign:'center' }}>
      <div style={{ ...mkCard, maxWidth:420, margin:'0 auto', borderColor:C.primary, borderWidth:2 }}>
        <div style={{ width:48, height:48, borderRadius:'50%', background:C.light, color:C.primary, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px', fontWeight:900, fontSize:24 }}>OK</div>
        <h3 style={{ fontWeight:900, color:C.dark, margin:'0 0 4px' }}>Bill Save Ho Gaya</h3>
        <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Bill No: #{successBill.billNumber}</div>
        <div style={{ textAlign:'left', background:C.bg, borderRadius:12, padding:14, marginBottom:14 }}>
          <div style={{ fontWeight:900 }}>{successBill.customerStore || successBill.customerName}</div>
          <div style={{ fontSize:13, color:C.muted }}>{successBill.customerName}</div>
          <div style={{ borderTop:`1px dashed ${C.border}`, margin:'10px 0' }} />
          {successBill.items.map((it, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0' }}>
              <span>{it.name} x {it.quantity} {it.unit}</span>
              <span style={{ fontWeight:700 }}>{fmt(it.subtotal)}</span>
            </div>
          ))}
          <div style={{ borderTop:`1px dashed ${C.border}`, margin:'10px 0' }} />
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:16 }}><span>Total</span><span>{fmt(successBill.total)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:C.primary, fontWeight:700 }}><span>Paid</span><span>{fmt(successBill.paid)}</span></div>
          {successBill.balance > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:C.danger, fontWeight:700 }}><span>Balance</span><span>{fmt(successBill.balance)}</span></div>}
        </div>
        <div style={{ marginBottom:16 }}><PayBadge method={successBill.paymentMethod} /></div>
        <button style={{ ...mkBtn('primary'), width:'100%', padding:13 }} onClick={() => setSuccessBill(null)}>Naya Bill Banao</button>
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:C.light, borderRadius:14 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:C.primary, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900 }}>B</div>
        <div><div style={{ fontWeight:900, color:C.dark }}>Salesman Bill</div>
          <div style={{ fontSize:12, color:C.muted }}>Saved customer select karo, inventory se item add karo</div>
        </div>
      </div>

      {err && <div style={{ background:C.dangerLight, color:C.danger, padding:'10px 14px', borderRadius:10, fontSize:13, fontWeight:700 }}>{err}</div>}

      <div style={mkCard}>
        <h3 style={{ margin:'0 0 12px', fontWeight:800, color:C.dark, fontSize:15 }}>Customer Search</h3>
        <input
          style={inp}
          placeholder="Customer naam, shop, mobile search karo"
          value={customerSearch}
          onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setErr(''); }}
        />
        {!selectedCustomer && (
          <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
            {customers.length === 0
              ? <div style={{ color:C.muted, fontSize:13, fontWeight:700, background:C.bg, borderRadius:10, padding:12 }}>Office page par customer details save karo.</div>
              : matchedCustomers.length === 0
                ? <div style={{ color:C.muted, fontSize:13, fontWeight:700, background:C.bg, borderRadius:10, padding:12 }}>Koi customer nahi mila.</div>
                : matchedCustomers.map(customer => (
                    <button key={customer.id} onClick={() => selectCustomer(customer)}
                      style={{ ...mkCard, padding:12, textAlign:'left', cursor:'pointer', boxShadow:'none', borderColor:C.border }}>
                      <div style={{ fontWeight:900, color:C.dark }}>{customer.name}</div>
                      <div style={{ fontSize:13, color:C.muted }}>{customer.storeName || 'Shop name missing'} Â· {customer.mobile || 'Mobile missing'}</div>
                      {customer.address && <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{customer.address}</div>}
                    </button>
                  ))
            }
          </div>
        )}
        {selectedCustomer && (
          <div style={{ marginTop:12, background:C.light, borderRadius:12, padding:12, display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
            <div>
              <div style={{ fontWeight:900, color:C.dark }}>{selectedCustomer.name}</div>
              <div style={{ fontSize:13, color:C.muted }}>{selectedCustomer.storeName || 'Shop name missing'} Â· {selectedCustomer.mobile || 'Mobile missing'}</div>
              {selectedCustomer.address && <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{selectedCustomer.address}</div>}
            </div>
            <button style={{ ...mkBtn('outline'), padding:'6px 10px', fontSize:12, boxShadow:'none' }} onClick={clearCustomer}>Change</button>
          </div>
        )}
      </div>

      {!selectedCustomer ? (
        <div style={{ ...mkCard, textAlign:'center', padding:32, color:C.muted, fontWeight:700 }}>
          Customer select karne ke baad bill format yahan dikhega.
        </div>
      ) : (
        <>
          <div style={mkCard}>
            <h3 style={{ margin:'0 0 14px', fontWeight:800, color:C.dark, fontSize:15 }}>Inventory Items</h3>
            {stock.length===0
              ? <p style={{ color:C.muted, fontWeight:600 }}>Koi stock nahi</p>
              : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {stock.map(p => {
                    const q = quantities[p.id];
                    const sub = (Number(q) > 0) ? Number(p.price || 0) * Number(q) : 0;
                    const available = Number(p.quantity || 0);
                    const isOut = available <= 0;
                    return (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px dashed ${C.border}`, opacity:isOut?0.55:1 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                          <div style={{ fontSize:12, color:C.muted }}>{fmt(p.price)} / {p.unit} Â· Stock: {available} {p.unit}</div>
                        </div>
                        <input
                          type="number" min="0" max={available} placeholder="0" disabled={isOut}
                          value={q===undefined?'':q}
                          onChange={e => setQty(p, e.target.value)}
                          style={{ ...inp, width:72, textAlign:'center', fontWeight:800, fontSize:16, padding:'7px 8px' }}
                        />
                        <div style={{ minWidth:76, textAlign:'right', fontWeight:800, fontSize:13, color: sub>0?C.dark:C.muted }}>
                          {sub > 0 ? fmt(sub) : isOut ? 'Out' : '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>

          <div style={{ ...mkCard, borderColor:orderItems.length?C.primary:C.border, borderWidth:orderItems.length?2:1 }}>
            <h3 style={{ margin:'0 0 12px', fontWeight:800, color:C.dark, fontSize:15 }}>Bill Format</h3>
            <div style={{ background:C.bg, borderRadius:12, padding:12, marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                <div>
                  <div style={{ fontWeight:900, color:C.dark }}>{selectedCustomer.storeName || selectedCustomer.name}</div>
                  <div style={{ fontSize:13, color:C.muted }}>{selectedCustomer.name} Â· {selectedCustomer.mobile}</div>
                </div>
                <div style={{ fontSize:12, fontWeight:800, color:C.primary }}>Bill #{draftBillNumber}</div>
              </div>
            </div>
            {orderItems.length === 0
              ? <div style={{ color:C.muted, fontSize:13, fontWeight:700 }}>Inventory se item quantity add karo.</div>
              : <>
                  {orderItems.map((it, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 0', borderBottom:`1px dashed ${C.border}` }}>
                      <span style={{ color:C.muted }}>{it.name} x {it.quantity} {it.unit}</span>
                      <span style={{ fontWeight:800, color:C.dark }}>{fmt(it.subtotal)}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:19, color:C.dark, marginTop:10, paddingTop:10, borderTop:`2px solid ${C.border}` }}>
                    <span>Total</span><span>{fmt(total)}</span>
                  </div>
                </>
            }
          </div>

          <div style={mkCard}>
            <h3 style={{ margin:'0 0 12px', fontWeight:800, color:C.dark, fontSize:15 }}>Payment</h3>
            <PayToggle value={paymentMethod} onChange={setPaymentMethod} />
            {paymentMethod === 'upi' && (
              <div style={{ marginTop:16, background:'#fff', borderRadius:16, padding:18, textAlign:'center', border:`2px solid ${C.upiLight}`, animation:'fadeIn 0.35s ease' }}>
                <img src={upiQR} alt="UPI QR" style={{ width:'100%', maxWidth:260, borderRadius:14, marginBottom:14 }} />
                <div style={{ fontWeight:900, color:C.upi, fontSize:17 }}>Q242432638@ybl</div>
              </div>
            )}
            <div style={{ marginTop:14 }}>
              <label style={lbl}>Paid Amount (blank = full payment)</label>
              <input style={inp} type="number" placeholder={total ? `Full: ${fmt(total)}` : '0'} value={paidAmount} onChange={e => { setPaidAmount(e.target.value); setErr(''); }} />
            </div>
            {orderItems.length > 0 && (
              <div style={{ marginTop:12, borderRadius:10, overflow:'hidden' }}>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px', background:C.light }}><span style={{ fontWeight:700, color:C.dark }}>Total</span><span style={{ fontWeight:900, color:C.dark }}>{fmt(total)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px', background:'#f0fdf4' }}><span style={{ fontWeight:700, color:C.primary }}>Paid</span><span style={{ fontWeight:900, color:C.primary }}>{fmt(paid)}</span></div>
                {balance > 0 && <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', background:C.dangerLight }}><span style={{ fontWeight:700, color:C.danger }}>Balance</span><span style={{ fontWeight:900, color:C.danger }}>{fmt(balance)}</span></div>}
                {overpaid > 0 && <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', background:'#fef3c7' }}><span style={{ fontWeight:700, color:'#92400e' }}>Return</span><span style={{ fontWeight:900, color:'#92400e' }}>{fmt(overpaid)}</span></div>}
              </div>
            )}
          </div>

          <button
            style={{ ...mkBtn('primary'), width:'100%', padding:16, fontSize:17, borderRadius:14, opacity: placing?0.7:1, boxShadow:'0 4px 16px rgba(22,163,74,0.3)' }}
            onClick={placeBill} disabled={placing}>
            {placing ? 'Bill save ho raha hai...' : `Bill Save Karo Â· ${paymentMethod==='cash'?'Cash':'UPI'}${balance>0?' Â· Balance: '+fmt(balance):''}`}
          </button>
        </>
      )}
    </div>
  );
}

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
    pending:   { color:'amber', label:'â³ Pending' },
    confirmed: { color:'green', label:'âœ… Confirmed' },
    delivered: { color:'gray',  label:'ðŸšš Delivered' },
  };
  const stats = ['pending','confirmed','delivered'].map(s=>({ s, count:orders.filter(o=>o.status===s).length }));
  return (
    <div>
      {/* Confirm Modal */}
      {confirmOrder && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ ...mkCard, width:'100%', maxWidth:380 }}>
            <h3 style={{ margin:'0 0 6px', fontWeight:900, color:C.dark }}>âœ… Order Confirm Karo</h3>
            <p style={{ margin:'0 0 16px', color:C.muted, fontSize:14 }}><strong>{confirmOrder.customerStore||confirmOrder.customerName}</strong></p>
            <label style={lbl}>Delivery Date</label>
            <input type="date" style={inp} value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button style={{ ...mkBtn('outline'), flex:1 }} onClick={()=>setConfirmOrder(null)}>Cancel</button>
              <button style={{ ...mkBtn('primary'), flex:2 }} onClick={doConfirm}>Confirm âœ“</button>
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
                <div style={{ fontSize:13, color:C.muted }}>{detailOrder.customerName} Â· ðŸ“ž {detailOrder.customerMobile}</div>
                <div style={{ fontSize:12, color:C.muted }}>ðŸ“ {detailOrder.customerAddress}</div>
               <div style={{ marginTop:6, display:'flex', gap:6 }}>
  <PayBadge method={detailOrder.paymentMethod || 'cash'} />
  {detailOrder.placedBy==='salesman' && (
    <span style={{ ...mkBadge('gray'), fontSize:10 }}>
      ðŸ§¾ Salesman
    </span>
  )}
</div>
              </div>
              <button onClick={()=>setDetailOrder(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:C.muted }}>âœ•</button>
            </div>
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12, marginBottom:12 }}>
              {getOrderItems(detailOrder).map((it,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom: i<getOrderItems(detailOrder).length-1?`1px dashed ${C.border}`:'none', fontSize:14 }}>
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
                <span>ðŸ’µ Diya Gaya</span><span>{fmt(detailOrder.paidAmount)}</span>
              </div>
            )}
            {detailOrder.balance > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:C.danger, fontWeight:700, padding:'8px 0' }}>
                <span>âš ï¸ Baaki Hai</span><span>{fmt(detailOrder.balance)}</span>
              </div>
            )}
            {detailOrder.deliveryDate && (
              <div style={{ background:C.light, color:C.dark, padding:'10px 12px', borderRadius:10, fontWeight:700, fontSize:14, marginTop:8 }}>
                ðŸšš Delivery: {fmtDate(detailOrder.deliveryDate+'T00:00:00')}
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
        ? <div style={{ textAlign:'center', padding:40, color:C.muted }}><div style={{ fontSize:40 }}>ðŸ“­</div><p style={{ fontWeight:700 }}>Koi order nahi</p></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {filtered.map(o => {
              const items = getOrderItems(o);
              const status = STATUS[o.status] || { color:'gray', label:o.status || 'Saved' };
              return (
              <div key={o.id} style={{ ...mkCard, padding:'14px 16px', borderLeft:`4px solid ${o.status==='confirmed'?C.primary:o.status==='pending'?C.accent:C.muted}` }}>
                {o.billNumber && <div style={{ fontSize:11, fontWeight:700, color:C.primary, marginBottom:4 }}>Bill #{o.billNumber}</div>}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:15 }}>{o.customerStore||o.customerName}</div>
                    <div style={{ fontSize:13, color:C.muted }}>ðŸ‘¤ {o.customerName} Â· ðŸ“ž {o.customerMobile}</div>
                    <div style={{ marginTop:4, display:'flex', gap:6 }}>
                      <PayBadge method={o.paymentMethod||'cash'} />
                      {o.placedBy==='salesman' && <span style={{ ...mkBadge('gray'), fontSize:10 }}>ðŸ§¾ Salesman</span>}
                    </div>
                  </div>
                  <span style={mkBadge(status.color)}>{status.label}</span>
                </div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>{items.length} item(s) Â· {fmtDT(o.placedAt)}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <span style={{ fontWeight:900, color:C.dark, fontSize:17 }}>{fmt(o.total)}</span>
                    {o.balance > 0 && <span style={{ marginLeft:8, fontSize:12, color:C.danger, fontWeight:700 }}>âš ï¸ Baaki: {fmt(o.balance)}</span>}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>setDetailOrder(o)} style={{ ...mkBtn('outline'), padding:'6px 12px', fontSize:12, boxShadow:'none' }}>Details</button>
                    {o.status==='pending'   && <button onClick={()=>{ setConfirmOrder(o); setDeliveryDate(''); }} style={{ ...mkBtn('primary'), padding:'6px 14px', fontSize:12 }}>Confirm âœ“</button>}
                    {o.status==='confirmed' && <button onClick={()=>doDeliver(o.id)} style={{ ...mkBtn('amber'), padding:'6px 14px', fontSize:12 }}>Deliver âœ“</button>}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// â”€â”€ Office Display â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function OfficePage({ orders, customers }) {
  const [f, setF] = useState({});
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [billSearch, setBillSearch] = useState('');

  const set = (k, v) => {
    setF(p => ({ ...p, [k]: v }));
    setErr('');
  };

  const resetCustomerForm = () => {
    setF({});
    setEditId(null);
    setErr('');
  };

  const editCustomer = customer => {
    setEditId(customer.id);
    setF({
      name: customer.name || '',
      storeName: customer.storeName || '',
      address: customer.address || '',
      mobile: customer.mobile || '',
    });
    setErr('');
  };

  const saveCustomer = async () => {
    const { name, storeName, address, mobile } = f;
    if (!name?.trim() || !storeName?.trim() || !address?.trim() || !mobile?.trim()) {
      setErr('Customer name, shop name, address, mobile sab zaroori hain');
      return;
    }
    if (!isValidIndianMobile(mobile.trim())) {
      setErr('Valid 10-digit mobile number daalo');
      return;
    }
    const duplicate = customers.find(c => c.mobile === mobile.trim() && c.id !== editId);
    if (duplicate) {
      setErr('Yeh mobile number already saved hai');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        storeName: storeName.trim(),
        address: address.trim(),
        mobile: mobile.trim(),
        updatedAt: now(),
      };
      if (editId) await updateDoc(doc(db, 'customers', editId), payload);
      else await addDoc(collection(db, 'customers'), { ...payload, createdAt: now() });
      resetCustomerForm();
    } catch {
      setErr('Customer save nahi hua, dobara try karo');
    } finally {
      setSaving(false);
    }
  };

  const sortedCustomers = [...customers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const sortedBills = [...orders].sort((a, b) => new Date(b.placedAt || 0) - new Date(a.placedAt || 0));
  const billNeedle = billSearch.trim().toLowerCase();
  const visibleBills = sortedBills.filter(o => {
    if (!billNeedle) return true;
    return [o.billNumber, o.customerName, o.customerStore, o.customerMobile, o.status]
      .some(v => String(v || '').toLowerCase().includes(billNeedle));
  });
  const statusInfo = status => ({
    pending: { label:'Pending', color:'amber' },
    confirmed: { label:'Confirmed', color:'green' },
    delivered: { label:'Delivered', color:'gray' },
  }[status] || { label:status || 'Saved', color:'gray' });

  const BillCard = ({ order }) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const status = statusInfo(order.status);
    return (
      <div style={{ ...mkCard, borderLeft:`5px solid ${order.status==='pending'?C.accent:order.status==='confirmed'?C.primary:C.muted}`, padding:'14px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start', marginBottom:8 }}>
          <div>
            {order.billNumber && <div style={{ fontSize:11, fontWeight:800, color:C.primary, marginBottom:4 }}>Bill #{order.billNumber}</div>}
            <div style={{ fontWeight:900, fontSize:15 }}>{order.customerStore || order.customerName || 'Customer'}</div>
            <div style={{ fontSize:13, color:C.muted }}>{order.customerName || '-'} - {order.customerMobile || '-'}</div>
            {order.customerAddress && <div style={{ fontSize:12, color:C.muted }}>{order.customerAddress}</div>}
          </div>
          <div style={{ textAlign:'right' }}>
            <span style={mkBadge(status.color)}>{status.label}</span>
            <div style={{ fontWeight:900, color:C.dark, fontSize:16, marginTop:8 }}>{fmt(order.total || 0)}</div>
            {Number(order.balance || 0) > 0 && <div style={{ fontSize:12, color:C.danger, fontWeight:700 }}>Balance: {fmt(order.balance)}</div>}
          </div>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, margin:'8px 0' }}>
          {items.map((it, i) => (
            <span key={i} style={{ background:C.light, color:C.dark, padding:'3px 9px', borderRadius:7, fontSize:12, fontWeight:700 }}>
              {it.name} x {it.quantity} {it.unit}
            </span>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', marginTop:8 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <PayBadge method={order.paymentMethod || 'cash'} />
            {order.placedBy === 'salesman' && <span style={{ background:'#f3f4f6', color:C.muted, padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:800 }}>Salesman</span>}
          </div>
          <div style={{ fontSize:11, color:C.muted }}>Saved: {fmtDT(order.placedAt)}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:C.light, borderRadius:14 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:C.primary, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900 }}>O</div>
        <div><div style={{ fontWeight:900, color:C.dark }}>Office</div><div style={{ fontSize:12, color:C.muted }}>Customers yahin save honge; Salesman search isi list se karega</div></div>
      </div>

      <div style={mkCard}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', marginBottom:14 }}>
          <h3 style={{ margin:0, fontWeight:900, color:C.dark, fontSize:16 }}>{editId ? 'Edit Customer' : 'Pre-save Customer'}</h3>
          {editId && <button style={{ ...mkBtn('outline'), padding:'6px 10px', fontSize:12, boxShadow:'none' }} onClick={resetCustomerForm}>Cancel Edit</button>}
        </div>
        {err && <div style={{ background:C.dangerLight, color:C.danger, padding:'10px 14px', borderRadius:10, marginBottom:14, fontSize:13, fontWeight:700 }}>{err}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
            <div><label style={lbl}>Customer Name</label><input style={inp} placeholder="Ramesh Kumar" value={f.name || ''} onChange={e=>set('name', e.target.value)} /></div>
            <div><label style={lbl}>Shop Name</label><input style={inp} placeholder="Kumar Kirana Store" value={f.storeName || ''} onChange={e=>set('storeName', e.target.value)} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
            <div><label style={lbl}>Mobile Number</label><input style={inp} type="tel" maxLength={10} placeholder="9876543210" value={f.mobile || ''} onChange={e=>set('mobile', e.target.value)} /></div>
            <div><label style={lbl}>Address</label><input style={inp} placeholder="Gali, mohalla, sheher" value={f.address || ''} onChange={e=>set('address', e.target.value)} /></div>
          </div>
          <button style={{ ...mkBtn('primary'), width:'100%', padding:13, opacity:saving?0.7:1 }} onClick={saveCustomer} disabled={saving}>
            {saving ? 'Saving...' : editId ? 'Update Customer' : 'Save Customer'}
          </button>
        </div>
      </div>

      <div style={mkCard}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', marginBottom:12 }}>
          <h3 style={{ margin:0, fontWeight:900, color:C.dark, fontSize:16 }}>Saved Customers</h3>
          <span style={mkBadge('green')}>{customers.length}</span>
        </div>
        {sortedCustomers.length === 0
          ? <div style={{ color:C.muted, fontWeight:700, fontSize:13 }}>Abhi koi customer saved nahi hai.</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:300, overflowY:'auto' }}>
              {sortedCustomers.map(customer => (
                <div key={customer.id} style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start', padding:'10px 0', borderBottom:`1px dashed ${C.border}` }}>
                  <div>
                    <div style={{ fontWeight:900, color:C.dark }}>{customer.name}</div>
                    <div style={{ fontSize:13, color:C.muted }}>{customer.storeName} - {customer.mobile}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{customer.address}</div>
                  </div>
                  <button style={{ ...mkBtn('outline'), padding:'6px 10px', fontSize:12, boxShadow:'none' }} onClick={() => editCustomer(customer)}>Edit</button>
                </div>
              ))}
            </div>
        }
      </div>

      <div>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', marginBottom:10 }}>
          <h3 style={{ margin:0, fontWeight:900, color:C.dark, fontSize:16 }}>All Saved Bills / Orders</h3>
          <span style={mkBadge('green')}>{orders.length}</span>
        </div>
        <input style={{ ...inp, marginBottom:12 }} placeholder="Bill, customer, mobile, status search karo" value={billSearch} onChange={e=>setBillSearch(e.target.value)} />
        {visibleBills.length === 0
          ? <div style={{ ...mkCard, textAlign:'center', padding:32, color:C.muted, fontWeight:700 }}>Koi saved bill/order nahi mila.</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{visibleBills.map(order => <BillCard key={order.id} order={order} />)}</div>
        }
      </div>
    </div>
  );
}

