import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateDuoVerification(
    userId: string,
    verified: boolean,
  ): Promise<void> {
    this.logger.debug(
      `Updating duoVerified in database to ${verified} for user ID ${userId}`,
    );
    await this.userRepository.update(userId, { duo_verified: verified });
  }

  async getCurrentUser(userId: string): Promise<User> {
    this.logger.debug(`Getting user data for ID: ${userId}`);
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    } catch (error) {
      this.logger.error('Error fetching user:', error);
      throw error;
    }
  }
}
