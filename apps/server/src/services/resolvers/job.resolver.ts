import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { ExecutionJobPayload, ResolutionResult } from '@omnisentinel/shared';
import { BaseResolver } from './base.resolver';
import { db, seenJobs } from '../../db';
import { MOCK_JOB_LISTINGS } from '../../fixtures/mock.fixtures';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export class JobResolver extends BaseResolver {
  /**
   * Extracts stipend / salary figure from text using heuristic regex patterns
   */
  private extractStipend(description: string): number | null {
    // Matches patterns like: ₹25,000, 25k, Rs. 30000, 25000/month
    const patterns = [
      /[₹Rs.]+\s*([0-9,]+)\s*(?:\/|\s*per|\s*a|\s*pm|\s*month)?/i,
      /([0-9]+)k\s*(?:\/|\s*per|\s*a|\s*pm|\s*month|\s*stipend)/i,
      /stipend(?:\s*of|\s*:)?\s*[₹Rs.]?\s*([0-9,]+)/i,
    ];

    for (const regex of patterns) {
      const match = description.match(regex);
      if (match && match[1]) {
        let rawVal = match[1].replace(/,/g, '');
        if (match[0].toLowerCase().includes('k')) {
          return parseFloat(rawVal) * 1000;
        }
        const val = parseFloat(rawVal);
        if (!isNaN(val) && val > 100) {
          return val;
        }
      }
    }
    return null;
  }

  /**
   * Computes a cryptographic hash for a job posting: SHA-256(company + title + location)
   */
  public generateJobHash(company: string, title: string, location: string): string {
    const raw = `${company.toLowerCase().trim()}_${title.toLowerCase().trim()}_${location.toLowerCase().trim()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async resolve(payload: ExecutionJobPayload): Promise<ResolutionResult> {
    const query = payload.targetSymbol || payload.rawPrompt || 'software intern';

    try {
      let listings: Array<{
        id: string;
        title: string;
        company: string;
        location: string;
        description: string;
        applyUrl: string;
        isRemote: boolean;
      }> = [];

      // 1. MOCK MODE OR NO RAPIDAPI KEY
      if (env.MOCK_MODE || !env.RAPIDAPI_KEY) {
        logger.info({ query }, '[MOCK] Using mock career aggregator listings');
        listings = MOCK_JOB_LISTINGS.map((j) => ({
          id: j.job_id,
          title: j.job_title,
          company: j.employer_name,
          location: j.job_city,
          description: j.job_description,
          applyUrl: j.job_apply_link,
          isRemote: j.job_is_remote,
        }));
      } else {
        // 2. LIVE JSEARCH / RAPIDAPI CALL
        const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=1`;
        const response = await fetch(url, {
          headers: {
            'X-RapidAPI-Key': env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
          },
        });

        if (!response.ok) {
          throw new Error(`JSearch API responded with status ${response.status}`);
        }

        const data = (await response.json()) as any;
        listings = (data.data || []).map((j: any) => ({
          id: j.job_id,
          title: j.job_title,
          company: j.employer_name,
          location: j.job_city || j.job_country || 'Remote',
          description: j.job_description || '',
          applyUrl: j.job_apply_link || j.job_google_link,
          isRemote: j.job_is_remote || false,
        }));
      }

      if (listings.length === 0) {
        return {
          status: 'NO_CHANGE',
          currentValue: null,
          newHash: null,
          extractedMetadata: { count: 0, query },
        };
      }

      // 3. DEDUPLICATION ENGINE & FILTERING AGAINST SEEN_JOBS
      let newMatchingJob: (typeof listings)[0] | null = null;
      let matchedStipend: number | null = null;
      let matchedJobHash: string | null = null;

      for (const job of listings) {
        const jobHash = this.generateJobHash(job.company, job.title, job.location);

        // Check if user already received this job alert
        const existing = await db
          .select({ id: seenJobs.id })
          .from(seenJobs)
          .where(and(eq(seenJobs.userId, payload.userId), eq(seenJobs.jobHash, jobHash)))
          .limit(1);

        if (existing.length > 0) {
          continue; // Already notified user about this job
        }

        const stipend = this.extractStipend(job.description);

        // Evaluate target value condition if defined
        const satisfiesCriteria =
          payload.conditionOperator === 'NEW_ENTRY' ||
          !payload.targetValue ||
          (stipend !== null && stipend >= payload.targetValue);

        if (satisfiesCriteria) {
          newMatchingJob = job;
          matchedStipend = stipend;
          matchedJobHash = jobHash;

          // Record into seen_jobs table immediately
          await db
            .insert(seenJobs)
            .values({
              userId: payload.userId,
              monitorId: payload.monitorId,
              jobHash,
              jobTitle: job.title,
              companyName: job.company,
              applyUrl: job.applyUrl,
            })
            .onConflictDoNothing();

          break; // Alert for the first fresh verified opening
        }
      }

      if (newMatchingJob && matchedJobHash) {
        const stipendText = matchedStipend ? `₹${matchedStipend.toLocaleString()}/month` : 'Stipend undisclosed';
        const notificationMessage = `💼 New Career Opening: ${newMatchingJob.title} at ${newMatchingJob.company} (${newMatchingJob.location}) - ${stipendText}. Apply: ${newMatchingJob.applyUrl}`;

        return {
          status: 'CONDITION_MET',
          currentValue: matchedStipend,
          newHash: matchedJobHash,
          extractedMetadata: {
            title: newMatchingJob.title,
            company: newMatchingJob.company,
            location: newMatchingJob.location,
            stipend: matchedStipend,
            applyUrl: newMatchingJob.applyUrl,
          },
          notificationMessage,
          actionUrl: newMatchingJob.applyUrl,
        };
      }

      return {
        status: 'NO_CHANGE',
        currentValue: null,
        newHash: payload.lastHash,
        extractedMetadata: { checkedCount: listings.length, newMatches: 0 },
      };
    } catch (err: any) {
      logger.error({ err, query }, 'JobResolver failed');
      return {
        status: 'FAILED',
        currentValue: null,
        newHash: null,
        extractedMetadata: { error: err?.message },
        error: err?.message,
      };
    }
  }
}
