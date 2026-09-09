import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export class CloudinaryService {
  /**
   * Uploads an image Buffer to Cloudinary CDN and returns the secure public HTTPS URL
   */
  public static async uploadScreenshot(buffer: Buffer, monitorId: string): Promise<string | null> {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      logger.info('Cloudinary credentials not configured. Skipping CDN upload.');
      return null;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = 'omnisentinel_screenshots';
      const publicId = `monitor_${monitorId}_${timestamp}`;

      // Cloudinary signature generation: SHA-1 of sorted query params + api_secret
      const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
      const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

      const formData = new FormData();
      const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      formData.append('file', base64Image);
      formData.append('api_key', env.CLOUDINARY_API_KEY);
      formData.append('timestamp', String(timestamp));
      formData.append('public_id', publicId);
      formData.append('folder', folder);
      formData.append('signature', signature);

      const endpoint = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`;
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Cloudinary responded with status ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as any;
      logger.info({ publicId, url: data.secure_url }, 'Visual proof uploaded to Cloudinary');
      return data.secure_url;
    } catch (err: any) {
      logger.warn({ err: err?.message }, 'Cloudinary upload failed');
      return null;
    }
  }
}
