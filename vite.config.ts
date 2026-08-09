import { defineConfig } from "vite";

/**
 * Relative base for itch.io (and any non-root host).
 * Also inject a <base> so ./assets and ./audio resolve when the embed
 * URL has no trailing slash (common on itch HTML hosts).
 */
export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "itch-relative-base",
      transformIndexHtml(html) {
        const baseScript = `
    <script>
      (function () {
        try {
          var u = new URL(document.URL);
          var path = u.pathname || "/";
          var last = path.split("/").pop() || "";
          if (!path.endsWith("/")) {
            if (last.indexOf(".") !== -1) {
              path = path.replace(/\\/[^/]*$/, "/");
            } else {
              path = path + "/";
            }
          }
          u.pathname = path;
          u.hash = "";
          u.search = "";
          var b = document.createElement("base");
          b.href = u.href;
          var head = document.head || document.getElementsByTagName("head")[0];
          if (head) head.insertBefore(b, head.firstChild);
        } catch (e) {}
      })();
    </script>`;
        return html.replace(/<head>/i, `<head>${baseScript}`);
      },
    },
  ],
});
