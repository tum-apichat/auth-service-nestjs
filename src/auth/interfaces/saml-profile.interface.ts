import { Profile } from '@node-saml/passport-saml';

export interface SamlProfile extends Profile {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  [key: string]: unknown;
}
