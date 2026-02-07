const OpenAI = require("openai");

const hasDedalus = !!process.env.DEDALUS_API_KEY;
const hasOpenAI = !!process.env.OPENAI_API_KEY;

const dedalus = hasDedalus
  ? new OpenAI({
      apiKey: process.env.DEDALUS_API_KEY,
      baseURL: process.env.DEDALUS_BASE_URL || "https://api.dedaluslabs.ai/v1",
    })
  : null;

const openai = hasOpenAI
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

module.exports = { dedalus, openai, hasDedalus, hasOpenAI };
