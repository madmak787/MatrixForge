import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded border border-primary bg-primary/20 cyber-border">
        <span className="glow-text text-3xl font-bold text-primary">◈</span>
      </span>
      <div>
        <p className="glow-text text-6xl font-bold text-primary">404</p>
        <h1 className="mt-3 text-lg font-semibold">This table does not exist</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you are looking for is not in the schema.</p>
      </div>
      <Link href="/" className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary hover:bg-primary/20">
        Back to MatrixForge
      </Link>
    </main>
  )
}
