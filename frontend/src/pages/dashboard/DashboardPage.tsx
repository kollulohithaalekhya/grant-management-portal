import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, FileText, Users, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasRole } from '../../utils/roles';
import { grantsAPI, applicationsAPI } from '../../api/services';
import { DashboardStats, Grant, Application } from '../../types';
import { Card, Badge, Spinner } from '../../components/ui';
import { formatCurrency, daysUntilDeadline } from '../../utils/helpers';

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string }> = ({ label, value, icon, color, sub }) => (
  <Card className="flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </Card>
);

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentGrants, setRecentGrants] = useState<Grant[]>([]);
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [grantsRes, appsRes] = await Promise.all([
          grantsAPI.getAll({ limit: 5 }),
          applicationsAPI.getAll({ limit: 5 }),
        ]);
        setRecentGrants(grantsRes.data.data);
        setRecentApps(appsRes.data.data);

        if (hasRole(user, 'ADMIN', 'GRANT_MANAGER')) {
          const statsRes = await grantsAPI.getStats();
          setStats(statsRes.data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name?.split(' ')[0]}! 👋</h1>
        <p className="text-gray-500 mt-1">Here's what's happening with your grants.</p>
      </div>

      {/* Stats grid - Admin/Manager */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Grants" value={stats.totalGrants} icon={<Award className="w-6 h-6 text-blue-600" />} color="bg-blue-50" sub={`${stats.openGrants} open`} />
          <StatCard label="Total Applications" value={stats.totalApplications} icon={<FileText className="w-6 h-6 text-purple-600" />} color="bg-purple-50" sub={`${stats.pendingApplications} pending`} />
          <StatCard label="Total Funding" value={formatCurrency(stats.totalFunding)} icon={<DollarSign className="w-6 h-6 text-green-600" />} color="bg-green-50" />
          <StatCard label="Registered Users" value={stats.totalUsers} icon={<Users className="w-6 h-6 text-orange-600" />} color="bg-orange-50" />
        </div>
      )}

      {/* Applicant stats */}
      {hasRole(user, 'APPLICANT') && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="My Applications" value={recentApps.length} icon={<FileText className="w-6 h-6 text-blue-600" />} color="bg-blue-50" />
          <StatCard label="Approved" value={recentApps.filter(a => a.status === 'APPROVED').length} icon={<CheckCircle className="w-6 h-6 text-green-600" />} color="bg-green-50" />
          <StatCard label="Pending Review" value={recentApps.filter(a => a.status === 'PENDING').length} icon={<Clock className="w-6 h-6 text-yellow-600" />} color="bg-yellow-50" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Grants */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Grants</h2>
            <Link to="/grants" className="text-sm text-primary-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentGrants.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No grants found</p>
            ) : recentGrants.map((grant) => {
              const days = daysUntilDeadline(grant.deadline);
              return (
                <Link key={grant.id} to={`/grants/${grant.id}`} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 group">
                  <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600 truncate">{grant.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{formatCurrency(grant.amount)}</span>
                      <span className="text-gray-300">·</span>
                      <span className={`text-xs ${days < 7 ? 'text-red-500' : 'text-gray-500'}`}>
                        {days < 0 ? 'Expired' : `${days}d left`}
                      </span>
                    </div>
                  </div>
                  <Badge label={grant.status} status={grant.status} />
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Recent Applications */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Applications</h2>
            <Link to="/applications" className="text-sm text-primary-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentApps.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No applications yet</p>
            ) : recentApps.map((app) => (
              <Link key={app.id} to={`/applications/${app.id}`} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 group">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600 truncate">{app.projectTitle}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{app.grantTitle}</p>
                </div>
                <Badge label={app.status} status={app.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
