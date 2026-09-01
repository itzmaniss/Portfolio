/**
 * Portfolio interactions.
 *
 * Everything here is progressive enhancement — with JS off the page is
 * still fully readable and navigable, just without the reveals, the
 * active-section tracking, and the statusline.
 */
(function () {
    "use strict";

    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
    ).matches;

    /* ── Mobile menu ─────────────────────────────────────────────────── */
    function initMobileMenu() {
        const toggle = document.getElementById("menu-toggle");
        const menu = document.getElementById("mobile-menu");
        const iconOpen = document.getElementById("menu-icon-open");
        const iconClose = document.getElementById("menu-icon-close");
        if (!toggle || !menu) return;

        const setOpen = (open) => {
            menu.classList.toggle("hidden", !open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
            iconOpen?.classList.toggle("hidden", open);
            iconClose?.classList.toggle("hidden", !open);
        };

        toggle.addEventListener("click", () => {
            setOpen(menu.classList.contains("hidden"));
        });

        // Close after navigating to a section.
        menu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => setOpen(false));
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !menu.classList.contains("hidden")) {
                setOpen(false);
                toggle.focus();
            }
        });

        // If the viewport grows past the mobile breakpoint while the menu
        // is open, close it so it can't linger in a desktop layout.
        window.matchMedia("(min-width: 768px)").addEventListener("change", (e) => {
            if (e.matches) setOpen(false);
        });
    }

    /* ── Scroll reveal ───────────────────────────────────────────────── */
    function initReveal() {
        const items = document.querySelectorAll("[data-reveal]");
        if (!items.length) return;

        // No IntersectionObserver, or motion is unwelcome: show everything.
        if (prefersReducedMotion || !("IntersectionObserver" in window)) {
            items.forEach((el) => el.setAttribute("data-visible", ""));
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.setAttribute("data-visible", "");
                    observer.unobserve(entry.target);
                });
            },
            { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
        );

        items.forEach((el) => observer.observe(el));
    }

    /* ── Scroll spy: nav highlight + statusline buffer name ──────────── */
    function initScrollSpy() {
        const sections = Array.from(document.querySelectorAll("main section[id]"));
        const navLinks = Array.from(document.querySelectorAll("[data-nav]"));
        const statusSection = document.getElementById("status-section");
        if (!sections.length) return;

        let current = "";

        const update = () => {
            // The section occupying the upper third of the viewport wins.
            const marker = window.scrollY + window.innerHeight * 0.33;
            let active = "hero";

            for (const section of sections) {
                if (section.offsetTop <= marker) active = section.id;
            }

            // Above the first section we're still in the hero.
            if (window.scrollY < sections[0].offsetTop - window.innerHeight * 0.5) {
                active = "hero";
            }

            if (active === current) return;
            current = active;

            navLinks.forEach((link) => {
                const isActive = link.getAttribute("href") === "#" + active;
                if (isActive) {
                    link.setAttribute("aria-current", "true");
                } else {
                    link.removeAttribute("aria-current");
                }
            });

            if (statusSection) statusSection.textContent = active;
        };

        // rAF-throttled: scroll events fire far faster than we need to paint.
        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(() => {
                update();
                ticking = false;
            });
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
        update();
    }

    /* ── Statusline clock (Singapore time, regardless of visitor TZ) ─── */
    function initClock() {
        const el = document.getElementById("status-clock");
        if (!el) return;

        const format = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Singapore",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });

        const tick = () => {
            el.textContent = format.format(new Date());
        };

        tick();
        setInterval(tick, 30000);
    }

    function init() {
        initMobileMenu();
        initReveal();
        initScrollSpy();
        initClock();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
