const connectDB = require('./config/db');
const User = require('./models/User');

async function reset() {
  await connectDB();
  const user = await User.findOne({ where: { email: 'admin@aocore.com' } });
  if (user) {
    user.tourCompleted = false;
    await user.save();
    console.log('Successfully reset tourCompleted to false for admin@aocore.com');
  } else {
    console.log('Admin user not found');
  }
  process.exit(0);
}

reset();
