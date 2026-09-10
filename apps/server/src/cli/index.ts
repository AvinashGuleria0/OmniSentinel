import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { ResolverFactory } from '../services/resolvers/resolver.factory';
import { db, monitors } from '../db';
import { ExecutionJobPayload } from '@omnisentinel/shared';
import { closeDb } from '../db';
import { BrowserManager } from '../services/scraping/browser.manager';
import { closeRedisConnection } from '../queues/connection';

import { IntentClassifierService } from '../services/intent/intent.classifier';
import { SchedulerService } from '../workers/scheduler.worker';
import { notificationQueue } from '../queues';
import { TelegramDispatcher } from '../services/notifications/telegram.dispatcher';
import { BrevoDispatcher } from '../services/notifications/brevo.dispatcher';
import { CloudinaryService } from '../services/storage/cloudinary.service';
import { env } from '../config/env';

const program = new Command();

program
  .name('omnisentinel-cli')
  .description('OmniSentinel CLI Test Harness for Domain Resolvers & Intent Engine')
  .version('1.0.0');

// 0. Test Intent Classification (Gemini Flash)
program
  .command('parse-intent')
  .description('Test Gemini Flash Natural Language Intent Classifier & Preview Generator')
  .argument('<prompt>', 'User natural language query')
  .action(async (prompt) => {
    console.log(`\n🤖 [CLI] Parsing Intent for: "${prompt}"`);
    const startTime = Date.now();

    const response = await IntentClassifierService.classify(prompt);
    const duration = Date.now() - startTime;

    console.log('\n🧠 Intent Analysis Result:');
    console.log('----------------------------------------------------');
    console.log(`Classified Domain: ${response.analysis.type}`);
    console.log(`Title:             ${response.analysis.title}`);
    console.log(`Target Query:      ${response.analysis.targetQuery}`);
    console.log(`Operator:          ${response.analysis.conditionOperator}`);
    console.log(`Target Value:      ${response.analysis.targetValue}`);
    console.log(`Currency:          ${response.analysis.currency}`);
    console.log(`Confidence:        ${(response.analysis.confidence * 100).toFixed(1)}%`);
    console.log(`Initial URL:       ${response.analysis.initialUrl || 'None'}`);
    console.log('Filter Metadata:  ', JSON.stringify(response.analysis.filterMetadata));
    console.log(`Execution Time:    ${duration}ms`);
    console.log('----------------------------------------------------');

    console.log('\n🃏 Generated Preview Cards (Search-and-Confirm UX):');
    response.previewResults.forEach((card, idx) => {
      console.log(`  Card ${idx + 1}: ${card.title}`);
      console.log(`    Source: ${card.source} | Price: ${card.currentPrice !== null ? card.currency + ' ' + card.currentPrice : 'N/A'}`);
      console.log(`    URL:    ${card.url}`);
    });
    console.log('');

    await closeDb();
    process.exit(0);
  });

// 0.1 Test Scheduler Tick
program
  .command('scheduler-tick')
  .description('Run a single poll cycle of the background scheduler against Supabase')
  .action(async () => {
    console.log('\n⏰ [CLI] Running manual SchedulerService.tick()...');
    const enqueued = await SchedulerService.tick();
    console.log(`✅ Scheduler tick completed. Enqueued ${enqueued} tasks into execution-queue.`);
    await closeDb();
    await closeRedisConnection();
    process.exit(0);
  });

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

// 6. Verify Telegram Bot
program
  .command('verify-telegram')
  .description('Verify live Telegram Bot connection and optionally dispatch a test alert')
  .option('-c, --chat <chatId>', 'Telegram Chat ID to send test message')
  .action(async (options) => {
    console.log('\n🤖 [CLI] Verifying Telegram Bot Configuration...');
    if (!env.TELEGRAM_BOT_TOKEN) {
      console.error('❌ TELEGRAM_BOT_TOKEN is not configured in .env');
      process.exit(1);
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
      const data = await res.json() as any;

      if (!data.ok) {
        console.error(`❌ Telegram API Error: ${data.description}`);
        process.exit(1);
      }

      console.log('✅ Telegram Bot Authentication Successful!');
      console.log('----------------------------------------------------');
      console.log(`Bot ID:        ${data.result.id}`);
      console.log(`Bot Name:      ${data.result.first_name}`);
      console.log(`Username:      @${data.result.username}`);
      console.log(`Can Join Grps: ${data.result.can_join_groups}`);
      console.log('----------------------------------------------------');

      if (options.chat) {
        console.log(`\n📨 Sending test message to chat ID: ${options.chat}...`);
        const sendRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: options.chat,
            text: '🚨 *OmniSentinel Live Verification Test*\n\nYour autonomous tracking alerts are active and connected!',
            parse_mode: 'Markdown',
          }),
        });
        const sendData = await sendRes.json() as any;
        if (sendData.ok) {
          console.log('✅ Test alert dispatched successfully to Telegram!');
        } else {
          console.error(`❌ Failed to send message: ${sendData.description}`);
        }
      }
    } catch (err: any) {
      console.error(`❌ Telegram verification failed: ${err.message}`);
    }
    process.exit(0);
  });

// 7. Verify Brevo Email API
program
  .command('verify-brevo')
  .description('Verify live Brevo Email API connection and optionally dispatch a test alert')
  .option('-e, --email <email>', 'Recipient email address for test message')
  .action(async (options) => {
    console.log('\n✉️ [CLI] Verifying Brevo Transactional Email Configuration...');
    if (!env.BREVO_API_KEY) {
      console.error('❌ BREVO_API_KEY is not configured in .env');
      process.exit(1);
    }

    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: {
          'api-key': env.BREVO_API_KEY,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`❌ Brevo API Error (${res.status}): ${errText}`);
        process.exit(1);
      }

      const data = await res.json() as any;
      console.log('✅ Brevo Authentication Successful!');
      console.log('----------------------------------------------------');
      console.log(`Account Email: ${data.email}`);
      console.log(`Company:       ${data.companyName || 'N/A'}`);
      console.log(`Sender Name:   ${env.BREVO_SENDER_NAME}`);
      console.log(`Sender Email:  ${env.BREVO_SENDER_EMAIL}`);
      if (data.plan && Array.isArray(data.plan)) {
        data.plan.forEach((p: any) => {
          console.log(`Plan Type:     ${p.type} (Credits: ${p.credits})`);
        });
      }
      console.log('----------------------------------------------------');

      if (options.email) {
        console.log(`\n📨 Sending test transactional email to ${options.email}...`);
        const originalMock = env.MOCK_MODE;
        (env as any).MOCK_MODE = false;
        const sent = await BrevoDispatcher.send(
          {
            monitorId: '00000000-0000-0000-0000-000000000001',
            userId: '00000000-0000-0000-0000-000000000001',
            title: 'OmniSentinel Verification Test',
            message: 'This is a test notification confirming your Brevo transactional email delivery is operating with high fidelity.',
            actionUrl: 'https://github.com/AvinashGuleria0/OmniSentinel',
            currentValue: 1599,
            targetValue: 1600,
          },
          options.email
        );
        (env as any).MOCK_MODE = originalMock;

        if (sent) {
          console.log(`✅ Test email dispatched successfully to ${options.email}!`);
        } else {
          console.error('❌ Failed to dispatch test email.');
        }
      }
    } catch (err: any) {
      console.error(`❌ Brevo verification failed: ${err.message}`);
    }
    process.exit(0);
  });

// 8. Verify Cloudinary Media Upload
program
  .command('verify-cloudinary')
  .description('Verify Cloudinary visual proof CDN upload')
  .action(async () => {
    console.log('\n🖼️ [CLI] Verifying Cloudinary Screenshot Upload...');
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      console.error('❌ Cloudinary credentials are not fully configured in .env');
      process.exit(1);
    }

    try {
      // 1x1 transparent PNG buffer for zero overhead verification
      const samplePng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      console.log(`Cloud Name: ${env.CLOUDINARY_CLOUD_NAME}`);
      console.log('Uploading sample visual proof buffer to Cloudinary...');

      const url = await CloudinaryService.uploadScreenshot(samplePng, 'live_verification');
      if (url) {
        console.log('✅ Cloudinary Visual Proof Upload Successful!');
        console.log('----------------------------------------------------');
        console.log(`CDN Secure URL: ${url}`);
        console.log('----------------------------------------------------');
      } else {
        console.error('❌ Cloudinary upload returned null.');
      }
    } catch (err: any) {
      console.error(`❌ Cloudinary verification failed: ${err.message}`);
    }
    process.exit(0);
  });

// 9. Verify Gemini Flash AI Intent
program
  .command('verify-gemini')
  .description('Verify Gemini Flash AI Intent Classification Engine')
  .argument('[prompt]', 'Test query', 'Track Bharti Airtel stock if price drops below 1600 INR')
  .action(async (prompt) => {
    console.log(`\n🧠 [CLI] Verifying Gemini Flash AI Intent Engine for: "${prompt}"...`);
    if (!env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not configured in .env');
      process.exit(1);
    }

    try {
      const originalMock = env.MOCK_MODE;
      (env as any).MOCK_MODE = false;
      const startTime = Date.now();
      const res = await IntentClassifierService.classify(prompt);
      const duration = Date.now() - startTime;
      (env as any).MOCK_MODE = originalMock;

      console.log('✅ Gemini Flash Inference Successful!');
      console.log('----------------------------------------------------');
      console.log(`Classified Domain: ${res.analysis.type}`);
      console.log(`Generated Title:   ${res.analysis.title}`);
      console.log(`Target Query:      ${res.analysis.targetQuery}`);
      console.log(`Condition:         ${res.analysis.conditionOperator} ${res.analysis.targetValue || ''} ${res.analysis.currency || ''}`);
      console.log(`Confidence Score:  ${(res.analysis.confidence * 100).toFixed(1)}%`);
      console.log(`Inference Latency: ${duration}ms`);
      console.log('----------------------------------------------------');
    } catch (err: any) {
      console.error(`❌ Gemini verification failed: ${err.message}`);
    }
    await closeDb();
    process.exit(0);
  });

// 10. Unified Live Diagnostics Suite
program
  .command('verify-live')
  .description('Execute end-to-end diagnostics across all live production services')
  .action(async () => {
    console.log('\n============================================================');
    console.log('🛡️  OMNISENTINEL PRODUCTION INTEGRATIONS DIAGNOSTIC SUITE');
    console.log('============================================================\n');

    const results: Array<{ service: string; status: 'PASS' | 'FAIL'; detail: string; latencyMs?: number }> = [];

    // 1. Supabase PostgreSQL
    try {
      const start = Date.now();
      const userCount = await db.select().from(monitors);
      results.push({
        service: 'Supabase PostgreSQL',
        status: 'PASS',
        detail: `Connected (${userCount.length} monitors present in DB)`,
        latencyMs: Date.now() - start,
      });
    } catch (err: any) {
      results.push({ service: 'Supabase PostgreSQL', status: 'FAIL', detail: err.message });
    }

    // 2. Telegram Bot API
    try {
      const start = Date.now();
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
      const data = await res.json() as any;
      if (data.ok) {
        results.push({
          service: 'Telegram Bot API',
          status: 'PASS',
          detail: `@${data.result.username} (ID: ${data.result.id})`,
          latencyMs: Date.now() - start,
        });
      } else {
        results.push({ service: 'Telegram Bot API', status: 'FAIL', detail: data.description });
      }
    } catch (err: any) {
      results.push({ service: 'Telegram Bot API', status: 'FAIL', detail: err.message });
    }

    // 3. Brevo Transactional Email
    try {
      const start = Date.now();
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': env.BREVO_API_KEY, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json() as any;
        results.push({
          service: 'Brevo Email API',
          status: 'PASS',
          detail: `${data.email} (${data.companyName || 'Verified'})`,
          latencyMs: Date.now() - start,
        });
      } else {
        results.push({ service: 'Brevo Email API', status: 'FAIL', detail: `HTTP ${res.status}` });
      }
    } catch (err: any) {
      results.push({ service: 'Brevo Email API', status: 'FAIL', detail: err.message });
    }

    // 4. Cloudinary CDN
    try {
      const start = Date.now();
      const samplePng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      const url = await CloudinaryService.uploadScreenshot(samplePng, 'diag_test');
      if (url) {
        results.push({
          service: 'Cloudinary CDN',
          status: 'PASS',
          detail: 'Upload & signature verified',
          latencyMs: Date.now() - start,
        });
      } else {
        results.push({ service: 'Cloudinary CDN', status: 'FAIL', detail: 'Upload returned null' });
      }
    } catch (err: any) {
      results.push({ service: 'Cloudinary CDN', status: 'FAIL', detail: err.message });
    }

    // 5. Gemini Flash AI Engine
    try {
      const start = Date.now();
      const originalMock = env.MOCK_MODE;
      (env as any).MOCK_MODE = false;
      const res = await IntentClassifierService.classify('Check gold price above 70000 INR');
      (env as any).MOCK_MODE = originalMock;
      results.push({
        service: 'Gemini Flash AI',
        status: 'PASS',
        detail: `Intent mapped: ${res.analysis.type} (${(res.analysis.confidence * 100).toFixed(0)}% conf)`,
        latencyMs: Date.now() - start,
      });
    } catch (err: any) {
      results.push({ service: 'Gemini Flash AI', status: 'FAIL', detail: err.message });
    }

    // Print Diagnostic Report Card
    console.log('DIAGNOSTIC RESULTS:');
    console.log('----------------------------------------------------------------------');
    results.forEach((r) => {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      const latency = r.latencyMs !== undefined ? `[${r.latencyMs}ms]` : '';
      console.log(`${icon} ${r.service.padEnd(22)} | ${r.status.padEnd(5)} | ${r.detail} ${latency}`);
    });
    console.log('----------------------------------------------------------------------');

    const allPassed = results.every((r) => r.status === 'PASS');
    if (allPassed) {
      console.log('\n🎉 ALL LIVE PRODUCTION INTEGRATIONS ARE OPERATIONAL & VERIFIED!\n');
    } else {
      console.log('\n⚠️ Some integrations had warnings or failed. Check configuration in .env.\n');
    }

    await closeDb();
    await closeRedisConnection();
    process.exit(allPassed ? 0 : 1);
  });

program.parse(process.argv);
