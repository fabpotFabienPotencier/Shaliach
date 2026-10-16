'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shaliach/ui';
import {
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Clock,
  KeyRound,
  X,
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Real Cloudflare Turnstile Verification ────────────────────
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');

  const siteKey =
    process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY || '0x4AAAAAAFYqFaePAI06zdOR';

  // ── Brute Force Lockout Protection ─────────────────────────────
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // ── Forgot Password Modal ──────────────────────────────────────
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  // Explicitly render real Cloudflare Turnstile widget
  const renderTurnstileWidget = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).turnstile) {
      const container = document.getElementById('cf-turnstile-container');
      if (container && container.childNodes.length === 0) {
        try {
          const wid = (window as any).turnstile.render('#cf-turnstile-container', {
            sitekey: siteKey,
            callback: (token: string) => {
              setTurnstileToken(token);
              setError(null);
            },
            'expired-callback': () => {
              setTurnstileToken(null);
            },
            'error-callback': (errCode: any) => {
              console.warn('Turnstile challenge error:', errCode);
              setTurnstileToken(null);
            },
            theme: 'auto',
          });
          setTurnstileWidgetId(wid);
        } catch (e) {
          console.error('Error rendering Cloudflare Turnstile:', e);
        }
      }
    }
  }, [siteKey]);

  // Load remembered email and initialize Turnstile check
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('shaliach_remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore localStorage exceptions in private browsing
    }

    // Check if turnstile script is already available
    const interval = setInterval(() => {
      if ((window as any).turnstile) {
        renderTurnstileWidget();
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [renderTurnstileWidget]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Check brute-force lockout
    if (lockoutSeconds > 0) {
      setError(`Security lockout active. Please wait ${lockoutSeconds} seconds before retrying.`);
      return;
    }

    // 2. Honeypot check (hidden input bots fill out)
    if (honeypot.trim().length > 0) {
      setIsSubmitting(true);
      await new Promise((r) => setTimeout(r, 1200));
      setError('Bot verification failed. Request blocked.');
      setIsSubmitting(false);
      return;
    }

    // 3. Official Cloudflare Turnstile token check
    if (!turnstileToken) {
      setError('Please complete the Cloudflare security verification checkbox before signing in.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email.trim(), password, turnstileToken);

      // Handle remember me
      try {
        if (rememberMe) {
          localStorage.setItem('shaliach_remembered_email', email.trim());
        } else {
          localStorage.removeItem('shaliach_remembered_email');
        }
      } catch {
        // Ignore storage exceptions
      }

      setFailedAttempts(0);
      router.push('/dashboard');
    } catch (err: any) {
      // Reset Turnstile token on failure
      if (typeof window !== 'undefined' && (window as any).turnstile && turnstileWidgetId) {
        try {
          (window as any).turnstile.reset(turnstileWidgetId);
        } catch {
          try {
            (window as any).turnstile.reset('#cf-turnstile-container');
          } catch {}
        }
      }
      setTurnstileToken(null);

      const nextFailures = failedAttempts + 1;
      setFailedAttempts(nextFailures);

      if (nextFailures >= 5) {
        setLockoutSeconds(30);
        setError('Too many failed attempts. For your security, login is locked for 30 seconds.');
      } else {
        const remaining = 5 - nextFailures;
        setError(
          err.message ||
            `Invalid email or password. Please try again. (${remaining} attempt${
              remaining === 1 ? '' : 's'
            } before temporary lockout)`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsSendingReset(true);
    await new Promise((r) => setTimeout(r, 900));
    setIsSendingReset(false);
    setForgotSubmitted(true);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      {/* Official Cloudflare Turnstile SDK Script */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderTurnstileWidget}
      />

      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-xl shadow-md transition-transform hover:scale-105">
            S
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            SHALIACH AI
          </h1>
          <p className="text-xs uppercase font-semibold text-muted-foreground tracking-widest">
            FixHubTech Outreach &amp; Sales Intelligence
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border-slate-200 dark:border-slate-800 backdrop-blur-sm bg-white/95 dark:bg-slate-900/95">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-bold">Sign In</CardTitle>
            <CardDescription className="text-xs">
              Enter your verified credentials to access your sales workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Bot Honeypot Field (Invisible to Humans) */}
              <input
                type="text"
                name="website_trap_auth"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                aria-hidden="true"
                autoComplete="off"
                style={{
                  position: 'absolute',
                  opacity: 0,
                  zIndex: -1,
                  pointerEvents: 'none',
                  height: 0,
                  width: 0,
                  margin: 0,
                  padding: 0,
                }}
              />

              {/* Error / Alert banner */}
              {error && (
                <div
                  className="flex items-center space-x-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive animate-in fade-in duration-200"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email Address */}
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="text-xs font-semibold text-foreground flex items-center justify-between"
                >
                  <span className="flex items-center">
                    <Mail className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    Email Address
                  </span>
                </label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@fixhubtech.com"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  disabled={isSubmitting || lockoutSeconds > 0}
                  className="transition-all focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="text-xs font-semibold text-foreground flex items-center justify-between"
                >
                  <span className="flex items-center">
                    <Lock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    Password
                  </span>
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    disabled={isSubmitting || lockoutSeconds > 0}
                    className="pr-10 transition-all focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center space-x-2 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-900"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotSubmitted(false);
                    setShowForgotModal(true);
                  }}
                  className="font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Real Cloudflare Turnstile Interactive Widget */}
              <div className="my-2 flex flex-col items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2.5">
                <div
                  id="cf-turnstile-container"
                  className="min-h-[65px] flex items-center justify-center"
                />
                {!turnstileToken && (
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1 text-primary" />
                    Complete Cloudflare challenge to proceed
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full font-semibold shadow-md transition-all active:scale-[0.99]"
                disabled={isSubmitting || lockoutSeconds > 0 || !turnstileToken}
              >
                {lockoutSeconds > 0 ? (
                  <span className="flex items-center justify-center">
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Locked ({lockoutSeconds}s remaining)
                  </span>
                ) : isSubmitting ? (
                  'Verifying credentials...'
                ) : (
                  'Sign In to Shaliach AI'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security & Encryption Trust Badges */}
        <div className="flex items-center justify-center space-x-3 text-[11px] text-muted-foreground/80">
          <span className="flex items-center">
            <ShieldCheck className="h-3 w-3 mr-1 text-emerald-500" />
            256-Bit TLS Encrypted
          </span>
          <span>•</span>
          <span>Cloudflare Turnstile Protected</span>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} FixHubTech Digital Solutions. All rights reserved.
        </p>
      </div>

      {/* Forgot Password Modal Dialog */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-2 text-primary font-bold text-base">
              <KeyRound className="h-5 w-5" />
              <span>Reset Your Password</span>
            </div>

            {forgotSubmitted ? (
              <div className="space-y-3 py-2">
                <div className="flex items-start space-x-2 text-emerald-600 dark:text-emerald-400 text-xs bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Reset instructions dispatched!</p>
                    <p className="mt-1 text-muted-foreground">
                      If an account exists for <b>{forgotEmail}</b>, password recovery
                      details have been sent. Please check your inbox or spam folder.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowForgotModal(false)}
                  className="w-full text-xs font-semibold"
                  variant="outline"
                >
                  Return to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  Enter your registered administrator email to receive a secure recovery link.
                </p>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Account Email</label>
                  <Input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="admin@fixhubtech.com"
                    required
                    disabled={isSendingReset}
                  />
                </div>
                <div className="flex space-x-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForgotModal(false)}
                    className="w-1/2 text-xs"
                    disabled={isSendingReset}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="w-1/2 text-xs font-semibold"
                    disabled={isSendingReset}
                  >
                    {isSendingReset ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

