'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
} from '@shaliach/ui';
import { Settings, User, Mail, Sparkles, Lock, Check } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sender profiles
  const { data: senders } = useQuery({
    queryKey: ['settings-senders'],
    queryFn: () => apiFetch('/api/settings/senders'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setPasswordMsg({ type: 'success', text: 'Password successfully updated.' });
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (err: any) => {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
          <Settings className="h-6 w-6 mr-2 text-primary" />
          Settings &amp; Configuration
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage sender identities, Groq AI parameters, and account security.
        </p>
      </div>

      <Tabs defaultValue="sender">
        <TabsList>
          <TabsTrigger value="sender">Sender Profiles</TabsTrigger>
          <TabsTrigger value="ai">Groq AI Parameters</TabsTrigger>
          <TabsTrigger value="security">Account Security</TabsTrigger>
        </TabsList>

        {/* Tab 1: Sender Profiles */}
        <TabsContent value="sender" className="space-y-4 pt-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center">
                <Mail className="h-4 w-4 mr-2 text-primary" />
                FixHubTech Sender Profiles
              </CardTitle>
              <CardDescription className="text-xs">
                Email addresses and identities used when dispatching campaigns through Resend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border divide-y text-xs">
                {senders && senders.length > 0 ? (
                  senders.map((s: any) => (
                    <div key={s.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-foreground flex items-center">
                          {s.fromName} &lt;{s.fromEmail}&gt;
                          {s.isDefault && (
                            <Badge variant="success" className="ml-2 text-[10px]">
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground text-[11px] mt-0.5">
                          Reply-To: {s.replyToEmail} · Daily Cap: {s.dailyLimit} emails/day
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-foreground flex items-center">
                        Joshua Caleb &lt;joshua@mail.fixhubtech.com&gt;
                        <Badge variant="success" className="ml-2 text-[10px]">
                          Default
                        </Badge>
                      </div>
                      <div className="text-muted-foreground text-[11px] mt-0.5">
                        Reply-To: joshua@reply.fixhubtech.com · Daily Cap: 100 emails/day
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Groq AI Parameters */}
        <TabsContent value="ai" className="space-y-4 pt-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center">
                <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
                Groq AI Engine Configuration
              </CardTitle>
              <CardDescription className="text-xs">
                Active models, inference limits, and temperature controls for personalization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Primary Model</label>
                  <Input value="llama-3.3-70b-versatile" disabled className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Fallback Model</label>
                  <Input value="llama-3.1-8b-instant" disabled className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Max Output Tokens</label>
                  <Input value="1000" disabled className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Temperature</label>
                  <Input value="0.4" disabled className="h-8 text-xs font-mono" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Security & Password */}
        <TabsContent value="security" className="space-y-4 pt-4">
          <Card className="shadow-sm max-w-lg">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center">
                <Lock className="h-4 w-4 mr-2 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription className="text-xs">
                Update credentials for {user?.email}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                {passwordMsg && (
                  <div
                    className={`p-2.5 rounded text-xs ${
                      passwordMsg.type === 'success'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {passwordMsg.text}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold">Current Password</label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold">New Password (min 8 chars)</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="h-8 text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={changePasswordMutation.isPending}
                  className="mt-2"
                >
                  {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
