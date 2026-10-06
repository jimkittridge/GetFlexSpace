import { json, submitRequest } from '../../server/tour-requests.js';

export const onRequestPost = submitRequest;
export const onRequestGet = async ({ env }) => {
  try {
    await env.LEADS_DB.prepare('SELECT id FROM tour_requests LIMIT 0').all();
    return json({ available: true, notificationsReady: env.TOUR_EMAIL_ENABLED === 'true' && Boolean(env.TOUR_NOTIFICATIONS) });
  } catch { return json({ available: false, notificationsReady: false }, 503); }
};
