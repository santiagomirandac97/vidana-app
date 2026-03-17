
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@/firebase';
import { Logo } from '@/components/logo';
import { Loader2, ChevronDown, Leaf, Recycle, Monitor, BarChart3, Mail, Instagram } from 'lucide-react';

// ---------------------------------------------------------------------------
// Landing page — public marketing site for Vidana
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/selection');
    }
  }, [user, isLoading, router]);

  // Navbar scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // IntersectionObserver for fade-up animations
  useEffect(() => {
    if (isLoading || user) return;

    // Wait for paint so all [data-animate] elements are in the DOM
    const rafId = requestAnimationFrame(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('animate-in');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
      );

      document.querySelectorAll('[data-animate]').forEach((el) => {
        observer.observe(el);
      });

      // Store for cleanup
      observerCleanup.current = () => observer.disconnect();
    });

    return () => {
      cancelAnimationFrame(rafId);
      observerCleanup.current?.();
    };
  }, [isLoading, user]);
  const observerCleanup = useRef<(() => void) | null>(null);

  // Show loader while auth resolves
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-3 text-lg">Cargando...</p>
      </div>
    );
  }

  // If user is authenticated the redirect effect handles it — render nothing
  if (user) return null;

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ---------------------------------------------------------------- */}
      {/* Navbar                                                           */}
      {/* ---------------------------------------------------------------- */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo variant={scrolled ? 'dark' : 'white'} />
          </Link>
          <Link
            href="/login"
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              scrolled
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'border border-white text-white hover:bg-white/10'
            }`}
          >
            Iniciar Sesi&oacute;n
          </Link>
        </div>
      </nav>

      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        {/* Background image */}
        <Image
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80"
          alt="Corporate food service"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center text-white">
          <h1 className="animate-fade-in text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Alimentaci&oacute;n corporativa de punta a punta
          </h1>
          <p className="animate-fade-in-delay mt-6 text-lg text-white/80 sm:text-xl md:text-2xl">
            Comedores, cafeter&iacute;as y micro markets dise&ntilde;ados para el bienestar de tu equipo
          </p>
          <div className="animate-fade-in-delay-2 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-primary shadow-lg transition hover:bg-white/90"
            >
              Iniciar Sesi&oacute;n
            </Link>
            <a
              href="#servicios"
              className="rounded-full border border-white px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Conoce m&aacute;s
            </a>
          </div>
        </div>

        {/* Bouncing chevron */}
        <a
          href="#servicios"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/70 hover:text-white"
        >
          <ChevronDown className="h-8 w-8" />
        </a>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Services                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section id="servicios" className="bg-secondary py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 data-animate className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Nuestras Soluciones
          </h2>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div
                key={s.title}
                data-animate
                className="group overflow-hidden rounded-xl bg-white shadow-card transition-shadow hover:shadow-card-hover"
              >
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={s.image}
                    alt={s.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Pillars                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 data-animate className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            &iquest;Por qu&eacute; Vidana?
          </h2>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <div
                key={p.title}
                data-animate
                className="flex flex-col items-center text-center"
              >
                <div className="group flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors hover:bg-primary">
                  <p.icon className="h-7 w-7 text-primary transition-colors group-hover:text-white" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Testimonials                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-primary/5 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 data-animate className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Lo que dicen nuestros clientes
          </h2>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                data-animate
                className="rounded-xl bg-white p-8 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <p className="text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-6">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Footer                                                            */}
      {/* ---------------------------------------------------------------- */}
      <footer
        className="py-16 text-white"
        style={{
          background:
            'linear-gradient(135deg, hsl(224, 76%, 48%) 0%, hsl(230, 72%, 32%) 50%, hsl(235, 80%, 18%) 100%)',
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-6 text-center">
          <Logo variant="white" />

          <div className="flex flex-col items-center gap-4 text-sm text-white/70 sm:flex-row sm:gap-8">
            <a
              href="mailto:hola@vidana.com.mx"
              className="flex items-center gap-2 transition hover:text-white"
            >
              <Mail className="h-4 w-4" />
              hola@vidana.com.mx
            </a>
            <a
              href="https://instagram.com/vidana_mx"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 transition hover:text-white"
            >
              <Instagram className="h-4 w-4" />
              vidana_mx
            </a>
            <Link href="/login" className="transition hover:text-white">
              Iniciar Sesi&oacute;n
            </Link>
          </div>

          <p className="text-xs text-white/50">
            &copy; 2022&ndash;2026 Vidana. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const services = [
  {
    title: 'Comedores Corporativos',
    description:
      'Operamos comedores dentro de tu empresa con men\u00fas balanceados, ingredientes frescos y servicio profesional.',
    image:
      'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80',
  },
  {
    title: 'Cafeter\u00edas Vidana',
    description:
      'Espacios modernos con opciones variadas: desde comida caliente hasta snacks saludables y bebidas de especialidad.',
    image:
      'https://images.unsplash.com/photo-1559305616-3f99cd43e353?w=800&q=80',
  },
  {
    title: 'Vidana Market',
    description:
      'Micro markets inteligentes disponibles 24/7 para que tu equipo tenga acceso a alimentos de calidad en cualquier momento.',
    image:
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80',
  },
];

const pillars = [
  {
    title: 'Nutrici\u00f3n',
    icon: Leaf,
    description:
      'Men\u00fas dise\u00f1ados por expertos para promover equilibrio y energ\u00eda en tu equipo.',
  },
  {
    title: 'Sostenibilidad',
    icon: Recycle,
    description:
      'Procesos responsables desde la selecci\u00f3n de insumos hasta la operaci\u00f3n diaria.',
  },
  {
    title: 'Tecnolog\u00eda',
    icon: Monitor,
    description:
      'Vidana Hub: control total de la operaci\u00f3n con datos en tiempo real.',
  },
  {
    title: 'Optimizaci\u00f3n',
    icon: BarChart3,
    description:
      'Predicci\u00f3n de consumo para menos desperdicio y mayor satisfacci\u00f3n.',
  },
];

const testimonials = [
  {
    name: 'Aar\u00f3n',
    company: 'Maritimex',
    quote:
      'El tener un beneficio como Vidana es una gran ventaja competitiva para las empresas. Al ser men\u00fas nutritivos cuidas su salud y bienestar. 100% recomendado.',
  },
  {
    name: 'Velia',
    company: 'Foley & Lardner LLP',
    quote:
      'El servicio siempre es r\u00e1pido, son muy atentos y tienen la mejor disposici\u00f3n y actitud. Puedo seguir mi dieta sin ning\u00fan problema.',
  },
  {
    name: 'Camila',
    company: 'Morgan Philips',
    quote:
      'No puedo recomendar m\u00e1s el servicio de Vidana. Los colaboradores de cualquier empresa ser\u00edan muy felices de tener este servicio.',
  },
];
