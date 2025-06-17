import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { Request, Response } from 'express';
import { DuoVerify } from './interfaces/duo-verify.interface';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let usersService: UsersService;
  let configService: ConfigService; // เพิ่มตัวแปร configService เพื่อ mock ในแต่ละเทส

  // Mock objects
  const mockRequest = () => {
    return {
      user: {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        duoVerified: true,
        requiresDuo: true,
      },
    } as Request & { user: any };
  };

  const mockResponse = () => {
    const res: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  beforeEach(async () => {
    // Arrange - Setup mocks and dependencies
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            duoHealthCheck: jest.fn(),
            validateSamlUser: jest.fn(),
            initiateDuoAuth: jest.fn(),
            verifyDuoResponse: jest.fn(),
            generateJwtToken: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getCurrentUser: jest.fn(),
            updateDuoVerification: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    configService = module.get<ConfigService>(ConfigService); // assign instance configService

    // Override logger to prevent console output during tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('me', () => {
    it('should return user data when authentication is successful', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      const mockUser = {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        fullname: 'Test User',
        required_duo: true,
        duo_verified: false,
      } as User;

      const getCurrentUserSpy = jest
        .spyOn(usersService, 'getCurrentUser')
        .mockResolvedValue(mockUser);
      const updateDuoVerificationSpy = jest
        .spyOn(usersService, 'updateDuoVerification')
        .mockResolvedValue(undefined);
      const statusSpy = jest.spyOn(res, 'status');
      const jsonSpy = jest.spyOn(res, 'json');

      // Act
      await controller.me(req, res);

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(getCurrentUserSpy).toHaveBeenCalledWith('test-user-id');
      expect(updateDuoVerificationSpy).toHaveBeenCalledWith(
        'test-user-id',
        true,
      );
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        user: {
          id: 'test-user-id',
          username: 'testuser',
          email: 'test@example.com',
          name: 'Test User',
          requiresDuo: true,
          duoVerified: true,
        },
      });
    });

    it('should not update duo verification if already verified in DB', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      const mockUser = {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        fullname: 'Test User',
        required_duo: true,
        duo_verified: true, // Already verified in DB
      } as User;

      const getCurrentUserSpy = jest
        .spyOn(usersService, 'getCurrentUser')
        .mockResolvedValue(mockUser);
      const updateDuoVerificationSpy = jest
        .spyOn(usersService, 'updateDuoVerification')
        .mockResolvedValue(undefined);
      const statusSpy = jest.spyOn(res, 'status');

      // Act
      await controller.me(req, res);

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(getCurrentUserSpy).toHaveBeenCalledWith('test-user-id');
      expect(updateDuoVerificationSpy).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(200);
    });

    it('should return error response when an exception occurs', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Database error');
      const statusSpy = jest.spyOn(res, 'status');
      const jsonSpy = jest.spyOn(res, 'json');

      jest.spyOn(usersService, 'getCurrentUser').mockRejectedValue(error);

      // Act
      await controller.me(req, res);

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred retrieving user data',
      });
    });
  });

  describe('duoHealthCheck', () => {
    it('should return health check data', () => {
      // Arrange
      const mockHealthData = {
        success: true,
        service: 'auth-service',
        status: 'healthy',
        timestamp: '2023-01-01T00:00:00.000Z',
      };
      const getDuoHealthSpy = jest
        .spyOn(authService, 'duoHealthCheck')
        .mockReturnValue(mockHealthData);

      // Act
      const result = controller.duoHealthCheck();

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(getDuoHealthSpy).toHaveBeenCalled();
      expect(result).toEqual(mockHealthData);
    });
  });

  describe('samlLogin', () => {
    it('should not return anything (void function)', () => {
      // Act
      const result = controller.samlLogin();

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('samlCallback', () => {
    it('should redirect to Duo auth when user requires Duo verification', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      const mockResult = {
        user: {
          id: 'test-user-id',
          username: 'testuser',
        } as User,
        requiresDuo: true,
        duoVerified: false,
      };
      const mockDuoAuthUrl = 'https://duo.com/auth?token=123';

      const validateSamlSpy = jest
        .spyOn(authService, 'validateSamlUser')
        .mockResolvedValue(mockResult);
      const initiateDuoSpy = jest
        .spyOn(authService, 'initiateDuoAuth')
        .mockResolvedValue(mockDuoAuthUrl);
      const redirectSpy = jest.spyOn(res, 'redirect');

      // Act
      await controller.samlCallback(req, res);

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(validateSamlSpy).toHaveBeenCalledWith(req.user);
      expect(initiateDuoSpy).toHaveBeenCalledWith(mockResult.user);
      expect(redirectSpy).toHaveBeenCalledWith(mockDuoAuthUrl);
    });

    it('should set cookie and redirect to frontend when user does not require Duo', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      const mockResult = {
        user: {
          id: 'test-user-id',
          username: 'testuser',
        } as User,
        requiresDuo: false,
        duoVerified: false,
      };
      const mockJwt = 'jwt-token-123';
      const mockFrontendUrl = 'https://frontend.example.com';

      const validateSamlSpy = jest
        .spyOn(authService, 'validateSamlUser')
        .mockResolvedValue(mockResult);
      const generateJwtSpy = jest
        .spyOn(authService, 'generateJwtToken')
        .mockReturnValue(mockJwt);
      const cookieSpy = jest.spyOn(res, 'cookie');
      const redirectSpy = jest.spyOn(res, 'redirect');
      jest.spyOn(configService, 'get').mockReturnValue(mockFrontendUrl); // mock configService.get ให้ return frontend url

      // Act
      await controller.samlCallback(req, res);

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(validateSamlSpy).toHaveBeenCalledWith(req.user);
      expect(generateJwtSpy).toHaveBeenCalledWith(mockResult.user);
      expect(cookieSpy).toHaveBeenCalledWith('auth_token', mockJwt, {
        httpOnly: true,
        secure: true,
      });
      expect(redirectSpy).toHaveBeenCalledWith(mockFrontendUrl);
    });
  });

  describe('duoCallback', () => {
    it('should return 400 when state or duo_code is missing', async () => {
      // Arrange
      const req = {
        ...mockRequest(),
        query: {}, // Missing state and duo_code
      } as any;
      const res = mockResponse();
      const statusSpy = jest.spyOn(res, 'status');

      // Act
      await controller.duoCallback(req, res);

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid Duo callback parameters',
      });
    });

    it('should redirect to success page when verification is successful', async () => {
      // Arrange
      const req = {
        ...mockRequest(),
        query: {
          state: 'test-state',
          duo_code: 'test-duo-code',
        },
      } as any;
      const res = mockResponse();
      const mockUser = {
        id: 'test-user-id',
        username: 'testuser',
      } as User;
      const mockVerifyResult = {
        verified: true,
        user: mockUser,
      };
      const mockJwt = 'jwt-token-123';
      const mockFrontendUrl = 'https://frontend.example.com';

      const verifyDuoSpy = jest
        .spyOn(authService, 'verifyDuoResponse')
        .mockResolvedValue(mockVerifyResult);
      const generateJwtSpy = jest
        .spyOn(authService, 'generateJwtToken')
        .mockReturnValue(mockJwt);
      const cookieSpy = jest.spyOn(res, 'cookie');
      const redirectSpy = jest.spyOn(res, 'redirect');
      jest.spyOn(configService, 'get').mockReturnValue(mockFrontendUrl); // mock configService.get ให้ return frontend url

      // Act
      await controller.duoCallback(req, res);

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(verifyDuoSpy).toHaveBeenCalledWith({
        username: 'testuser',
        state: 'test-state',
        duo_code: 'test-duo-code',
      } as DuoVerify);
      expect(generateJwtSpy).toHaveBeenCalledWith(mockUser);
      expect(cookieSpy).toHaveBeenCalledWith('auth_token', mockJwt, {
        httpOnly: true,
        secure: true,
      });
      expect(redirectSpy).toHaveBeenCalledWith(
        `${mockFrontendUrl}/login/success?token=${mockJwt}`,
      );
    });

    it('should redirect to error page when verification fails', async () => {
      // Arrange
      const req = {
        ...mockRequest(),
        query: {
          state: 'test-state',
          duo_code: 'test-duo-code',
        },
      } as any;
      const res = mockResponse();
      const mockFrontendUrl = 'https://frontend.example.com';
      const redirectSpy = jest.spyOn(res, 'redirect');
      jest.spyOn(configService, 'get').mockReturnValue(mockFrontendUrl); // mock configService.get ให้ return frontend url
      const mockUser = {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        fullname: 'Test User',
        required_duo: false,
        duo_verified: false,
      } as User;
      jest.spyOn(authService, 'verifyDuoResponse').mockResolvedValue({
        verified: false,
        user: mockUser,
      }); // mock ให้ verifyDuoResponse return failed

      // Act
      await controller.duoCallback(req, res);

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(redirectSpy).toHaveBeenCalledWith(
        `${mockFrontendUrl}/login?error=duo_verification_failed`,
      );
    });

    it('should return 500 when an error occurs during verification', async () => {
      // Arrange
      const req = {
        ...mockRequest(),
        query: {
          state: 'test-state',
          duo_code: 'test-duo-code',
        },
      } as any;
      const res = mockResponse();
      const statusSpy = jest.spyOn(res, 'status');
      // Act
      await controller.duoCallback(req, res);

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error during Duo callback',
      });
    });
  });

  describe('logout', () => {
    it('should clear cookie and return success message', () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      const clearCookieSpy = jest.spyOn(res, 'clearCookie');
      const statusSpy = jest.spyOn(res, 'status');
      const jsonSpy = jest.spyOn(res, 'json');

      // Act
      controller.logout(req, res);

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(clearCookieSpy).toHaveBeenCalledWith('auth_token');
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful',
        instructions: 'Please remove token from localStorage',
      });
    });

    it('should return 500 when an error occurs during logout', () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Logout error');
      const statusSpy = jest.spyOn(res, 'status');
      const jsonSpy = jest.spyOn(res, 'json');

      // Mock implementation to throw an error
      jest.spyOn(res, 'clearCookie').mockImplementation(() => {
        throw error;
      });

      // Act
      controller.logout(req, res);

      // Assert
      // assertion ผ่านตัวแปร spy เพื่อป้องกันปัญหา unbound method
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Error during logout',
      });
    });
  });
});
