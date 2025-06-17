import { Test, TestingModule } from '@nestjs/testing';
import { SamlAuthStrategy } from './saml.strategy';
import { ConfigService } from '@nestjs/config';
import { SamlProfile } from '../interfaces/saml-profile.interface';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock fs and path modules
jest.mock('node:fs', () => ({
  readFileSync: jest.fn().mockReturnValue('mock-content'),
}));

jest.mock('node:path', () => ({
  resolve: jest.fn().mockReturnValue('/mock/path'),
}));

// Mock @nestjs/passport
jest.mock('@nestjs/passport', () => ({
  PassportStrategy: jest.fn().mockImplementation(() => {
    return class MockStrategy {
      constructor() {
        return;
      }
      validate(payload: any) {
        return payload;
      }
    };
  }),
}));

// Mock @node-saml/passport-saml
jest.mock('@node-saml/passport-saml', () => ({
  Strategy: jest.fn().mockImplementation(() => {
    return class MockSamlStrategy {
      constructor() {
        return;
      }
    };
  }),
  ValidateInResponseTo: {
    never: 'never',
  },
}));

describe('SamlAuthStrategy', () => {
  let strategy: SamlAuthStrategy;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key) => {
      const config = {
        KEYCLOAK_URL: 'http://mock-keycloak:8080',
        KEYCLOAK_REALM: 'mock-realm',
        SAML_ENTITY_ID: 'mock-entity-id',
        SAML_CALLBACK_URL: 'http://mock-callback-url',
      };
      return config[key];
    }),
  };

  let resolveSpy: jest.SpiedFunction<typeof path.resolve>;
  let readFileSyncSpy: jest.SpiedFunction<typeof fs.readFileSync>;

  beforeEach(async () => {
    // สร้าง spy สำหรับ path.resolve และ fs.readFileSync เพื่อใช้ assertion แบบไม่ reference unbound method
    resolveSpy = jest.spyOn(path, 'resolve');
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SamlAuthStrategy,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<SamlAuthStrategy>(SamlAuthStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // cleanup spy
    resolveSpy.mockRestore();
    readFileSyncSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should read certificate files during initialization', () => {
    // ตรวจสอบการเรียก path.resolve และ fs.readFileSync ผ่าน spy ไม่ reference unbound method ตาม eslint
    expect(resolveSpy).toHaveBeenCalledWith(
      expect.any(String),
      'certs/sp-key.pem',
    );
    expect(resolveSpy).toHaveBeenCalledWith(
      expect.any(String),
      'certs/saml.cert',
    );
    expect(readFileSyncSpy).toHaveBeenCalledTimes(2);
  });

  describe('validate', () => {
    it('should return the profile unchanged', () => {
      // Arrange
      const mockProfile: SamlProfile = {
        nameID: 'test-id', // This is the user's ID in the SAML response
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        issuer: 'http://mock-keycloak:8080/realms/mock-realm',
        nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
        inResponseTo: '',
        sessionIndex: '',
        Role: '',
        attributes: { Role: '' },
      };

      // Act
      const result = strategy.validate(mockProfile);

      // Assert
      expect(result).toEqual(mockProfile);
    });
  });
});
