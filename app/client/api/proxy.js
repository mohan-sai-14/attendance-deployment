import axios from 'axios';

export default async function handler(req, res) {
  const backendUrl = 'https://attendance-backend-00pc.onrender.com';
  const path = req.url; // Already contains /api/...
  const targetUrl = `${backendUrl}${path}`;
  
  console.log(`Proxying ${req.method} ${path} to ${targetUrl}`);

  try {
    const config = {
      method: req.method,
      url: targetUrl,
      headers: { ...req.headers },
      data: req.body,
      params: req.query,
      validateStatus: () => true, // Forward all status codes
    };

    // Remove host header to avoid conflicts
    delete config.headers.host;

    const response = await axios(config);

    // Forward headers from backend to frontend
    Object.entries(response.headers).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    });

    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).json({ 
      error: 'Backend Proxy Error', 
      message: error.message,
      target: targetUrl 
    });
  }
}
