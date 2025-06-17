import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      return null;
    }),
  };

  const mockUsersService = {
    findByUsername: jest.fn(),
    updateDuoVerification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const mockPayload: JwtPayload = {
      username: 'testuser',
      sub: 1,
      email: 'test@example.com',
      duoVerified: false,
    };

    it('should return user data when validation is successful', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullname: 'Test User',
        is_active: true,
        required_duo: false,
        duo_verified: false,
      };
      mockUsersService.findByUsername.mockResolvedValue(mockUser);

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        requiresDuo: false,
        duoVerified: false,
      });
      expect(mockUsersService.findByUsername).toHaveBeenCalledWith('testuser');
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      // Arrange
      mockUsersService.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });

    it('should throw UnauthorizedException when user account is disabled', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullname: 'Test User',
        is_active: false,
        required_duo: false,
        duo_verified: false,
      };
      mockUsersService.findByUsername.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        new UnauthorizedException('Account is disabled'),
      );
    });

    it('should update duo verification in database when token has verified but database has not', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullname: 'Test User',
        is_active: true,
        required_duo: true,
        duo_verified: false,
      };
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      const payloadWithDuoVerified = { ...mockPayload, duoVerified: true };

      // Act
      await strategy.validate(payloadWithDuoVerified);

      // Assert
      expect(mockUsersService.updateDuoVerification).toHaveBeenCalledWith(
        1,
        true,
      );
    });

    it('should not update duo verification when both token and database are verified', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullname: 'Test User',
        is_active: true,
        required_duo: true,
        duo_verified: true,
      };
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      const payloadWithDuoVerified = { ...mockPayload, duoVerified: true };

      // Act
      await strategy.validate(payloadWithDuoVerified);

      // Assert
      expect(mockUsersService.updateDuoVerification).not.toHaveBeenCalled();
    });

    it('should handle errors and throw UnauthorizedException', async () => {
      // Arrange
      mockUsersService.findByUsername.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid token'),
      );
    });
  });
});
