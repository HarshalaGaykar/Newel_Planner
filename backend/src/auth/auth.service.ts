import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CookieOptions, Response } from 'express';

/** How long a freshly issued OTP stays usable. */
const OTP_TTL_MS = 2 * 60 * 1000;
/** Minimum gap between two OTP emails for the same account. */
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
/** Wrong guesses allowed before an OTP is burned. */
const MAX_OTP_ATTEMPTS = 5;
/** Window the user has to choose a new password after verifying the OTP. */
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated. Please contact your administrator.');
    }

    if (user.failedAttempts >= 5) {
      throw new ForbiddenException('Account is locked due to multiple failed attempts');
    }

    const isMatch = await bcrypt.compare(pass, user.password);

    if (!isMatch) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0 },
      });
    }

    const { password, ...result } = user;
    return result;
  }

  private async handleFailedLogin(user: any) {
    const newFailedAttempts = user.failedAttempts + 1;
    const updateData: any = { failedAttempts: newFailedAttempts };

    if (newFailedAttempts >= 5) {
      updateData.isActive = false;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
  }

  async login(user: any, response: Response) {
    const permissions: string[] = (user.role?.permissions ?? []).map(
      (rp: any) => rp.permission.name,
    );

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role.name,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN as any,
    });

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    this.setCookies(response, accessToken, refreshToken);

    // A user is a Reporting Authority if at least one active user reports to them.
    const subordinateCount = await this.prisma.user.count({
      where: { reportingAuthorityId: user.id, isActive: true },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role.name,
        permissions,
        isReportingAuthority: subordinateCount > 0,
      },
    };
  }

  /**
   * Step 1 — email a 6 digit OTP to the account owner.
   *
   * The response is deliberately identical whether or not the address belongs to
   * a real account, so this endpoint cannot be used to enumerate users. For the
   * same reason a request that arrives inside the resend cooldown is accepted
   * and silently ignored rather than rejected.
   */
  async forgotPassword(email: string) {
    const genericResponse = {
      message: 'If that email is registered, an OTP has been sent to it.',
      expiresInSeconds: OTP_TTL_MS / 1000,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
    };

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return genericResponse;
    }

    const lastOtp = await this.prisma.passwordResetOtp.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return genericResponse;
    }

    // randomInt is uniform and CSPRNG backed, unlike Math.random based schemes.
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const otpHash = await bcrypt.hash(otp, 10);

    await this.prisma.$transaction([
      // Any OTP still outstanding for this user is void once a new one is issued.
      this.prisma.passwordResetOtp.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.passwordResetOtp.create({
        data: {
          userId: user.id,
          otpHash,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      }),
    ]);

    await this.emailService.sendPasswordResetOtp(
      user.email,
      user.firstName ?? 'there',
      otp,
      OTP_TTL_MS / 60000,
    );

    return genericResponse;
  }

  /**
   * Step 2 — exchange a valid OTP for a short lived reset token. Holding that
   * token is what authorises step 3, so the password fields cannot be driven
   * straight from the client without passing through here.
   */
  async verifyOtp(email: string, otp: string) {
    const invalid = 'Invalid or expired OTP. Please request a new one.';

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new BadRequestException(invalid);
    }

    const record = await this.prisma.passwordResetOtp.findFirst({
      where: {
        userId: user.id,
        consumedAt: null,
        tokenHash: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException(invalid);
    }

    const matches = await bcrypt.compare(otp, record.otpHash);

    if (!matches) {
      const attempts = record.attempts + 1;
      const exhausted = attempts >= MAX_OTP_ATTEMPTS;

      await this.prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { attempts, ...(exhausted ? { consumedAt: new Date() } : {}) },
      });

      throw new BadRequestException(
        exhausted
          ? 'Too many incorrect attempts. Please request a new OTP.'
          : `Incorrect OTP. ${MAX_OTP_ATTEMPTS - attempts} attempt(s) remaining.`,
      );
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    await this.prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });

    return {
      resetToken,
      expiresInSeconds: RESET_TOKEN_TTL_MS / 1000,
      message: 'OTP verified. You can now set a new password.',
    };
  }

  /**
   * Step 3 — set the new password against a reset token from step 2.
   */
  async resetPassword(resetToken: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    const record = await this.prisma.passwordResetOtp.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired reset session. Please start again.');
    }

    if (await bcrypt.compare(newPassword, record.user.password)) {
      throw new BadRequestException('New password must be different from your current password.');
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          password: hashed,
          passwordResetToken: null,
          passwordResetExpires: null,
          failedAttempts: 0,
        },
      }),
      this.prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      // A password change invalidates every existing session.
      this.prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    return { message: 'Password reset successful. You can now log in.' };
  }

  async refresh(refreshToken: string, response: Response) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.REFRESH_TOKEN_SECRET,
      });

      const tokenInDb = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!tokenInDb || tokenInDb.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Re-fetch permissions so changes take effect without full re-login
      const freshPermissions = await this.getPermissionsForUser(payload.sub);

      const newPayload = {
        email: payload.email,
        sub: payload.sub,
        role: payload.role,
        permissions: freshPermissions,
      };
      const newAccessToken = this.jwtService.sign(newPayload);

      this.setCookies(response, newAccessToken, refreshToken);

      return { success: true };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string, response: Response) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    response.clearCookie('access_token', this.getBaseCookieOptions());
    response.clearCookie('refresh_token', this.getBaseCookieOptions());
    return { success: true };
  }

  private async getPermissionsForUser(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: { select: { name: true } } } },
          },
        },
      },
    });
    return (user?.role?.permissions ?? []).map((rp: any) => rp.permission.name);
  }

  private setCookies(response: Response, accessToken: string, refreshToken: string) {
    response.cookie('access_token', accessToken, {
      ...this.getBaseCookieOptions(),
      maxAge: 15 * 60 * 1000,
    });

    response.cookie('refresh_token', refreshToken, {
      ...this.getBaseCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private getBaseCookieOptions(): CookieOptions {
    const sameSite = this.getCookieSameSite();
    const domain = process.env.COOKIE_DOMAIN?.trim();

    return {
      httpOnly: true,
      secure: this.getCookieSecure(sameSite),
      sameSite,
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }

  private getCookieSameSite(): CookieOptions['sameSite'] {
    const configured = process.env.COOKIE_SAME_SITE?.trim().toLowerCase();

    if (configured === 'strict' || configured === 'lax' || configured === 'none') {
      return configured;
    }

    return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
  }

  private getCookieSecure(sameSite: CookieOptions['sameSite']): boolean {
    if (sameSite === 'none') {
      return true;
    }

    const configured = process.env.COOKIE_SECURE?.trim().toLowerCase();

    if (configured === 'true') {
      return true;
    }

    if (configured === 'false') {
      return false;
    }

    return process.env.NODE_ENV === 'production';
  }
}
