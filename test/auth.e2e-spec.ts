import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import {
  authPath,
  buildRound1DigitSequence,
  extractRefreshCookie,
  registerPayload,
  uniqueUnitname,
  validPassphrase,
  validSecurityAnswer,
} from './helpers/auth-test-utils';
import { createE2eApp } from './helpers/create-e2e-app';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)('AuthModule (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const createdUnitnames: string[] = [];

  beforeAll(async () => {
    app = await createE2eApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (createdUnitnames.length > 0) {
      await dataSource.query(
        `DELETE FROM units WHERE unitname = ANY($1::text[])`,
        [createdUnitnames],
      );
    }
    await app.close();
  });

  const trackUnit = (unitname: string) => {
    createdUnitnames.push(unitname);
  };

  const registerAndVerify = async (unitname: string, passphrase: string) => {
    trackUnit(unitname);

    const registerResponse = await request(app.getHttpServer())
      .post(authPath('/register'))
      .send(registerPayload(unitname, passphrase))
      .expect(201);

    const verifyResponse = await request(app.getHttpServer())
      .post(authPath('/verify'))
      .send({ unitname, code: registerResponse.body.verificationCode })
      .expect(201);

    expect(verifyResponse.body.status).toBe('verified');
    expect(verifyResponse.body.accessToken).toBeDefined();
    expect(
      extractRefreshCookie(verifyResponse.headers['set-cookie']),
    ).toContain('refresh_token=');

    return registerResponse;
  };

  const login = async (unitname: string, passphrase: string) =>
    request(app.getHttpServer())
      .post(authPath('/login'))
      .send({ unitname, passphrase })
      .expect(201);

  describe('Flow A — registration and login', () => {
    it('registers, verifies, rejects wrong login, accepts valid login', async () => {
      const unitname = uniqueUnitname('flowA');
      const passphrase = validPassphrase();

      await registerAndVerify(unitname, passphrase);

      await request(app.getHttpServer())
        .post(authPath('/login'))
        .send({ unitname, passphrase: 'wrong passphrase1' })
        .expect(401);

      const loginResponse = await login(unitname, passphrase);

      expect(loginResponse.body.accessToken).toBeDefined();
      expect(
        extractRefreshCookie(loginResponse.headers['set-cookie']),
      ).toContain('refresh_token=');
    });
  });

  describe('Flow B — session refresh and logout', () => {
    it('refreshes tokens and logs out', async () => {
      const unitname = uniqueUnitname('flowB');
      const passphrase = validPassphrase();

      await registerAndVerify(unitname, passphrase);
      const loginResponse = await login(unitname, passphrase);

      const accessToken = loginResponse.body.accessToken;
      const refreshCookie = extractRefreshCookie(
        loginResponse.headers['set-cookie'],
      );

      const refreshResponse = await request(app.getHttpServer())
        .post(authPath('/refresh-token'))
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshCookie ?? '')
        .expect(201);

      expect(refreshResponse.body.accessToken).toBeDefined();

      await request(app.getHttpServer())
        .post(authPath('/logout'))
        .set('Authorization', `Bearer ${refreshResponse.body.accessToken}`)
        .expect(201);
    });
  });

  describe('Flow C — change passphrase', () => {
    it('issues challenge and changes passphrase with auto-login', async () => {
      const unitname = uniqueUnitname('flowC');
      const passphrase = validPassphrase();
      const newPassphrase = 'brand new pass12';

      await registerAndVerify(unitname, passphrase);
      const loginResponse = await login(unitname, passphrase);
      const accessToken = loginResponse.body.accessToken;

      const challengeResponse = await request(app.getHttpServer())
        .post(authPath('/passphrase-challenge'))
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ securityAnswer: validSecurityAnswer() })
        .expect(201);

      const changeResponse = await request(app.getHttpServer())
        .post(authPath('/change-passphrase'))
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassphrase: passphrase,
          digitSequence: challengeResponse.body.digits,
          newPassphrase,
        })
        .expect(201);

      expect(changeResponse.body.accessToken).toBeDefined();

      await login(unitname, newPassphrase);
    });
  });

  describe('Flow D — forgot and reset passphrase', () => {
    it('completes round-1 digit verify then passphrase-only reset with auto-login', async () => {
      const unitname = uniqueUnitname('flowD');
      const passphrase = validPassphrase();
      const newPassphrase = 'reset passphrase12';

      await registerAndVerify(unitname, passphrase);

      await request(app.getHttpServer())
        .post(authPath('/forgot-passphrase/security-question'))
        .send({ unitname })
        .expect(201);

      const round1Response = await request(app.getHttpServer())
        .post(authPath('/forgot-passphrase/round-1/challenge'))
        .send({ unitname, securityAnswer: validSecurityAnswer() })
        .expect(201);

      const round2Response = await request(app.getHttpServer())
        .post(authPath('/forgot-passphrase/round-1/verify'))
        .send({
          unitname,
          digitSequence: buildRound1DigitSequence(round1Response.body.digits),
        })
        .expect(201);

      const resetResponse = await request(app.getHttpServer())
        .post(authPath('/forgot-passphrase/reset'))
        .send({
          unitname,
          newPassphrase,
        })
        .expect(201);

      expect(resetResponse.body.accessToken).toBeDefined();

      await login(unitname, newPassphrase);
    });
  });

  describe('Error cases', () => {
    it('returns retry for invalid verification code', async () => {
      const unitname = uniqueUnitname('errVerify');
      const passphrase = validPassphrase();
      trackUnit(unitname);

      await request(app.getHttpServer())
        .post(authPath('/register'))
        .send(registerPayload(unitname, passphrase))
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(authPath('/verify'))
        .send({ unitname, code: '1111111111111111' })
        .expect(201);

      expect(response.body.status).toBe('retry');
      expect(response.body.attemptsRemaining).toBe(2);
    });

    it('returns 404 for unknown unit on forgot challenge', async () => {
      await request(app.getHttpServer())
        .post(authPath('/forgot-passphrase/round-1/challenge'))
        .send({
          unitname: 'unknownunit999',
          securityAnswer: validSecurityAnswer(),
        })
        .expect(404);
    });

    it('returns 403 for unverified unit on forgot challenge', async () => {
      const unitname = uniqueUnitname('errForgot');
      const passphrase = validPassphrase();

      await request(app.getHttpServer())
        .post(authPath('/register'))
        .send(registerPayload(unitname, passphrase))
        .expect(201);

      trackUnit(unitname);

      await request(app.getHttpServer())
        .post(authPath('/forgot-passphrase/round-1/challenge'))
        .send({ unitname, securityAnswer: validSecurityAnswer() })
        .expect(403);
    });

    it('returns 400 for change-passphrase without challenge', async () => {
      const unitname = uniqueUnitname('errChange');
      const passphrase = validPassphrase();

      await registerAndVerify(unitname, passphrase);
      const loginResponse = await login(unitname, passphrase);

      await request(app.getHttpServer())
        .post(authPath('/change-passphrase'))
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .send({
          currentPassphrase: passphrase,
          digitSequence: '9876543210000000',
          newPassphrase: 'another passph12',
        })
        .expect(400);
    });

    it('returns 400 for short passphrase on register', async () => {
      await request(app.getHttpServer())
        .post(authPath('/register'))
        .send(registerPayload(uniqueUnitname('short'), 'short'))
        .expect(400);
    });
  });
});
