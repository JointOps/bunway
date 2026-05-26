# bunWay Performance Report - 5/26/2026, 6:40:51 PM

## Executive Summary
bunWay achieves **45,531 req/s** on JSON - **280.4% of Hono** and **1.2x Express**.

## TechEmpower-Style Results (Bun runtime, c=100, 10s x 2 runs)

| Endpoint | bunWay | Hono | Elysia | bunWay/Hono |
|----------|--------|------|--------|-------------|
| /json | 45,531 | 16,239 | 13,641 | 280.4% |
| /plaintext | 30,803 | 12,269 | 15,843 | 251.1% |
| /params/:id | 51,183 | 15,385 | 16,497 | 332.7% |
| /route50/:id | 60,819 | 21,063 | 16,212 | 288.8% |

## Bun Framework Ranking

| Rank | Framework | /json | /plaintext | /params/:id | /route50/:id | bunWay/Hono |
|------|-----------|--------|--------|--------|--------|-------------|
| 1 | bunWay | 45,531 | 30,803 | 51,183 | 60,819 | 280.4% |
| 2 | Hono | 16,239 | 12,269 | 15,385 | 21,063 | 100.0% |
| 3 | Elysia | 13,641 | 15,843 | 16,497 | 16,212 | 84.0% |

## Latency Percentiles - /json, c=100

| Framework | p50 | p75 | p99 | p999 |
|-----------|-----|-----|-----|------|
| bunWay | 1.39ms | 1.86ms | 16.50ms | 30.08ms |
| Hono | 1.80ms | 4.15ms | 38.73ms | 85.16ms |
| Elysia | 1.96ms | 8.28ms | 42.16ms | 69.57ms |

## Concurrency Saturation - bunWay /json

| Connections | RPS | p99 |
|-------------|-----|-----|

## Node.js Frameworks (Node.js v24.3.0, c=100, 10s x 2 runs)

| Endpoint | Express | Fastify | bunWay/Fastify |
|----------|---------|---------|----------------|
| /json | 38,491 | 54,447 | 83.6% |
| /plaintext | 39,807 | 47,229 | 65.2% |
| /params/:id | 37,588 | 48,572 | 105.4% |
| /route50/:id | 33,733 | 48,387 | 125.7% |

## Detailed Statistics

### bunWay (Bun)

| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable | Errors |
|----------|----------|--------|-----|-----|--------|-----|----------|--------|
| /json | 45,531 | 63,450 | 27,612 | 63,450 | 17,919 | 39.4% | no | 0 |
| /plaintext | 30,803 | 32,852 | 28,753 | 32,852 | 2,049 | 6.7% | yes | 0 |
| /params/:id | 51,183 | 62,343 | 40,023 | 62,343 | 11,160 | 21.8% | no | 0 |
| /route50/:id | 60,819 | 62,761 | 58,878 | 62,761 | 1,941 | 3.2% | yes | 0 |

### Hono (Bun)

| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable | Errors |
|----------|----------|--------|-----|-----|--------|-----|----------|--------|
| /json | 16,239 | 17,822 | 14,657 | 17,822 | 1,582 | 9.7% | yes | 0 |
| /plaintext | 12,269 | 16,405 | 8,133 | 16,405 | 4,136 | 33.7% | no | 960 |
| /params/:id | 15,385 | 17,317 | 13,453 | 17,317 | 1,932 | 12.6% | no | 0 |
| /route50/:id | 21,063 | 25,613 | 16,512 | 25,613 | 4,550 | 21.6% | no | 0 |

### Elysia (Bun)

| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable | Errors |
|----------|----------|--------|-----|-----|--------|-----|----------|--------|
| /json | 13,641 | 14,048 | 13,235 | 14,048 | 406 | 3.0% | yes | 0 |
| /plaintext | 15,843 | 16,619 | 15,066 | 16,619 | 777 | 4.9% | yes | 0 |
| /params/:id | 16,497 | 17,506 | 15,488 | 17,506 | 1,009 | 6.1% | yes | 0 |
| /route50/:id | 16,212 | 18,507 | 13,917 | 18,507 | 2,295 | 14.2% | no | 0 |

### Fastify (Node.js)

| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable | Errors |
|----------|----------|--------|-----|-----|--------|-----|----------|--------|
| /json | 54,447 | 54,853 | 54,042 | 54,853 | 406 | 0.7% | yes | 0 |
| /plaintext | 47,229 | 50,185 | 44,272 | 50,185 | 2,957 | 6.3% | yes | 0 |
| /params/:id | 48,572 | 50,053 | 47,092 | 50,053 | 1,481 | 3.0% | yes | 0 |
| /route50/:id | 48,387 | 49,245 | 47,529 | 49,245 | 858 | 1.8% | yes | 0 |

### Express (Node.js)

| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable | Errors |
|----------|----------|--------|-----|-----|--------|-----|----------|--------|
| /json | 38,491 | 38,909 | 38,073 | 38,909 | 418 | 1.1% | yes | 0 |
| /plaintext | 39,807 | 40,140 | 39,474 | 40,140 | 333 | 0.8% | yes | 0 |
| /params/:id | 37,588 | 38,008 | 37,169 | 38,008 | 420 | 1.1% | yes | 0 |
| /route50/:id | 33,733 | 34,007 | 33,459 | 34,007 | 274 | 0.8% | yes | 0 |

## Run Metadata

- Tool: internal
- OS: darwin (arm64)
- Bun: 1.3.10
- Node: v24.3.0
