import { gsap, SplitText } from "../../lib/gsap.js";

const split = SplitText.create("#title", { type: "chars" });

gsap.from(split.chars, {
  yPercent: 100,
  opacity: 0,
  stagger: 0.04,
  ease: "back.out(1.7)",
  duration: 0.8,
});

gsap.from("#subtitle", {
  opacity: 0,
  y: 20,
  delay: 0.4,
  duration: 0.8,
});

gsap.from(".hero-kicker, .hero-actions", {
  opacity: 0,
  y: 18,
  delay: 0.25,
  duration: 0.7,
  stagger: 0.1,
});

gsap.from("#portrait-card", {
  opacity: 0,
  y: 32,
  scale: 0.96,
  delay: 0.35,
  duration: 0.9,
  ease: "power2.out",
});
