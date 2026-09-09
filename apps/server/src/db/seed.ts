import { db, users, monitors } from './index';
import { logger } from '../utils/logger';

export async function seedDemoData() {
  try {
    logger.info('Seeding demo data into database...');

    // 1. Create a demo user
    const [demoUser] = await db
      .insert(users)
      .values({
        email: 'demo@omnisentinel.dev',
        telegramChatId: '123456789',
        preferredChannel: 'TELEGRAM',
      })
      .onConflictDoNothing()
      .returning();

    const userId = demoUser?.id || (await db.query.users.findFirst())?.id;

    if (!userId) {
      logger.error('Failed to get or create demo user');
      return;
    }

    // 2. Create demo monitors for each of the 4 domains
    await db
      .insert(monitors)
      .values([
        {
          userId,
          title: 'Airtel Stock Alert',
          type: 'STOCK',
          targetSymbol: 'BHARTIARTL.NS',
          rawPrompt: 'Notify me when Airtel stock drops below 1600',
          conditionOperator: 'LT',
          targetValue: '1600.00',
          frequencyMinutes: 15,
        },
        {
          userId,
          title: 'Nike Air Max Watch',
          type: 'ECOMMERCE',
          targetUrl: 'https://www.amazon.in/dp/B0CKWVR2C7',
          rawPrompt: 'Alert me when Nike Air Max drops below 3000 on Amazon with HDFC card',
          conditionOperator: 'LT',
          targetValue: '3000.00',
          filterMetadata: {
            include_coupons: true,
            selected_banks: ['HDFC'],
          },
          frequencyMinutes: 60,
        },
        {
          userId,
          title: 'Remote MERN Internships',
          type: 'JOB',
          targetSymbol: 'MERN stack intern remote',
          rawPrompt: 'Tell me when there is a remote MERN stack software engineer internship with at least 25000 stipend',
          conditionOperator: 'NEW_ENTRY',
          targetValue: '25000.00',
          frequencyMinutes: 120,
        },
        {
          userId,
          title: 'DU Cutoff Announcements',
          type: 'GENERIC_WEB',
          targetUrl: 'https://du.ac.in/index.php?page=admissions',
          rawPrompt: 'Alert me when Delhi University releases the cutoff list',
          conditionOperator: 'CONTAINS',
          frequencyMinutes: 30,
        },
      ])
      .onConflictDoNothing();

    logger.info('Demo data seeded successfully!');
  } catch (err) {
    logger.error({ err }, 'Error seeding demo data');
  }
}

if (process.argv[1]?.includes('seed')) {
  seedDemoData().then(() => process.exit(0));
}
