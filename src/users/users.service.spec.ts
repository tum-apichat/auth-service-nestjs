import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Repository<User>;

  const mockUserRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByUsername', () => {
    it('should return a user when found by username', async () => {
      // Arrange
      const username = 'testuser';
      const mockUser = new User();
      mockUser.id = 'user-id';
      mockUser.username = username;
      mockUser.email = 'test@example.com';

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByUsername(username);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { username },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const username = 'nonexistentuser';
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findByUsername(username)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { username },
      });
    });
  });

  describe('updateDuoVerification', () => {
    it('should update duo verification status', async () => {
      // Arrange
      const userId = 'user-id';
      const verified = true;
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      await service.updateDuoVerification(userId, verified);

      // Assert
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        duo_verified: verified,
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return user when found by id', async () => {
      // Arrange
      const userId = 'user-id';
      const mockUser = new User();
      mockUser.id = userId;
      mockUser.username = 'testuser';
      mockUser.email = 'test@example.com';

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.getCurrentUser(userId);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const userId = 'nonexistent-id';
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getCurrentUser(userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should propagate errors from repository', async () => {
      // Arrange
      const userId = 'user-id';
      const dbError = new Error('Database connection error');
      mockUserRepository.findOne.mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.getCurrentUser(userId)).rejects.toThrow(dbError);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });
  });
});
