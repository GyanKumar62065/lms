import Link from 'next/link';
import {
  ShieldCheck,
  Zap,
  BadgeIndianRupee,
  Clock,
  FileCheck,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { EstimateWidget } from '@/components/marketing/estimate-widget';
import { ApplyCTA } from '@/components/marketing/apply-cta';
import { ProductCarousel } from '@/components/marketing/product-carousel';
import { LandingView } from '@/components/analytics/landing-view';
import { getSession } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { formatRupees } from '@/lib/money';
import type { PublicConfig, LoanProduct } from '@/types/api';

const DEFAULT_CONFIG: PublicConfig = {
  loan: {
    minPrincipal: 50000,
    maxPrincipal: 500000,
    interestRate: 12,
    minTenureDays: 30,
    maxTenureDays: 365,
  },
  eligibility: {
    minAge: 23,
    maxAge: 50,
    minMonthlySalary: 25000,
    employmentModes: ['Salaried', 'Self-employed'],
  },
};

const HOW_STEPS = [
  {
    icon: FileCheck,
    title: 'Apply online',
    desc: 'Fill a 3-minute form — no branch visit needed.',
  },
  {
    icon: ShieldCheck,
    title: 'Instant verification',
    desc: 'Automated KYC + salary check in seconds.',
  },
  {
    icon: BadgeIndianRupee,
    title: 'Get sanctioned',
    desc: 'Approval decision within the same business day.',
  },
  {
    icon: Zap,
    title: 'Money in your account',
    desc: 'Disbursal straight to your bank — no middlemen.',
  },
];

const FEATURES = [
  { icon: Zap, title: 'Instant disbursal', desc: 'Funds credited within hours of sanction.' },
  { icon: ShieldCheck, title: 'Fully secure', desc: 'Bank-grade encryption, RBI-compliant processes.' },
  { icon: BadgeIndianRupee, title: 'Transparent pricing', desc: 'No hidden fees. Know your total cost upfront.' },
  { icon: Clock, title: 'Flexible tenure', desc: 'Choose any repayment window that fits your budget.' },
];

const FAQS = [
  {
    q: 'What documents do I need?',
    a: 'Just a valid PAN card, Aadhaar, and your latest 3 months salary slips.',
  },
  {
    q: 'How fast is the disbursal?',
    a: 'Once sanctioned, funds hit your account within a few hours — same business day in most cases.',
  },
  {
    q: 'Is there a prepayment penalty?',
    a: 'No. You can repay early at any time without any extra charge.',
  },
  {
    q: 'What is the interest rate?',
    a: 'Our rate is competitive and shown transparently on the loan estimate. The exact rate depends on your profile.',
  },
];

export default async function LandingPage() {
  const me = await getSession();

  let config: PublicConfig;
  try {
    config = await endpoints.publicConfig({ serverBase: process.env.API_URL_INTERNAL });
  } catch {
    config = DEFAULT_CONFIG;
  }

  let products: LoanProduct[] = [];
  try { products = (await endpoints.publicProducts({ serverBase: process.env.API_URL_INTERNAL })).data; } catch { /* fallback to config */ }

  const { eligibility } = config;
  const eligibilityItems = [
    `Age ${eligibility.minAge}–${eligibility.maxAge} years`,
    `Monthly income ≥ ${formatRupees(eligibility.minMonthlySalary * 100)}`,
    ...eligibility.employmentModes.map((m) => m),
    'Valid PAN card',
  ];

  return (
    <>
      <LandingView />

      {/* Hero */}
      <section className="bg-primary/5 py-20 px-4">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Personal loans,{' '}
            <span className="text-primary">at the speed of now</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Apply in minutes, get sanctioned today. No paperwork queues, no branch visits — just
            money when you need it.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <ApplyCTA me={me} label="Apply now" />
            <Link
              href="#loans"
              className={buttonVariants({ variant: 'outline' })}
            >
              See loan details <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 pt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> RBI-compliant
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-primary" /> Same-day disbursal
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeIndianRupee className="h-4 w-4 text-primary" /> No hidden fees
            </span>
          </div>
        </div>
      </section>

      {/* Active products carousel */}
      {products.length > 0 && (
        <section className="py-10 px-4">
          <div className="mx-auto max-w-4xl">
            <ProductCarousel products={products} />
          </div>
        </section>
      )}

      {/* Loan at a glance */}
      <section id="loans" className="py-16 px-4">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Loan at a glance</h2>
            <p className="text-muted-foreground">
              Drag the sliders to estimate your repayment before you apply.
            </p>
          </div>
          <EstimateWidget config={config} products={products} />
        </div>
      </section>

      {/* Eligibility */}
      <section className="bg-muted/40 py-16 px-4">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Who can apply?</h2>
            <p className="text-muted-foreground">
              Simple eligibility — if you tick these boxes, you're good to go.
            </p>
          </div>
          <Card>
            <CardContent className="p-6">
              <ul className="space-y-3">
                {eligibilityItems.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <ApplyCTA me={me} label="Check my eligibility" variant="outline" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 px-4">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
            <p className="text-muted-foreground">Four steps from application to disbursal.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map((step, i) => (
              <Card key={step.title} className="relative">
                <CardHeader className="pb-2">
                  <span className="text-xs font-semibold text-muted-foreground mb-1">
                    Step {i + 1}
                  </span>
                  <step.icon className="h-7 w-7 text-primary mb-1" />
                  <CardTitle className="text-base">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/40 py-16 px-4">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Why choose us?</h2>
            <p className="text-muted-foreground">Built around your convenience, not ours.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardHeader className="pb-2">
                  <f.icon className="h-6 w-6 text-primary mb-1" />
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 px-4">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Frequently asked questions</h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <Card key={faq.q}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-semibold">{faq.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center pt-4">
            <ApplyCTA me={me} label="Apply now — it's free" />
          </div>
        </div>
      </section>
    </>
  );
}
