export interface SamlUser {
  issuer: string;
  inResponseTo: string;
  sessionIndex: string;
  nameID: string;
  nameIDFormat: string;
  nameQualifier?: string;
  spNameQualifier?: string;
  Role: string;
  attributes: { Role: string };
  [key: string]: unknown;
}
