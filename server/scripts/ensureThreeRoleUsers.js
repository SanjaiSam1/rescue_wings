require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Volunteer = require('../models/Volunteer');

const USERS = [
  {
    name: 'Citizen Demo',
    email: 'citizen.demo@rescue.com',
    password: 'Citizen@123',
    phone: '+91 9000000101',
    role: 'citizen',
  },
  {
    name: 'Volunteer Demo',
    email: 'volunteer.demo@rescue.com',
    password: 'Volunteer@123',
    phone: '+91 9000000102',
    role: 'volunteer',
  },
  {
    name: 'Admin Demo',
    email: 'admin.demo@rescue.com',
    password: 'Admin@123',
    phone: '+91 9000000103',
    role: 'admin',
  },
];

async function ensureUsers() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rescue-wings');

  for (const userData of USERS) {
    const existing = await User.findOne({ email: userData.email }).select('+password');
    if (!existing) {
      const created = await User.create(userData);
      console.log(`CREATED ${userData.role} ${userData.email}`);

      if (userData.role === 'volunteer') {
        await Volunteer.findOneAndUpdate(
          { userId: created._id },
          {
            userId: created._id,
            verificationStatus: 'approved',
            availability: 'available',
            skills: ['first-aid'],
          },
          { upsert: true, new: true }
        );
        console.log(`APPROVED volunteer profile for ${userData.email}`);
      }
      continue;
    }

    existing.name = userData.name;
    existing.phone = userData.phone;
    existing.role = userData.role;
    existing.isActive = true;
    existing.password = userData.password;
    await existing.save();
    console.log(`UPDATED ${userData.role} ${userData.email}`);

    if (userData.role === 'volunteer') {
      await Volunteer.findOneAndUpdate(
        { userId: existing._id },
        {
          userId: existing._id,
          verificationStatus: 'approved',
          availability: 'available',
          skills: ['first-aid'],
        },
        { upsert: true, new: true }
      );
      console.log(`APPROVED volunteer profile for ${userData.email}`);
    }

    if (userData.role !== 'volunteer') {
      await Volunteer.deleteOne({ userId: existing._id });
    }
  }

  await mongoose.disconnect();
}

ensureUsers().catch(async (error) => {
  console.error(error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
