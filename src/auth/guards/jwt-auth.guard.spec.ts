import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UnauthorizedException } from '@nestjs/common';

// Mock the AuthGuard from @nestjs/passport
jest.mock('@nestjs/passport', () => {
  return {
    AuthGuard: jest.fn().mockImplementation(() => {
      return class {
        // This is just a mock implementation that will be overridden by our guard
      };
    }),
  };
});

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('handleRequest', () => {
    it('should return the user when authentication is successful', () => {
      // Arrange
      const mockUser = { id: 1, username: 'testuser' };

      // Act
      const result = guard.handleRequest(null, mockUser, null);

      // Assert
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException with "Token expired" message when TokenExpiredError occurs', () => {
      // Arrange
      const mockInfo = { name: 'TokenExpiredError' };

      // Act & Assert
      expect(() => guard.handleRequest(null, null, mockInfo)).toThrow(
        new UnauthorizedException('Token expired'),
      );
    });

    it('should throw the original error when an error occurs during authentication', () => {
      // Arrange
      const mockError = new Error('Authentication failed');

      // Act & Assert
      expect(() => guard.handleRequest(mockError, null, null)).toThrow(
        mockError,
      );
    });

    it('should throw UnauthorizedException with default message when no user and no error', () => {
      // Act & Assert
      expect(() => guard.handleRequest(null, null, null)).toThrow(
        new UnauthorizedException('Please log in to access this API'),
      );
    });
  });
});
