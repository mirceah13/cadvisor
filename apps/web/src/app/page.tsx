import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">CADVisor</h1>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/signup">
              <Button>Sign Up</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Validate Building Submissions with AI
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              CADVisor helps construction companies validate building submission 
              packages against standards, legal norms, and internal guidelines using AI-powered 
              analysis and human-in-the-loop review.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg">Start Free Trial</Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline">Learn More</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="border-t bg-muted/50 py-12">
          <div className="container">
            <div className="mx-auto max-w-3xl rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 p-6">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                ⚠️ Important Disclaimer
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                BuildGuard Advisor provides decision-support suggestions and does not replace 
                certified engineering or legal review. This system is not a legal authority 
                or certified compliance body. Always consult with qualified professionals for 
                final approval.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container py-24">
          <h3 className="text-3xl font-bold text-center mb-12">Key Features</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="rounded-lg border p-6">
              <h4 className="font-semibold text-xl mb-2">🏗️ Multi-Tenant SaaS</h4>
              <p className="text-muted-foreground">
                Organizations, Projects, and Submissions with role-based access control
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <h4 className="font-semibold text-xl mb-2">📁 CAD & Document Analysis</h4>
              <p className="text-muted-foreground">
                Support for IFC, DXF, PDF, DOCX with intelligent extraction
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <h4 className="font-semibold text-xl mb-2">🤖 AI-Powered Validation</h4>
              <p className="text-muted-foreground">
                RAG + rules engine with local LLMs for compliance checking
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <h4 className="font-semibold text-xl mb-2">👥 Human-in-the-Loop</h4>
              <p className="text-muted-foreground">
                Review workflow with feedback learning for continuous improvement
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <h4 className="font-semibold text-xl mb-2">📊 Compliance Reports</h4>
              <p className="text-muted-foreground">
                PDF reports with citations, evidence, and detailed findings
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <h4 className="font-semibold text-xl mb-2">🔐 Enterprise Security</h4>
              <p className="text-muted-foreground">
                RBAC, audit logs, secure file handling, and data isolation
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; 2025 CADVisor. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
