import axios from 'axios';

export default async function handler(req, res) {
  const backendUrl = 'https://attendance-backend-00pc.onrender.com';
  const apiPath = req.query.path || '';
  const targetUrl = `${backendUrl}/api/${apiPath}`;
  
  console.log(`Proxying ${req.method} /api/${apiPath} to ${targetUrl}`);

  try {
    const config = {
      method: req.method,
      url: targetUrl,
      headers: { ...req.headers },
      data: req.body,
      params: req.query,
      validateStatus: () => true, // Forward all status codes
    };

    // Remove headers that might conflict or be incorrect for the proxy request
    delete config.headers.host;
    delete config.headers['content-length'];

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
