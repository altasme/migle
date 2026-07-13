import { NavLink } from 'react-router-dom'
import { HomeIcon, RoomsIcon, ChatIcon, FriendsIcon, ProfileIcon } from './icons'

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/rooms', label: 'Rooms', Icon: RoomsIcon, end: false },
  { to: '/chat', label: 'Chat', Icon: ChatIcon, end: false },
  { to: '/discover', label: 'Discover', Icon: FriendsIcon, end: false },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon, end: false },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-md justify-between px-2 py-2">
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs ${
                isActive ? 'text-purple-400' : 'text-zinc-500'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
