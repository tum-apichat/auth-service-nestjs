export interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  requiresDuo: boolean;
  duoVerified: boolean;
  [key: string]: unknown;
}
