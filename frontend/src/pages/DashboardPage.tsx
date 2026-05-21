import { useQuery } from '@tanstack/react-query'
import {
  Users,
  FileText,
  Plug,
  Activity,
  BarChart2,
  HardDrive,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { adminApi } from '@/api/admin'
import { useAuthStore } from '@/store/authStore'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { Card, CardHeader } from '@/components/ui/Card'

// Sample chart data — replaced with real API data in production
const weeklyRunData = [
  { day: 'Mon', runs: 12, errors: 1 },
  { day: 'Tue', runs: 19, errors: 0 },
  { day: 'Wed', runs: 8, errors: 2 },
  { day: 'Thu', runs: 24, errors: 0 },
  { day: 'Fri', runs: 31, errors: 1 },
  { day: 'Sat', runs: 5, errors: 0 },
  { day: 'Sun', runs: 3, errors: 0 },
]

const storageData = [
  { name: 'Reports', value: 240 },
  { name: 'Exports', value: 140 },
  { name: 'Logs', value: 80 },
  { name: 'Other', value: 30 },
]

const chartTooltipStyle = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#f3f4f6',
  fontSize: 12,
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: adminApi.getStats,
    enabled: isAdmin,
    refetchInterval: 30_000,
  })

  const { data: activity = [], isLoading: activityLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => adminApi.getActivity(15),
    enabled: isAdmin,
    refetchInterval: 60_000,
  })

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-white">
          {greeting()}, {user?.full_name.split(' ')[0]}
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Here's what's happening in your workspace today.
        </p>
      </div>

      {/* Stats grid — admin only */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatsCard
            title="Total users"
            value={stats?.user_count ?? 0}
            subtitle={`${stats?.active_user_count ?? 0} active`}
            icon={<Users size={18} />}
            color="blue"
            loading={statsLoading}
            trend={{ value: 12, label: 'this month' }}
          />
          <StatsCard
            title="Reports"
            value={stats?.report_count ?? 0}
            subtitle={`${stats?.recent_report_runs ?? 0} runs this week`}
            icon={<FileText size={18} />}
            color="purple"
            loading={statsLoading}
          />
          <StatsCard
            title="Plugins"
            value={stats?.plugin_count ?? 0}
            subtitle="Installed"
            icon={<Plug size={18} />}
            color="green"
            loading={statsLoading}
          />
          <StatsCard
            title="Storage used"
            value={`${stats?.storage_used_mb ?? 0} MB`}
            subtitle="Of allocated quota"
            icon={<HardDrive size={18} />}
            color="orange"
            loading={statsLoading}
          />
          <StatsCard
            title="Report runs"
            value={stats?.recent_report_runs ?? 0}
            subtitle="Last 7 days"
            icon={<Activity size={18} />}
            color="blue"
            loading={statsLoading}
            trend={{ value: 8, label: 'vs last week' }}
          />
          <StatsCard
            title="Active users"
            value={stats?.active_user_count ?? 0}
            subtitle="Logged in recently"
            icon={<Users size={18} />}
            color="green"
            loading={statsLoading}
          />
        </div>
      )}

      {/* Charts row — admin only */}
      {isAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2" padding="none">
            <div className="p-5 pb-0">
              <CardHeader
                title="Report executions"
                subtitle="Last 7 days"
              />
            </div>
            <div className="px-2 pb-5">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weeklyRunData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="runsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="errorsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    cursor={{ stroke: '#4b5563', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="runs"
                    name="Runs"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#runsGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="errors"
                    name="Errors"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#errorsGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card padding="none">
            <div className="p-5 pb-0">
              <CardHeader
                title="Storage breakdown"
                subtitle="By category (MB)"
              />
            </div>
            <div className="px-2 pb-5">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={storageData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar
                    dataKey="value"
                    name="MB"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* Activity feed — admin only */}
      {isAdmin && (
        <Card>
          <CardHeader
            title="Recent activity"
            subtitle="System-wide audit trail"
            actions={
              <span className="text-xs text-gray-500">Refreshes every 60s</span>
            }
          />
          <ActivityFeed items={activity} loading={activityLoading} />
        </Card>
      )}

      {/* Non-admin welcome */}
      {!isAdmin && (
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-900/40 border border-blue-800 flex items-center justify-center">
              <BarChart2 size={28} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Your workspace</h3>
              <p className="text-sm text-gray-400 mt-0.5">
                Navigate using the sidebar to view reports, manage plugins, or update your profile.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
