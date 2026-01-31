---
layout: home
title: "bunWay"
hero:
  name: "The fastest way"
  text: "to Express"
  tagline: "Express-compatible framework built natively for Bun. Same patterns, 2.4× faster, zero rewrites."
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/JointOps/bunway
---

<div class="custom-home">

<div class="code-demo">
  <div class="code-header">
    <span class="dot red"></span>
    <span class="dot yellow"></span>
    <span class="dot green"></span>
    <span class="filename">app.ts</span>
  </div>

```ts
import { bunway, helmet, cors } from 'bunway'

const app = bunway()

app.use(helmet())
app.use(cors())
app.use(app.json())

app.get('/api', (req, res) => {
  res.json({ message: 'Hello, World!' })
})

app.listen(3000)  // That's it!
```

</div>

</div>

<style>
.custom-home {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24px 24px;
  position: relative;
}

/* Code Demo Card - Clean, premium terminal */
.code-demo {
  max-width: 580px;
  width: 100%;
  background: #0c0c0c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
}

.code-demo:hover {
  transform: translateY(-4px);
  border-color: rgba(63, 197, 183, 0.3);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.9),
    0 0 0 1px rgba(63, 197, 183, 0.1),
    0 0 80px -20px rgba(63, 197, 183, 0.15);
}

/* Terminal header */
.code-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.code-header .dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.code-header .dot.red { background: #ff5f57; }
.code-header .dot.yellow { background: #febc2e; }
.code-header .dot.green { background: #28c840; }

.code-header .filename {
  margin-left: auto;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-family: var(--vp-font-family-mono);
}

/* Code block styling */
.code-demo div[class*="language-"] {
  margin: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  border: none !important;
}

.code-demo pre {
  margin: 0 !important;
  padding: 20px !important;
  background: transparent !important;
}

.code-demo code {
  font-size: 13px !important;
  line-height: 1.8 !important;
}

/* Light mode - keep dark terminal */
html:not(.dark) .code-demo {
  background: #0c0c0c;
}
</style>
