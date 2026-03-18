import { Outlet } from 'react-router-dom'

export function FramelessLayout() {
  return (
    <div className="h-screen bg-background">
      <div className="h-full overflow-y-auto p-8">
        <Outlet />
      </div>
    </div>
  )
}
