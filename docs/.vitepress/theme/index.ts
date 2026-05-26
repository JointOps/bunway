// docs/.vitepress/theme/index.ts — full replacement
import DefaultTheme from "vitepress/theme";
import HomeLayout from "./HomeLayout.vue";
import Badge from "./components/Badge.vue";
import Steps from "./components/Steps.vue";
import AccordionSection from "./components/AccordionSection.vue";
import AccordionItem from "./components/AccordionItem.vue";
import "./custom.css";
import type { App } from "vue";

export default {
  extends: DefaultTheme,
  Layout: HomeLayout,
  enhanceApp({ app }: { app: App }) {
    app.component("Badge", Badge);
    app.component("Steps", Steps);
    app.component("AccordionSection", AccordionSection);
    app.component("AccordionItem", AccordionItem);
  },
};
