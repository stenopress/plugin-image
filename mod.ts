/**
 * Steno plugin for bulk image optimization, resizing, and automatic HTML lazy-loading injection.
 */
import type { StenoPlugin } from "steno";
import { basename, dirname, extname, join } from "@std/path";
import { walk } from "@std/fs";
import sharp from "sharp";

export interface ImagePluginOptions {
  widths?: number[];
  formats?: Array<"webp" | "jpeg" | "png">;
  quality?: number;
  injectLazyLoad?: boolean; // New Option!
}

export interface SiteConfig {
  output?: string;
}

export default function imagePlugin(
  options: ImagePluginOptions = {},
): StenoPlugin {
  const widths = options.widths ?? [640, 1024, 1280];
  const formats = options.formats ?? ["webp"];
  const quality = options.quality ?? 80;
  const injectLazyLoad = options.injectLazyLoad ?? true;

  const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png"];

  return {
    name: "steno-plugin-image",

    async afterBuild(config: SiteConfig): Promise<void> {
      const outputDir = config.output ?? "dist";
      const imageMetadataMap = new Map<
        string,
        { width: number; height: number; lqip?: string }
      >();

      // 1. Process and Optimize Physical Images
      for await (const entry of walk(outputDir, { includeDirs: false })) {
        const ext = extname(entry.path).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(ext)) {
          continue;
        }

        const dir = dirname(entry.path);
        const name = basename(entry.path, ext);
        const imageBuffer = await Deno.readFile(entry.path);
        const metadata = await sharp(imageBuffer).metadata();

        if (!metadata.width || !metadata.height) continue;

        // Cache metadata for HTML injection phase
        const relativePath = entry.path.replace(outputDir, "").replace(
          /\\/g,
          "/",
        );

        // Generate a tiny Base64 LQIP (16px wide) for instant loading preview
        const lqipBuffer = await sharp(imageBuffer)
          .resize(16)
          .blur(1)
          .toBuffer();
        const lqipBase64 = `data:image/${ext.slice(1)};base64,${
          lqipBuffer.toString("base64")
        }`;

        imageMetadataMap.set(relativePath, {
          width: metadata.width,
          height: metadata.height,
          lqip: lqipBase64,
        });

        // Write optimized files (widths & formats)
        for (const format of formats) {
          for (const width of widths) {
            if (width > metadata.width) continue;

            const outputFilename = `${name}-${width}.${format}`;
            const outputPath = join(dir, outputFilename);

            let transform = sharp(imageBuffer).resize({ width });

            if (format === "webp") {
              transform = transform.webp({ quality });
            } else if (format === "jpeg") {
              transform = transform.jpeg({ quality, mozjpeg: true });
            } else if (format === "png") {
              transform = transform.png({ quality });
            }

            const processedBuffer = await transform.toBuffer();
            await Deno.writeFile(outputPath, processedBuffer);
          }
        }
      }

      // 2. Scan and Inject lazy-loading attributes into HTML files
      if (injectLazyLoad) {
        for await (const entry of walk(outputDir, { includeDirs: false })) {
          if (extname(entry.path).toLowerCase() !== ".html") {
            continue;
          }

          let htmlContent = await Deno.readTextFile(entry.path);
          let modified = false;

          // Regex to match <img> tags
          const imgRegex = /<img\s+([^>]*?)src="([^"]+?)"([^>]*?)>/gi;

          htmlContent = htmlContent.replace(
            imgRegex,
            (match, before, src, after) => {
              // Normalize path to map to our metadata registry
              const cleanSrc = src.startsWith("/") ? src : `/${src}`;
              const meta = imageMetadataMap.get(cleanSrc);

              if (!meta) return match; // Skip if we don't have matching local metadata

              // Check if attributes are already defined to prevent duplicates
              const hasWidth = /width=/i.test(match);
              const hasHeight = /height=/i.test(match);
              const hasLoading = /loading=/i.test(match);

              let extraAttrs = "";
              if (!hasWidth) extraAttrs += ` width="${meta.width}"`;
              if (!hasHeight) extraAttrs += ` height="${meta.height}"`;
              if (!hasLoading) extraAttrs += ` loading="lazy"`;

              // Apply low-quality blur-up style if LQIP is available
              const hasStyle = /style=/i.test(match);
              if (!hasStyle && meta.lqip) {
                extraAttrs +=
                  ` style="background-image: url('${meta.lqip}'); background-size: cover; filter: blur(4px); transition: filter 0.3s;" onload="this.style.filter='none'"`;
              }

              modified = true;
              return `<img ${before}src="${src}"${after}${extraAttrs}>`;
            },
          );

          if (modified) {
            await Deno.writeTextFile(entry.path, htmlContent);
          }
        }
      }
    },
  };
}
