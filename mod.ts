/**
 * Steno plugin for bulk image optimization, resizing, and WebP compilation.
 */
import type { StenoPlugin } from "steno";
import { join, extname, basename, dirname } from "@std/path";
import { walk } from "@std/fs";
import sharp from "sharp";

export interface ImagePluginOptions {
  widths?: number[];
  formats?: Array<"webp" | "jpeg" | "png">;
  quality?: number;
}

export interface SiteConfig {
  output?: string;
}

export default function imagePlugin(options: ImagePluginOptions = {}): StenoPlugin {
  const widths = options.widths ?? [640, 1024, 1280];
  const formats = options.formats ?? ["webp"];
  const quality = options.quality ?? 80;

  const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png"];

  return {
    name: "steno-plugin-image",

    async afterBuild(config: SiteConfig): Promise<void> {
      const outputDir = config.output ?? "dist";

      // Recursively find all source assets in the built output directory
      for await (const entry of walk(outputDir, { includeDirs: false })) {
        const ext = extname(entry.path).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(ext)) {
          continue;
        }

        const dir = dirname(entry.path);
        const name = basename(entry.path, ext);

        // Read image into buffer once for processing multiple pipeline variations
        const imageBuffer = await Deno.readFile(entry.path);
        const metadata = await sharp(imageBuffer).metadata();

        if (!metadata.width) continue;

        // Process every configuration combination
        for (const format of formats) {
          for (const width of widths) {
            // Skip upscaling smaller images to keep sizes minimal
            if (width > metadata.width) {
              continue;
            }

            const outputFilename = `${name}-${width}.${format}`;
            const outputPath = join(dir, outputFilename);

            let transform = sharp(imageBuffer).resize({ width });

            // Apply standard encoder configuration
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
    },
  };
}