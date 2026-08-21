import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config();

export const dataSourceOptionst: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: true,
  ...(process.env.DATABASE_HOST === 'localhost' ||
  process.env.DATABASE_HOST === '127.0.0.1'
    ? {}
    : {
        ssl: {
          rejectUnauthorized: true,
        },
      }),
  extra: {
    max: process.env.DATABASE_POOL_MAX,
    idleTimeoutMillis: process.env.DATABASE_POOL_IDLE_TIMEOUT,
  },
};

export const dataSource = new DataSource(dataSourceOptionst);
