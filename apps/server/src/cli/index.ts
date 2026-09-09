import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { ResolverFactory } from '../services/resolvers/resolver.factory';
import { db, monitors } from '../db';
import { ExecutionJobPayload } from '@omnisentinel/shared';
import { closeDb } from '../db';
import { BrowserManager } from '../services/scraping/browser.manager';

const program = new Command();

program
  .name('omnisentinel-cli')
  .description('OmniSentinel CLI Test Harness for Domain Resolvers')
  .version('1.0.0');

// 1. Test Stock Resolver
program
  .command('stock')
  .description('Test StockResolver against a live or mock ticker')
  .argument('<symbol>', 'Stock Ticker (e.g. BHARTIARTL.NS, AAPL, RELIANCE.NS)')
  .option('-t, --target <value>', 'Target price threshold', '1600')
  .option('-o, --operator <op>', 'Condition operator (LT, GT, EQUALS)', 'LT')
  .action(async (symbol, options) => {
    console.log(`\n🔍 [CLI] Testing StockResolver for: ${symbol}`);
    const startTime = Date.now();

    const payload: ExecutionJobPayload = {
      monitorId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      type: 'STOCK',
      targetSymbol: symbol,
      targetUrl: null,
      conditionOperator: options.operator as any,
      targetValue: parseFloat(options.target),
      lastHash: null,
      filterMetadata: {},
    };

    const result = await ResolverFactory.resolve(payload);
    const duration = Date.now() - startTime;

    console.log('\n📊 Resolution Output:');
    console.log('----------------------------------------------------');
    console.log(`Status:            ${result.status}`);
    console.log(`Current Value:     ${result.currentValue}`);
    console.log(`Condition Met:     ${result.status === 'CONDITION_MET' ? '✅ YES' : '❌ NO'}`);
    console.log(`Execution Time:    ${duration}ms`);
    if (result.notificationMessage) {
      console.log(`Notification Msg:  ${result.notificationMessage}`);
    }
    console.log('Metadata:', JSON.stringify(result.extractedMetadata, null, 2));
    console.log('----------------------------------------------------');

    await closeDb();
    process.exit(0);
  });

// 2. Test E-Commerce Resolver
program
  .command('ecommerce')
  .description('Test EcommerceResolver with Playwright and multi-tier math')
  .argument('<url>', 'Product URL (or "mock")')
  .option('-t, --target <value>', 'Target price', '3000')
  .option('-b, --bank <banks...>', 'Selected banks for discount (e.g. HDFC ICICI)', ['HDFC'])
  .option('-c, --coupons', 'Include on-page coupons', true)
  .action(async (url, options) => {
    console.log(`\n🔍 [CLI] Testing EcommerceResolver for: ${url}`);
    const startTime = Date.now();

    const payload: ExecutionJobPayload = {
      monitorId: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000002',
      type: 'ECOMMERCE',
      targetUrl: url,
      targetSymbol: null,
      conditionOperator: 'LT',
      targetValue: parseFloat(options.target),
      lastHash: null,
      filterMetadata: {
        include_coupons: options.coupons,
        selected_banks: options.bank,
      },
    };

    const result = await ResolverFactory.resolve(payload);
    const duration = Date.now() - startTime;

    console.log('\n📊 Resolution Output:');
    console.log('----------------------------------------------------');
    console.log(`Status:            ${result.status}`);
    console.log(`Effective Price:   ${result.currentValue}`);
    console.log(`Condition Met:     ${result.status === 'CONDITION_MET' ? '✅ YES' : '❌ NO'}`);
    console.log(`Execution Time:    ${duration}ms`);
    if (result.notificationMessage) {
      console.log(`Notification Msg:  ${result.notificationMessage}`);
    }

    if (result.screenshotBuffer) {
      const outPath = path.resolve(process.cwd(), 'scratch/screenshot_test.jpg');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, result.screenshotBuffer);
      console.log(`Visual Proof:      Saved to ${outPath}`);
    }

    console.log('Metadata:', JSON.stringify(result.extractedMetadata, null, 2));
    console.log('----------------------------------------------------');

    await BrowserManager.closeBrowser();
    await closeDb();
    process.exit(0);
  });

// 3. Test Career & Internship Resolver
program
  .command('job')
  .description('Test JobResolver with stipend extraction and seen_jobs deduplication')
  .argument('<query>', 'Job Search Query (e.g. "MERN stack intern remote")')
  .option('-t, --target <value>', 'Minimum stipend threshold', '25000')
  .action(async (query, options) => {
    console.log(`\n🔍 [CLI] Testing JobResolver for: "${query}"`);
    const startTime = Date.now();

    // Fetch or use demo user & monitor from Supabase
    const demoJobMonitor = await db.query.monitors.findFirst({
      where: (table, { eq }) => eq(table.type, 'JOB'),
    });

    const demoUser = await db.query.users.findFirst();
    const userId = demoJobMonitor?.userId || demoUser?.id;
    const monitorId = demoJobMonitor?.id;

    if (!userId || !monitorId) {
      console.error('No seed monitors found in DB. Run seed first.');
      process.exit(1);
    }

    const payload: ExecutionJobPayload = {
      monitorId,
      userId,
      type: 'JOB',
      targetSymbol: query,
      targetUrl: null,
      conditionOperator: 'NEW_ENTRY',
      targetValue: parseFloat(options.target),
      lastHash: null,
      filterMetadata: {},
    };

    const result = await ResolverFactory.resolve(payload);
    const duration = Date.now() - startTime;

    console.log('\n📊 Resolution Output:');
    console.log('----------------------------------------------------');
    console.log(`Status:            ${result.status}`);
    console.log(`Stipend Extracted: ${result.currentValue ? '₹' + result.currentValue : 'Undisclosed'}`);
    console.log(`New Job Detected:  ${result.status === 'CONDITION_MET' ? '✅ YES' : '❌ NO (Already seen or no match)'}`);
    console.log(`Execution Time:    ${duration}ms`);
    if (result.notificationMessage) {
      console.log(`Notification Msg:  ${result.notificationMessage}`);
    }
    console.log('Metadata:', JSON.stringify(result.extractedMetadata, null, 2));
    console.log('----------------------------------------------------');

    await closeDb();
    process.exit(0);
  });

// 4. Test Generic Web Resolver
program
  .command('web')
  .description('Test GenericWebResolver with clean text and SHA-256 diffing')
  .argument('<url>', 'Notice or portal URL (or "mock")')
  .option('-k, --keyword <keyword>', 'Keyword filter', 'cutoff')
  .action(async (url, options) => {
    console.log(`\n🔍 [CLI] Testing GenericWebResolver for: ${url}`);
    const startTime = Date.now();

    const payload: ExecutionJobPayload = {
      monitorId: '00000000-0000-0000-0000-000000000004',
      userId: '00000000-0000-0000-0000-000000000001',
      type: 'GENERIC_WEB',
      targetUrl: url,
      targetSymbol: options.keyword,
      conditionOperator: 'CONTAINS',
      targetValue: null,
      lastHash: null,
      filterMetadata: {},
    };

    const result = await ResolverFactory.resolve(payload);
    const duration = Date.now() - startTime;

    console.log('\n📊 Resolution Output:');
    console.log('----------------------------------------------------');
    console.log(`Status:            ${result.status}`);
    console.log(`Content Hash:      ${result.newHash}`);
    console.log(`Keyword Match:     ${result.status === 'CONDITION_MET' ? '✅ YES' : '❌ NO'}`);
    console.log(`Execution Time:    ${duration}ms`);
    if (result.notificationMessage) {
      console.log(`Notification Msg:  ${result.notificationMessage}`);
    }
    console.log('Metadata:', JSON.stringify(result.extractedMetadata, null, 2));
    console.log('----------------------------------------------------');

    await BrowserManager.closeBrowser();
    await closeDb();
    process.exit(0);
  });

// 5. Test All Seeded Monitors from Supabase
program
  .command('test-all-seed')
  .description('Execute all seeded monitors stored in Supabase through their respective resolvers')
  .action(async () => {
    console.log('\n🚀 [CLI] Fetching and testing all active monitors from Supabase...');
    const allMonitors = await db.select().from(monitors);

    console.log(`Found ${allMonitors.length} monitors. Resolving sequentially...\n`);

    for (const m of allMonitors) {
      console.log(`▶ Testing Monitor: "${m.title}" (${m.type})`);
      const payload: ExecutionJobPayload = {
        monitorId: m.id,
        userId: m.userId,
        type: m.type,
        targetUrl: m.targetUrl,
        targetSymbol: m.targetSymbol,
        conditionOperator: m.conditionOperator as any,
        targetValue: m.targetValue ? parseFloat(m.targetValue) : null,
        lastHash: m.lastContentHash,
        filterMetadata: (m.filterMetadata as any) || {},
      };

      const res = await ResolverFactory.resolve(payload);
      console.log(`  └─ Result: ${res.status} | Value: ${res.currentValue} | Met: ${res.status === 'CONDITION_MET'}`);
      if (res.notificationMessage) {
        console.log(`     Alert: ${res.notificationMessage}`);
      }
      console.log('');
    }

    console.log('✅ All seed monitors executed successfully!\n');
    await BrowserManager.closeBrowser();
    await closeDb();
    process.exit(0);
  });

program.parse(process.argv);
