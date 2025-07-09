const express = require('express');
const axios = require('axios');

class CircuitBreaker {
  constructor(name, requestFn, options = {}) {
    this.name = name;
    this.requestFn = requestFn;
    this.failureThreshold = options.failureThreshold || 3;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 10000;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }

  async call(...args) {
    console.log(`[${this.name}] Current state: ${this.state}`);

    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF';
        console.log(`[${this.name}] Timeout passed, transitioning to HALF-OPEN`);
      } else {
        console.log(`[${this.name}] Request blocked, circuit is OPEN`);
        throw new Error('Circuit is OPEN. Try later.');
      }
    }

    try {
      const response = await this.requestFn(...args);

      if (this.state === 'HALF') {
        this.successCount++;
        console.log(`[${this.name}] HALF-OPEN test success (${this.successCount}/${this.successThreshold})`);
        if (this.successCount >= this.successThreshold) {
          this.state = 'CLOSED';
          this.failureCount = 0;
          this.successCount = 0;
          console.log(`[${this.name}] Transitioning to CLOSED`);
        }
      }

      if (this.state === 'CLOSED') {
        this.failureCount = 0;
      }

      return response;
    } catch (err) {
      this.failureCount++;

      if (this.state === 'HALF') {
        this.state = 'OPEN';
        this.nextAttempt = Date.now() + this.timeout;
        this.successCount = 0;
        console.log(`[${this.name}] HALF-OPEN test failed, transitioning back to OPEN`);
      } else if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        this.nextAttempt = Date.now() + this.timeout;
        console.log(`[${this.name}] Failure threshold reached, transitioning to OPEN`);
      } else {
        console.log(`[${this.name}] Failure count: ${this.failureCount}/${this.failureThreshold}`);
      }

      throw err;
    }
  }
}

const breakerOptions = {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 5000,
};

const circuitMap = {
  'group1_api1': new CircuitBreaker('group1_api1', () => axios.get('https://httpstat.us/500'), breakerOptions),
  'group1_api2': new CircuitBreaker('group1_api2', () => axios.get('https://httpstat.us/503'), breakerOptions),
  'group2_api1': new CircuitBreaker('group2_api1', () => axios.get('https://jsonplaceholder.typicode.com/posts/1'), breakerOptions),
  'group2_api2': new CircuitBreaker('group2_api2', () => axios.get('https://jsonplaceholder.typicode.com/posts/2'), breakerOptions),
};

const app = express();
const PORT = 3000;

app.get('/group1/api1', async (req, res) => {
  try {
    const result = await circuitMap['group1_api1'].call();
    res.json({ status: result.status });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.get('/group1/api2', async (req, res) => {
  try {
    const result = await circuitMap['group1_api2'].call();
    res.json({ status: result.status });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.get('/group2/api1', async (req, res) => {
  try {
    const result = await circuitMap['group2_api1'].call();
    res.json(result.data);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.get('/group2/api2', async (req, res) => {
  try {
    const result = await circuitMap['group2_api2'].call();
    res.json(result.data);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
