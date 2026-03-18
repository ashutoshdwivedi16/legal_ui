export function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to the Admin Framework.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Core Framework</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Core components and layout system ready
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Module System</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Module structure prepared for service-specific features
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Shared Utilities</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Shared hooks, utils, and components available
          </p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
