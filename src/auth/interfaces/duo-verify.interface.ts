export interface DuoVerify {
  username: string;
  state: string;
  duo_code: string;
  [key: string]: unknown;
}
