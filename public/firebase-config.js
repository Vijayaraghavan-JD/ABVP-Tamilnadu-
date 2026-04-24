// ============================================================
// Firebase Configuration — ABVP Tamil Nadu
// Shared across all pages (index, admin, verify)
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyAKAFimi8k0C4fEfQWWhoOAaA4RghredGA",
    authDomain: "abvp-tamilnadu.firebaseapp.com",
    projectId: "abvp-tamilnadu",
    storageBucket: "abvp-tamilnadu.firebasestorage.app",
    messagingSenderId: "425512765058",
    appId: "1:425512765058:web:88b788f8a58bba171b569b",
    measurementId: "G-JJ1CWN69VN"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const db = firebase.firestore();
const auth = firebase.auth();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Admin email constant (initial super_admin — RBAC takes over after first login)
const INITIAL_SUPER_ADMIN = 'vijayaraghavanxicb3@gmail.com';

// ============================================================
// Utility Functions (shared)
// ============================================================

/**
 * Check if a user's email is in the admins collection
 * @param {string} email
 * @returns {Promise<{isAdmin: boolean, role: string|null}>}
 */
async function checkAdminRole(email) {
    try {
        const doc = await db.collection('admins').doc(email).get();
        if (doc.exists) {
            return { isAdmin: true, role: doc.data().role };
        }
        return { isAdmin: false, role: null };
    } catch (err) {
        console.error('Error checking admin role:', err);
        return { isAdmin: false, role: null };
    }
}

/**
 * Seed the initial super_admin document if it doesn't exist
 * @param {firebase.User} user
 */
async function seedSuperAdmin(user) {
    if (user.email !== INITIAL_SUPER_ADMIN) return;

    const docRef = db.collection('admins').doc(user.email);
    const doc = await docRef.get();

    if (!doc.exists) {
        await docRef.set({
            email: user.email,
            role: 'super_admin',
            displayName: user.displayName || 'Super Admin',
            addedBy: 'system',
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('Super admin seeded:', user.email);
    }
}

/**
 * Compress and resize an image file to keep Firestore document sizes manageable.
 * @param {File} file - The image file
 * @param {number} maxWidth - Max width in pixels
 * @param {number} maxHeight - Max height in pixels
 * @param {number} quality - JPEG quality 0-1
 * @returns {Promise<string>} - Base64 data URL
 */
function compressImage(file, maxWidth = 400, maxHeight = 500, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Scale down proportionally
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Format a Firestore Timestamp to a readable date string
 * @param {firebase.firestore.Timestamp} ts
 * @returns {string}
 */
function formatDate(ts) {
    if (!ts) return 'N/A';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

console.log('🔥 Firebase initialized for ABVP Tamil Nadu');
