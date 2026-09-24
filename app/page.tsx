import { DiagramEditor } from '@/components/diagram-editor'

export default function Home() {
  return (
    <main className="h-dvh w-screen overflow-hidden">
      <h1 className="sr-only">MatrixForge database schema designer</h1>
      <DiagramEditor />
    </main>
  )
}
