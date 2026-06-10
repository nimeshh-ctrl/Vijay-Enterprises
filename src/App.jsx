import { useState, useEffect } from "react";
import {
  collection, doc, onSnapshot,
  addDoc, updateDoc, deleteDoc, runTransaction,
} from "firebase/firestore";
import upiQR from "./assets/upi-qr.jpg";
import { db } from "./firebase";

// Utilities
const fmt     = n  => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = s  => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtDT   = s  => s ? new Date(s).toLocaleString('en-IN',     { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
const now     = () => new Date().toISOString();
const billNo  = () => 'VE-' + Date.now().toString().slice(-5);
const isValidIndianMobile = (num) => /^[6-9]\d{9}$/.test(num);
const getOrderItems = order => Array.isArray(order?.items) ? order.items : [];

// Theme
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

// Payment Toggle
function PayToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[
        { id: 'cash', label: 'Cash', color: C.primary, bg: C.light },
        { id: 'upi',  label: 'UPI',  color: C.upi,    bg: C.upiLight },
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
// PayBadge
const PayBadge = ({ method }) => (
  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
    background: method === 'upi' ? C.upiLight : C.light,
    color: method === 'upi' ? C.upi : C.dark,
    border: `1px solid ${method === 'upi' ? '#ddd6fe' : C.border}` }}>
    {method === 'upi' ? 'UPI' : 'Cash'}
  </span>
);

// App Root
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
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 60, fontWeight: 900 }}>VE</div>
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

// Auth Page
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
      setErr('Invalid username or password');
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
        <div style={{ padding:'10px 12px', background:C.light, borderRadius:10, fontSize:12, color:C.dark, fontWeight:800, marginBottom:16 }}>Owner access only</div>
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
    { id:'orders',   label:'Orders',   badge: pendingCount },
    { id:'stock',    label:'Stock' },
    { id:'salesman', label:'Salesman' },
    { id:'office',   label:'Office' },
  ];
  return (
    <div style={{ maxWidth:640, margin:'0 auto', minHeight:'100vh', paddingBottom:32 }}>
      <div style={{ background:`linear-gradient(135deg,${C.dark},${C.primary})`, padding:'20px 20px 0', color:'#fff' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, margin:0 }}>Owner Dashboard</h1>
            <p style={{ margin:'3px 0 0', opacity:0.75, fontSize:12, fontWeight:600 }}>Vijay Enterprises - Business Control</p>
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

// Stock Manager
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
    if (!name?.trim()||!price||!unit||!quantity) { setErr('All fields are required'); return; }
    setSaving(true);
    try {
      if (editId) await updateDoc(doc(db,'stock',editId), { name:name.trim(), price:+price, unit, quantity:+quantity });
      else        await addDoc(collection(db,'stock'), { name:name.trim(), price:+price, unit, quantity:+quantity });
      cancel();
    } catch { setErr('Something went wrong. Please try again.'); }
    setSaving(false);
  };
  const handleDelete = async id => { if (!window.confirm('Delete this item?')) return; await deleteDoc(doc(db,'stock',id)); };
  const UNITS = ['kg','g','250g','500g','litre','500ml','packet','dozen','piece','box','bag','bottle','bundle'];
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ margin:0, fontWeight:900, fontSize:18, color:C.dark }}>Stock Management</h2>
        <button style={mkBtn('primary')} onClick={openAdd}>+ Add Item</button>
      </div>
      {showForm && (
        <div style={{ ...mkCard, marginBottom:16, borderColor:C.primary, borderWidth:2 }}>
          <h3 style={{ margin:'0 0 14px', fontWeight:800, color:C.dark }}>{editId?'Edit Product':'New Product'}</h3>
          {err && <div style={{ color:C.danger, fontSize:13, fontWeight:700, marginBottom:10 }}>{err}</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div><label style={lbl}>Product Name</label><input style={inp} placeholder="Basmati Rice..." value={f.name||''} onChange={e=>set('name',e.target.value)} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={lbl}>Price (Rs.)</label><input style={inp} type="number" placeholder="85" value={f.price||''} onChange={e=>set('price',e.target.value)} /></div>
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
              <button style={{ ...mkBtn('primary'), flex:2, opacity:saving?0.7:1 }} onClick={handleSave} disabled={saving}>{saving?'Saving...':editId?'Update':'Add Item'}</button>
            </div>
          </div>
        </div>
      )}
      {stock.length===0
        ? <div style={{ textAlign:'center', padding:48, color:C.muted }}><p style={{ fontWeight:700 }}>No stock items yet. Add an item.</p></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {stock.map(p => (
              <div key={p.id} style={{ ...mkCard, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px' }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>{p.name}</div>
                  <div style={{ fontSize:13, color:C.muted, marginTop:3 }}>{fmt(p.price)}/{p.unit} <span style={{ marginLeft:8, fontWeight:700, color:p.quantity<10?C.danger:C.primary }}> Stock: {p.quantity} {p.unit}</span></div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>openEdit(p)} style={{ ...mkBtn('outline'), padding:'6px 12px', fontSize:13 }}>Edit</button>
                  <button onClick={()=>handleDelete(p.id)} style={{ ...mkBtn('danger'), padding:'6px 12px', fontSize:13 }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// Salesman Panel (Bill Style)
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
    if (!selectedCustomer) { setErr('Please select a customer'); return; }
    if (!orderItems.length) { setErr('Add at least one item to the bill'); return; }

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
          if (!snap.exists()) throw new Error(`${item.name} was not found in stock`);
          const available = Number(snap.data().quantity || 0);
          if (available < item.quantity) throw new Error(`${item.name} has only ${available} ${item.unit} in stock`);
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
      setErr(e?.message || 'Bill could not be saved. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (successBill) return (
    <div style={{ textAlign:'center' }}>
      <div style={{ ...mkCard, maxWidth:420, margin:'0 auto', borderColor:C.primary, borderWidth:2 }}>
        <div style={{ width:48, height:48, borderRadius:'50%', background:C.light, color:C.primary, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px', fontWeight:900, fontSize:24 }}>OK</div>
        <h3 style={{ fontWeight:900, color:C.dark, margin:'0 0 4px' }}>Bill Saved</h3>
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
        <button style={{ ...mkBtn('primary'), width:'100%', padding:13 }} onClick={() => setSuccessBill(null)}>Create New Bill</button>
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:C.light, borderRadius:14 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:C.primary, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900 }}>B</div>
        <div><div style={{ fontWeight:900, color:C.dark }}>Salesman Bill</div>
          <div style={{ fontSize:12, color:C.muted }}>Select a saved customer and add inventory items</div>
        </div>
      </div>

      {err && <div style={{ background:C.dangerLight, color:C.danger, padding:'10px 14px', borderRadius:10, fontSize:13, fontWeight:700 }}>{err}</div>}

      <div style={mkCard}>
        <h3 style={{ margin:'0 0 12px', fontWeight:800, color:C.dark, fontSize:15 }}>Customer Search</h3>
        <input
          style={inp}
          placeholder="Search by customer, shop, or mobile"
          value={customerSearch}
          onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setErr(''); }}
        />
        {!selectedCustomer && (
          <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
            {customers.length === 0
              ? <div style={{ color:C.muted, fontSize:13, fontWeight:700, background:C.bg, borderRadius:10, padding:12 }}>Save customer details on the Office page first.</div>
              : matchedCustomers.length === 0
                ? <div style={{ color:C.muted, fontSize:13, fontWeight:700, background:C.bg, borderRadius:10, padding:12 }}>No customer found.</div>
                : matchedCustomers.map(customer => (
                    <button key={customer.id} onClick={() => selectCustomer(customer)}
                      style={{ ...mkCard, padding:12, textAlign:'left', cursor:'pointer', boxShadow:'none', borderColor:C.border }}>
                      <div style={{ fontWeight:900, color:C.dark }}>{customer.name}</div>
                      <div style={{ fontSize:13, color:C.muted }}>{customer.storeName || 'Shop name missing'} - {customer.mobile || 'Mobile missing'}</div>
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
              <div style={{ fontSize:13, color:C.muted }}>{selectedCustomer.storeName || 'Shop name missing'} - {selectedCustomer.mobile || 'Mobile missing'}</div>
              {selectedCustomer.address && <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{selectedCustomer.address}</div>}
            </div>
            <button style={{ ...mkBtn('outline'), padding:'6px 10px', fontSize:12, boxShadow:'none' }} onClick={clearCustomer}>Change</button>
          </div>
        )}
      </div>

      {!selectedCustomer ? (
        <div style={{ ...mkCard, textAlign:'center', padding:32, color:C.muted, fontWeight:700 }}>
          Select a customer to show the bill format here.
        </div>
      ) : (
        <>
          <div style={mkCard}>
            <h3 style={{ margin:'0 0 14px', fontWeight:800, color:C.dark, fontSize:15 }}>Inventory Items</h3>
            {stock.length===0
              ? <p style={{ color:C.muted, fontWeight:600 }}>No stock items available</p>
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
                          <div style={{ fontSize:12, color:C.muted }}>{fmt(p.price)} / {p.unit} - Stock: {available} {p.unit}</div>
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
                  <div style={{ fontSize:13, color:C.muted }}>{selectedCustomer.name} - {selectedCustomer.mobile}</div>
                </div>
                <div style={{ fontSize:12, fontWeight:800, color:C.primary }}>Bill #{draftBillNumber}</div>
              </div>
            </div>
            {orderItems.length === 0
              ? <div style={{ color:C.muted, fontSize:13, fontWeight:700 }}>Add item quantities from inventory.</div>
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
            {placing ? 'Saving bill...' : `Save Bill - ${paymentMethod==='cash'?'Cash':'UPI'}${balance>0?' - Balance: '+fmt(balance):''}`}
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
    if (!deliveryDate) { alert('Delivery date is required'); return; }
    await updateDoc(doc(db,'orders',confirmOrder.id), { status:'confirmed', confirmedAt:now(), deliveryDate });
    setConfirmOrder(null); setDeliveryDate('');
  };
  const doDeliver = async id => updateDoc(doc(db,'orders',id), { status:'delivered', deliveredAt:now() });
  const STATUS = {
    pending:   { color:'amber', label:'Pending' },
    confirmed: { color:'green', label:'Confirmed' },
    delivered: { color:'gray',  label:'Delivered' },
  };
  const stats = ['pending','confirmed','delivered'].map(s=>({ s, count:orders.filter(o=>o.status===s).length }));
  return (
    <div>
      {/* Confirm Modal */}
      {confirmOrder && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ ...mkCard, width:'100%', maxWidth:380 }}>
            <h3 style={{ margin:'0 0 6px', fontWeight:900, color:C.dark }}>Confirm Order</h3>
            <p style={{ margin:'0 0 16px', color:C.muted, fontSize:14 }}><strong>{confirmOrder.customerStore||confirmOrder.customerName}</strong></p>
            <label style={lbl}>Delivery Date</label>
            <input type="date" style={inp} value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button style={{ ...mkBtn('outline'), flex:1 }} onClick={()=>setConfirmOrder(null)}>Cancel</button>
              <button style={{ ...mkBtn('primary'), flex:2 }} onClick={doConfirm}>Confirm</button>
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
                <div style={{ fontSize:13, color:C.muted }}>{detailOrder.customerName} - {detailOrder.customerMobile}</div>
                <div style={{ fontSize:12, color:C.muted }}>{detailOrder.customerAddress}</div>
               <div style={{ marginTop:6, display:'flex', gap:6 }}>
  <PayBadge method={detailOrder.paymentMethod || 'cash'} />
  {detailOrder.placedBy==='salesman' && (
    <span style={{ ...mkBadge('gray'), fontSize:10 }}>
      Salesman
    </span>
  )}
</div>
              </div>
              <button onClick={()=>setDetailOrder(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:C.muted }}>X</button>
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
                <span>Paid</span><span>{fmt(detailOrder.paidAmount)}</span>
              </div>
            )}
            {detailOrder.balance > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:C.danger, fontWeight:700, padding:'8px 0' }}>
                <span>Balance</span><span>{fmt(detailOrder.balance)}</span>
              </div>
            )}
            {detailOrder.deliveryDate && (
              <div style={{ background:C.light, color:C.dark, padding:'10px 12px', borderRadius:10, fontWeight:700, fontSize:14, marginTop:8 }}>
                Delivery: {fmtDate(detailOrder.deliveryDate+'T00:00:00')}
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
        ? <div style={{ textAlign:'center', padding:40, color:C.muted }}><p style={{ fontWeight:700 }}>No orders found</p></div>
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
                    <div style={{ fontSize:13, color:C.muted }}>{o.customerName} - {o.customerMobile}</div>
                    <div style={{ marginTop:4, display:'flex', gap:6 }}>
                      <PayBadge method={o.paymentMethod||'cash'} />
                      {o.placedBy==='salesman' && <span style={{ ...mkBadge('gray'), fontSize:10 }}>Salesman</span>}
                    </div>
                  </div>
                  <span style={mkBadge(status.color)}>{status.label}</span>
                </div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>{items.length} item(s) - {fmtDT(o.placedAt)}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <span style={{ fontWeight:900, color:C.dark, fontSize:17 }}>{fmt(o.total)}</span>
                    {o.balance > 0 && <span style={{ marginLeft:8, fontSize:12, color:C.danger, fontWeight:700 }}>Balance: {fmt(o.balance)}</span>}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>setDetailOrder(o)} style={{ ...mkBtn('outline'), padding:'6px 12px', fontSize:12, boxShadow:'none' }}>Details</button>
                    {o.status==='pending'   && <button onClick={()=>{ setConfirmOrder(o); setDeliveryDate(''); }} style={{ ...mkBtn('primary'), padding:'6px 14px', fontSize:12 }}>Confirm</button>}
                    {o.status==='confirmed' && <button onClick={()=>doDeliver(o.id)} style={{ ...mkBtn('amber'), padding:'6px 14px', fontSize:12 }}>Deliver</button>}
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

// Office Display
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
      setErr('Customer name, shop name, address, and mobile number are required');
      return;
    }
    if (!isValidIndianMobile(mobile.trim())) {
      setErr('Enter a valid 10-digit mobile number');
      return;
    }
    const duplicate = customers.find(c => c.mobile === mobile.trim() && c.id !== editId);
    if (duplicate) {
      setErr('This mobile number is already saved');
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
      setErr('Customer could not be saved. Please try again.');
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
        <div><div style={{ fontWeight:900, color:C.dark }}>Office</div><div style={{ fontSize:12, color:C.muted }}>Save customers here. The Salesman page searches this list.</div></div>
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
            <div><label style={lbl}>Address</label><input style={inp} placeholder="Street, area, city" value={f.address || ''} onChange={e=>set('address', e.target.value)} /></div>
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
          ? <div style={{ color:C.muted, fontWeight:700, fontSize:13 }}>No saved customers yet.</div>
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
        <input style={{ ...inp, marginBottom:12 }} placeholder="Search bill, customer, mobile, or status" value={billSearch} onChange={e=>setBillSearch(e.target.value)} />
        {visibleBills.length === 0
          ? <div style={{ ...mkCard, textAlign:'center', padding:32, color:C.muted, fontWeight:700 }}>No saved bills or orders found.</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{visibleBills.map(order => <BillCard key={order.id} order={order} />)}</div>
        }
      </div>
    </div>
  );
}

