import { defineUserConfig } from "vuepress";

import { hopeTheme } from "vuepress-theme-hope";

import theme from "./theme.js";

export default defineUserConfig({
  base: "/moran-blog/",

  locales: {
    "/": {
      lang: "en-US",
      title: "moran",
      description: "墨然的博客",
    },
    "/zh/": {
      lang: "zh-CN",
      title: "墨然",
      description: "墨然的博客",
    },
  },

  theme,

  // Enable it with pwa
  // shouldPrefetch: false,
});


