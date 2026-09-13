import os from 'os';
import type { NextConfig } from 'next';

function localDevOrigins() {
	const hosts = new Set(['localhost', '127.0.0.1']);

	for (const adapters of Object.values(os.networkInterfaces())) {
		for (const net of adapters ?? []) {
			if (net.family === 'IPv4' && !net.internal) {
				hosts.add(net.address);
			}
		}
	}

	return [...hosts];
}

const nextConfig: NextConfig = {
	allowedDevOrigins: localDevOrigins(),
};

export default nextConfig;
