import { NavLink } from 'react-router-dom'
import { HomeIcon, ChatIcon, ProfileIcon } from './icons'
import { useNotificationStore } from '../store/notificationStore'

// Rooms and Discover are pulled from nav per the regional-match relaunch
// spec (public rooms / discovery grid / DM-to-strangers are "NOT in
// launch"). Routes and pages are left intact — only the entry points are
// gone — since the plan is to bring rooms back later as friends-only.
const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/chat', label: 'Chat', Icon: ChatIcon, end: false },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon, end: false },
]

export function BottomNav() {
  const totalUnread = useNotificationStore((s) =>
    Object.values(s.unreadCounts).reduce((sum, n) => sum + n, 0),
  )

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-800/80 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md justify-between px-2 py-2">
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-xs transition-colors active:scale-95 ${
                isActive ? 'text-purple-400' : 'text-zinc-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200 ${
                    isActive ? 'scale-105 bg-purple-600/15' : 'scale-100'
                  }`}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {to === '/chat' && totalUnread > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                        {totalUnread > 9 ? '9+' : totalUnread}
                      </span>
                    )}
                  </span>
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
