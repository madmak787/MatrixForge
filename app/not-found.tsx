import Link from 'next/link'
import { Brand } from '@/components/brand'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <Brand />
      <div>
        <p className="font-mono text-6xl font-semibold tracking-tight text-primary">404</p>
        <h1 className="mt-4 text-lg font-semibold">This table does not exist</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">The page you are looking for is not part of the schema.</p>
      </div>
      <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Open MatrixForge
      </Link>
    </main>
  )
}
