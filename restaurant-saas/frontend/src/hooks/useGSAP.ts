import { useEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';

// ─── Page Transition Hook ────────────────────

export function usePageTransition(ref: RefObject<HTMLElement | HTMLDivElement>) {
  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
      );
    }, ref);

    return () => ctx.revert();
  }, []);
}

// ─── Stagger Children Animation ──────────────

export function useStaggerAnimation(
  containerRef: RefObject<HTMLElement>,
  selector: string = '[data-animate]',
  options?: { delay?: number; stagger?: number; y?: number }
) {
  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        selector,
        { opacity: 0, y: options?.y ?? 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: options?.stagger ?? 0.07,
          delay: options?.delay ?? 0,
          ease: 'power3.out',
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);
}

// ─── Cart Slide Animation ────────────────────

export function useCartAnimation(isOpen: boolean, ref: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!ref.current) return;

    if (isOpen) {
      gsap.fromTo(
        ref.current,
        { x: '100%', opacity: 0 },
        { x: '0%', opacity: 1, duration: 0.4, ease: 'power3.out' }
      );
    } else {
      gsap.to(ref.current, {
        x: '100%',
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      });
    }
  }, [isOpen]);
}

// ─── Number Counter Animation ────────────────

export function useCountUp(
  ref: RefObject<HTMLElement>,
  target: number,
  duration: number = 1.5,
  prefix: string = '',
  suffix: string = ''
) {
  useEffect(() => {
    if (!ref.current) return;

    const obj = { value: 0 };
    const tween = gsap.to(obj, {
      value: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent =
            prefix + Math.round(obj.value).toLocaleString() + suffix;
        }
      },
    });

    return () => {
      tween.kill();
    };
  }, [target]);
}

// ─── Hover Tilt Effect ───────────────────────

export function useTiltEffect(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;

      gsap.to(el, {
        rotateX,
        rotateY,
        duration: 0.3,
        ease: 'power2.out',
        transformPerspective: 500,
        transformOrigin: 'center center',
      });
    };

    const handleMouseLeave = () => {
      gsap.to(el, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.4,
        ease: 'power2.out',
      });
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);
}

// ─── Menu Item Hover ─────────────────────────

export function animateMenuItemHover(el: HTMLElement, enter: boolean) {
  if (enter) {
    gsap.to(el, {
      scale: 1.02,
      y: -2,
      duration: 0.25,
      ease: 'power2.out',
    });
  } else {
    gsap.to(el, {
      scale: 1,
      y: 0,
      duration: 0.2,
      ease: 'power2.in',
    });
  }
}

// ─── Add to Cart Bounce ──────────────────────

export function animateAddToCart(buttonEl: HTMLElement, cartIconEl?: HTMLElement | null) {
  // Bounce button
  gsap.timeline()
    .to(buttonEl, { scale: 0.9, duration: 0.1, ease: 'power2.in' })
    .to(buttonEl, { scale: 1.1, duration: 0.15, ease: 'power2.out' })
    .to(buttonEl, { scale: 1, duration: 0.2, ease: 'elastic.out(1, 0.5)' });

  // Shake cart icon
  if (cartIconEl) {
    gsap.to(cartIconEl, {
      rotation: 15,
      duration: 0.1,
      yoyo: true,
      repeat: 3,
      ease: 'power1.inOut',
    });
  }
}

// ─── Reveal on Scroll ────────────────────────

export function useScrollReveal(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            gsap.fromTo(
              el,
              { opacity: 0, y: 30 },
              { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
            );
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);
}

// ─── Modal Animation ─────────────────────────

export function animateModalIn(backdropEl: HTMLElement, contentEl: HTMLElement) {
  gsap.fromTo(backdropEl, { opacity: 0 }, { opacity: 1, duration: 0.25 });
  gsap.fromTo(
    contentEl,
    { scale: 0.9, opacity: 0, y: 20 },
    { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.3)' }
  );
}

export function animateModalOut(
  backdropEl: HTMLElement,
  contentEl: HTMLElement,
  onComplete?: () => void
) {
  const tl = gsap.timeline({ onComplete });
  tl.to(contentEl, { scale: 0.95, opacity: 0, y: 10, duration: 0.2, ease: 'power2.in' });
  tl.to(backdropEl, { opacity: 0, duration: 0.2 }, '-=0.1');
}

// ─── Notification Toast Slide ─────────────────

export function animateToastIn(el: HTMLElement) {
  gsap.fromTo(
    el,
    { x: 60, opacity: 0 },
    { x: 0, opacity: 1, duration: 0.35, ease: 'power3.out' }
  );
}

// ─── Loading Bar ─────────────────────────────

export function useLoadingBar() {
  const barRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const start = () => {
    if (!barRef.current) return;
    gsap.set(barRef.current, { scaleX: 0, opacity: 1 });
    tweenRef.current = gsap.to(barRef.current, {
      scaleX: 0.7,
      duration: 8,
      ease: 'power1.out',
    });
  };

  const finish = () => {
    if (!barRef.current) return;
    tweenRef.current?.kill();
    gsap.to(barRef.current, {
      scaleX: 1,
      duration: 0.3,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(barRef.current, { opacity: 0, duration: 0.3, delay: 0.1 });
      },
    });
  };

  return { barRef, start, finish };
}
