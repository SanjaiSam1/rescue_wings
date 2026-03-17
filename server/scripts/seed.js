require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rescue-wings');
  const User = require('../models/User');
  const Volunteer = require('../models/Volunteer');
  const Alert = require('../models/Alert');

  await User.deleteMany({});
  await Volunteer.deleteMany({});
  await Alert.deleteMany({});

  const admin = await User.create({ name: 'Admin User', email: 'admin@rescue.com', password: 'admin123', phone: '+91 9000000001', role: 'admin' });
  const volUser = await User.create({ name: 'Rahul Kumar', email: 'vol@rescue.com', password: 'vol123', phone: '+91 9000000002', role: 'volunteer' });
  await User.create({ name: 'Priya Citizen', email: 'citizen@rescue.com', password: 'citizen123', phone: '+91 9000000003', role: 'citizen' });
  await Volunteer.create({ userId: volUser._id, skills: ['first-aid', 'swimming'], verificationStatus: 'approved', availability: 'available' });
  await Alert.create({ title: 'Flood Warning - Chennai', message: 'Evacuate low-lying areas immediately.', type: 'warning', severity: 'high', createdBy: admin._id, isActive: true });

  console.log('✅ Seeded: admin@rescue.com/admin123 | vol@rescue.com/vol123 | citizen@rescue.com/citizen123');
  process.exit(0);
}
seed().catch(err => { console.error(err); process.exit(1); });
