import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { t } from "@/lib/locales";
import { useLanguage } from "@/components/shared/LanguageContext";
import { toast } from "sonner";
import axios from "axios";
import { Loader2, Eye, EyeOff } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function AccountTab() {
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const { locale } = useLanguage();
  
  const profile = useSelector((state: RootState) => state.profile);
  // Try to get more detailed info from localStorage if available, as Redux might be minimal
  const [detailedInfo, setDetailedInfo] = React.useState<any>({});
  
  // Editable state
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [hasChanges, setHasChanges] = React.useState(false);

  // Email editing state
  const [isEditingEmail, setIsEditingEmail] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState('');
  const [verificationCode, setVerificationCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [codeSent, setCodeSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);

  // Delete account state
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  
  const isEmailLogin = detailedInfo.loginType === 'email' || detailedInfo.login_type === 'email';
  
  React.useEffect(() => {
    const stored = localStorage.getItem('userInfo');
    if (stored) {
      try {
        const info = JSON.parse(stored);
        setDetailedInfo(info);
        
        // Initialize name fields
        const fullName = info.name || profile.name || 'User';
        const parts = fullName.split(' ');
        if (parts.length > 0) {
            setFirstName(parts[0]);
            setLastName(parts.slice(1).join(' '));
        } else {
            setFirstName(fullName);
            setLastName('');
        }
      } catch(e) {}
    } else if (profile.name) {
        // Fallback to redux profile
        const parts = profile.name.split(' ');
        if (parts.length > 0) {
            setFirstName(parts[0]);
            setLastName(parts.slice(1).join(' '));
        } else {
            setFirstName(profile.name);
            setLastName('');
        }
    }
  }, [profile.name]);

  // Countdown timer effect
  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const email = profile.email || detailedInfo.email || 'No email linked';

  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
    setHasChanges(true);
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value);
    setHasChanges(true);
  };

  const handleSave = () => {
    const newName = `${firstName} ${lastName}`.trim();
    
    // Update localStorage
    const stored = localStorage.getItem('userInfo');
    let newInfo = {};
    if (stored) {
        try {
            newInfo = JSON.parse(stored);
        } catch {}
    }
    
    // Merge updates
    newInfo = { ...newInfo, name: newName };
    
    // Save back
    localStorage.setItem('userInfo', JSON.stringify(newInfo));
    setDetailedInfo(newInfo);
    
    // Dispatch event for Navbar update
    window.dispatchEvent(new Event('userInfoUpdated'));
    
    setHasChanges(false);
    toast.success(t('success', locale));
  };

  const handleStartEditEmail = () => {
    setIsEditingEmail(true);
    setNewEmail(email === 'No email linked' ? '' : email);
  };

  const handleCancelEditEmail = () => {
    setIsEditingEmail(false);
    setCodeSent(false);
    setVerificationCode('');
    setNewPassword('');
    setConfirmPassword('');
    setNewEmail('');
    setShowPassword(false);
  };

  const handleSendCode = async () => {
    if (!newEmail || !newEmail.includes('@')) {
        toast.error(t('invalidEmail', locale));
        return;
    }
    setLoading(true);
    try {
        const URL = process.env.NEXT_PUBLIC_API_URL || '';
        await axios.post(`${URL}/api/v1/auth/send-code`, {
            email: newEmail,
            type: 'update_email'
        });
        setCodeSent(true);
        toast.success(t('verificationCodeSent', locale));
        setCountdown(60);
    } catch (error: any) {
        const errorMsg = error.response?.data?.detail;
        if (errorMsg === 'Email already occupied by another user') {
            toast.error(t('emailOccupied', locale));
        } else {
            toast.error(t('errorSendingCode', locale));
        }
    } finally {
        setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!verificationCode) {
        toast.error(t('enterCode', locale));
        return;
    }
    
    if (newPassword && newPassword.length < 6) {
        toast.error(t('passwordTooShort', locale, { min: '6' }) || 'Password must be at least 6 characters');
        return;
    }

    if (newPassword && newPassword !== confirmPassword) {
        toast.error(t('passwordsDoNotMatch', locale) || 'Passwords do not match');
        return;
    }

    setLoading(true);
    try {
        const URL = process.env.NEXT_PUBLIC_API_URL || '';
        // Get current user info for ID
        const currentUser = detailedInfo.userId ? detailedInfo : JSON.parse(localStorage.getItem('userInfo') || '{}');
        const userId = currentUser.user_id || currentUser.userId || currentUser.email;

        if (!userId) {
            toast.error(t('userNotFound', locale));
            return;
        }

        const res = await axios.post(`${URL}/api/v1/auth/update-email`, {
            user_id: userId,
            email: newEmail,
            code: verificationCode,
            password: newPassword
        });
        
        // Update local storage
        const updatedUser = { ...currentUser, email: newEmail };
        
        // If login type was email, update user_id too (if backend returns it, or we infer)
        if (res.data.user) {
            updatedUser.email = res.data.user.email;
            if (res.data.user.login_type === 'email') {
                updatedUser.userId = res.data.user.user_id;
                localStorage.setItem('userEmail', res.data.user.user_id);
            }
        } else {
             updatedUser.email = newEmail;
        }

        localStorage.setItem('userInfo', JSON.stringify(updatedUser));
        setDetailedInfo(updatedUser);
        window.dispatchEvent(new Event('userInfoUpdated'));
        
        setIsEditingEmail(false);
        setCodeSent(false);
        setVerificationCode('');
        toast.success(t('emailUpdated', locale));
    } catch (error: any) {
        const errorMsg = error.response?.data?.detail;
        if (errorMsg === 'Email already occupied by another user') {
            toast.error(t('emailOccupied', locale));
        } else {
            toast.error(errorMsg || t('errorUpdatingEmail', locale));
        }
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') return;
    
    setIsDeleting(true);
    try {
        const URL = process.env.NEXT_PUBLIC_API_URL || '';
        await axios.delete(`${URL}/api/v1/auth/user/me`, {
            withCredentials: true
        });
        
        toast.success(t('accountDeleted', locale));
        logout();
    } catch (error: any) {
        console.error("Delete account error:", error);
        toast.error(error.response?.data?.detail || t('error', locale));
        setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Personal Details */}
      <div className="space-y-4">
        <div>
            <h3 className="text-lg font-medium">{t('personalDetails', locale)}</h3>
            <p className="text-sm text-muted-foreground">{t('updatePersonalDetails', locale)}</p>
        </div>
        
        <div className="flex items-center gap-4 mb-6">
             <Avatar className="h-16 w-16">
                <AvatarImage src={detailedInfo.avatar} />
                <AvatarFallback>{firstName ? firstName[0].toUpperCase() : 'U'}</AvatarFallback>
            </Avatar>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('firstName', locale)}</Label>
            <Input value={firstName} onChange={handleFirstNameChange} />
          </div>
          <div className="space-y-2">
            <Label>{t('lastName', locale)}</Label>
            <Input value={lastName} onChange={handleLastNameChange} />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('email', locale)}</Label>
            {!isEditingEmail && !isEmailLogin && (
                <Button variant="ghost" size="sm" onClick={handleStartEditEmail} className="h-8 text-xs">
                    {t('edit', locale)}
                </Button>
            )}
          </div>
          
          {isEditingEmail ? (
            <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{t('enterNewEmail', locale)}</Label>
                    <div className="flex gap-2">
                        <Input 
                            value={newEmail} 
                            onChange={(e) => setNewEmail(e.target.value)} 
                            placeholder={t('emailPlaceholder', locale)}
                            disabled={codeSent || loading}
                        />
                        {!codeSent && (
                             <Button onClick={handleSendCode} disabled={loading || !newEmail} type="button">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('sendCode', locale)}
                             </Button>
                        )}
                    </div>
                </div>
                
                {codeSent && (
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">{t('enterVerificationCode', locale)}</Label>
                        <div className="flex gap-2">
                            <Input 
                                value={verificationCode} 
                                onChange={(e) => setVerificationCode(e.target.value)} 
                                placeholder={t('verificationCode', locale)}
                            />
                            <Button 
                                variant="outline" 
                                onClick={handleSendCode} 
                                disabled={countdown > 0 || loading}
                                type="button"
                            >
                                {countdown > 0 ? t('resendCodeIn', locale, { seconds: countdown.toString() }) : t('resendCode', locale)}
                            </Button>
                        </div>
                        
                        <div className="space-y-2 pt-2">
                            <Label className="text-xs text-muted-foreground">{t('setPassword', locale)}</Label>
                            <div className="relative">
                                <Input 
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword} 
                                    onChange={(e) => setNewPassword(e.target.value)} 
                                    placeholder={t('passwordPlaceholder', locale)}
                                    className="pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                            
                            {newPassword && (
                                <div className="mt-2">
                                    <div className="relative">
                                        <Input 
                                            type={showPassword ? "text" : "password"}
                                            value={confirmPassword} 
                                            onChange={(e) => setConfirmPassword(e.target.value)} 
                                            placeholder={t('confirmNewPassword', locale)}
                                            className="pr-10"
                                        />
                                    </div>
                                </div>
                            )}
                            <p className="text-[10px] text-muted-foreground">{t('setPasswordDesc', locale)}</p>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                             <Button variant="ghost" onClick={handleCancelEditEmail} disabled={loading}>
                                {t('cancel', locale)}
                             </Button>
                             <Button onClick={handleVerifyEmail} disabled={loading || !verificationCode}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('verifyAndSave', locale)}
                             </Button>
                        </div>
                    </div>
                )}
                 {!codeSent && (
                     <div className="flex justify-end gap-2 mt-2">
                         <Button variant="ghost" onClick={handleCancelEditEmail} disabled={loading} size="sm">
                            {t('cancel', locale)}
                         </Button>
                     </div>
                 )}
            </div>
          ) : (
            <Input value={email} readOnly disabled className="bg-muted opacity-70" />
          )}
        </div>
        
        <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!hasChanges}>
                {t('saveChanges', locale)}
            </Button>
        </div>
      </div>

      {/* Appearance */}
      <div className="space-y-4 pt-6 border-t">
        <div>
            <h3 className="text-lg font-medium">{t('appearance', locale)}</h3>
            <p className="text-sm text-muted-foreground">{t('appearanceDesc', locale)}</p>
        </div>
        
        <RadioGroup defaultValue={theme} onValueChange={setTheme} className="grid grid-cols-3 gap-4">
          <div>
            <RadioGroupItem value="light" id="light" className="peer sr-only" />
            <Label
              htmlFor="light"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
            >
              <div className="mb-2 rounded-md bg-[#ecedef] p-2 w-full h-20 flex items-center justify-center">
                 <div className="h-4 w-2/3 bg-white rounded shadow-sm" />
              </div>
              {t('light', locale)}
            </Label>
          </div>
          <div>
            <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
            <Label
              htmlFor="dark"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
            >
              <div className="mb-2 rounded-md bg-slate-950 p-2 w-full h-20 flex items-center justify-center">
                <div className="h-4 w-2/3 bg-slate-800 rounded shadow-sm" />
              </div>
              {t('dark', locale)}
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Authorization */}
      <div className="space-y-4 pt-6 border-t">
        <div>
            <h3 className="text-lg font-medium">{t('authorization', locale)}</h3>
            <p className="text-sm text-muted-foreground">{t('manageAuth', locale)}</p>
        </div>
        <Button variant="outline" onClick={logout}>
            {t('logout', locale)}
        </Button>
      </div>

      {/* Delete Account */}
      <div className="space-y-4 pt-6 border-t border-destructive/20">
        <div>
            <h3 className="text-lg font-medium text-destructive">{t('deleteAccount', locale)}</h3>
            <p className="text-sm text-muted-foreground">{t('deleteAccountDesc', locale)}</p>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
                {t('deleteAccountButton', locale)}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirmDeleteAccountTitle', locale)}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('confirmDeleteAccountDesc', locale)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="py-4 space-y-2">
                <Label>{t('deleteAccountConfirmation', locale)}</Label>
                <Input 
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                  setDeleteConfirmation('');
                  setIsDeleting(false);
              }}>{t('cancel', locale)}</AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                    e.preventDefault();
                    handleDeleteAccount();
                }}
                disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('deleteAccountButton', locale)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

