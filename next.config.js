/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'export', // <-- Cloudflare Pages ke liye ye line sabse zaroori hai
  eslint: {
    ignoreDuringBuilds: true, // Agar choti-moti warning hogi toh build fail nahi hone dega
  },
};

module.exports = nextConfig;