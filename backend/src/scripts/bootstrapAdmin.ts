import { createOrUpdateUser } from '../services/authService.js';
import type { UserRole } from '../types.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || 'Policy Intelligence Admin';
const role = (process.env.ADMIN_ROLE || 'admin') as UserRole;

if (!email || !password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  process.exit(1);
}

if (!['admin', 'operator', 'briefing_user'].includes(role)) {
  console.error('ADMIN_ROLE must be admin, operator, or briefing_user');
  process.exit(1);
}

const user = createOrUpdateUser({
  email,
  name,
  password,
  role,
});

console.log(JSON.stringify({ user }, null, 2));
