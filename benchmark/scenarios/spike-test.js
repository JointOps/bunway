import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 100 },
    { duration: "10s", target: 1000 },
    { duration: "1m", target: 1000 },
    { duration: "10s", target: 100 },
    { duration: "1m", target: 100 },
  ],
  thresholds: {
    http_req_duration: ["p(99)<500"],
    http_req_failed: ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const res = http.get(`${BASE_URL}/json`);

  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  sleep(0.05);
}
