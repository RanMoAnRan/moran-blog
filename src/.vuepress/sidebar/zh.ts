import { sidebar } from "vuepress-theme-hope";

export const zhSidebar = sidebar({
  "/zh/": [
    "",
    {
      text: "Kafka",
      icon: "laptop-code",
      prefix: "demo/",
      link: "demo/",
      children: "structure",
    },
    {
      text: "Spark",
      icon: "book",
      prefix: "posts/",
      children: "structure",
    },
    "intro",
    {
      text: "Flume",
      icon: "person-chalkboard",
      link: "",
    },
    {
      text: "Doris",
      icon: "book",
      prefix: "posts/",
      children: "structure",
    },
  ],
});
