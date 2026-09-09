import { ExecutionJobPayload, MonitorType, ResolutionResult } from '@omnisentinel/shared';
import { StockResolver } from './stock.resolver';
import { EcommerceResolver } from './ecommerce.resolver';
import { JobResolver } from './job.resolver';
import { GenericWebResolver } from './generic-web.resolver';
import { BaseResolver } from './base.resolver';

export class ResolverFactory {
  private static resolvers: Map<MonitorType, BaseResolver> = new Map([
    ['STOCK', new StockResolver()],
    ['ECOMMERCE', new EcommerceResolver()],
    ['JOB', new JobResolver()],
    ['GENERIC_WEB', new GenericWebResolver()],
  ]);

  public static getResolver(type: MonitorType): BaseResolver {
    const resolver = this.resolvers.get(type);
    if (!resolver) {
      throw new Error(`Unsupported resolver type: ${type}`);
    }
    return resolver;
  }

  public static async resolve(payload: ExecutionJobPayload): Promise<ResolutionResult> {
    const resolver = this.getResolver(payload.type);
    return await resolver.resolve(payload);
  }
}
