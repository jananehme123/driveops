import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LayoutDashboard, Car, Building2, Calendar, Users, Truck, FileText, Search, LogOut, Zap } from 'lucide-react'

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/operations', label: 'Operations', Icon: Car, highlight: true },
  { to: '/clients',    label: 'Clients',    Icon: Building2 },
  { to: '/events',     label: 'Events',     Icon: Calendar },
  { to: '/delegates',  label: 'Delegates',  Icon: Users },
  { to: '/vehicles',   label: 'Vehicles',   Icon: Truck },
  { to: '/reports',    label: 'Reports',    Icon: FileText },
  { to: '/audit-logs', label: 'Audit Logs', Icon: Search },
]

export default function Layout({ session }) {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 220, minWidth: 220,
        background: '#0a1628',
        borderRight: '1px solid #1e293b',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={20} color="#3b82f6" />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6' }}>DriveOps</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Event Operations Platform</div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {navItems.map(({ to, label, Icon, highlight }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                textDecoration: 'none', fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#f1f5f9' : '#64748b',
                background: isActive ? (highlight ? '#1d4ed8' : '#1e293b') : 'transparent',
                transition: 'all 0.15s',
              })}
            >
              <Icon size={16} />
              {label}
              {highlight && (
                <span style={{
                  marginLeft: 'auto', background: '#ef4444', color: 'white',
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999,
                }}>LIVE</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + Sign out */}
        <div style={{ padding: '12px 12px 16px', borderTop: '1px solid #1e293b' }}>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 8, padding: '0 4px' }}>
            {session?.user?.email}
          </div>
          <button onClick={handleSignOut} className="btn btn-ghost"
            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px', background: '#0f172a' }}>
        <Outlet />
      </main>
    </div>
  )
}
