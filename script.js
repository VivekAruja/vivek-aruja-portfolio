(function () {
  var navToggle = document.getElementById('navToggle');
  var siteNav = document.getElementById('siteNav');

  navToggle.addEventListener('click', function () {
    var isOpen = siteNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  /* ---- Dark mode toggle ----
     The initial theme (from localStorage or prefers-color-scheme) is
     already applied by the inline script in <head>, before first paint,
     to avoid a flash of the wrong theme. This just wires up the button. */
  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    var syncToggleState = function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeToggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    };
    syncToggleState();

    themeToggle.addEventListener('click', function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      try { localStorage.setItem('theme', isDark ? 'light' : 'dark'); } catch (e) {}
      syncToggleState();

      var themeColorMeta = document.getElementById('themeColorMeta');
      if (themeColorMeta) themeColorMeta.setAttribute('content', isDark ? '#C8C3B7' : '#1A1917');
    });
  }

  siteNav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      siteNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && siteNav.classList.contains('is-open')) {
      siteNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.focus();
    }
  });

  var revealTargets = document.querySelectorAll(
    '.section-head, .section-statement, .entry, .hobby-carousel'
  );

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealTargets.forEach(function (el) { observer.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---- Circuit-trace scroll progress bar ---- */
  var progressFill = document.getElementById('scrollProgressFill');
  if (progressFill) {
    var progressTicking = false;
    var updateProgress = function () {
      progressTicking = false;
      var scrollable = document.documentElement.scrollHeight - window.innerHeight;
      var pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      progressFill.style.width = Math.min(100, Math.max(0, pct)).toFixed(2) + '%';
    };
    window.addEventListener('scroll', function () {
      if (progressTicking) return;
      progressTicking = true;
      window.requestAnimationFrame(updateProgress);
    }, { passive: true });
    window.addEventListener('resize', updateProgress);
    updateProgress();
  }

  /* ---- Scroll-linked nav + section markers ----
     Plain scroll-position math instead of a percentage rootMargin
     IntersectionObserver: this page's sections vary wildly in height
     (the four-entry experience section is ~10x a viewport tall), which
     makes a fixed center-band trigger unreliable. Comparing scrollY
     against each section's offsetTop is the standard, dependable
     pattern for this and doesn't care how tall any one section is. */
  var navLinkMap = {
    about: document.querySelector('.site-nav a[href="#about"]'),
    work: document.querySelector('.site-nav a[href="#work"]'),
    contact: document.querySelector('.site-nav a[href="#contact"]')
  };
  var spySections = Array.prototype.slice.call(document.querySelectorAll('main > section[id]'));

  if (spySections.length) {
    var spyTicking = false;

    var updateScrollSpy = function () {
      spyTicking = false;
      var probe = window.scrollY + window.innerHeight * 0.35;
      var current = null;
      spySections.forEach(function (s) {
        if (s.offsetTop <= probe) current = s;
      });
      spySections.forEach(function (s) {
        var isCurrent = s === current;
        var head = s.querySelector('.section-head');
        var navLink = navLinkMap[s.id];
        if (head) head.classList.toggle('is-current', isCurrent);
        if (navLink) navLink.classList.toggle('is-active', isCurrent);
      });
    };

    window.addEventListener('scroll', function () {
      if (spyTicking) return;
      spyTicking = true;
      window.requestAnimationFrame(updateScrollSpy);
    }, { passive: true });
    window.addEventListener('resize', updateScrollSpy);
    updateScrollSpy();
  }

  /* ---- Magnetic hover on primary CTAs ---- */
  var magneticEls = document.querySelectorAll('.magnetic');
  if (magneticEls.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    magneticEls.forEach(function (el) {
      var strength = 0.35;
      var maxOffset = 14;

      el.addEventListener('mousemove', function (e) {
        var rect = el.getBoundingClientRect();
        var relX = e.clientX - (rect.left + rect.width / 2);
        var relY = e.clientY - (rect.top + rect.height / 2);
        var x = Math.max(-maxOffset, Math.min(maxOffset, relX * strength));
        var y = Math.max(-maxOffset, Math.min(maxOffset, relY * strength));
        el.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = '';
      });
    });
  }

  /* ---- Click-to-copy email ---- */
  var emailLink = document.getElementById('emailLink');
  var copyToast = document.getElementById('copyToast');
  if (emailLink && copyToast && navigator.clipboard) {
    var copyTimeout;
    emailLink.addEventListener('click', function (e) {
      e.preventDefault();
      navigator.clipboard.writeText(emailLink.dataset.email).then(function () {
        copyToast.classList.add('is-shown');
        window.clearTimeout(copyTimeout);
        copyTimeout = window.setTimeout(function () {
          copyToast.classList.remove('is-shown');
        }, 2000);
      }).catch(function () {
        window.location.href = emailLink.href;
      });
    });
  }

  /* ---- Cursor-reactive hero diagram ----
     A light-cycle style trail (Tron) follows the cursor around the hero:
     a chain of points where each one eases toward the point ahead of it,
     rendered as tapering segments with a glow filter, brightest and
     thickest at the head and fading out toward the tail. */
  var heroDiagram = document.querySelector('.hero-diagram');
  var heroSection = document.querySelector('.hero');
  var cursorTrace = document.getElementById('cursorTrace');
  var reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var traceTarget = { x: 0, y: 0 };

  var TRAIL_LENGTH = 16;
  var trailPoints = [];
  var trailSegments = [];
  var trailHead = null;

  if (cursorTrace) {
    for (var t = 0; t < TRAIL_LENGTH; t++) trailPoints.push({ x: 0, y: 0 });

    for (var s = 0; s < TRAIL_LENGTH - 1; s++) {
      var seg = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      seg.setAttribute('class', 'trail-segment');
      var age = s / (TRAIL_LENGTH - 2);
      seg.style.opacity = (1 - age * 0.92).toFixed(2);
      seg.style.strokeWidth = Math.max(1, 7 * (1 - age)).toFixed(2);
      cursorTrace.appendChild(seg);
      trailSegments.push(seg);
    }

    trailHead = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    trailHead.setAttribute('class', 'trail-head');
    trailHead.setAttribute('r', '6');
    cursorTrace.appendChild(trailHead);
  }

  if (heroDiagram && heroSection && !reduceMotionQuery.matches) {
    heroSection.addEventListener('mousemove', function (e) {
      var rect = heroSection.getBoundingClientRect();
      var relX = (e.clientX - rect.left) / rect.width - 0.5;
      var relY = (e.clientY - rect.top) / rect.height - 0.5;
      heroDiagram.style.transform =
        'translate(' + (relX * 16).toFixed(1) + 'px, ' + (relY * 16).toFixed(1) + 'px)';

      if (cursorTrace) {
        var svgRect = heroDiagram.getBoundingClientRect();
        var viewBox = heroDiagram.viewBox.baseVal;
        var px = ((e.clientX - svgRect.left) / svgRect.width) * viewBox.width;
        var py = ((e.clientY - svgRect.top) / svgRect.height) * viewBox.height;
        traceTarget.x = px;
        traceTarget.y = py;
        cursorTrace.classList.add('is-active');
      }
    });
    heroSection.addEventListener('mouseleave', function () {
      heroDiagram.style.transform = '';
      if (cursorTrace) cursorTrace.classList.remove('is-active');
    });
  }

  if (cursorTrace) {
    var headEase = reduceMotionQuery.matches ? 1 : 0.3;
    var chainEase = reduceMotionQuery.matches ? 1 : 0.45;

    (function animateTrail() {
      requestAnimationFrame(animateTrail);

      trailPoints[0].x += (traceTarget.x - trailPoints[0].x) * headEase;
      trailPoints[0].y += (traceTarget.y - trailPoints[0].y) * headEase;
      for (var i = 1; i < TRAIL_LENGTH; i++) {
        trailPoints[i].x += (trailPoints[i - 1].x - trailPoints[i].x) * chainEase;
        trailPoints[i].y += (trailPoints[i - 1].y - trailPoints[i].y) * chainEase;
      }

      for (var j = 0; j < trailSegments.length; j++) {
        trailSegments[j].setAttribute('x1', trailPoints[j].x.toFixed(1));
        trailSegments[j].setAttribute('y1', trailPoints[j].y.toFixed(1));
        trailSegments[j].setAttribute('x2', trailPoints[j + 1].x.toFixed(1));
        trailSegments[j].setAttribute('y2', trailPoints[j + 1].y.toFixed(1));
      }
      if (trailHead) {
        trailHead.setAttribute('cx', trailPoints[0].x.toFixed(1));
        trailHead.setAttribute('cy', trailPoints[0].y.toFixed(1));
      }
    })();
  }

  /* ---- Click-to-enlarge diagrams/photos ---- */
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lightboxCaption = document.getElementById('lightboxCaption');
  var lightboxClose = document.getElementById('lightboxClose');
  var lastFocused = null;

  function openLightbox(img) {
    lastFocused = document.activeElement;
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || '';
    lightboxCaption.textContent = img.alt || '';
    lightbox.classList.add('is-open');
    lightboxClose.focus();
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightboxImg.src = '';
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  if (lightbox) {
    document.querySelectorAll('.entry-photo, .about-photo-frame img').forEach(function (img) {
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.addEventListener('click', function () { openLightbox(img); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(img);
        }
      });
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('is-open')) closeLightbox();
    });
  }

  /* ---- Skills to experience cross-reference ---- */
  var skillTags = document.querySelectorAll('.skill-tag');
  var skillEntries = document.querySelectorAll('.entry[data-skills]');
  if (skillTags.length && skillEntries.length) {
    skillTags.forEach(function (tag) {
      tag.addEventListener('click', function () {
        var wasActive = tag.classList.contains('is-active');
        skillTags.forEach(function (t) { t.classList.remove('is-active'); });
        skillEntries.forEach(function (entry) { entry.classList.remove('is-linked'); });

        if (wasActive) return;

        tag.classList.add('is-active');
        var skill = tag.dataset.skill;
        var firstMatch = null;
        skillEntries.forEach(function (entry) {
          var entrySkills = entry.dataset.skills.split(' ');
          if (entrySkills.indexOf(skill) !== -1) {
            entry.classList.add('is-linked');
            if (!firstMatch) firstMatch = entry;
          }
        });

        /* The highlight itself is a subtle border/tint on the matched
           entry, which can easily sit off-screen in the Experience
           section below. Without scrolling to it, clicking a skill can
           look like it did nothing at all. */
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  }
})();
