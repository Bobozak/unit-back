import { Response } from 'express';

const setRefreshTokenCookie = (response: Response, refreshToken: string) => {
  response.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 днів
    sameSite: 'none',
    secure: true,
  });
};

export { setRefreshTokenCookie };
