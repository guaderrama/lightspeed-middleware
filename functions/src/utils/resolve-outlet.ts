import * as logger from 'firebase-functions/logger';
import { CacheService } from '../services/cache';
import { LightspeedClient } from '../services/lightspeed';

/**
 * Resolve outlet_id: if not a UUID, fetch first real outlet from Lightspeed.
 * Shared utility used by customers and reports routes.
 *
 * @param outletId - The outlet ID string to resolve
 * @param cache - CacheService instance for caching outlets
 * @param lightspeedClient - LightspeedClient instance for API calls
 * @returns The resolved outlet UUID
 */
export async function resolveOutletId(
  outletId: string,
  cache: CacheService,
  lightspeedClient: LightspeedClient
): Promise<string> {
  // If it looks like a UUID, use as-is
  if (outletId.includes('-') && outletId.length > 10) {
    return outletId;
  }

  // Otherwise, resolve to first real outlet
  let outlets = await cache.get<any[]>('outlets-list');
  if (!outlets) {
    outlets = await lightspeedClient.listOutlets();
    await cache.set('outlets-list', outlets, { ttl: 3600 });
  }

  if (outlets && outlets.length > 0) {
    logger.info(`Resolved outlet_id '${outletId}' to '${outlets[0].id}' (${outlets[0].name})`);
    return outlets[0].id;
  }

  throw new Error('No outlets found in Lightspeed');
}
