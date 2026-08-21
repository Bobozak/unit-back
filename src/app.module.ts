import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { parse } from 'pg-connection-string';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssessmentModule } from './assessment/assessment.module';
import { AuthModule } from './auth/auth.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import {
  AppLoggerMiddleware,
  DatesErrorsInterceptor,
  IsUniqueInterceptor,
  NotFoundInterceptor,
} from './common';
import { BlockedUnitGuard } from './common/guards/blocked-unit.guard';
import { SessionModule } from './session/session.module';
import { NotesModule } from './notes/notes.module';
import { TasksModule } from './tasks/tasks.module';
import { UnitsModule } from './units/units.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const connectionString =
          configService.getOrThrow<string>('DATABASE_URL');
        const dbConfig = parse(connectionString);
        const isLocalHost =
          dbConfig.host === 'localhost' || dbConfig.host === '127.0.0.1';

        return {
          type: 'postgres',
          host: dbConfig.host ?? undefined,
          port: Number(dbConfig.port),
          username: dbConfig.user,
          password: dbConfig.password,
          database: dbConfig.database ?? undefined,
          entities: [join(__dirname, '**', '*.entity.{ts,js}')],
          synchronize: true,
          ...(isLocalHost ? {} : { ssl: { rejectUnauthorized: false } }),
          extra: {
            max: 10,
            idleTimeoutMillis: 30000,
          },
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UnitsModule,
    TasksModule,
    NotesModule,
    AssessmentModule,
    DiagnosticsModule,
    CloudinaryModule,
    SessionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BlockedUnitGuard,
    },

    { provide: APP_INTERCEPTOR, useClass: DatesErrorsInterceptor },
    {
      provide: APP_INTERCEPTOR,
      useClass: NotFoundInterceptor,
    },
    { provide: APP_INTERCEPTOR, useClass: IsUniqueInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AppLoggerMiddleware).forRoutes('{*splat}');
  }
}
