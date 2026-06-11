import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find projects.json by traversing parent dirs
let defaultHost = '10.0.0.16';
try {
  let curr = __dirname;
  for (let i = 0; i < 5; i++) {
    const p1 = path.join(curr, 'vault-service', 'projects.json');
    if (fs.existsSync(p1)) {
      const data = JSON.parse(fs.readFileSync(p1, 'utf8'));
      if (data.defaultHost) defaultHost = data.defaultHost;
      break;
    }
    const p2 = path.join(curr, 'projects.json');
    if (fs.existsSync(p2)) {
      const data = JSON.parse(fs.readFileSync(p2, 'utf8'));
      if (data.defaultHost) defaultHost = data.defaultHost;
      break;
    }
    curr = path.dirname(curr);
  }
} catch (e) {
  // Fallback
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Proxy API requests to trading-service and supporting services
  async rewrites() {
    return [
      // Agent registry (prism-service port 3031)
      {
        source: '/api/v1/agents',
        destination: `http://${defaultHost}:3031/api/v1/agents`,
      },
      {
        source: '/api/v1/agents/:path*',
        destination: `http://${defaultHost}:3031/api/v1/agents/:path*`,
      },
      {
        source: '/api/v1/agent-tools',
        destination: `http://${defaultHost}:3031/api/v1/agent-tools`,
      },
      {
        source: '/api/v1/agent-tools/:path*',
        destination: `http://${defaultHost}:3031/api/v1/agent-tools/:path*`,
      },
      // Piper TTS (port 3032)
      {
        source: '/api/v1/tts/:path*',
        destination: `http://${defaultHost}:3032/api/v1/tts/:path*`,
      },
      // Trading-service backend API (port 8888 inside trading-client container = exposed on 8888)
      {
        source: '/api/:path*',
        destination: `http://${defaultHost}:8888/api/:path*`,
      },
      // Prism-service direct API (port 7777)
      {
        source: '/prism-api/:path*',
        destination: (process.env.PRISM_URL || `http://${defaultHost}:7777`) + '/:path*',
      },
    ];
  },

  allowedDevOrigins: [
    `http://${defaultHost}:3035`,
    defaultHost,
    `http://${defaultHost}`,
    'http://10.0.0.103:3035',
    '10.0.0.103',
  ],

  webpack(config) {
    config.module.rules.push({
      test: /\.(glb|gltf|mp3)$/,
      type: 'asset/resource',
    });
    return config;
  },
  turbopack: {
    rules: {
      '.glb': { as: 'resource' },
      '.gltf': { as: 'resource' },
      '.mp3': { as: 'resource' },
    },
  },
};

export default nextConfig;
