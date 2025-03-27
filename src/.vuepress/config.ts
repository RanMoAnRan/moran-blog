import { defineUserConfig } from "vuepress";

import theme from "./theme.js";

export default defineUserConfig({
  base: "/moran-blog/",

  locales: {
    "/": {
      lang: "en-US",
      title: "Blog Demo",
      description: "A blog demo for vuepress-theme-hope",
    },
    "/zh/": {
      lang: "zh-CN",
      title: "墨然",
      description: "vuepress-theme-hope 墨然的博客",
    },
  },

  theme,

  // Enable it with pwa
  // shouldPrefetch: false,
});
