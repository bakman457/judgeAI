const endpoint = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
const apiKey = 'sk-e1d320343fac4883a60841aceeb76e9b';
const largePrompt = 'A'.repeat(50000);
const payload = {
  model: 'qwen-coder-plus',
  temperature: 0.2,
  messages: [
    { role: 'system', content: 'You are a legal assistant.' },
    { role: 'user', content: largePrompt },
  ],
};
console.log('Payload size:', JSON.stringify(payload).length);
try {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + apiKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text.slice(0, 200));
} catch (e) {
  console.log('ERROR:', e.message, e.cause?.code);
}
