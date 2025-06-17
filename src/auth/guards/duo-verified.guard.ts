import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';

@Injectable()
export class DuoVerifiedGuard implements CanActivate {
  private readonly logger = new Logger(DuoVerifiedGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    this.logger.debug('===== DUO VERIFICATION CHECK =====');

    // Skip Duo if not required
    if (!user.requiresDuo) {
      this.logger.debug('Duo not required for this user, proceeding');
      return true;
    }

    // Check if Duo is verified
    if (!user.duoVerified) {
      this.logger.debug('Duo verification required but not completed');
      throw new ForbiddenException({
        success: false,
        message: 'Please verify with Duo before access',
        requiresDuo: true,
      });
    }

    this.logger.debug('Duo verification passed, proceeding');
    return true;
  }
}
