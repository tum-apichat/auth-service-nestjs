import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { User } from './interfaces/user.interface';
import { DuoVerify } from './interfaces/duo-verify.interface';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { DuoVerifiedGuard } from './guards/duo-verified.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    private authService: AuthService,
    private userService: UsersService,
    private configService: ConfigService,
  ) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, DuoVerifiedGuard)
  async me(
    @Req() req: Request & { user: User },
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Getting user data for ID: ${req.user.id}, duoVerified: ${req.user.duoVerified}`,
      );

      const user = await this.userService.getCurrentUser(req.user.id);

      // If token says user is verified but DB says not, update DB
      if (req.user.duoVerified && !user.duo_verified) {
        this.logger.debug(
          `Updating duoVerified in database for user ${user.username}`,
        );
        await this.userService.updateDuoVerification(user.id, true);
      }

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.fullname,
          requiresDuo: user.required_duo,
          duoVerified: req.user.duoVerified,
        },
      });
    } catch (error: unknown) {
      this.logger.error('Error getting current user:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred retrieving user data',
      });
    }
  }

  @Get('duo/health')
  duoHealthCheck(): any {
    return this.authService.duoHealthCheck();
  }

  @Get('saml')
  @UseGuards(AuthGuard('saml'))
  samlLogin(): void {
    // ไม่ต้องทำอะไร - Guard จะจัดการการ redirect ไปยัง Identity Provider
  }

  @Post('saml/callback')
  @UseGuards(AuthGuard('saml'))
  async samlCallback(
    @Req() req: Request & { user: User },
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authService.validateSamlUser(req.user);

    // ถ้าต้องการยืนยันตัวตนด้วย Duo
    if (result.requiresDuo) {
      const duoAuthUrl = await this.authService.initiateDuoAuth(result.user);
      this.logger.debug('Duo authentication URL:', duoAuthUrl);
      return res.redirect(duoAuthUrl);
    }

    const jwt = this.authService.generateJwtToken(result.user);
    res.cookie('auth_token', jwt, { httpOnly: true, secure: true }); // สร้าง cookie สำหรับการยืนยันตัวตน
    res.redirect(`${this.configService.get('FRONTEND_URL')}`); // ข้ามไปหน้า home
  }

  @Get('duo/callback')
  async duoCallback(
    @Req() req: Request & { user: User },
    @Res() res: Response,
  ): Promise<void> {
    const { state, duo_code } = req.query;

    if (!state || !duo_code) {
      this.logger.error('Missing state or duo_code in query params');
      res.status(400).json({
        success: false,
        message: 'Invalid Duo callback parameters',
      });
    }

    try {
      const duoVerify: DuoVerify = {
        username: req.user?.username,
        state: state as string,
        duo_code: duo_code as string,
      };
      const result = await this.authService.verifyDuoResponse(duoVerify);
      this.logger.debug('Duo verification result:', result);
      if (result.verified) {
        const jwt = this.authService.generateJwtToken(result.user);
        res.cookie('auth_token', jwt, { httpOnly: true, secure: true });
        res.redirect(
          `${this.configService.get('FRONTEND_URL')}/login/success?token=${jwt}`,
        );
      } else {
        res.redirect(
          `${this.configService.get('FRONTEND_URL')}/login?error=duo_verification_failed`,
        );
      }
    } catch (error: unknown) {
      this.logger.error('Error during Duo callback', error);
      res.status(500).json({
        success: false,
        message: 'Error during Duo callback',
      });
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: Request & { user: User }, @Res() res: Response): void {
    try {
      this.logger.debug(`User ${req.user.username} logging out`);
      // ในระบบ JWT ไม่มีการเก็บ session บนเซิร์ฟเวอร์
      // ดังนั้นการออกจากระบบจึงเป็นความรับผิดชอบของฝั่งไคลเอนต์ในการลบ token
      // ถ้าใช้ cookie สามารถลบ cookie ได้
      res.clearCookie('auth_token');
      res.status(200).json({
        success: true,
        message: 'Logout successful',
        instructions: 'Please remove token from localStorage',
      });
    } catch (error: unknown) {
      this.logger.error('Error during logout:', error);
      res.status(500).json({
        success: false,
        message: 'Error during logout',
      });
    }
  }
}
