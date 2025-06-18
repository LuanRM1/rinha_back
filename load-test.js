import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "5s", target: 500 }, // Quick ramp to 500 in 5s
    { duration: "10s", target: 1000 }, // Hit 1000 in next 10s
  ],
  thresholds: {
    errors: ["rate<0.1"], // Error rate should be less than 10%
    http_req_duration: ["p(95)<2000"], // 95% of requests should be below 2s
  },
  userAgent: "K6LoadTest/1.0",
  maxRedirects: 0,
  noConnectionReuse: false,
  batch: 20, // Increased batch for short test
  batchPerHost: 20,
  insecureSkipTLSVerify: true,
};

const BASE_URL = "http://localhost:9999";

// Gera um ID de cliente aleatório entre 1 e 5
function getRandomClientId() {
  return Math.floor(Math.random() * 5) + 1;
}

// Gera um valor de transação aleatório entre 1 e 9999
function getRandomTransactionValue() {
  return Math.floor(Math.random() * 9999) + 1;
}

function getRandomTransactionType() {
  // Garantindo que seja 'c' ou 'd'
  return Math.random() < 0.5 ? "c" : "d";
}

function makeRequest(method, url, body = null) {
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: "10s",
    tags: { name: url.split("/").slice(-2).join("/") },
  };

  let response;
  try {
    if (method === "GET") {
      response = http.get(url, params);
    } else {
      response = http.post(url, body, params);
    }

    // Retry once on connection errors
    if (response.status === 0) {
      sleep(0.5); // Wait 500ms before retry
      if (method === "GET") {
        response = http.get(url, params);
      } else {
        response = http.post(url, body, params);
      }
    }

    return response;
  } catch (e) {
    console.error(`Request failed: ${e.message}`);
    return null;
  }
}

export default function () {
  const clientId = getRandomClientId();

  // Test GET /clientes/{id}/extrato
  const extratoRes = makeRequest(
    "GET",
    `${BASE_URL}/clientes/${clientId}/extrato`
  );

  if (!extratoRes) {
    errorRate.add(1);
    return;
  }

  const extratoChecks = check(extratoRes, {
    "extrato status is 200": (r) => r.status === 200,
    "response is valid JSON": (r) => {
      try {
        const data = JSON.parse(r.body);
        return (
          data.saldo &&
          typeof data.saldo.total === "number" &&
          typeof data.saldo.limite === "number" &&
          data.saldo.data_extrato &&
          "ultimas_transacoes" in data
        );
      } catch (e) {
        if (r.status !== 0) {
          // Ignore connection errors
          console.error(`Invalid JSON response: ${r.body}`);
        }
        return false;
      }
    },
  });

  if (!extratoChecks && extratoRes.status !== 0) {
    console.error(
      `Failed extrato request for client ${clientId}. Status: ${extratoRes.status}, Body: ${extratoRes.body}`
    );
    errorRate.add(1);
  }

  let saldoAtual = 0;
  let limiteAtual = 0;

  try {
    if (extratoRes.status === 200) {
      const data = JSON.parse(extratoRes.body);
      saldoAtual = data.saldo.total;
      limiteAtual = data.saldo.limite;
    }
  } catch (e) {
    // Ignore parsing errors here
  }

  const valor = getRandomTransactionValue();
  const tipo = getRandomTransactionType();

  if (tipo === "d" && saldoAtual - valor < -limiteAtual) {
    return; // Skip debit if insufficient funds
  }

  const payload = JSON.stringify({
    valor: valor,
    tipo: tipo,
    descricao: "TX" + valor.toString().padStart(8, "0"),
  });

  const transacaoRes = makeRequest(
    "POST",
    `${BASE_URL}/clientes/${clientId}/transacoes`,
    payload
  );

  if (!transacaoRes) {
    errorRate.add(1);
    return;
  }

  const transacaoChecks = check(transacaoRes, {
    "transacao status is 200 or 422": (r) =>
      r.status === 200 || r.status === 422,
    "response has limite and saldo when 200": (r) => {
      if (r.status !== 200) return true;
      try {
        const data = JSON.parse(r.body);
        return data.limite !== undefined && data.saldo !== undefined;
      } catch (e) {
        if (r.status !== 0) {
          console.error(`Invalid JSON response: ${r.body}`);
        }
        return false;
      }
    },
  });

  if (!transacaoChecks && transacaoRes.status !== 0) {
    console.error(
      `Failed transacao request for client ${clientId}. Status: ${transacaoRes.status}, Body: ${transacaoRes.body}`
    );
    errorRate.add(1);
  }

  sleep(0.01); // Minimal sleep for aggressive test
}
