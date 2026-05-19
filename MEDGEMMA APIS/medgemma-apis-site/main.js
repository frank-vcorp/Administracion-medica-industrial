/**
 * ARCH-20260513-05 | Micrositio Comercial — Copiloto Clínico Ocupacional
 * Respaldo: context/SPECs/SPEC_ARCH-20260513-05-MICROSITIO-ESTATICO-MEDGEMMA-APIS.md
 * IMPL-20260513-01 | SOFIA - Builder
 *
 * Configuración:
 * ─────────────────────────────────────────────────────────────
 * 1. Reemplaza WHATSAPP_NUMBER con tu número de WhatsApp
 *    (formato internacional sin espacios ni +, ej: 521XXXXXXXXXX)
 * 2. Personaliza WHATSAPP_MESSAGE con el mensaje prellenado
 * ─────────────────────────────────────────────────────────────
 */

;(function () {
  'use strict';

  /* ============================================================
     CONFIGURACIÓN — EDITAR AQUÍ
     ============================================================ */
  var CONFIG = {
    WHATSAPP_NUMBER: 'XXXXXXXXXX',               // ← Sustituir con tu número real
    WHATSAPP_MESSAGE: 'Hola, me interesa el Copiloto Clínico Ocupacional. Quisiera agendar una demo.',
    BRAND_NAME: 'Copiloto Clínico Ocupacional',
  };

  /* ============================================================
     HELPER: CONSTRUIR URL DE WHATSAPP
     ============================================================ */
  function buildWhatsAppURL(plan) {
    var msg = plan
      ? 'Hola, me interesa el plan ' + plan + ' del Copiloto Clínico Ocupacional. ¿Podemos agendar una demo?'
      : CONFIG.WHATSAPP_MESSAGE;
    return 'https://wa.me/' + CONFIG.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  /* ============================================================
     BIND CTAs DE WHATSAPP
     ============================================================ */
  function bindWhatsAppCTAs() {
    var ctaIds = [
      'hero-cta-primary',
      'nav-cta',
      'demo-cta',
      'close-cta',
      'sticky-cta-btn',
    ];

    ctaIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.setAttribute('href', buildWhatsAppURL(null));
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });

    // Plan-specific CTAs
    var planCTAs = document.querySelectorAll('.plan-cta, .enterprise-cta');
    planCTAs.forEach(function (el) {
      var plan = el.dataset.plan || null;
      el.setAttribute('href', buildWhatsAppURL(plan));
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    });
  }

  /* ============================================================
     NAVBAR — SCROLL SHADOW + MOBILE TOGGLE
     ============================================================ */
  function initNavbar() {
    var navbar   = document.getElementById('navbar');
    var toggle   = document.getElementById('nav-toggle');
    var navLinks = document.getElementById('nav-links');

    // Scroll shadow
    window.addEventListener('scroll', function () {
      if (window.scrollY > 20) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }, { passive: true });

    // Mobile toggle
    if (toggle && navLinks) {
      toggle.addEventListener('click', function () {
        var isOpen = navLinks.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      // Cierra el menú al hacer clic en un enlace
      navLinks.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          navLinks.classList.remove('open');
        });
      });
    }
  }

  /* ============================================================
     FAQ — ACCORDION
     ============================================================ */
  function initFAQ() {
    var questions = document.querySelectorAll('.faq-question');
    questions.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        var answer   = btn.nextElementSibling;

        // Cierra todos
        questions.forEach(function (q) {
          q.setAttribute('aria-expanded', 'false');
          if (q.nextElementSibling) q.nextElementSibling.hidden = true;
        });

        // Abre el actual si estaba cerrado
        if (!expanded) {
          btn.setAttribute('aria-expanded', 'true');
          if (answer) answer.hidden = false;
        }
      });
    });
  }

  /* ============================================================
     STICKY CTA — SHOW / HIDE
     ============================================================ */
  function initStickyCTA() {
    var sticky = document.getElementById('sticky-cta');
    var hero   = document.getElementById('hero');
    if (!sticky || !hero) return;

    var observer = new IntersectionObserver(
      function (entries) {
        // Muestra el sticky cuando el hero sale de la vista
        sticky.style.display = entries[0].isIntersecting ? 'none' : 'block';
      },
      { threshold: 0 }
    );
    observer.observe(hero);
  }

  /* ============================================================
     ANIMACIÓN DE ENTRADA (IntersectionObserver)
     ============================================================ */
  function initAnimations() {
    if (!('IntersectionObserver' in window)) return;

    var targets = document.querySelectorAll(
      '.pain-card, .case-card, .trust-card, .pricing-card, .step, .diff-pillar, .faq-item'
    );

    targets.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity .45s ease, transform .45s ease';
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ============================================================
     SMOOTH SCROLL para anclas internas
     ============================================================ */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var href = anchor.getAttribute('href');
        if (!href || href === '#') return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ============================================================
     INIT
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    bindWhatsAppCTAs();
    initNavbar();
    initFAQ();
    initStickyCTA();
    initAnimations();
    initSmoothScroll();

    // Alerta si el número no ha sido configurado
    if (CONFIG.WHATSAPP_NUMBER === 'XXXXXXXXXX') {
      console.warn(
        '[Copiloto Clínico] ⚠ Configura WHATSAPP_NUMBER en main.js antes de publicar el sitio.'
      );
    }
  });

})();
