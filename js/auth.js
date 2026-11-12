const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyAToXxxnn6LlmFwX7XjxFRgnZlH2PxvfaI",
  authDomain: "asisten-keuangan-ai-45072.firebaseapp.com",
  projectId: "asisten-keuangan-ai-45072",
  storageBucket: "asisten-keuangan-ai-45072.firebasestorage.app",
  messagingSenderId: "875015441409",
  appId: "1:875015441409:web:5bd1c40d70221729e94400"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = (typeof firebase.firestore === 'function') ? firebase.firestore() : null;

window.transactions = [];
window.monthlyBudget = 2000000;
window.currentAuthUser = null;

function getSavedSessionUser() {
  try {
    const raw = localStorage.getItem('finai_saved_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.uid) return parsed;
    }
    // Cek juga jika ada data cloud_<uid> dari login sebelumnya
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cloud_') && k !== 'cloud_undefined') {
        const uid = k.replace('cloud_', '');
        return { uid: uid, displayName: 'Pengguna FinAI', email: '' };
      }
    }
  } catch (e) {}
  return null;
}

// Jalankan seketika saat refresh agar tetap di dalam menu utama
(function keepUserInsideOnRefresh() {
  const savedUser = getSavedSessionUser();
  if (savedUser) {
    window.currentAuthUser = savedUser;
    document.addEventListener('DOMContentLoaded', () => {
      updateUserUI(savedUser);
      loadCloudData(savedUser.uid);
    });
  } else if (localStorage.getItem('finai_offline') === 'true') {
    const offlineUser = { uid: 'offline', displayName: 'Mode Lokal', email: 'Offline' };
    window.currentAuthUser = offlineUser;
    document.addEventListener('DOMContentLoaded', () => {
      updateUserUI(offlineUser);
      loadCloudData('offline');
    });
  }
})();

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

auth.onAuthStateChanged((user) => {
  if (user) {
    const cleanUser = {
      uid: user.uid,
      displayName: user.displayName || 'Pengguna',
      email: user.email || ''
    };
    window.currentAuthUser = cleanUser;
    localStorage.setItem('finai_saved_user', JSON.stringify(cleanUser));
    updateUserUI(cleanUser);
    loadCloudData(cleanUser.uid);
  } else {
    // Jika refresh membuat Firebase kehilangan token sesaat, JANGAN keluarkan user ke halaman login
    const savedUser = getSavedSessionUser();
    if (savedUser) {
      window.currentAuthUser = savedUser;
      updateUserUI(savedUser);
      loadCloudData(savedUser.uid);
      return;
    }
    if (localStorage.getItem('finai_offline') === 'true') {
      const offlineUser = { uid: 'offline', displayName: 'Mode Lokal', email: 'Offline' };
      window.currentAuthUser = offlineUser;
      updateUserUI(offlineUser);
      loadCloudData('offline');
      return;
    }
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('main-app')?.classList.add('hidden');
  }
});

function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then((res) => {
    if (res && res.user) {
      const cleanUser = {
        uid: res.user.uid,
        displayName: res.user.displayName || 'Pengguna',
        email: res.user.email || ''
      };
      localStorage.setItem('finai_saved_user', JSON.stringify(cleanUser));
      window.currentAuthUser = cleanUser;
      updateUserUI(cleanUser);
      loadCloudData(cleanUser.uid);
    }
  }).catch(err => {
    if (err.code === 'auth/popup-blocked') auth.signInWithRedirect(provider);
    else alert(err.message);
  });
}

function continueOffline() {
  localStorage.setItem('finai_offline', 'true');
  const offlineUser = { uid: 'offline', displayName: 'Mode Lokal', email: 'Offline' };
  localStorage.setItem('finai_saved_user', JSON.stringify(offlineUser));
  window.currentAuthUser = offlineUser;
  updateUserUI(offlineUser);
  loadCloudData('offline');
}

function logoutGoogle() {
  if (confirm('Yakin ingin keluar dari akun?')) {
    localStorage.removeItem('finai_offline');
    localStorage.removeItem('finai_saved_user');
    auth.signOut().finally(() => window.location.reload());
  }
}

function updateUserUI(user) {
  if (!user) return;
  localStorage.setItem('finai_saved_user', JSON.stringify({
    uid: user.uid,
    displayName: user.displayName || 'Pengguna',
    email: user.email || ''
  }));
  document.getElementById('login-screen')?.classList.add('hidden');
  document.getElementById('main-app')?.classList.remove('hidden');
  const nameEl = document.getElementById('user-display-name');
  const emailEl = document.getElementById('user-display-email');
  if (nameEl && user.displayName) nameEl.textContent = user.displayName;
  if (emailEl && user.email) emailEl.textContent = user.email;
}

// Perbaiki otomatis semua transaksi "Saldo cash..." yang tadinya minus (expense) menjadi positif (income)
function fixNegativeBalanceBug(list) {
  if (!Array.isArray(list)) return { list: [], fixed: false };
  let fixed = false;
  const cleaned = list.map(t => {
    const d = String(t.description || '').toLowerCase();
    if (t.type === 'expense' && /(saldo|uang\s+cash|uang\s+tunai|modal\s+awal|kas\s+awal)/i.test(d)) {
      fixed = true;
      return Object.assign({}, t, {
        description: 'Saldo Awal Cash',
        type: 'income',
        category: 'Saldo Awal & Kas'
      });
    }
    return t;
  });
  return { list: cleaned, fixed };
}

async function loadCloudData(uid) {
  const saved = localStorage.getItem(`cloud_${uid}`);
  if (saved) {
    try {
      const p = JSON.parse(saved);
      const res = fixNegativeBalanceBug(p.transactions || []);
      window.transactions = res.list;
      window.monthlyBudget = p.monthlyBudget || 2000000;
      if (p.goals) window.goals = p.goals;
      if (res.fixed) saveCloudData();
    } catch (e) {}
  }

  if (typeof renderAll === 'function') renderAll();
  if (typeof initChart === 'function') initChart();
  if (typeof checkInitialBalancePrompt === 'function') checkInitialBalancePrompt();

  if (db && uid !== 'offline') {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        const data = doc.data();
        if (Array.isArray(data.transactions) && window.transactions.length === 0 && data.transactions.length > 0) {
          const res = fixNegativeBalanceBug(data.transactions);
          window.transactions = res.list;
          window.monthlyBudget = data.monthlyBudget || 2000000;
          saveCloudData();
          if (typeof renderAll === 'function') renderAll();
        }
      }
    } catch (e) {}
  }
}

function saveCloudData() {
  if (!window.currentAuthUser) return;
  const uid = window.currentAuthUser.uid;
  const payload = {
    transactions: window.transactions || [],
    monthlyBudget: window.monthlyBudget || 2000000,
    goals: window.goals || [],
    updatedAt: Date.now()
  };
  localStorage.setItem(`cloud_${uid}`, JSON.stringify(payload));
  if (db && uid !== 'offline') {
    db.collection('users').doc(uid).set(payload, { merge: true }).catch(() => {});
  }
}
