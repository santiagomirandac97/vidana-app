# Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace root redirector with a full marketing landing page at `/` with sticky navbar, hero, services, pillars, testimonials, and footer.

**Architecture:** Single `src/app/page.tsx` client component. Uses `useUser()` for auth-redirect. Intersection Observer for scroll animations. Scroll listener for navbar transparency transition. White logo variant needed for dark backgrounds.

**Tech Stack:** Next.js 15, Tailwind CSS, Lucide icons, Unsplash images, existing Logo component (extended with `variant` prop)

---

### Task 1: Add white logo variant

**Files:**
- Modify: `src/components/logo.tsx`

**Step 1: Update Logo component to accept a variant prop**

```tsx
import Image from 'next/image';

interface LogoProps {
  variant?: 'dark' | 'white';
  className?: string;
}

export function Logo({ variant = 'dark', className }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Image
        src={variant === 'white' ? '/logos/Logo N+.png' : '/logos/logo.png'}
        alt="Vidana"
        width={120}
        height={40}
        className="object-contain"
        priority
      />
    </div>
  );
}
```

Note: `Logo N+.png` appears to be a white/light variant already in `/public/logos/`. Verify by opening in browser. If it's not white, we'll need to create one or use CSS `brightness(0) invert(1)` filter.

**Step 2: Verify login page still works (Logo with no props = dark default)**

Run: `npx next build`
Expected: No errors

**Step 3: Commit**

```
feat: add variant prop to Logo component for white/dark modes
```

---

### Task 2: Add middleware exception for root path

**Files:**
- Modify: `src/app/middleware.ts` (middleware.ts at project root)

**Step 1: Verify `/` is already public**

Check `middleware.ts` — the current PUBLIC_PATH_PREFIXES are `/login`, `/signup`, `/reset-password`, `/survey`. The root `/` path matches everything so it should pass through. But we need to confirm that the middleware doesn't redirect `/` to `/login` for unauthenticated users.

Looking at the middleware: it checks `pathname.startsWith(prefix)` for public paths. Since `/login`.startsWith('/') is false but '/'.startsWith('/login') is also false, the root path `/` is NOT in the public list and WILL be redirected to `/login`.

**Add `/` to public paths:**

In `middleware.ts`, add `'/'` to the PUBLIC_PATH_PREFIXES array:

```typescript
const PUBLIC_PATH_PREFIXES = ['/login', '/signup', '/reset-password', '/survey'];
```

Change to exact-match logic for `/`:

```typescript
const isPublicPath = PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix)) || pathname === '/';
```

**Step 2: Commit**

```
fix: allow root path through middleware for landing page
```

---

### Task 3: Build the landing page

**Files:**
- Replace: `src/app/page.tsx`

**Step 1: Write the complete landing page**

This is the main implementation. The page has these parts:

1. **Auth redirect logic** — `useUser()` check, redirect to `/selection` if authenticated
2. **Scroll state** — `useState` for `scrolled` boolean, `useEffect` with scroll listener
3. **Animation hook** — `useEffect` with IntersectionObserver for fade-in elements
4. **Navbar** — fixed, transparent→white on scroll, logo variant swap, login pill button
5. **Hero** — full-screen, Unsplash bg image, overlay, headline, subtitle, 2 CTAs
6. **Services** — 3 cards with images
7. **Pillars** — 2x2 grid with icons
8. **Testimonials** — 3 quote cards
9. **Footer** — deep blue, logo, links, copyright

Unsplash image URLs to use:
- Hero: `https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80` (beautiful food plating)
- Comedores: `https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80` (corporate cafeteria)
- Cafeterías: `https://images.unsplash.com/photo-1559305616-3f99cd43e353?w=800&q=80` (modern cafe)
- Vidana Market: `https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80` (grab and go)

Full component code (~350 lines):

```tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Loader2, Leaf, Recycle, Monitor, BarChart3, ChevronDown, Mail, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SERVICES = [
  {
    title: 'Comedores Corporativos',
    description: 'Operación integral de comedores con menús diseñados según la cultura y necesidades de cada empresa.',
    image: 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80',
  },
  {
    title: 'Cafeterías Vidana',
    description: 'Una cafetería premium dentro de tu empresa, pensada para inspirar y consentir a tu equipo.',
    image: 'https://images.unsplash.com/photo-1559305616-3f99cd43e353?w=800&q=80',
  },
  {
    title: 'Vidana Market',
    description: 'Tiendas de autoservicio con snacks y bebidas disponibles todo el día. Flexibles, ágiles y prácticas.',
    image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80',
  },
];

const PILLARS = [
  {
    icon: Leaf,
    title: 'Nutrición',
    description: 'Menús diseñados por expertos para promover equilibrio y energía en tu equipo.',
  },
  {
    icon: Recycle,
    title: 'Sostenibilidad',
    description: 'Procesos responsables desde la selección de insumos hasta la operación diaria.',
  },
  {
    icon: Monitor,
    title: 'Tecnología',
    description: 'Vidana Hub: control total de la operación con datos en tiempo real.',
  },
  {
    icon: BarChart3,
    title: 'Optimización',
    description: 'Predicción de consumo para menos desperdicio y mayor satisfacción.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'El tener un beneficio como Vidana es una gran ventaja competitiva para las empresas. Al ser menús nutritivos cuidas su salud y bienestar. 100% recomendado.',
    author: 'Aarón',
    company: 'Maritimex',
  },
  {
    quote: 'El servicio siempre es rápido, son muy atentos y tienen la mejor disposición y actitud. Puedo seguir mi dieta sin ningún problema.',
    author: 'Velia',
    company: 'Foley & Lardner LLP',
  },
  {
    quote: 'No puedo recomendar más el servicio de Vidana. Los colaboradores de cualquier empresa serían muy felices de tener este servicio.',
    author: 'Camila',
    company: 'Morgan Philips',
  },
];

export default function LandingPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const animatedRef = useRef<Set<Element>>(new Set());

  // Auth redirect
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/selection');
    }
  }, [user, isLoading, router]);

  // Navbar scroll transition
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animatedRef.current.has(entry.target)) {
            animatedRef.current.add(entry.target);
            entry.target.classList.add('animate-in');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    document.querySelectorAll('[data-animate]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (user) return null; // redirecting

  const scrollToServices = () => {
    document.getElementById('servicios')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen">
      {/* ── Navbar ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md' : 'bg-transparent'
      }`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Logo variant={scrolled ? 'dark' : 'white'} />
          <Link href="/login">
            <Button
              variant={scrolled ? 'default' : 'outline'}
              className={`rounded-full px-6 ${
                scrolled
                  ? ''
                  : 'border-white text-white hover:bg-white hover:text-primary bg-transparent'
              }`}
            >
              Iniciar Sesión
            </Button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80"
          alt="Alimentación corporativa"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl animate-fade-in">
            Alimentación corporativa
            <br />
            <span className="text-white/90">de punta a punta</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl animate-fade-in-delay">
            Comedores, cafeterías y micro markets diseñados para el bienestar de tu equipo
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-fade-in-delay-2">
            <Link href="/login">
              <Button size="lg" className="rounded-full bg-white text-primary hover:bg-white/90 px-8 text-base font-semibold">
                Iniciar Sesión
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-white text-white hover:bg-white/10 px-8 text-base bg-transparent"
              onClick={scrollToServices}
            >
              Conoce más
            </Button>
          </div>
        </div>
        {/* Scroll indicator */}
        <button
          onClick={scrollToServices}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 hover:text-white transition-colors animate-bounce"
        >
          <ChevronDown className="h-8 w-8" />
        </button>
      </section>

      {/* ── Services ── */}
      <section id="servicios" className="bg-secondary py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center" data-animate>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Nuestras Soluciones</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Un modelo flexible para cada tipo de empresa
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service, i) => (
              <div
                key={service.title}
                className="group overflow-hidden rounded-xl bg-white shadow-card hover:shadow-card-hover transition-shadow"
                data-animate
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={service.image}
                    alt={service.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold">{service.title}</h3>
                  <p className="mt-2 text-muted-foreground">{service.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pillars ── */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center" data-animate>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">¿Por qué Vidana?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Nutrición, sostenibilidad, tecnología y optimización en cada servicio
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar, i) => (
              <div
                key={pillar.title}
                className="group text-center rounded-xl p-6 transition-transform hover:scale-105"
                data-animate
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <pillar.icon className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{pillar.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-primary/5 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center" data-animate>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Lo que dicen nuestros clientes</h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.author}
                className="rounded-xl bg-white p-8 shadow-card"
                data-animate
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <p className="text-muted-foreground italic leading-relaxed">"{t.quote}"</p>
                <div className="mt-6">
                  <p className="font-semibold">{t.author}</p>
                  <p className="text-sm text-muted-foreground">{t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative overflow-hidden py-16" style={{
        background: 'linear-gradient(135deg, hsl(224, 76%, 48%) 0%, hsl(230, 72%, 32%) 50%, hsl(235, 80%, 18%) 100%)',
      }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center gap-8 text-center">
            <Logo variant="white" />
            <div className="flex items-center gap-6 text-white/70">
              <a href="mailto:hola@vidana.com.mx" className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail className="h-4 w-4" />
                hola@vidana.com.mx
              </a>
              <a href="https://instagram.com/vidana_mx" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                <Instagram className="h-4 w-4" />
                vidana_mx
              </a>
            </div>
            <Link href="/login" className="text-white/70 hover:text-white transition-colors text-sm">
              Iniciar Sesión
            </Link>
            <p className="text-sm text-white/40">
              © 2022–2026 Vidana. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

**Step 2: Add animation CSS to globals.css**

Append to `src/app/globals.css`:

```css
/* Landing page animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.8s ease-out forwards;
}

.animate-fade-in-delay {
  animation: fadeIn 0.8s ease-out 0.2s forwards;
  opacity: 0;
}

.animate-fade-in-delay-2 {
  animation: fadeIn 0.8s ease-out 0.4s forwards;
  opacity: 0;
}

/* Scroll-triggered animations */
[data-animate] {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

[data-animate].animate-in {
  opacity: 1;
  transform: translateY(0);
}
```

**Step 3: Build and verify**

Run: `npx next build`
Expected: No errors

**Step 4: Commit**

```
feat: add landing page with hero, services, pillars, testimonials, footer
```

---

### Task 4: Update middleware for root path

**Files:**
- Modify: `middleware.ts` (project root)

**Step 1: Add root path as public**

Find the line with `PUBLIC_PATH_PREFIXES` or the public path check logic. Add exact match for `/`:

After the `startsWith` check, add:
```typescript
|| pathname === '/'
```

**Step 2: Build and verify**

Run: `npx next build`
Expected: No errors

**Step 3: Commit**

```
fix: allow root path through auth middleware for landing page
```

---

### Task 5: Visual verification

**Step 1: Start dev server and take screenshots**

Run dev server, navigate to `/`, verify:
- Navbar is transparent with white logo over hero
- Scrolling transitions navbar to white with dark logo
- Hero image loads, headline and CTAs visible
- Services cards render with images
- Pillars grid with icons
- Testimonials section
- Footer with gradient, logo, links
- "Iniciar Sesión" buttons link to `/login`
- "Conoce más" smooth-scrolls to services
- Mobile responsiveness (cards stack)

**Step 2: Verify auth redirect works**

Log in, navigate to `/`, verify redirect to `/selection`.

**Step 3: Final commit if any fixes needed**

---

### Task 6: Push

```bash
git push
```
