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

// Pulihkan sesi instan saat halaman di-refresh agar TIDAK PERNAH mental ke layar login
(function restoreSessionImmediately() {
  const cachedUser = localStorage.getItem('finai_saved_user');
  if (cachedUser) {
    try {
      const userObj = JSON.parse(cachedUser);
      if (userObj && userObj.uid) {
        window.currentAuthUser = userObj;
        document.addEventListener('DOMContentLoaded', () => {
          updateUserUI(userObj);
          loadCloudData(userObj.uid);
        });
      }
    } catch (e) {}
  } else if (localStorage.getItem('finai_offline') === 'true') {
    const offlineUser = { uid: 'offline', displayName: 'Offline', email: 'Lokal' };
    window.currentAuthUser = offlineUser;
    document.addEventListener('DOMContentLoaded', () => {
      updateUserUI(offlineUser);
      loadCloudData('offline');
    });
  }
})();

auth.onAuthStateChanged((user) => {
  if (user) {
    const cleanUser = {
      uid: user.uid,
      displayName: user.displayName || 'User',
      email: user.email || ''
    };
    window.currentAuthUser = cleanUser;
    localStorage.setItem('finai_saved_user', JSON.stringify(cleanUser));
    updateUserUI(cleanUser);
    loadCloudData(cleanUser.uid);
  } else {
    // Jangan tendang user ke layar login jika sudah ada sesi tersimpan di HP
    const cachedUser = localStorage.getItem('finai_saved_user');
    if (cachedUser) {
      try {
        const userObj = JSON.parse(cachedUser);
        window.currentAuthUser = userObj;
        updateUserUI(userObj);
        loadCloudData(userObj.uid);
        return;
      } catch (e) {}
    }

    if (localStorage.getItem('finai_offline') === 'true') {
      window.currentAuthUser = { uid: 'offline', displayName: 'Offline', email: 'Lokal' };
      updateUserUI(window.currentAuthUser);
      loadCloudData('offline');
    } else {
      document.getElementById('login-screen')?.classList.remove('hidden');
      document.getElementById('main-app')?.classList.add('hidden');
    }
  }
});

function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(() => {
    return auth.signInWithPopup(provider);
  }).then((result) => {
    if (result && result.user) {
      const cleanUser = {
        uid: result.user.uid,
        displayName: result.user.displayName || 'User',
        email: result.user.email || ''
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
  const offlineUser = { uid: 'offline', displayName: 'Offline', email: 'Lokal' };
  localStorage.setItem('finai_saved_user', JSON.stringify(offlineUser));
  window.currentAuthUser = offlineUser;
  updateUserUI(offlineUser);
  loadCloudData('offline');
}

function logoutGoogle() {
  if (confirm('Keluar dari akun?')) {
    localStorage.removeItem('finai_offline');
    localStorage.removeItem('finai_saved_user');
    sessionStorage.removeItem('finai_session_unlocked');
    auth.signOut().finally(() => window.location.reload());
  }
}

function updateUserUI(user) {
  document.getElementById('login-screen')?.classList.add('hidden');
  document.getElementById('main-app')?.classList.remove('hidden');
  const nameEl = document.getElementById('user-display-name');
  const emailEl = document.getElementById('user-display-email');
  if (nameEl) nameEl.textContent = user.displayName || 'User';
  if (emailEl) emailEl.textContent = user.email || '';
}

// Otomatis perbaiki transaksi "Saldo cash..." yang salah tercatat sebagai pengeluaran (minus)
function healMistakenBalanceTransactions(list) {
  if (!Array.isArray(list)) return { list: [], changed: false };
  let changed = false;
  const fixed = list.map(t => {
    const desc = String(t.description || '').toLowerCase();
    if (t.type === 'expense' && /^(saldo|uang\s+cash|uang\s+tunai|kas\s+tunai|modal\s+awal)/i.test(desc)) {
      changed = true;
      return Object.assign({}, t, {
        type: 'income',
        category: 'Gaji & Pendapatan'
      });
    }
    return t;
  });
  return { list: fixed, changed };
}

async function loadCloudData(uid) {
  let localUpdatedAt = 0;
  const saved = localStorage.getItem(`cloud_${uid}`);
  if (saved) {
    try {
      const p = JSON.parse(saved);
      const healed = healMistakenBalanceTransactions(p.transactions || []);
      window.transactions = healed.list;
      window.monthlyBudget = p.monthlyBudget || 2000000;
      localUpdatedAt = p.updatedAt || 0;
      if (p.goals) window.goals = p.goals;
      if (healed.changed) saveCloudData();
    } catch (e) {}
  }
  if (typeof renderAll === 'function') renderAll();
  if (typeof initChart === 'function') initChart();

  if (db && uid !== 'offline') {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        const data = doc.data();
        const cloudUpdatedAt = data.updatedAt || 0;
        if (Array.isArray(data.transactions) && (cloudUpdatedAt > localUpdatedAt || window.transactions.length === 0)) {
          const healed = healMistakenBalanceTransactions(data.transactions);
          window.transactions = healed.list;
          window.monthlyBudget = data.monthlyBudget || 2000000;
          if (Array.isArray(data.goals)) {
            window.goals = data.goals;
            localStorage.setItem('finai_goals_v1', JSON.stringify(window.goals));
          }
          if (healed.changed) {
            saveCloudData();
          } else {
            localStorage.setItem(`cloud_${uid}`, JSON.stringify({
              transactions: window.transactions,
              monthlyBudget: window.monthlyBudget,
              goals: window.goals,
              updatedAt: cloudUpdatedAt || Date.now()
            }));
          }
          if (typeof renderAll === 'function') renderAll();
        }
      }
    } catch (e) {
      console.warn('Menggunakan data lokal:', e.message);
    }
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
