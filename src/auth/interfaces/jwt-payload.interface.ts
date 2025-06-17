export interface JwtPayload {
  sub: number;
  username: string;
  email: string;
  duoVerified?: boolean;
  [key: string]: unknown;
}
