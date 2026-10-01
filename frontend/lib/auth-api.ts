import api from './api';

export interface ForgotPasswordResponse {
  message: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface VerifyOtpResponse {
  resetToken: string;
  expiresInSeconds: number;
  message: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export const authApi = {
  /** Step 1 — email a 6 digit OTP to the account owner. */
  forgotPassword: (email: string) =>
    api.post<ForgotPasswordResponse>('/auth/forgot-password', { email }).then(res => res.data),

  /** Step 2 — exchange a valid OTP for a short lived reset token. */
  verifyOtp: (email: string, otp: string) =>
    api.post<VerifyOtpResponse>('/auth/verify-otp', { email, otp }).then(res => res.data),

  /** Step 3 — set the new password using the token from step 2. */
  resetPassword: (data: { resetToken: string; newPassword: string; confirmPassword: string }) =>
    api.post<ResetPasswordResponse>('/auth/reset-password', data).then(res => res.data),
};

/** Pulls a readable message out of an axios error, falling back to a generic one. */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  return message || fallback;
}
