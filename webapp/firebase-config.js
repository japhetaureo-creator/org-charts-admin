// =============================================================================
// Firebase Configuration & Initialization
// =============================================================================
// Loaded AFTER the Firebase CDN scripts in index.html.
// Exposes: window.firebaseApp, window.firebaseDb
// =============================================================================

const firebaseConfig = {
    apiKey: "AIzaSyB9RX80o38miQGK-1FlmioJ6CCmS1Zvj9w",
    authDomain: "org-chart-56259.firebaseapp.com",
    projectId: "org-chart-56259",
    storageBucket: "org-chart-56259.firebasestorage.app",
    messagingSenderId: "258167005553",
    appId: "1:258167005553:web:1f519a6a291a6aa488d6d0",
    measurementId: "G-8PN3K7NX7T"
};

// Initialize Firebase (compat SDK loaded via CDN)
try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        window.firebaseApp = firebase.app();
        window.firebaseDb = firebase.firestore();
        console.log('Firebase initialized. Project:', firebaseConfig.projectId);
    } else {
        console.warn('Firebase SDK not loaded. Admin users will fall back to localStorage.');
    }
} catch (e) {
    console.error('Firebase initialization failed:', e);
}
