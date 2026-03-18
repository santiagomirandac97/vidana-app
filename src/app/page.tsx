
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@/firebase';
import { Logo } from '@/components/logo';
import { Loader2, ChevronDown, Leaf, Recycle, Monitor, BarChart3, Mail, Instagram } from 'lucide-react';

// ---------------------------------------------------------------------------
// Landing page — public marketing site for Vidana
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Stats counter hook — counts from 0 to target over ~2s with easeOut
// ---------------------------------------------------------------------------
function useCountUp(target: number, duration = 2000) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const start = useCallback(() => setStarted(true), []);

  useEffect(() => {
    if (!started) return;

    // Check for reduced motion preference
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setValue(target);
      return;
    }

    let startTime: number | null = null;
    let rafId: number;

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOut(progress);
      setValue(Math.floor(easedProgress * target));

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setValue(target);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [started, target, duration]);

  return { value, ref, start };
}

function formatNumber(n: number): string {
  return n.toLocaleString('es-MX');
}

// ---------------------------------------------------------------------------
// 3D Tilt handler for service cards
// ---------------------------------------------------------------------------
function useCardTilt() {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = ref.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * 5;
    const rotateX = ((centerY - y) / centerY) * 5;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = ref.current;
    if (!card) return;
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
  }, []);

  return { ref, handleMouseMove, handleMouseLeave };
}

// ---------------------------------------------------------------------------
// Wave SVG separator component
// ---------------------------------------------------------------------------
function WaveSeparator({ fromColor, toColor, flip }: { fromColor: string; toColor: string; flip?: boolean }) {
  return (
    <div className="relative w-full overflow-hidden leading-[0]" style={{ backgroundColor: fromColor }}>
      <svg
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height: '80px', transform: flip ? 'scaleY(-1)' : undefined }}
      >
        <path
          d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,20 1440,40 L1440,80 L0,80 Z"
          fill={toColor}
        />
      </svg>
    </div>
  );
}

export default function LandingPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  // Stats counter hooks
  const stat1 = useCountUp(2000000);
  const stat2 = useCountUp(10000);
  const stat3 = useCountUp(20);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsTriggered = useRef(false);

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

  // IntersectionObserver for fade-up animations + stats counter trigger
  useEffect(() => {
    if (isLoading || user) return;

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

      document.querySelectorAll('[data-animate], [data-animate-left], [data-animate-right]').forEach((el) => {
        observer.observe(el);
      });

      // Stats counter observer
      const statsObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !statsTriggered.current) {
              statsTriggered.current = true;
              stat1.start();
              stat2.start();
              stat3.start();
              statsObserver.disconnect();
            }
          });
        },
        { threshold: 0.3 },
      );

      if (statsRef.current) {
        statsObserver.observe(statsRef.current);
      }

      observerCleanup.current = () => {
        observer.disconnect();
        statsObserver.disconnect();
      };
    });

    return () => {
      cancelAnimationFrame(rafId);
      observerCleanup.current?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Duplicate testimonials for seamless carousel loop
  const carouselTestimonials = [...testimonials, ...testimonials];

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ---------------------------------------------------------------- */}
      {/* Navbar                                                           */}
      {/* ---------------------------------------------------------------- */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/80 backdrop-blur-lg border-b border-black/5 shadow-sm'
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
      {/* Hero — Food Photography                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        {/* Food photography background */}
        <Image
          src="/logos/hero-chef.jpg"
          alt="Chef Vidana cocinando en cocina profesional"
          fill
          className="object-cover"
          priority
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center text-white">
          <h1
            className="animate-fade-in text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
          >
            Alimentaci&oacute;n corporativa de punta a punta
          </h1>
          <p className="animate-fade-in-delay mt-6 text-lg text-white/80 sm:text-xl md:text-2xl" style={{ textShadow: '0 1px 10px rgba(0,0,0,0.4)' }}>
            Comedores, cafeter&iacute;as y micro markets dise&ntilde;ados para el bienestar de tu equipo
          </p>
          <div className="animate-fade-in-delay-2 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-primary shadow-lg transition hover:bg-white/90"
              style={{ boxShadow: '0 0 30px rgba(255,255,255,0.15)' }}
            >
              Iniciar Sesi&oacute;n
            </Link>
            <a
              href="#servicios"
              className="rounded-full px-8 py-3 text-sm font-semibold text-white transition backdrop-blur-md bg-white/10 border border-white/20 hover:bg-white/20"
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
      {/* Stats Counter Section                                            */}
      {/* ---------------------------------------------------------------- */}
      <section
        ref={statsRef}
        className="border-t border-border bg-white py-20"
      >
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-10 sm:grid-cols-3">
            {statsData.map((stat, i) => {
              const counter = [stat1, stat2, stat3][i];
              return (
                <div key={stat.label} className="flex flex-col items-center text-center">
                  <span className="font-mono text-4xl font-bold text-primary sm:text-5xl">
                    {formatNumber(counter.value)}+
                  </span>
                  <span className="mt-2 text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Services                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section id="servicios" className="bg-secondary py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 data-animate className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Nuestras Soluciones
          </h2>
          <div className="mt-14 grid gap-8 sm:grid-cols-2">
            {services.map((s, i) => (
              <ServiceCard key={s.title} service={s} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Wave: secondary → white */}
      <WaveSeparator fromColor="hsl(220, 14%, 96%)" toColor="#ffffff" />

      {/* ---------------------------------------------------------------- */}
      {/* Pillars                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 data-animate className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            &iquest;Por qu&eacute; Vidana?
          </h2>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p, i) => (
              <div
                key={p.title}
                {...(i % 2 === 0 ? { 'data-animate-left': '' } : { 'data-animate-right': '' })}
                className="flex flex-col items-center text-center"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="pillar-icon-wrap relative">
                  {/* Ring pulse element */}
                  <div className="ring-pulse absolute inset-0 rounded-full border-2 border-primary/40 opacity-0" />
                  <div className="animate-float group flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors hover:bg-primary">
                    <p.icon className="h-7 w-7 text-primary transition-colors group-hover:text-white" />
                  </div>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave: white → primary/5 */}
      <WaveSeparator fromColor="#ffffff" toColor="hsl(224, 76%, 48%, 0.05)" />

      {/* ---------------------------------------------------------------- */}
      {/* Testimonials — Auto-Scroll Carousel                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-24" style={{ backgroundColor: 'hsl(224, 76%, 48%, 0.05)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <h2 data-animate className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Lo que dicen nuestros clientes
          </h2>
          <div className="carousel-container mt-14 overflow-hidden">
            <div className="carousel-track flex gap-6" style={{ width: 'max-content' }}>
              {carouselTestimonials.map((t, i) => (
                <div
                  key={`${t.name}-${i}`}
                  className="relative min-w-[350px] max-w-[350px] flex-shrink-0 rounded-xl bg-white p-8 shadow-card transition-shadow hover:shadow-card-hover"
                >
                  {/* Decorative quote mark */}
                  <span className="absolute top-4 left-4 text-6xl leading-none font-serif select-none" style={{ color: 'hsl(224, 76%, 48%, 0.1)' }}>
                    &ldquo;
                  </span>
                  <p className="relative z-10 text-sm leading-relaxed text-muted-foreground pt-6">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-6">
                    <p className="font-semibold">{t.name}</p>
                  </div>
                </div>
              ))}
            </div>
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
// Service Card with 3D tilt
// ---------------------------------------------------------------------------
function ServiceCard({ service, index }: { service: typeof services[number]; index: number }) {
  const tilt = useCardTilt();

  return (
    <div style={{ perspective: '1000px' }}>
      <div
        ref={tilt.ref}
        data-animate
        onMouseMove={tilt.handleMouseMove}
        onMouseLeave={tilt.handleMouseLeave}
        className="group overflow-hidden rounded-xl bg-white shadow-card transition-all duration-200 hover:shadow-card-hover border border-white/50"
        style={{
          transformStyle: 'preserve-3d',
          transitionDelay: `${index * 150}ms`,
        }}
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
          <h3 className="text-lg font-semibold">{service.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const statsData = [
  { target: 2000000, label: 'Comidas servidas' },
  { target: 10000, label: 'Personas que han probado nuestra comida' },
  { target: 20, label: 'Empresas colaboradoras' },
];

const services = [
  {
    title: 'Comedores Corporativos',
    description:
      'Men\u00fas dise\u00f1ados seg\u00fan la cultura y necesidades de cada empresa con alianzas con banqueteras l\u00edderes.',
    image:
      'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80',
  },
  {
    title: 'Comedores Industriales',
    description:
      'Operaci\u00f3n de alto volumen con foco en energ\u00eda y rendimiento. Servicio eficiente para turnos, flujo y continuidad.',
    image:
      'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=800&q=80',
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
    quote:
      'El tener un beneficio como Vidana es una gran ventaja competitiva para las empresas. Al ser men\u00fas nutritivos cuidas su salud y bienestar. 100% recomendado.',
  },
  {
    name: 'Velia',
    quote:
      'El servicio siempre es r\u00e1pido, son muy atentos y tienen la mejor disposici\u00f3n y actitud. Puedo seguir mi dieta sin ning\u00fan problema.',
  },
  {
    name: 'Camila',
    quote:
      'No puedo recomendar m\u00e1s el servicio de Vidana. Los colaboradores de cualquier empresa ser\u00edan muy felices de tener este servicio.',
  },
  {
    name: 'Roberto',
    quote:
      'La variedad de los men\u00fas es excelente y el sabor siempre es consistente. Nuestros colaboradores esperan con ganas la hora de la comida.',
  },
  {
    name: 'Fernanda',
    quote:
      'Desde que implementamos Vidana, el ambiente en la oficina cambi\u00f3. La gente se re\u00fane a comer, convive m\u00e1s y se nota en la productividad.',
  },
  {
    name: 'Luis',
    quote:
      'Operan nuestro comedor con un nivel de profesionalismo impresionante. La log\u00edstica de turnos y volumen la manejan sin problema.',
  },
  {
    name: 'Ana',
    quote:
      'La cafeter\u00eda Vidana se convirti\u00f3 en el punto de encuentro favorito del equipo. El caf\u00e9 de especialidad y los snacks saludables son un gran plus.',
  },
  {
    name: 'Miguel',
    quote:
      'Lo que m\u00e1s valoramos es la transparencia en los reportes y la disposici\u00f3n para adaptar los men\u00fas a nuestras necesidades espec\u00edficas.',
  },
];
