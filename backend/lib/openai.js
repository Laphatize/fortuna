const OpenAI = require("openai");

const apiKey = process.env.DEDALUS_API_KEY || process.env.OPENAI_API_KEY;
const baseURL = process.env.DEDALUS_API_KEY ? "https://api.dedaluslabs.ai" : undefined;

const openai = new OpenAI({
  apiKey,
  baseURL,
});

module.exports = openai;
