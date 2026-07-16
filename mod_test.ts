import { assert, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import imagePlugin from "./mod.ts";
import sharp from "sharp";

// Helper to generate a valid 1x1 PNG using Sharp
async function createTestPng(): Promise<Uint8Array> {
  return await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
}

Deno.test({
  name: "image-plugin: successfully resizes and outputs modern webp targets",
  fn: async () => {
    const testDir = await Deno.makeTempDir({ prefix: "steno_img_test_" });
    const inputFilePath = join(testDir, "test-image.png");

    const validPngBuffer = await createTestPng();
    await Deno.writeFile(inputFilePath, validPngBuffer);

    const plugin = imagePlugin({
      widths: [1],
      formats: ["webp"],
      quality: 70,
      injectLazyLoad: false, // Disable HTML scanning for this pure asset generation test
    });

    // deno-lint-ignore no-explicit-any
    const pluginAny = plugin as any;

    try {
      await pluginAny.afterBuild({ output: testDir });

      const expectedWebpPath = join(testDir, "test-image-1.webp");
      const fileInfo = await Deno.stat(expectedWebpPath);

      assert(fileInfo.isFile);
      assert(fileInfo.size > 0);
    } finally {
      await Deno.remove(testDir, { recursive: true });
    }
  },
});

Deno.test({
  name:
    "image-plugin: injects lazy-load, dimension, and LQIP attributes into HTML files",
  fn: async () => {
    const testDir = await Deno.makeTempDir({ prefix: "steno_html_test_" });

    // 1. Create a dummy PNG image inside the output directory
    const imgPath = join(testDir, "hero.png");
    const validPngBuffer = await createTestPng();
    await Deno.writeFile(imgPath, validPngBuffer);

    // 2. Create an HTML file referencing that PNG image
    const htmlPath = join(testDir, "index.html");
    const rawHtml = `
            <!DOCTYPE html>
            <html>
            <body>
                <h1>Welcome to Steno</h1>
                <img src="/hero.png" alt="Hero Image">
            </body>
            </html>
        `;
    await Deno.writeTextFile(htmlPath, rawHtml);

    const plugin = imagePlugin({
      widths: [1],
      formats: ["webp"],
      injectLazyLoad: true,
    });

    // deno-lint-ignore no-explicit-any
    const pluginAny = plugin as any;

    try {
      // Run the build hook processing
      await pluginAny.afterBuild({ output: testDir });

      // Read back the processed HTML file
      const processedHtml = await Deno.readTextFile(htmlPath);

      // Assert that dimension headers were dynamically read and injected
      assertStringIncludes(processedHtml, 'width="1"');
      assertStringIncludes(processedHtml, 'height="1"');

      // Assert that loading lazy was successfully added
      assertStringIncludes(processedHtml, 'loading="lazy"');

      // Assert that the inline Base64 LQIP transition style is present
      assertStringIncludes(
        processedHtml,
        "style=\"background-image: url('data:image/png;base64,",
      );
      assertStringIncludes(
        processedHtml,
        "onload=\"this.style.filter='none'\"",
      );
    } finally {
      await Deno.remove(testDir, { recursive: true });
    }
  },
});
