import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 8085;

  // เปิดใช้งาน Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // <--- ตัด Property ที่ไม่มีใน DTO ทิ้งไปเลย
      forbidNonWhitelisted: true, // <--- ถ้ามี Property ที่ไม่มีใน DTO ส่งมา ให้โยน Error
      transform: true, // <--- แปลงข้อมูล Payload ให้เป็น Type ตาม DTO (เช่น string -> number)
      transformOptions: {
        enableImplicitConversion: true, // <--- ช่วยแปลง Type อัตโนมัติ
      },
    }),
  );

  // ตั้งค่า Prefix กลางสำหรับทุก API (optional)
  app.setGlobalPrefix('api'); // <--- ทุก endpoint จะขึ้นต้นด้วย /api

  // ตั้งค่า Swagger
  const config = new DocumentBuilder()
    .setTitle('Auth Service')
    .setDescription('Auth Service for Aircraft Management')
    .setVersion('1.0')
    .addBearerAuth() // ถ้ามีการใช้ JWT Authentication
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document); // <--- '/docs' คือ URL path สำหรับเข้าถึง Swagger UI

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger UI available at: http://localhost:${port}/docs`);
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
