// Firebase loads on demand, not with the page: most visitors never sign in, and it is
// a large part of the code every page would otherwise download first.
export const loadFirebaseAuth = () =>
  Promise.all([import("../../../firebase"), import("firebase/auth")]).then(([{ auth }, firebaseAuth]) => ({ auth, ...firebaseAuth }));
