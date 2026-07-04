import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { User, Lock, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usersAPI } from '../../api/services';
import { Button, Card, Input, Badge } from '../../components/ui';
import { getInitials } from '../../utils/helpers';
import toast from 'react-hot-toast';

interface ProfileForm { name: string; }
interface PasswordForm { currentPassword: string; newPassword: string; confirmPassword: string; }

const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const profileForm = useForm<ProfileForm>({ defaultValues: { name: user?.name || '' } });
  const passwordForm = useForm<PasswordForm>();

  const onProfileSubmit = async (data: ProfileForm) => {
    setProfileLoading(true);
    try {
      const res = await usersAPI.updateProfile(data);
      updateUser(res.data.data);
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally { setProfileLoading(false); }
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      await usersAPI.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed');
      passwordForm.reset();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setPasswordLoading(false); }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account preferences</p>
      </div>

      {/* Profile overview */}
      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
            {getInitials(user.name)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{user.name}</h2>
            <p className="text-gray-500 text-sm">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge label={user.role.replace('_', ' ')} status={user.role} />
              <Badge label={user.provider} className="bg-gray-100 text-gray-500" />
            </div>
          </div>
        </div>

        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium text-gray-900">Profile Information</h3>
          </div>
          <Input
            label="Full Name"
            error={profileForm.formState.errors.name?.message}
            {...profileForm.register('name', { required: 'Name is required' })}
          />
          <Input label="Email Address" value={user.email} disabled className="bg-gray-50 cursor-not-allowed" />
          <Button type="submit" loading={profileLoading}>Save Changes</Button>
        </form>
      </Card>

      {/* Change password — local accounts only */}
      {user.provider === 'local' && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium text-gray-900">Change Password</h3>
          </div>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              placeholder="••••••••"
              error={passwordForm.formState.errors.currentPassword?.message}
              {...passwordForm.register('currentPassword', { required: 'Required' })}
            />
            <Input
              label="New Password"
              type="password"
              placeholder="Min. 8 chars with upper, lower, number"
              error={passwordForm.formState.errors.newPassword?.message}
              {...passwordForm.register('newPassword', {
                required: 'Required',
                minLength: { value: 8, message: 'Min 8 characters' },
                pattern: { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: 'Must include upper, lower, number' },
              })}
            />
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="••••••••"
              error={passwordForm.formState.errors.confirmPassword?.message}
              {...passwordForm.register('confirmPassword', { required: 'Required' })}
            />
            <Button type="submit" loading={passwordLoading}>Change Password</Button>
          </form>
        </Card>
      )}

      {/* Role info */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-900">Permissions</h3>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          {user.role === 'ADMIN' && (
            <ul className="space-y-1">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Full access to all features</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Manage users, roles, and grants</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Review and approve applications</li>
            </ul>
          )}
          {user.role === 'GRANT_MANAGER' && (
            <ul className="space-y-1">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Create and manage grants</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Review and approve/reject applications</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-gray-300 rounded-full" /> Cannot manage users</li>
            </ul>
          )}
          {user.role === 'APPLICANT' && (
            <ul className="space-y-1">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full" /> Browse and apply for open grants</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full" /> Track your applications</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-gray-300 rounded-full" /> View-only access to grant listings</li>
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
