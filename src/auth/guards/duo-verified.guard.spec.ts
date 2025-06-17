import { Test, TestingModule } from '@nestjs/testing';
import { DuoVerifiedGuard } from './duo-verified.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('DuoVerifiedGuard', () => {
  let guard: DuoVerifiedGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DuoVerifiedGuard],
    }).compile();

    guard = module.get<DuoVerifiedGuard>(DuoVerifiedGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockContext: ExecutionContext;
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {};
      mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      // Arrange
      mockRequest.user = undefined;

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(
        new ForbiddenException('User not authenticated'),
      );
    });

    it('should return true when user does not require Duo verification', () => {
      // Arrange
      mockRequest.user = {
        id: 1,
        username: 'testuser',
        requiresDuo: false,
      };

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user requires Duo but is not verified', () => {
      // Arrange
      mockRequest.user = {
        id: 1,
        username: 'testuser',
        requiresDuo: true,
        duoVerified: false,
      };

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      try {
        guard.canActivate(mockContext);
      } catch (error) {
        expect(error.response).toEqual({
          success: false,
          message: 'Please verify with Duo before access',
          requiresDuo: true,
        });
      }
    });

    it('should return true when user requires Duo and is verified', () => {
      // Arrange
      mockRequest.user = {
        id: 1,
        username: 'testuser',
        requiresDuo: true,
        duoVerified: true,
      };

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });
  });
});
