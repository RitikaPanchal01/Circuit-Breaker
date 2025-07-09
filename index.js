const express = require('express');
const axios = require('axios');
const CircuitBreaker = require('./circuitbreaker');

const app = express();
const PORT = 3000;

const failingApiCall = () => axios.get('https://httpstat.us/500');

const breaker = new CircuitBreaker(failingApiCall, {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 5000,
});

app.get('/call', async (req, res) => {
  try {
    const result = await breaker.call();
    res.status(200).json({ status: result.status, data: result.data });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
