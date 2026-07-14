import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import imagePlugin from "./mod.ts";

// Minimal 1x1 Transparent PNG byte buffer
const dummyPngBuffer = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
  0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
  120, 156, 99, 96, 96, 96, 0, 0, 0, 5, 0, 1, 165, 246, 69, 122, 0, 0, 0, 0,
  73, 69, 78, 68, 174, 66, 96, 130
]);

Deno.test({
  name: "image-plugin: successfully resizes and outputs modern webp targets",
  fn: async () => {
    const testDir = await Deno.makeTempDir({ prefix: "steno_img_test_" });
    const inputFilePath = join(testDir, "test-image.png");

    // Write mock png asset to temporary directory
    await Deno.writeFile(inputFilePath, dummyPngBuffer);

    const plugin = imagePlugin({
      widths: [1], // Matches dummy width so it doesn't skip due to upscaling constraints
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