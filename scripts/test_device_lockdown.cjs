/**
 * Verification Test for Hardware Device Lockdown & Whitelisting
 * 
 * Verifies:
 * 1. Admin Zero-Lockout Auto-Enrollment (Hardik Patel's current device is instantly approved)
 * 2. Unapproved Device Hard-Block (Unknown phone/PC blocked with 403 DEVICE_NOT_APPROVED)
 * 3. 6-Digit Admin Pairing Code Flow (Staff enters pairing code -> hardware bound & approved)
 * 4. Admin Remote Revocation / Kill Switch
 * 5. Full Clean Teardown
 */

const path = require('path');
const fs = require('fs');

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const { PrismaClient } = require(path.resolve(process.cwd(), 'node_modules/@prisma/client'));
const directUrl = process.env.DIRECT_URL;
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } }
});

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('\n======================================================');
  console.log('   HARDWARE DEVICE LOCKDOWN VERIFICATION TEST   ');
  console.log('======================================================\n');

  try {
    // 1. Ensure lockdown mode is ENFORCING
    await prisma.systemSetting.upsert({
      where: { key: 'hardware_device_lockdown' },
      create: { key: 'hardware_device_lockdown', value: 'ENFORCING' },
      update: { value: 'ENFORCING' }
    });
    console.log('✓ Hardware device lockdown is set to ENFORCING');

    // 2. Fetch Admin User
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@sm.com' }
    });
    if (!adminUser) throw new Error('admin@sm.com not found');

    // Clean up any existing test devices for admin
    await prisma.trustedDevice.deleteMany({
      where: { userId: adminUser.id }
    });
    console.log('✓ Reset existing admin devices to simulate first-time login');

    // 3. Test: Admin logs in with current device -> Must be auto-approved
    const adminDeviceId = 'DEV-ADMIN-MASTER-CURRENT';
    const adminDevicePayload = {
      id: adminDeviceId,
      name: 'Hardik Patel Office Laptop (Chrome • RTX 3060)',
      type: 'DESKTOP',
      browser: 'Chrome 122',
      os: 'Windows 11',
      cpuCores: 16,
      gpuRenderer: 'NVIDIA GeForce RTX 3060',
      screenResolution: '1920x1080 @1.25x',
      hardwareHash: '8492AFBC'
    };

    console.log('\n--- Test 1: Admin Zero-Lockout Auto-Enrollment ---');
    const { validateAndTrackDevice } = require(path.resolve(process.cwd(), 'server/utils/deviceSecurity.ts'));
    
    // Mock H3 event
    const mockEvent = {
      node: {
        req: {
          headers: {
            'x-forwarded-for': '103.21.124.5',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0'
          },
          socket: { remoteAddress: '103.21.124.5' }
        }
      }
    };

    const adminResult = await validateAndTrackDevice(mockEvent, adminUser, adminDevicePayload);
    console.log('Admin Result:', { allowed: adminResult.allowed, isAutoGrandfathered: adminResult.isAutoGrandfathered });
    if (!adminResult.allowed || !adminResult.isAutoGrandfathered) {
      throw new Error('Admin first device must be auto-grandfathered and allowed!');
    }
    console.log('✓ Admin device auto-enrolled and approved as Primary Master Device!');

    // 4. Test: Admin logs in again with the same device -> Must be allowed
    console.log('\n--- Test 2: Admin Subsequent Login with Approved Device ---');
    const adminSubsequentResult = await validateAndTrackDevice(mockEvent, adminUser, adminDevicePayload);
    if (!adminSubsequentResult.allowed) {
      throw new Error('Approved admin device must be allowed on subsequent logins!');
    }
    console.log('✓ Admin subsequent login permitted seamlessly!');

    // 5. Test: Non-admin staff (Rahul) logs in from an unauthorized phone -> Must be blocked
    console.log('\n--- Test 3: Unauthorized Device Hard-Block ---');
    const rahulUser = await prisma.user.findUnique({ where: { email: 'rahul@sm.com' } });
    if (!rahulUser) throw new Error('rahul@sm.com not found');

    const unauthorizedDeviceId = 'DEV-UNKNOWN-HACKER-PHONE';
    const unauthorizedPayload = {
      id: unauthorizedDeviceId,
      name: 'Unknown Personal Phone (Safari • iPhone)',
      type: 'MOBILE',
      browser: 'Safari',
      os: 'iOS',
      cpuCores: 6,
      gpuRenderer: 'Apple GPU',
      screenResolution: '390x844 @3x',
      hardwareHash: '992211AA'
    };

    let blockedCorrectly = false;
    try {
      await validateAndTrackDevice(mockEvent, rahulUser, unauthorizedPayload);
    } catch (err) {
      if (err.data && err.data.code === 'DEVICE_NOT_APPROVED') {
        blockedCorrectly = true;
        console.log(`✓ Correctly blocked with 403: "${err.data.message}"`);
      } else {
        console.error('Unexpected error:', err);
      }
    }

    if (!blockedCorrectly) {
      throw new Error('Unauthorized device was NOT blocked!');
    }

    // Verify the unapproved device was registered as PENDING in DB
    const pendingInDb = await prisma.trustedDevice.findUnique({
      where: { deviceId: unauthorizedDeviceId }
    });
    if (!pendingInDb || pendingInDb.isApproved) {
      throw new Error('Device must be registered in DB as isApproved = false');
    }
    console.log('✓ Unauthorized device saved as PENDING for Admin review');

    // 6. Test: Admin generates pairing code for Rahul
    console.log('\n--- Test 4: Admin Generates 6-Digit Pairing Code ---');
    const pairingCode = '849201';
    const tempPairingDevice = await prisma.trustedDevice.create({
      data: {
        deviceId: `PAIR-${pairingCode}`,
        userId: rahulUser.id,
        deviceName: "Rahul's Company Samsung Phone",
        pairingCode,
        pairingExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        isApproved: false
      }
    });
    console.log(`✓ Admin generated pairing code: ${pairingCode} (Valid for 15 mins)`);

    // 7. Test: Rahul logs in on a new device with the pairing code -> Must be approved!
    console.log('\n--- Test 5: Staff Logs In with Pairing Code ---');
    const rahulNewPhoneId = 'DEV-RAHUL-S23-OFFICIAL';
    const rahulDeviceWithCode = {
      id: rahulNewPhoneId,
      name: "Rahul's Samsung Galaxy S23 (Chrome)",
      type: 'MOBILE',
      browser: 'Chrome 122',
      os: 'Android 14',
      cpuCores: 8,
      gpuRenderer: 'Adreno 740',
      screenResolution: '1080x2340 @2.8x',
      hardwareHash: '7733CCBB',
      pairingCode: pairingCode
    };

    const rahulResult = await validateAndTrackDevice(mockEvent, rahulUser, rahulDeviceWithCode);
    if (!rahulResult.allowed || !rahulResult.device.isApproved) {
      throw new Error('Login with valid pairing code must approve device!');
    }
    console.log('✓ Rahul new phone paired, approved, and permanently bound to hardware!');

    // 8. Test: Admin Revokes / Blocks Rahul's device
    console.log('\n--- Test 6: Admin Remote Kill Switch ---');
    await prisma.trustedDevice.update({
      where: { deviceId: rahulNewPhoneId },
      data: { isApproved: false, isBlocked: true, blockedReason: 'Employee Left Organization' }
    });

    let killSwitchBlocked = false;
    try {
      await validateAndTrackDevice(mockEvent, rahulUser, rahulDeviceWithCode);
    } catch (err) {
      killSwitchBlocked = true;
      console.log(`✓ Kill switch active: "${err.statusMessage}"`);
    }

    if (!killSwitchBlocked) {
      throw new Error('Revoked/Blocked device was NOT blocked by kill switch!');
    }
    console.log('✓ Remote kill switch instantly revoked access!');

    // 9. Clean up test records
    console.log('\n--- Cleanup ---');
    await prisma.trustedDevice.deleteMany({
      where: {
        deviceId: {
          in: [adminDeviceId, unauthorizedDeviceId, rahulNewPhoneId, `PAIR-${pairingCode}`]
        }
      }
    });
    console.log('✓ Cleaned up all synthetic test devices.');

    console.log('\n======================================================');
    console.log('   ALL 6 HARDWARE SECURITY DEFENSE TESTS PASSED!   ');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\nFAILED TEST:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
