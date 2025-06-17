import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User as UserInterface } from './interfaces/user.interface';

import { Client } from '@duosecurity/duo_universal';
import { DuoVerify } from './interfaces/duo-verify.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private duoClient: Client;

  constructor(
    private userService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    // สร้าง Duo Client instance
    try {
      const duoClientId = this.configService.get<string>('DUO_CLIENT_ID');
      const duoClientSecret =
        this.configService.get<string>('DUO_CLIENT_SECRET');
      const duoApiHost = this.configService.get<string>('DUO_API_HOST');
      const redirectUrl = this.configService.get<string>('DUO_REDIRECT_URL');

      if (duoClientId && duoClientSecret && duoApiHost && redirectUrl) {
        this.duoClient = new Client({
          clientId: duoClientId,
          clientSecret: duoClientSecret,
          apiHost: duoApiHost,
          redirectUrl: redirectUrl,
        });
      } else {
        this.logger.warn('Duo configuration missing, MFA will be disabled');
      }
    } catch (error) {
      this.logger.error('Duo client initialization failed', error);
    }
  }

  duoHealthCheck(): any {
    return {
      success: true,
      service: 'auth-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  async validateSamlUser(
    samlUser: UserInterface,
  ): Promise<{ user: User; requiresDuo: boolean; duoVerified: boolean }> {
    try {
      this.logger.debug(`Validating SAML user: ${JSON.stringify(samlUser)}`);

      // ค้นหาผู้ใช้จากอีเมลหรือ username
      let user = await this.userRepository.findOne({
        where: [{ email: samlUser.email }, { username: samlUser.username }],
      });

      // ถ้าไม่พบผู้ใช้ ทำการสร้างผู้ใช้ใหม่
      if (!user) {
        this.logger.debug(`Creating new user from SAML: ${samlUser.username}`);
        user = this.userRepository.create({
          username: samlUser.username,
          email: samlUser.email,
          fullname: samlUser.firstName + ' ' + samlUser.lastName,
          required_duo: true,
          duo_verified: false,
          is_active: true,
        });

        await this.userRepository.save(user);
      }

      return {
        user,
        requiresDuo: user.required_duo,
        duoVerified: user.duo_verified,
      };
    } catch (error) {
      this.logger.error(`Error validating SAML user`, error);
      throw new UnauthorizedException('SAML authentication failed');
    }
  }

  async initiateDuoAuth(user: User): Promise<string> {
    try {
      if (!this.duoClient) {
        this.logger.warn('Duo client not initialized, skipping MFA');

        // อัปเดตสถานะผู้ใช้เป็นผ่านการยืนยันแล้ว
        user.duo_verified = true;
        await this.userRepository.save(user);

        return `${this.configService.get('FRONTEND_URL')}`; // ข้ามไปหน้า home เลย
      }

      // สร้าง state สำหรับการตรวจสอบ callback
      const state = this.duoClient.generateState();
      const encodedState = `${state}|${encodeURIComponent(user.username)}`;

      // เริ่มกระบวนการยืนยันตัวตน
      const authUrl = this.duoClient.createAuthUrl(user.username, encodedState);

      return authUrl;
    } catch (error) {
      this.logger.error(`Error initiating Duo auth:`, error);
      throw new UnauthorizedException('Failed to initialize Duo MFA');
    }
  }

  async verifyDuoResponse(
    duoVerify: DuoVerify,
  ): Promise<{ verified: boolean; user: User }> {
    this.logger.debug('Duo verification request:', duoVerify);
    try {
      if (!this.duoClient) {
        throw new UnauthorizedException('Duo client not configured');
      }

      // Parse the state to extract username
      const [, encodedUsername] = duoVerify.state.split('|');
      const username = encodedUsername
        ? decodeURIComponent(encodedUsername)
        : duoVerify.username;

      // ตรวจสอบการตอบกลับจาก Duo
      const duoUsername =
        await this.duoClient.exchangeAuthorizationCodeFor2FAResult(
          duoVerify.duo_code,
          username,
        );
      this.logger.debug('Duo verification response:', duoUsername);

      // ค้นหาผู้ใช้จาก username
      const user = await this.userRepository.findOne({
        where: { username: username },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // อัปเดตสถานะการยืนยันตัวตน
      user.duo_verified = true;
      await this.userRepository.save(user);

      return { verified: true, user };
    } catch (error) {
      this.logger.error(`Duo verification failed`, error);
      // สร้าง dummy user เพื่อให้ตรงกับ type signature
      const dummyUser = new User();
      return { verified: false, user: dummyUser };
    }
  }

  generateJwtToken(user: User): string {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
    };

    return this.jwtService.sign(payload);
  }
}
