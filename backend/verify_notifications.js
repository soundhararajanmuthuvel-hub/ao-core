const connectDB = require('./config/db');
const Notification = require('./models/Notification');
const User = require('./models/User');
const { getNotifications, markRead, markAllRead, deleteNotification, clearAllNotifications } = require('./controllers/notificationController');

const makeMockRes = () => {
  return {
    statusCode: 200,
    data: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(payload) {
      this.data = payload;
      return this;
    }
  };
};

async function runVerification() {
  console.log('--------------------------------------------------');
  console.log('🤖 STARTING NOTIFICATION CENTER BACKEND CONTROLLERS TESTING');
  console.log('--------------------------------------------------\n');

  await connectDB();

  // Find a test user or create a temporary one
  let testUser = await User.findOne();
  if (!testUser) {
    // If no user exists, create a temporary admin user
    testUser = await User.create({
      name: 'Test Notif Admin',
      email: 'notif_test@ao.com',
      password: 'password123',
      role: 'SUPER ADMIN'
    });
    console.log(`✓ Created temporary user: ${testUser.email}`);
  } else {
    console.log(`✓ Using existing user for test: ${testUser.email} (ID: ${testUser.id})`);
  }

  // 1. Clean up existing notifications for this user
  await Notification.destroy({ where: { userId: testUser.id } });
  await Notification.destroy({ where: { userId: null } }); // Clean up global ones if they exist

  console.log('\nTest 1: Creating mock notifications...');
  
  // Create 3 notifications: 2 unread, 1 read
  const n1 = await Notification.create({
    title: 'Test Unread 1',
    message: 'Message 1',
    isRead: false,
    userId: testUser.id
  });
  const n2 = await Notification.create({
    title: 'Test Unread 2',
    message: 'Message 2',
    isRead: false,
    userId: testUser.id
  });
  const n3 = await Notification.create({
    title: 'Test Read 1',
    message: 'Message 3',
    isRead: true,
    userId: testUser.id
  });

  console.log('✓ Mock notifications created.');

  // 2. Test getNotifications - ALL
  console.log('\nTest 2: Verifying getNotifications for status: all...');
  {
    const req = { user: testUser, query: { status: 'all' } };
    const res = makeMockRes();
    await getNotifications(req, res, (err) => { throw err; });
    console.log(`✓ Total notifications retrieved: ${res.data.notifications.length} (Expected: 3)`);
    console.log(`✓ Unread count: ${res.data.unreadCount} (Expected: 2)`);
    if (res.data.notifications.length !== 3 || res.data.unreadCount !== 2) {
      console.error('❌ Failed status: all checks');
      process.exit(1);
    }
  }

  // 3. Test getNotifications - UNREAD only
  console.log('\nTest 3: Verifying getNotifications for status: unread...');
  {
    const req = { user: testUser, query: { status: 'unread' } };
    const res = makeMockRes();
    await getNotifications(req, res, (err) => { throw err; });
    console.log(`✓ Unread notifications retrieved: ${res.data.notifications.length} (Expected: 2)`);
    if (res.data.notifications.length !== 2) {
      console.error('❌ Failed status: unread checks');
      process.exit(1);
    }
  }

  // 4. Test getNotifications - READ only
  console.log('\nTest 4: Verifying getNotifications for status: read...');
  {
    const req = { user: testUser, query: { status: 'read' } };
    const res = makeMockRes();
    await getNotifications(req, res, (err) => { throw err; });
    console.log(`✓ Read notifications retrieved: ${res.data.notifications.length} (Expected: 1)`);
    if (res.data.notifications.length !== 1) {
      console.error('❌ Failed status: read checks');
      process.exit(1);
    }
  }

  // 5. Test markRead toggle (mark unread to read, and vice-versa)
  console.log('\nTest 5: Verifying markRead controller (toggle status)...');
  {
    // Mark n1 as read
    const reqMarkRead = { user: testUser, params: { id: n1.id }, body: { isRead: true } };
    const resMarkRead = makeMockRes();
    await markRead(reqMarkRead, resMarkRead, (err) => { throw err; });
    
    // Verify in db
    const updatedN1 = await Notification.findByPk(n1.id);
    console.log(`✓ Notification 1 isRead status: ${updatedN1.isRead} (Expected: true)`);
    if (!updatedN1.isRead) {
      console.error('❌ Failed to mark notification as read');
      process.exit(1);
    }

    // Toggle back to unread
    const reqMarkUnread = { user: testUser, params: { id: n1.id }, body: { isRead: false } };
    const resMarkUnread = makeMockRes();
    await markRead(reqMarkUnread, resMarkUnread, (err) => { throw err; });
    const toggledN1 = await Notification.findByPk(n1.id);
    console.log(`✓ Notification 1 isRead status toggled back: ${toggledN1.isRead} (Expected: false)`);
    if (toggledN1.isRead) {
      console.error('❌ Failed to toggle notification to unread');
      process.exit(1);
    }
  }

  // 6. Test markAllRead
  console.log('\nTest 6: Verifying markAllRead controller...');
  {
    const req = { user: testUser };
    const res = makeMockRes();
    await markAllRead(req, res, (err) => { throw err; });
    
    // Check if any unread left
    const reqGet = { user: testUser, query: { status: 'unread' } };
    const resGet = makeMockRes();
    await getNotifications(reqGet, resGet, (err) => { throw err; });
    console.log(`✓ Unread notifications count after markAllRead: ${resGet.data.notifications.length} (Expected: 0)`);
    console.log(`✓ Unread count badge: ${resGet.data.unreadCount} (Expected: 0)`);
    if (resGet.data.notifications.length !== 0 || resGet.data.unreadCount !== 0) {
      console.error('❌ Failed markAllRead checks');
      process.exit(1);
    }
  }

  // 7. Test deleteNotification (single delete)
  console.log('\nTest 7: Verifying deleteNotification (single delete)...');
  {
    const req = { user: testUser, params: { id: n1.id } };
    const res = makeMockRes();
    await deleteNotification(req, res, (err) => { throw err; });
    
    const checkDeleted = await Notification.findByPk(n1.id);
    console.log(`✓ Checked deleted notification in db: ${checkDeleted ? 'Found' : 'Null'} (Expected: Null)`);
    if (checkDeleted) {
      console.error('❌ Failed: notification was not deleted');
      process.exit(1);
    }
  }

  // 8. Test clearAllNotifications (bulk delete)
  console.log('\nTest 8: Verifying clearAllNotifications (bulk delete)...');
  {
    const req = { user: testUser };
    const res = makeMockRes();
    await clearAllNotifications(req, res, (err) => { throw err; });
    
    const countLeft = await Notification.count({ where: { userId: testUser.id } });
    console.log(`✓ Notification count left for user: ${countLeft} (Expected: 0)`);
    if (countLeft !== 0) {
      console.error('❌ Failed: clearAllNotifications did not delete all user notifications');
      process.exit(1);
    }
  }

  // Cleanup temporary user if created
  if (testUser.email === 'notif_test@ao.com') {
    await testUser.destroy();
    console.log('\n✓ Cleaned up temporary test user.');
  }

  console.log('\n--------------------------------------------------');
  console.log('🎉 ALL NOTIFICATION CENTER BACKEND TESTS PASSED!');
  console.log('--------------------------------------------------');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
