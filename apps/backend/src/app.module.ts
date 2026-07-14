import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './infra/prisma.module';
import { RedisModule } from './infra/redis.module';
import { StorageModule } from './infra/storage.module';
import { QueueModule } from './infra/queue.module';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ScansModule } from './modules/scans/scans.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { GrillzModule } from './modules/grillz/grillz.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { AiModule } from './modules/ai/ai.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductionModule } from './modules/production/production.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { WorkersModule } from './workers/workers.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    StorageModule,
    QueueModule,
    AuditModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    ScansModule,
    CatalogModule,
    GrillzModule,
    PricingModule,
    AiModule,
    OrdersModule,
    PaymentsModule,
    ProductionModule,
    NotificationsModule,
    AdminModule,
    HealthModule,
    WorkersModule,
  ],
  providers: [
    // order matters: rate limit → authenticate → authorize
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
