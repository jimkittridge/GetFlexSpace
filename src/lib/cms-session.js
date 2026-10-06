// This small adapter follows Sveltia CMS 0.229.0's user cache. Keep the CMS
// version pinned and verify these keys when upgrading. Never copy the token
// into another store, a URL, or a message; the server still verifies access.
export const CMS_VERSION = '0.229.0';
export const CMS_USER_KEYS = ['sveltia-cms.user', 'decap-cms-user', 'netlify-cms-user'];

export function readCmsSession(storage) {
  try {
    for (const key of CMS_USER_KEYS) {
      const raw = storage.getItem(key);
      if (!raw) continue;
      // An empty primary cache represents an explicit sign-out. Do not fall
      // back to an old token left by another CMS after that point.
      const user = JSON.parse(raw);
      if (user?.backendName !== 'github' || typeof user.token !== 'string'
        || !/^\S{20,255}$/.test(user.token)) return null;
      return { token: user.token };
    }
  } catch { /* Missing, inaccessible, or invalid storage means signed out. */ }
  return null;
}
