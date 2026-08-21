export interface JwtPayload {
  unitname: string;
  sub: string;
  sessionId: string;
  iat: number;
  exp: number;
}
