import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy as SamlStrategy,
  ValidateInResponseTo,
} from '@node-saml/passport-saml';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SamlProfile } from '../interfaces/saml-profile.interface';
import { User } from '../interfaces/user.interface';

type SamlVerifyCallback = (error: Error | null, user?: User) => void;

@Injectable()
export class SamlAuthStrategy extends PassportStrategy(SamlStrategy, 'saml') {
  private readonly logger = new Logger(SamlAuthStrategy.name);

  constructor(private readonly configService: ConfigService) {
    // ดึงค่าจาก env
    const KEYCLOAK_URL =
      configService.get<string>('KEYCLOAK_URL') || 'http://localhost:8080';
    const KEYCLOAK_REALM =
      configService.get<string>('KEYCLOAK_REALM') || 'test-realm';
    const SAML_ENTITY_ID =
      configService.get<string>('SAML_ENTITY_ID') || 'mini-microservice';
    const SAML_CALLBACK_URL =
      configService.get<string>('SAML_CALLBACK_URL') ||
      'http://localhost:8085/api/auth/saml/callback';

    // อ่าน private key และ certificate สำหรับการเข้ารหัสและตรวจสอบ SAML
    // ใช้ path.resolve เพื่อให้ไฟล์อยู่ที่ root ของโปรเจกต์
    const privateKeyPath = path.resolve(process.cwd(), 'certs/sp-key.pem');
    const idpCertPath = path.resolve(process.cwd(), 'certs/saml.cert');
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    const idpCert = fs.readFileSync(idpCertPath, 'utf8');

    // Initialize Passport's SAML strategy
    super(
      // config saml
      {
        entryPoint: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/saml`,
        issuer: SAML_ENTITY_ID,
        callbackUrl: SAML_CALLBACK_URL,
        idpCert: idpCert,
        wantAssertionsSigned: false,
        disableRequestedAuthnContext: true,
        validateInResponseTo: ValidateInResponseTo.never,
        acceptedClockSkewMs: 5000,
        identifierFormat:
          'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified', // username
        //   identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress', // email
        privateKey: privateKey,
      },
      // validate saml
      (profile: SamlProfile, done: SamlVerifyCallback) => {
        try {
          return done(null, {
            id: profile.nameID,
            username: profile.username,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            requiresDuo: false,
            duoVerified: false,
          });
        } catch (error: unknown) {
          this.logger.error('Error during SAML validation', error);
          done(error as Error);
        }
      },
    );
  }

  // This is the method that will be called by Passport.js
  // to validate the SAML assertion
  validate(profile: SamlProfile): SamlProfile {
    return profile;
  }
}
