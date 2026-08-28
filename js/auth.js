const firebaseConfig = {
  apiKey: "AIzaSyAToXxxnn6LlmFwX7XjxFRgnZlH2PxvfaI",
  authDomain: "asisten-keuangan-ai-45072.firebaseapp.com",
  projectId: "asisten-keuangan-ai-45072",
  storageBucket: "asisten-keuangan-ai-45072.firebasestorage.app",
  messagingSenderId: "875015441409",
  appId: "1:875015441409:web:5bd1c40d70221729e94400"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

window.transactions = [];
window.monthlyBudget = 2000000;
window.currentAuthUser = null;

// Hindari redirect loop dengan persistence LOCAL
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
    if(err.code === 'auth/popup-blocked') auth.signInWithRedirect(provider);
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

function loadCloudData(uid) {
  const saved = localStorage.getItem(`cloud_${uid}`);
  if (saved) {
    const p = JSON.parse(saved);
    window.transactions = p.transactions || [];
    window.monthlyBudget = p.monthlyBudget || 2000000;
  }
  if(typeof renderAll === 'function') renderAll();
  if(typeof initChart === 'function') initChart();
}

function saveCloudData() {
  if (!window.currentAuthUser) return;
  localStorage.setItem(`cloud_${window.currentAuthUser.uid}`, JSON.stringify({ transactions: window.transactions, monthlyBudget: window.monthlyBudget }));
}
