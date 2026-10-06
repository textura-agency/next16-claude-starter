// 📖 Docs: obsidian/frontend/utils.md → "warmImage"

import { getImageProps, type ImageProps } from "next/image";

/**
 * Warm (download + decode) exactly the candidate a rendered `<Image>` will
 * pick — never the source file.
 *
 * A preloader, a reveal or a canvas effect that does
 * `new Image().src = "/assets/hero.png"` downloads the multi-megabyte original
 * from `public/`, while the page's `<Image>` asks `/_next/image` for a
 * 30–200 KB AVIF/WebP. Measured on four production sites: page weight
 * 11.5 → 0.57 MB, hosted mobile LCP 31.0 → 3.7 s; a canvas reveal's photo
 * 2,776 → 20 KB. Pass the same `src`/`width`/`height`/`sizes`/`quality` the
 * `<Image>` gets — keep one spec object for both — and the warm-up hits the
 * same URL, so the rendered image comes from cache.
 *
 *   const HERO = { src: "/assets/hero/plate.jpg", width: 2400, height: 1600, sizes: "100vw", alt: "" };
 *   <Image {...HERO} alt={HERO.alt} priority />
 *   await warmImage(HERO);            // in a preloader / before a reveal
 *   const img = await warmImage(SPEC); // a canvas effect draws `img`
 *
 * Below-the-fold warming belongs after `load`, in idle time — never during the
 * page's own load. CSS backgrounds: take `getImageProps(...).props.srcSet`
 * and write it as `image-set(url(…) 1x, url(…) 2x)` instead of a raw `url()`.
 */
export const warmImage = (
  spec: Omit<ImageProps, "alt"> & { alt?: string },
): Promise<HTMLImageElement> => {
  const { props } = getImageProps({ alt: "", ...spec });
  const img = new Image();
  // Order matters: `sizes` and `srcset` before `src`, or the browser starts
  // fetching `src` (the largest candidate) before it knows the layout width.
  if (props.sizes) img.sizes = props.sizes;
  if (props.srcSet) img.srcset = props.srcSet;
  img.src = props.src;
  return img.decode().then(
    () => img,
    () => img, // a decode error must not hold a preloader forever
  );
};
