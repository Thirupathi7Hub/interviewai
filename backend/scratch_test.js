import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const key = process.env.NVIDIA_API_KEY;

async function testKey() {
  console.log('Testing NVIDIA key:', key ? `${key.slice(0, 15)}...` : 'NONE');
  if (!key) {
    console.error('❌ No NVIDIA_API_KEY found in backend/.env');
    return;
  }

  const model = process.env.NVIDIA_MODEL || 'meta/llama-3.2-11b-vision-instruct';
  console.log(`Testing model: ${model}`);

  try {
    const res = await axios.post(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        model: model,
        messages: [{ role: 'user', content: 'Say "NVIDIA is working!" in 3 words' }],
        max_tokens: 30,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('🎉 SUCCESS! Model response:', res.data.choices[0].message.content.trim());
  } catch (err) {
    console.error(`❌ FAILED with status ${err.response?.status}:`, err.response?.data || err.message);
  }
}

testKey();
