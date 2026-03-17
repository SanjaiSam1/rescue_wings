const User = require('../models/User');

const DEFAULT_ADMIN = {
  name: 'System Admin',
  email: 'admin@app.com',
  password: 'Admin@123',
  role: 'admin',
  phone: '',
  isActive: true,
  isEmailVerified: true,
};

async function ensureDefaultAdmin() {
  const existing = await User.findOne({ email: DEFAULT_ADMIN.email }).select('_id');
  if (existing) return { created: false, email: DEFAULT_ADMIN.email };

  await User.create(DEFAULT_ADMIN);
  return { created: true, email: DEFAULT_ADMIN.email };
}

module.exports = {
  ensureDefaultAdmin,
  DEFAULT_ADMIN,
};
