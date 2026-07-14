import { assert } from "@std/assert";
import { join } from "@std/path";
import imagePlugin from "./mod.ts";
import sharp from "sharp";

Deno.test({
  name: "image-plugin: successfully resizes and outputs modern webp targets",
  fn: async () => {
    const testDir = await Deno.makeTempDir({ prefix: "steno_img_test_" });
    const inputFilePath = join(testDir, "test-image.png");

    const validPngBuffer = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
        .png()
        .toBuffer();

    await Deno.writeFile(inputFilePath, validPngBuffer);

    const plugin = imagePlugin({
      widths: [1], // Matches dummy width so it doesn't skip
      formats: ["webp"],
      quality: 70
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
  }
});