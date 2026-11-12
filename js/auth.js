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

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(() => {
  auth.onAuthStateChanged((user) => {
    if (user) {
      window.currentAuthUser = user;
      updateUserUI(user);
      loadCloudData(user.uid);
    } else {
      if (localStorage.getItem('finai_offline') === 'true') {
        window.currentAuthUser = { uid: 'offline', displayName: 'Offline', email: 'Lokal' };
        updateUserUI(window.currentAuthUser);
        loadCloudData('offline');
      } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
      }
    }
  });
});

function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    if (err.code === 'auth/popup-blocked') auth.signInWithRedirect(provider);
    else alert(err.message);
  });
}

function continueOffline() {
  localStorage.setItem('finai_offline', 'true');
  window.currentAuthUser = { uid: 'offline', displayName: 'Offline', email: 'Lokal' };
  updateUserUI(window.currentAuthUser);
  loadCloudData('offline');
}

function logoutGoogle() {
  if (confirm('Keluar dari akun?')) {
    localStorage.removeItem('finai_offline');
    auth.signOut().then(() => window.location.reload());
  }
}

function updateUserUI(user) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  document.getElementById('user-display-name').textContent = user.displayName || 'User';
  document.getElementById('user-display-email').textContent = user.email || '';
}

async function loadCloudData(uid) {
  // 1. Muat instan dari LocalStorage
  const saved = localStorage.getItem(`cloud_${uid}`);
  if (saved) {
    try {
      const p = JSON.parse(saved);
      window.transactions = p.transactions || [];
      window.monthlyBudget = p.monthlyBudget || 2000000;
      if (p.goals) window.goals = p.goals;
    } catch (e) {}
  }
  if (typeof renderAll === 'function') renderAll();
  if (typeof initChart === 'function') initChart();

  // 2. Sinkronisasi dari Cloud Firestore jika online & bukan akun offline
  if (db && uid !== 'offline') {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        const data = doc.data();
        if (Array.isArray(data.transactions) && data.transactions.length >= window.transactions.length) {
          window.transactions = data.transactions;
          window.monthlyBudget = data.monthlyBudget || 2000000;
          if (Array.isArray(data.goals)) {
            window.goals = data.goals;
            localStorage.setItem('finai_goals_v1', JSON.stringify(window.goals));
          }
          localStorage.setItem(`cloud_${uid}`, JSON.stringify({
            transactions: window.transactions,
            monthlyBudget: window.monthlyBudget,
            goals: window.goals
          }));
          if (typeof renderAll === 'function') renderAll();
        }
      }
    } catch (e) {
      console.warn('Mode lokal aktif:', e.message);
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
