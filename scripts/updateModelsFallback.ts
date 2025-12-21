import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_API_URL = 'https://models.dev/api.json';
const OUTPUT_PATH = path.join(__dirname, '../src/config/modelsFallback.json');

const allowedProviders = [
  'openai',
  'anthropic',
  'openrouter',
  'xai',
  'mistralai',
  'ollama-cloud'
];

async function updateFallbackData() {
  try {
    console.log('Fetching models from models.dev...');
    const response = await fetch(MODELS_API_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const data: Record<string, unknown> = await response.json();

    const filteredData: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      if (allowedProviders.includes(key)) {
        filteredData[key] = data[key];
      }
    }

    console.log('Writing filtered fallback data to', OUTPUT_PATH);
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(filteredData, null, 2));

    console.log('Fallback data updated successfully!');
    console.log(`Providers included: ${Object.keys(filteredData).length}`);
  } catch (error) {
    console.error('Error updating fallback data:', error);
    process.exit(1);
  }
}

updateFallbackData();