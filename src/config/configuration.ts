export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  corsOrigin: string;
  jwtSecret: string;
  jwtExpiresIn: string;
}

export default (): { app: AppConfig } => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret =
    process.env.JWT_SECRET || 'ticketgo_default_jwt_secret_change_me';

  if (
    nodeEnv === 'production' &&
    (!process.env.JWT_SECRET ||
      jwtSecret === 'ticketgo_default_jwt_secret_change_me')
  ) {
    console.warn(
      '⚠️  [SECURITY WARNING] JWT_SECRET is unset or using the default development secret in production! Set a strong JWT_SECRET in your production environment.',
    );
  }

  return {
    app: {
      port: parseInt(process.env.PORT || '5000', 10),
      nodeEnv,
      databaseUrl: process.env.DATABASE_URL || '',
      corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      jwtSecret,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
  };
};
