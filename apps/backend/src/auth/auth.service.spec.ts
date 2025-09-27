import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let databaseService: DatabaseService;
  let configService: ConfigService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2b$10$hashedPassword',
    name: 'Test User',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
    signAsync: jest.fn(),
  };

  const mockDatabaseService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
      });
      expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockUser.password);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('nonexistent@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('test@example.com', 'wrongpassword')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return access token and user info', async () => {
      const user = { id: mockUser.id, email: mockUser.email, role: mockUser.role };
      const mockToken = 'jwt.token.here';

      mockJwtService.signAsync.mockResolvedValue(mockToken);

      const result = await service.login(user);

      expect(result).toEqual({
        access_token: mockToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { sub: user.id, email: user.email, role: user.role },
        expect.any(Object)
      );
    });
  });

  describe('register', () => {
    it('should create new user and return access token', async () => {
      const registerDto = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      };
      const hashedPassword = '$2b$10$newHashedPassword';
      const newUser = {
        ...mockUser,
        id: 'new-user-123',
        email: registerDto.email,
        name: registerDto.name,
        password: hashedPassword,
      };
      const mockToken = 'jwt.token.here';

      mockDatabaseService.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockDatabaseService.user.create.mockResolvedValue(newUser);
      mockJwtService.signAsync.mockResolvedValue(mockToken);

      const result = await service.register(registerDto);

      expect(result).toEqual({
        access_token: mockToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockDatabaseService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          password: hashedPassword,
          name: registerDto.name,
          role: 'user',
        },
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User',
      };

      mockDatabaseService.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(mockDatabaseService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should generate new access token for valid user', async () => {
      const userId = 'user-123';
      const mockToken = 'new.jwt.token';

      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue(mockToken);

      const result = await service.refreshToken(userId);

      expect(result).toEqual({ access_token: mockToken });
      expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
        expect.any(Object)
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('invalid-id')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('verifyToken', () => {
    it('should return decoded token for valid JWT', async () => {
      const token = 'valid.jwt.token';
      const decoded = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        iat: 1234567890,
        exp: 9999999999,
      };

      mockJwtService.verify.mockReturnValue(decoded);

      const result = await service.verifyToken(token);

      expect(result).toEqual(decoded);
      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const token = 'invalid.token';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyToken(token)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('changePassword', () => {
    it('should update password successfully', async () => {
      const userId = 'user-123';
      const changePasswordDto = {
        currentPassword: 'oldPassword',
        newPassword: 'newPassword123',
      };
      const hashedNewPassword = '$2b$10$newHashedPassword';

      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedNewPassword);
      mockDatabaseService.user.update.mockResolvedValue({
        ...mockUser,
        password: hashedNewPassword,
      });

      await service.changePassword(userId, changePasswordDto);

      expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        changePasswordDto.currentPassword,
        mockUser.password
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(changePasswordDto.newPassword, 10);
      expect(mockDatabaseService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });
    });

    it('should throw UnauthorizedException when current password is wrong', async () => {
      const userId = 'user-123';
      const changePasswordDto = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword123',
      };

      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(userId, changePasswordDto)
      ).rejects.toThrow(UnauthorizedException);
      expect(mockDatabaseService.user.update).not.toHaveBeenCalled();
    });
  });
});