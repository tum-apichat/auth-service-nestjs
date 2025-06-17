import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // <--- ทำให้ ConfigService ใช้ได้ทั่ว global ไม่ต้อง import ซ้ำๆ ในโมดูลอื่น
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // <--- บอกว่าต้องใช้ ConfigModule ก่อน
      inject: [ConfigService], // <--- Inject ConfigService เข้ามาใช้งาน
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        schema: configService.get<string>('DB_SCHEMA'),
        entities: [__dirname + '/entities/*.entity.{ts,js}'], // <--- ตำแหน่งของ Entity files (สำคัญ!)
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // <--- !!! ใช้ true เฉพาะตอน Development เท่านั้น !!!
        // มันจะสร้าง/อัปเดต ตารางตาม Entity อัตโนมัติ (ห้ามใช้ใน Production!)
        logging: true, // แสดง SQL query ใน console ตอน Development
      }),
    }),
    AuthModule,
    UsersModule,
  ],
  providers: [],
  exports: [],
})
export class AppModule {}
