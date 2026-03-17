require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rescue-wings');

  const totalUsers = await User.countDocuments();
  const byRole = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log(JSON.stringify({ totalUsers, byRole }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
