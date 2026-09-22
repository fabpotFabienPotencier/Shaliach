// ═══════════════════════════════════════════════════════════════
// Prisma Seed — Default Data for Shaliach AI
// ═══════════════════════════════════════════════════════════════
// Run: pnpm db:seed
// Creates the single authorized user, default sender profile,
// and initial application settings.
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Shaliach AI database...');

  // ─── Create User ─────────────────────────────────────────
  // IMPORTANT: Change the password after first login!
  const passwordHash = await bcrypt.hash('changeme', 12);

  const user = await prisma.user.upsert({
    where: { email: 'joshua@fixhubtech.com' },
    update: {},
    create: {
      email: 'joshua@fixhubtech.com',
      name: 'Joshua Caleb',
      passwordHash,
    },
  });

  console.log(`✅ User created: ${user.name} (${user.email})`);

  // ─── Create Default Sender Profile ───────────────────────

  const senderProfile = await prisma.senderProfile.upsert({
    where: { id: 'default-sender-profile' },
    update: {},
    create: {
      id: 'default-sender-profile',
      name: 'Default — Joshua Caleb',
      fromName: 'Joshua Caleb',
      fromEmail: 'joshua@mail.fixhubtech.com',
      replyToEmail: 'joshua@reply.fixhubtech.com',
      companyName: 'FixHubTech',
      companyWebsite: 'https://fixhubtech.com',
      postalAddress: '{{postal_address}}',
      signature: null,
      isDefault: true,
    },
  });

  console.log(`✅ Sender profile created: ${senderProfile.name}`);

  // ─── Create Default Settings ─────────────────────────────

  const defaultSettings = [
    { key: 'company_name', value: 'FixHubTech' },
    { key: 'company_website', value: 'https://fixhubtech.com' },
    { key: 'company_tagline', value: 'Web Design & Digital Solutions' },
    { key: 'owner_name', value: 'Joshua Caleb' },
    { key: 'owner_title', value: 'Founder & Web Developer' },
    { key: 'postal_address', value: '' },
    { key: 'daily_send_limit', value: '200' },
    { key: 'import_chunk_size', value: '1000' },
    { key: 'ai_concurrency', value: '3' },
    { key: 'email_concurrency', value: '5' },
    { key: 'follow_up_delay_days', value: '3' },
    { key: 'sending_window_start', value: '09:00' },
    { key: 'sending_window_end', value: '17:00' },
    { key: 'sending_timezone', value: 'America/New_York' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log(`✅ ${defaultSettings.length} default settings created`);
  console.log('');
  console.log('🚀 Seed complete!');
  console.log('');
  console.log('⚠️  IMPORTANT: Change the default password after first login!');
  console.log('   Default credentials:');
  console.log('   Email:    joshua@fixhubtech.com');
  console.log('   Password: changeme');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
