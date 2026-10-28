export interface HealthDatabaseStatus {
  status: 'connected' | 'disconnected';
  responseTimeMs?: number;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  database: HealthDatabaseStatus;
}
