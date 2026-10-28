import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { HealthCheckResponse } from './dto/health-response.dto';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async check(): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    let dbConnected = false;
    let responseTimeMs = 0;

    try {
      dbConnected = await this.prisma.pingDatabase();
      responseTimeMs = Date.now() - startTime;
    } catch (err) {
      this.logger.warn(`Database health check failed: ${(err as Error).message}`);
      dbConnected = false;
    }

    const nodeEnv =
      this.configService.get<string>('app.nodeEnv') ||
      process.env.NODE_ENV ||
      'development';

    return {
      status: dbConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: nodeEnv,
      database: {
        status: dbConnected ? 'connected' : 'disconnected',
        responseTimeMs,
      },
    };
  }
}
