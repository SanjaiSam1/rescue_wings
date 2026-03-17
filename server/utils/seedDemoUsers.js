const User = require('../models/User');
const Volunteer = require('../models/Volunteer');

const DEMO_USERS = [
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

const ensureDemoUsers = async () => {
  for (const userData of DEMO_USERS) {
    const existing = await User.findOne({ email: userData.email }).select('+password');

    if (!existing) {
      const created = await User.create({
        ...userData,
        isActive: true,
        isEmailVerified: true,
      });

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
      }

      continue;
    }

    existing.name = userData.name;
    existing.phone = userData.phone;
    existing.role = userData.role;
    existing.isActive = true;
    existing.isEmailVerified = true;
    existing.password = userData.password;
    await existing.save();

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
    } else {
      await Volunteer.deleteOne({ userId: existing._id });
    }
  }
};

module.exports = {
  ensureDemoUsers,
  DEMO_USERS,
};