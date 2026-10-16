'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getAssetUrl } from '@/lib/api';
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
import {
  Settings,
  User,
  Mail,
  Sparkles,
  Lock,
  Check,
  Image as ImageIcon,
  Upload,
  Trash2,
  Plus,
  RefreshCw,
  AlertCircle,
  Building,
  CheckCircle2,
  X,
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Branding & Logo State ─────────────────────────────────────
  const { data: branding, isLoading: isBrandingLoading } = useQuery({
    queryKey: ['branding'],
    queryFn: () => apiFetch('/api/settings/branding'),
  });

  const [appName, setAppName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [brandingMsg, setBrandingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    if (branding) {
      setAppName(branding.appName || 'SHALIACH AI');
      setCompanyName(branding.companyName || 'FixHubTech');
    }
  }, [branding]);

  // Update Branding Info Mutation
  const updateBrandingMutation = useMutation({
    mutationFn: (body: { appName: string; companyName: string }) =>
      apiFetch('/api/settings/branding', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setBrandingMsg({ type: 'success', text: 'Workspace branding saved successfully.' });
      queryClient.invalidateQueries({ queryKey: ['branding'] });
    },
    onError: (err: any) => {
      setBrandingMsg({ type: 'error', text: err.message || 'Failed to update branding.' });
    },
  });

  // Handle Logo File Selection
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setBrandingMsg({ type: 'error', text: 'Logo image must be smaller than 5MB.' });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setBrandingMsg(null);
    }
  };

  // Upload Logo
  const handleUploadLogo = async () => {
    if (!logoFile) return;
    setIsUploadingLogo(true);
    setBrandingMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', logoFile);

      await apiFetch('/api/settings/logo', {
        method: 'POST',
        body: formData,
      });

      setLogoFile(null);
      setLogoPreview(null);
      setBrandingMsg({ type: 'success', text: 'Custom logo uploaded and applied to workspace.' });
      queryClient.invalidateQueries({ queryKey: ['branding'] });
    } catch (err: any) {
      setBrandingMsg({ type: 'error', text: err.message || 'Failed to upload logo.' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Delete Custom Logo
  const handleDeleteLogo = async () => {
    if (!confirm('Revert to default application logo?')) return;
    setIsUploadingLogo(true);
    setBrandingMsg(null);

    try {
      await apiFetch('/api/settings/logo', { method: 'DELETE' });
      setLogoFile(null);
      setLogoPreview(null);
      setBrandingMsg({ type: 'success', text: 'Custom logo removed. Default icon restored.' });
      queryClient.invalidateQueries({ queryKey: ['branding'] });
    } catch (err: any) {
      setBrandingMsg({ type: 'error', text: err.message || 'Failed to remove logo.' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // ── Sender Profiles State ─────────────────────────────────────
  const { data: senders } = useQuery({
    queryKey: ['settings-senders'],
    queryFn: () => apiFetch('/api/settings/senders'),
  });

  const [showSenderModal, setShowSenderModal] = useState(false);
  const [senderForm, setSenderForm] = useState({
    name: '',
    fromName: '',
    fromEmail: '',
    replyToEmail: '',
    dailyLimit: 100,
    isDefault: false,
  });
  const [senderMsg, setSenderMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const createSenderMutation = useMutation({
    mutationFn: (body: typeof senderForm) =>
      apiFetch('/api/settings/senders', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setShowSenderModal(false);
      setSenderForm({
        name: '',
        fromName: '',
        fromEmail: '',
        replyToEmail: '',
        dailyLimit: 100,
        isDefault: false,
      });
      queryClient.invalidateQueries({ queryKey: ['settings-senders'] });
    },
    onError: (err: any) => {
      setSenderMsg({ type: 'error', text: err.message || 'Failed to create sender profile.' });
    },
  });

  const deleteSenderMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/settings/senders/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-senders'] });
    },
  });

  // ── Password change state ─────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
          Manage workspace branding, sender identities, Groq AI parameters, and account security.
        </p>
      </div>

      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">Branding &amp; Logo</TabsTrigger>
          <TabsTrigger value="sender">Sender Profiles</TabsTrigger>
          <TabsTrigger value="ai">Groq AI Parameters</TabsTrigger>
          <TabsTrigger value="security">Account Security</TabsTrigger>
        </TabsList>

        {/* Tab 1: Branding & Logo */}
        <TabsContent value="branding" className="space-y-4 pt-4">
          {brandingMsg && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${
                brandingMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}
            >
              {brandingMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{brandingMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Management Card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center">
                  <ImageIcon className="h-4 w-4 mr-2 text-primary" />
                  Workspace Logo
                </CardTitle>
                <CardDescription className="text-xs">
                  Upload your brand logo. It automatically updates the login page, sidebar, and dashboard headers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Active / Preview Logo Display */}
                <div className="flex items-center space-x-4 p-4 rounded-xl border bg-muted/20">
                  <div className="h-16 w-16 rounded-xl border bg-card flex items-center justify-center p-2 overflow-hidden shadow-sm">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="h-full w-full object-contain"
                      />
                    ) : branding?.logoUrl ? (
                      <img
                        src={getAssetUrl(branding.logoUrl) || branding.logoUrl}
                        alt="Current Workspace Logo"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground font-black text-lg flex items-center justify-center shadow-sm">
                        {(appName || 'S').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-foreground">
                      {logoPreview
                        ? 'New Logo Selected (Unsaved)'
                        : branding?.logoUrl
                        ? 'Custom Workspace Logo Active'
                        : 'Default Icon Active'}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Recommended: Transparent PNG, SVG, or WebP. Max 5MB.
                    </p>
                    {branding?.logoUrl && !logoPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDeleteLogo}
                        disabled={isUploadingLogo}
                        className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Revert to Default
                      </Button>
                    )}
                  </div>
                </div>

                {/* Upload Form */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground block">
                    Choose New Logo Image
                  </label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/svg+xml, image/webp, image/avif"
                    onChange={handleLogoFileChange}
                    className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
                  />
                </div>

                {logoFile && (
                  <div className="flex space-x-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleUploadLogo}
                      disabled={isUploadingLogo}
                      className="text-xs"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {isUploadingLogo ? 'Uploading to Storage...' : 'Save & Apply Logo'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(null);
                      }}
                      disabled={isUploadingLogo}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Workspace Names Card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center">
                  <Building className="h-4 w-4 mr-2 text-primary" />
                  Workspace Information
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure the brand names displayed across the navigation bar and authentication portals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setBrandingMsg(null);
                    updateBrandingMutation.mutate({ appName, companyName });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Application / Suite Name
                    </label>
                    <Input
                      type="text"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="e.g. SHALIACH AI"
                      required
                      className="h-8 text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Displayed on the sidebar header, login screen, and page titles.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Company / Organization Name
                    </label>
                    <Input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. FixHubTech"
                      required
                      className="h-8 text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Displayed on subtitle headers, footer copyright, and email templates.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={updateBrandingMutation.isPending}
                    className="mt-2 text-xs"
                  >
                    {updateBrandingMutation.isPending ? 'Saving Details...' : 'Save Workspace Details'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Sender Profiles */}
        <TabsContent value="sender" className="space-y-4 pt-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-primary" />
                  Sender Profiles
                </CardTitle>
                <CardDescription className="text-xs">
                  Email addresses and identities used when dispatching outreach campaigns through Resend.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setShowSenderModal(true)}
                className="text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Sender Profile
              </Button>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete sender profile "${s.fromName}"?`)) {
                            deleteSenderMutation.mutate(s.id);
                          }
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground space-y-2">
                    <Mail className="h-8 w-8 mx-auto text-muted-foreground/50" />
                    <p className="font-semibold text-xs text-foreground">No sender profiles configured yet</p>
                    <p className="text-[11px]">
                      Add your domain email identity (configured in Resend) to begin dispatching campaigns.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowSenderModal(true)}
                      className="mt-2 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add First Profile
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Groq AI Parameters */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Primary Model</label>
                  <Input value="openai/gpt-oss-120b" disabled className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Fallback Model</label>
                  <Input value="openai/gpt-oss-20b" disabled className="h-8 text-xs font-mono" />
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

        {/* Tab 4: Security & Password */}
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

      {/* Add Sender Profile Modal */}
      {showSenderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowSenderModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-2 text-primary font-bold text-base">
              <Mail className="h-5 w-5" />
              <span>Add Sender Identity</span>
            </div>

            {senderMsg && (
              <div className="p-2.5 rounded text-xs bg-rose-100 text-rose-800">
                {senderMsg.text}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSenderMsg(null);
                createSenderMutation.mutate(senderForm);
              }}
              className="space-y-3 text-xs"
            >
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Profile Label</label>
                <Input
                  type="text"
                  placeholder="e.g. Outreach Primary"
                  value={senderForm.name}
                  onChange={(e) => setSenderForm({ ...senderForm, name: e.target.value })}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Sender Display Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Joshua Caleb"
                  value={senderForm.fromName}
                  onChange={(e) => setSenderForm({ ...senderForm, fromName: e.target.value })}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">From Email Address</label>
                <Input
                  type="email"
                  placeholder="e.g. outreach@yourdomain.com"
                  value={senderForm.fromEmail}
                  onChange={(e) => setSenderForm({ ...senderForm, fromEmail: e.target.value })}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Reply-To Email Address</label>
                <Input
                  type="email"
                  placeholder="e.g. replies@yourdomain.com"
                  value={senderForm.replyToEmail}
                  onChange={(e) => setSenderForm({ ...senderForm, replyToEmail: e.target.value })}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Daily Send Cap</label>
                <Input
                  type="number"
                  min={1}
                  max={2000}
                  value={senderForm.dailyLimit}
                  onChange={(e) =>
                    setSenderForm({ ...senderForm, dailyLimit: parseInt(e.target.value) || 100 })
                  }
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={senderForm.isDefault}
                  onChange={(e) => setSenderForm({ ...senderForm, isDefault: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary"
                />
                <label htmlFor="isDefault" className="text-muted-foreground select-none cursor-pointer">
                  Set as default sender profile for campaigns
                </label>
              </div>

              <div className="flex space-x-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSenderModal(false)}
                  className="w-1/2 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createSenderMutation.isPending}
                  className="w-1/2 text-xs font-semibold"
                >
                  {createSenderMutation.isPending ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
