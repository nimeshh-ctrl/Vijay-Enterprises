# 🛒 Vijay Enterprises App — Setup Guide

---

## STEP 1: Node.js Install Karo (Agar nahi hai)

1. https://nodejs.org pe jao
2. "LTS" version download karo
3. Install karo (Next Next Finish)
4. CMD/Terminal mein check karo: `node --version`

---

## STEP 2: Firebase Project Banao (FREE)

1. https://console.firebase.google.com pe jao
2. "Create a project" click karo
3. Project ka naam likho: `vijay-enterprises`
4. Google Analytics: OFF kar do (zaroori nahi)
5. "Create project" click karo

### Firestore Database Setup:
1. Left sidebar mein "Firestore Database" click karo
2. "Create database" click karo
3. **"Start in test mode"** select karo (IMPORTANT — production mein baad mein change karenge)
4. Location: `asia-south1` (Mumbai — fastest for India) select karo
5. "Enable" click karo

### Firebase Config Copy Karo:
1. Project Overview (home icon) pe jao
2. `</>` (Web) icon click karo
3. App nickname: `grocery-web`
4. "Register app" click karo
5. Jo `firebaseConfig = { ... }` dikhega — **woh saara copy karo**

---

## STEP 3: App Files Setup Karo

1. Yeh saari files ek folder mein rakho: `grocery-app/`
2. Folder structure aisa hona chahiye:
   ```
   grocery-app/
   ├── package.json
   ├── vite.config.js
   ├── index.html
   ├── .env              ← yeh banao (niche dekho)
   └── src/
       ├── main.jsx
       ├── firebase.js
       └── App.jsx
   ```

### .env File Banao:
`.env.example` ko copy karke naam rakho `.env`
Fir apni Firebase values daalo:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=vijay-enterprises.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=vijay-enterprises
VITE_FIREBASE_STORAGE_BUCKET=vijay-enterprises.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=12345678
VITE_FIREBASE_APP_ID=1:12345678:web:abcdef
```

---

## STEP 4: Dependencies Install Karo

Terminal/CMD mein `grocery-app` folder mein jao:
```bash
cd grocery-app
npm install
```

---

## STEP 5: Local Test Karo

```bash
npm run dev
```

Browser mein khulega: http://localhost:5173

Test karo:
- ✅ Owner login direct: `admin / grocery123`
- ✅ Stock add/edit karo aur live quantity update dekho
- ✅ Office page par customer details pre-save karo
- ✅ Salesman page par customer search karke bill save karo
- ✅ Office page par saved bills/orders list mein dekho

---

## STEP 6: Deploy to Vercel (FREE — Real Website)

1. https://github.com pe free account banao
2. New repository banao: `grocery-app`
3. Apni files upload karo (ya git use karo)
4. https://vercel.com pe jao — GitHub se login karo
5. "New Project" → apna GitHub repo select karo
6. **Environment Variables** add karo (Vercel settings mein):
   - `VITE_FIREBASE_API_KEY` = apni value
   - `VITE_FIREBASE_AUTH_DOMAIN` = apni value
   - `VITE_FIREBASE_PROJECT_ID` = apni value
   - `VITE_FIREBASE_STORAGE_BUCKET` = apni value
   - `VITE_FIREBASE_MESSAGING_SENDER_ID` = apni value
   - `VITE_FIREBASE_APP_ID` = apni value
7. "Deploy" click karo

**5 minute mein aapka app live ho jaayega!**
URL milega: `https://grocery-app-xyz.vercel.app`

---

## STEP 7: Firestore Security Rules (IMPORTANT — After Testing)

Firebase Console → Firestore → Rules tab mein yeh paste karo:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Stock — live inventory
    match /stock/{doc} {
      allow read: if true;
      allow write: if true; // baad mein restrict karein
    }
    match /orders/{doc} {
      allow read, write: if true;
    }
    match /customers/{doc} {
      allow read, write: if true;
    }
  }
}
```

---

## Owner Password Change Karna

`src/App.jsx` mein yeh line dhundho (line ~135):
```js
if (f.username === 'admin' && f.password === 'grocery123')
```

Apna username aur password set karo:
```js
if (f.username === 'APNA_USERNAME' && f.password === 'APNA_PASSWORD')
```

---

## ❓ Common Problems

| Problem | Solution |
|---------|----------|
| `npm` command nahi mila | Node.js install nahi hai, Step 1 karo |
| Firebase error aaya | .env file check karo, sab values sahi hain? |
| Data save nahi ho raha | Firestore "test mode" mein hai? Check karo |
| Vercel pe kaam nahi kar raha | Environment variables add kiye? |

---

## 🚀 Future Mein Add Kar Sakte Ho

- WhatsApp notification (Twilio ya Meta Business API)
- SMS notification
- PDF invoice generate karna
- Sales report / analytics
- Multiple salesman support
- Product categories

---

