import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Bell, CreditCard, LayoutDashboard, Plus, Trash2, Upload } from 'lucide-react';

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="border-b border-border pb-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {label && <p className="font-mono text-xs text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

// ─── Color swatch ───────────────────────────────────────────────────────────

function Swatch({ name, bg, text, value }: { name: string; bg: string; text?: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[100px]">
      <div className={`h-12 w-full rounded border border-border ${bg} ${text ?? ''}`} />
      <div>
        <p className="text-xs font-medium">{name}</p>
        <p className="font-mono text-[10px] text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DesignSystem() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="space-y-1">
            <Logo variant="wordmark" height={24} />
            <p className="font-mono text-xs text-muted-foreground">Design System · LIF-87</p>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">v1.0</Badge>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-8 py-12 space-y-16">

        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <Section title="Brand">
          <Row label="wordmark (light surface)">
            <div className="bg-background border border-border rounded p-4">
              <Logo variant="wordmark" height={32} />
            </div>
          </Row>
          <Row label="wordmark-inverse (dark surface)">
            <div className="bg-foreground rounded p-4">
              <Logo variant="wordmark-inverse" height={32} />
            </div>
          </Row>
          <Row label="mark / favicon">
            <div className="flex gap-4">
              {([16, 24, 32, 48] as const).map(size => (
                <div key={size} className="flex flex-col items-center gap-1.5">
                  <Logo variant="mark" height={size} />
                  <span className="font-mono text-[10px] text-muted-foreground">{size}px</span>
                </div>
              ))}
            </div>
          </Row>
        </Section>

        {/* ── Colors ────────────────────────────────────────────────────── */}
        <Section title="Colors">
          <div className="space-y-6">
            <div>
              <p className="font-mono text-xs text-muted-foreground mb-3">Base palette</p>
              <div className="flex flex-wrap gap-4">
                <Swatch name="Snow" bg="bg-background" value="hsl(60 17% 98%)" />
                <Swatch name="Black" bg="bg-foreground" value="hsl(0 0% 9%)" />
                <Swatch name="Sand" bg="bg-secondary" value="hsl(35 26% 91%)" />
                <Swatch name="Ash" bg="bg-border" value="hsl(36 9% 78%)" />
                <Swatch name="Brand Orange" bg="bg-brand-orange" value="hsl(16 100% 45%)" />
              </div>
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground mb-3">Semantic tokens</p>
              <div className="flex flex-wrap gap-4">
                <Swatch name="primary" bg="bg-primary" value="--primary" />
                <Swatch name="secondary" bg="bg-secondary" value="--secondary" />
                <Swatch name="muted" bg="bg-muted" value="--muted" />
                <Swatch name="accent" bg="bg-accent" value="--accent" />
                <Swatch name="destructive" bg="bg-destructive" value="--destructive" />
                <Swatch name="success" bg="bg-success" value="--success" />
                <Swatch name="warning" bg="bg-warning" value="--warning" />
                <Swatch name="card" bg="bg-card border border-border" value="--card" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Typography ────────────────────────────────────────────────── */}
        <Section title="Typography">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">Sans — Archivo</p>
              <div className="space-y-1">
                {[
                  ['text-4xl font-bold', '4xl / bold'],
                  ['text-3xl font-semibold', '3xl / semibold'],
                  ['text-2xl font-medium', '2xl / medium'],
                  ['text-xl', 'xl / regular'],
                  ['text-lg', 'lg / regular'],
                  ['text-base', 'base / regular'],
                  ['text-sm', 'sm / regular'],
                  ['text-xs', 'xs / regular'],
                ].map(([cls, label]) => (
                  <div key={cls} className="flex items-baseline gap-4">
                    <span className={cls}>The quick brown fox</span>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">Mono — Space Mono</p>
              <div className="space-y-1">
                {[
                  ['font-mono text-base font-bold', 'base / bold'],
                  ['font-mono text-base', 'base / regular'],
                  ['font-mono text-sm', 'sm / regular'],
                  ['font-mono text-xs', 'xs / regular'],
                  ['font-mono text-[10px]', '10px / regular'],
                ].map(([cls, label]) => (
                  <div key={label} className="flex items-baseline gap-4">
                    <span className={cls}>$19.99 / month</span>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">Font weights — Archivo</p>
              <div className="flex flex-wrap gap-6">
                {[100, 200, 300, 400, 500, 600, 700, 800, 900].map(w => (
                  <div key={w} className="flex flex-col gap-0.5">
                    <span style={{ fontWeight: w }} className="text-sm">Aa</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Buttons ───────────────────────────────────────────────────── */}
        <Section title="Buttons">
          <Row label="variants">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row label="sizes">
            <Button size="lg">Large</Button>
            <Button size="default">Default</Button>
            <Button size="sm">Small</Button>
            <Button size="icon" variant="outline"><Plus className="h-4 w-4" /></Button>
            <Button size="icon"><Bell className="h-4 w-4" /></Button>
            <Button size="icon" variant="destructive"><Trash2 className="h-4 w-4" /></Button>
          </Row>
          <Row label="with icon">
            <Button><Plus className="h-4 w-4" />Add subscription</Button>
            <Button variant="outline"><Upload className="h-4 w-4" />Upload receipt</Button>
            <Button variant="secondary"><CreditCard className="h-4 w-4" />Payment</Button>
          </Row>
          <Row label="disabled">
            <Button disabled>Default</Button>
            <Button variant="secondary" disabled>Secondary</Button>
            <Button variant="outline" disabled>Outline</Button>
          </Row>
        </Section>

        {/* ── Badges ────────────────────────────────────────────────────── */}
        <Section title="Badges">
          <Row label="variants">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </Row>
          <Row label="examples">
            <Badge variant="secondary" className="font-mono">Netflix</Badge>
            <Badge variant="outline" className="font-mono">due in 3 days</Badge>
            <Badge className="bg-success text-white border-0">Active</Badge>
            <Badge className="bg-warning text-white border-0">Expiring</Badge>
            <Badge variant="destructive">Overdue</Badge>
          </Row>
        </Section>

        {/* ── Cards ─────────────────────────────────────────────────────── */}
        <Section title="Cards">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Monthly spend</CardTitle>
                <CardDescription>All active subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-3xl font-bold text-brand-orange">$84.97</p>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">Renewed across 6 services</p>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Annual spend</CardTitle>
                <CardDescription>Projected for the year</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-3xl font-bold">$1,019.64</p>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">+3.2% YoY</Badge>
              </CardFooter>
            </Card>
          </div>
        </Section>

        {/* ── Form elements ─────────────────────────────────────────────── */}
        <Section title="Form Elements">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="ds-input">Text input</Label>
              <Input id="ds-input" placeholder="e.g. Netflix" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-input-disabled">Disabled</Label>
              <Input id="ds-input-disabled" placeholder="Read-only" disabled />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ds-textarea">Textarea</Label>
              <Textarea id="ds-textarea" placeholder="Add notes about this subscription…" />
            </div>
          </div>
        </Section>

        {/* ── Dialog ────────────────────────────────────────────────────── */}
        <Section title="Dialog">
          <Row>
            <Button variant="outline" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" />Open dialog</Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add subscription</DialogTitle>
                  <DialogDescription>
                    Track a new recurring service. Fill in the details below.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="ds-dialog-name">Service name</Label>
                    <Input id="ds-dialog-name" placeholder="e.g. Spotify" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ds-dialog-amount">Amount</Label>
                    <Input id="ds-dialog-amount" placeholder="9.99" type="number" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => setDialogOpen(false)}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Row>
        </Section>

        {/* ── Custom utilities ──────────────────────────────────────────── */}
        <Section title="Custom Utilities">
          <div className="space-y-6 max-w-sm">
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">.border-perf — dashed perforation border</p>
              <div className="border-perf p-4 font-mono text-xs">Receipt row separator</div>
            </div>
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">.leader-dots — dotted leader line</p>
              <div className="flex items-end gap-1 font-mono text-sm">
                <span>Netflix</span>
                <span className="leader-dots flex-1 mb-[3px]" />
                <span>$15.99</span>
              </div>
              <div className="flex items-end gap-1 font-mono text-sm">
                <span>Spotify</span>
                <span className="leader-dots flex-1 mb-[3px]" />
                <span>$9.99</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">Border radius tokens</p>
              <div className="flex gap-4 items-center">
                <div className="h-10 w-10 bg-secondary border border-border rounded-sm flex items-center justify-center">
                  <span className="font-mono text-[10px] text-muted-foreground">sm</span>
                </div>
                <div className="h-10 w-10 bg-secondary border border-border rounded-md flex items-center justify-center">
                  <span className="font-mono text-[10px] text-muted-foreground">md</span>
                </div>
                <div className="h-10 w-10 bg-secondary border border-border rounded-lg flex items-center justify-center">
                  <span className="font-mono text-[10px] text-muted-foreground">lg</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Icons ─────────────────────────────────────────────────────── */}
        <Section title="Icons (Lucide)">
          <Row label="examples from the app">
            {[
              { icon: LayoutDashboard, name: 'LayoutDashboard' },
              { icon: CreditCard, name: 'CreditCard' },
              { icon: Bell, name: 'Bell' },
              { icon: Plus, name: 'Plus' },
              { icon: Trash2, name: 'Trash2' },
              { icon: Upload, name: 'Upload' },
            ].map(({ icon: Icon, name }) => (
              <div key={name} className="flex flex-col items-center gap-1.5">
                <div className="h-10 w-10 flex items-center justify-center border border-border rounded bg-card">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{name}</span>
              </div>
            ))}
          </Row>
          <Row label="sizes">
            {([
              ['h-3 w-3', 12],
              ['h-4 w-4', 16],
              ['h-5 w-5', 20],
              ['h-6 w-6', 24],
              ['h-8 w-8', 32],
            ] as const).map(([cls, px]) => (
              <div key={px} className="flex flex-col items-center gap-1.5">
                <Bell className={cls} />
                <span className="font-mono text-[10px] text-muted-foreground">{px}px</span>
              </div>
            ))}
          </Row>
        </Section>

        {/* Footer */}
        <div className="border-t border-border pt-6 text-center">
          <p className="font-mono text-xs text-muted-foreground">
            Paypr design system · branch <span className="text-foreground">feature/design-system-page</span>
          </p>
        </div>

      </div>
    </div>
  );
}
