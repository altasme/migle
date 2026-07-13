import { NavLink } from 'react-router-dom'
import { HomeIcon, RoomsIcon, ChatIcon, FriendsIcon, ProfileIcon } from './icons'
import { useNotificationStore } from '../store/notificationStore'

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/rooms', label: 'Rooms', Icon: RoomsIcon, end: false },
  { to: '/chat', label: 'Chat', Icon: ChatIcon, end: false },
  { to: '/discover', label: 'Discover', Icon: FriendsIcon, end: false },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon, end: false },
]

export function BottomNav() {
  const hasUnreadDm = useNotificationStore((s) => s.hasUnreadDm)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-md justify-between px-2 py-2">
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs ${
                isActive ? 'text-purple-400' : 'text-zinc-500'
              }`
            }
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {to === '/chat' && hasUnreadDm && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
