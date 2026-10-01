'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  X,
} from 'lucide-react';
import { authApi, getApiErrorMessage } from '@/lib/auth-api';

type Step = 'email' | 'otp' | 'password' | 'done';

const emailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});

const otpSchema = z.object({
  otp: z
    .string()
    .min(1, 'OTP is required')
    .regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

// Mirrors the backend rule in reset-password.dto.ts so the two cannot drift apart.
const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters')
      .regex(/[a-z]/, 'Include at least one lowercase letter')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/\d/, 'Include at least one number')
      .regex(/[^A-Za-z0-9]/, 'Include at least one special character'),
    confirmPassword: z.string().min(1, 'Please re-enter your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type EmailValues = z.infer<typeof emailSchema>;
type OtpValues = z.infer<typeof otpSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number', test: (v: string) => /\d/.test(v) },
  { label: 'One special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background/50 px-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });
  const otpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const newPassword = useWatch({ control: passwordForm.control, name: 'newPassword' }) ?? '';
  const otpRegister = otpForm.register('otp');

  // One ticker drives both the OTP expiry and the resend cooldown.
  useEffect(() => {
    if (otpExpiresIn <= 0 && resendIn <= 0) return;
    const id = setInterval(() => {
      setOtpExpiresIn((v) => (v > 0 ? v - 1 : 0));
      setResendIn((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [otpExpiresIn, resendIn]);

  const otpExpired = step === 'otp' && otpExpiresIn <= 0;

  const requestOtp = useCallback(
    async (targetEmail: string, { isResend = false } = {}) => {
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        const res = await authApi.forgotPassword(targetEmail);
        setEmail(targetEmail);
        setOtpExpiresIn(res.expiresInSeconds);
        setResendIn(res.resendAfterSeconds);
        setStep('otp');
        otpForm.reset({ otp: '' });
        setNotice(
          isResend
            ? 'A new code has been sent if the address is registered.'
            : res.message,
        );
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [otpForm],
  );

  const onSubmitEmail = (data: EmailValues) => requestOtp(data.email.trim().toLowerCase());

  const onSubmitOtp = async (data: OtpValues) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authApi.verifyOtp(email, data.otp);
      setResetToken(res.resetToken);
      setStep('password');
      setOtpExpiresIn(0);
      setResendIn(0);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onSubmitPassword = async (data: PasswordValues) => {
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword({
        resetToken,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      setResetToken('');
      setStep('done');
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    setStep('email');
    setError(null);
    setNotice(null);
    setResetToken('');
    setOtpExpiresIn(0);
    setResendIn(0);
    otpForm.reset({ otp: '' });
    passwordForm.reset({ newPassword: '', confirmPassword: '' });
    emailForm.reset({ email });
  };

  const heading = useMemo(() => {
    switch (step) {
      case 'email':
        return { title: 'Forgot Password', subtitle: "Enter your email and we'll send you a 6-digit code." };
      case 'otp':
        return { title: 'Enter OTP', subtitle: `We sent a 6-digit code to ${email}.` };
      case 'password':
        return { title: 'Set New Password', subtitle: 'Choose a strong password you have not used before.' };
      default:
        return { title: 'Password Updated', subtitle: '' };
    }
  }, [step, email]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-card p-8 rounded-2xl shadow-xl border border-border/50 space-y-6">
          {step === 'done' ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter text-foreground">{heading.title}</h1>
              <p className="text-muted-foreground text-sm">
                Your password has been updated. Redirecting you to sign in…
              </p>
              <Link
                href="/login"
                className="flex items-center justify-center w-full premium-gradient text-primary-foreground h-10 px-4 py-2 rounded-md font-medium transition-opacity hover:opacity-90"
              >
                Go to login
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h1 className="text-3xl font-black tracking-tighter text-foreground">{heading.title}</h1>
                <p className="text-muted-foreground mt-2 text-sm">{heading.subtitle}</p>
              </div>

              <div className="flex items-center justify-center gap-2" aria-hidden="true">
                {(['email', 'otp', 'password'] as const).map((s) => {
                  const order = { email: 0, otp: 1, password: 2 } as const;
                  const active = order[s] <= order[step as 'email' | 'otp' | 'password'];
                  return (
                    <span
                      key={s}
                      className={`h-1.5 rounded-full transition-all ${
                        active ? 'w-8 bg-primary' : 'w-4 bg-border'
                      }`}
                    />
                  );
                })}
              </div>

              {step === 'email' && (
                <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium leading-none">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        {...emailForm.register('email')}
                        placeholder="name@example.com"
                        className={inputClass}
                      />
                    </div>
                    {emailForm.formState.errors.email && (
                      <p className="text-xs text-destructive">{emailForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full premium-gradient text-primary-foreground h-10 px-4 py-2 rounded-md font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Send OTP'}
                  </button>
                </form>
              )}

              {step === 'otp' && (
                <form onSubmit={otpForm.handleSubmit(onSubmitOtp)} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <label htmlFor="otp" className="text-sm font-medium leading-none">6-digit code</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        id="otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        autoFocus
                        disabled={otpExpired}
                        {...otpRegister}
                        onChange={(e) => {
                          // Strip anything non numeric so a pasted "123 456" still works.
                          e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          return otpRegister.onChange(e);
                        }}
                        placeholder="000000"
                        className={`${inputClass} tracking-[0.5em] font-mono text-base`}
                      />
                    </div>
                    {otpForm.formState.errors.otp && (
                      <p className="text-xs text-destructive">{otpForm.formState.errors.otp.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {otpExpired
                        ? 'This code has expired. Request a new one.'
                        : `Code expires in ${formatCountdown(otpExpiresIn)}`}
                    </p>
                  </div>

                  {notice && !error && (
                    <div className="p-3 rounded-md bg-primary/10 text-primary text-sm">{notice}</div>
                  )}
                  {error && (
                    <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || otpExpired}
                    className="w-full premium-gradient text-primary-foreground h-10 px-4 py-2 rounded-md font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Verify OTP'}
                  </button>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={restart}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      disabled={resendIn > 0 || loading}
                      onClick={() => requestOtp(email, { isResend: true })}
                      className="text-primary hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
                    </button>
                  </div>
                </form>
              )}

              {step === 'password' && (
                <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <label htmlFor="newPassword" className="text-sm font-medium leading-none">New password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        autoFocus
                        {...passwordForm.register('newPassword')}
                        placeholder="••••••••"
                        className={`${inputClass} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-xs text-destructive">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  <ul className="space-y-1">
                    {PASSWORD_RULES.map((rule) => {
                      const ok = rule.test(newPassword);
                      return (
                        <li
                          key={rule.label}
                          className={`flex items-center gap-2 text-xs ${
                            ok ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'
                          }`}
                        >
                          {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          {rule.label}
                        </li>
                      );
                    })}
                  </ul>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium leading-none">
                      Re-type new password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        {...passwordForm.register('confirmPassword')}
                        placeholder="••••••••"
                        className={`${inputClass} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-xs text-destructive">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full premium-gradient text-primary-foreground h-10 px-4 py-2 rounded-md font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Submit'}
                  </button>
                </form>
              )}

              <div className="text-center">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
