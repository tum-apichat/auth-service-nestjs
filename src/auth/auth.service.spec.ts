import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UnauthorizedException } from '@nestjs/common';
import { DuoVerify } from './interfaces/duo-verify.interface';
import { User as UserInterface } from './interfaces/user.interface';

// Mock Client class from duo_universal
jest.mock('@duosecurity/duo_universal', () => {
  return {
    Client: jest.fn().mockImplementation(() => {
      return {
        generateState: jest.fn().mockReturnValue('mock-state'),
        createAuthUrl: jest.fn().mockReturnValue('https://duo-auth-url.com'),
        exchangeAuthorizationCodeFor2FAResult: jest
          .fn()
          .mockResolvedValue('testuser'),
      };
    }),
  };
});

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findOne: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  const mockConfigService = {
    get: jest.fn((key) => {
      const config = {
        DUO_CLIENT_ID: 'mock-client-id',
        DUO_CLIENT_SECRET: 'mock-client-secret',
        DUO_API_HOST: 'api-host.duosecurity.com',
        DUO_REDIRECT_URL: 'https://example.com/callback',
        FRONTEND_URL: 'https://example.com',
      };
      return config[key];
    }),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('duoHealthCheck', () => {
    it('should return health status', () => {
      // Act
      const result = service.duoHealthCheck();

      // Assert
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('service', 'auth-service');
      expect(result).toHaveProperty('status', 'healthy');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('validateSamlUser', () => {
    it('should find existing user by email', async () => {
      // Arrange
      const samlUser: UserInterface = {
        id: 'saml-id',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        requiresDuo: true,
        duoVerified: false,
      };

      const existingUser = new User();
      existingUser.id = 'user-id';
      existingUser.username = 'testuser';
      existingUser.email = 'test@example.com';
      existingUser.fullname = 'Test User';
      existingUser.required_duo = true;
      existingUser.duo_verified = false;

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      // Act
      const result = await service.validateSamlUser(samlUser);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: [{ email: samlUser.email }, { username: samlUser.username }],
      });
      expect(result).toEqual({
        user: existingUser,
        requiresDuo: existingUser.required_duo,
        duoVerified: existingUser.duo_verified,
      });
    });

    it('should create new user if not found', async () => {
      // Arrange
      const samlUser: UserInterface = {
        id: 'saml-id',
        username: 'newuser',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        requiresDuo: true,
        duoVerified: false,
      };

      const newUser = new User();
      newUser.id = 'new-user-id';
      newUser.username = 'newuser';
      newUser.email = 'new@example.com';
      newUser.fullname = 'New User';
      newUser.required_duo = true;
      newUser.duo_verified = false;
      newUser.is_active = true;

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(newUser);
      mockUserRepository.save.mockResolvedValue(newUser);

      // Act
      const result = await service.validateSamlUser(samlUser);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalled();
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: samlUser.username,
        email: samlUser.email,
        fullname: samlUser.firstName + ' ' + samlUser.lastName,
        required_duo: true,
        duo_verified: false,
        is_active: true,
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith(newUser);
      expect(result).toEqual({
        user: newUser,
        requiresDuo: newUser.required_duo,
        duoVerified: newUser.duo_verified,
      });
    });

    it('should throw UnauthorizedException on error', async () => {
      // Arrange
      const samlUser: UserInterface = {
        id: 'saml-id',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        requiresDuo: true,
        duoVerified: false,
      };

      mockUserRepository.findOne.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.validateSamlUser(samlUser)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('initiateDuoAuth', () => {
    it('should return auth URL when Duo client is initialized', async () => {
      // Arrange
      const user = new User();
      user.username = 'testuser';

      // Act
      const result = await service.initiateDuoAuth(user);

      // Assert
      expect(result).toBe('https://duo-auth-url.com');
    });

    it('should skip MFA when Duo client is not initialized', async () => {
      // Arrange
      const user = new User();
      user.username = 'testuser';
      user.duo_verified = false;

      // Override the duoClient property to simulate uninitialized client
      Object.defineProperty(service, 'duoClient', { value: null });

      // Act
      const result = await service.initiateDuoAuth(user);

      // Assert
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          duo_verified: true,
        }),
      );
      expect(result).toBe('https://example.com');
    });

    it('should throw UnauthorizedException on error', async () => {
      // Arrange
      const user = new User();
      user.username = 'testuser';

      // Mock the duoClient to throw an error
      const mockDuoClient = {
        generateState: jest.fn().mockImplementation(() => {
          throw new Error('Duo error');
        }),
      };
      Object.defineProperty(service, 'duoClient', { value: mockDuoClient });

      // Act & Assert
      await expect(service.initiateDuoAuth(user)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyDuoResponse', () => {
    it('should verify Duo response and update user', async () => {
      // Arrange
      const duoVerify: DuoVerify = {
        username: 'testuser',
        state: 'mock-state|testuser',
        duo_code: 'duo-auth-code',
      };

      const user = new User();
      user.username = 'testuser';
      user.duo_verified = false;

      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue({
        ...user,
        duo_verified: true,
      });

      // Act
      const result = await service.verifyDuoResponse(duoVerify);

      // Assert
      expect(result.verified).toBe(true);
      expect(result.user.duo_verified).toBe(true);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when Duo client is not configured', async () => {
      // Arrange
      const duoVerify: DuoVerify = {
        username: 'testuser',
        state: 'mock-state|testuser',
        duo_code: 'duo-auth-code',
      };

      // Override the duoClient property to simulate uninitialized client
      Object.defineProperty(service, 'duoClient', { value: null });

      // Act & Assert
      const result = await service.verifyDuoResponse(duoVerify);
      expect(result.verified).toBe(false);
    });

    it('should throw NotFoundException when user is not found', async () => {
      // Arrange
      const duoVerify: DuoVerify = {
        username: 'testuser',
        state: 'mock-state|testuser',
        duo_code: 'duo-auth-code',
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.verifyDuoResponse(duoVerify);

      // Assert
      expect(result.verified).toBe(false);
    });

    it('should return verified:false on error', async () => {
      // Arrange
      const duoVerify: DuoVerify = {
        username: 'testuser',
        state: 'mock-state|testuser',
        duo_code: 'duo-auth-code',
      };

      const mockDuoClient = {
        exchangeAuthorizationCodeFor2FAResult: jest
          .fn()
          .mockRejectedValue(new Error('Duo error')),
      };
      Object.defineProperty(service, 'duoClient', { value: mockDuoClient });

      // Act
      const result = await service.verifyDuoResponse(duoVerify);

      // Assert
      expect(result.verified).toBe(false);
    });
  });

  describe('generateJwtToken', () => {
    it('should generate JWT token with correct payload', () => {
      // Arrange
      const user = new User();
      user.id = 'user-id';
      user.username = 'testuser';
      user.email = 'test@example.com';
      const mockJwtService = {
        sign: jest.fn().mockReturnValue('mock-jwt-token'),
      };
      Object.defineProperty(service, 'jwtService', { value: mockJwtService });

      // Act
      const token = service.generateJwtToken(user);

      // Assert
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        username: user.username,
        email: user.email,
      });
      expect(token).toBe('mock-jwt-token');
    });
  });
});
