// Firebase web configuration is public. Access is controlled by firestore.rules.
export const firebaseConfig = {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || globalThis.SUNDAY_FIREBASE_CONFIG?.apiKey || '',
    authDomain: 'zacksbasicstaticwebsite.firebaseapp.com',
    projectId: 'zacksbasicstaticwebsite'
};

// Turn on after Firestore, anonymous sign-in, and the rules are deployed.
// Plain static previews do not load private environment files or inject Vite variables.
export const leaderboardEnabled = Boolean(firebaseConfig.apiKey);
