const nextConfig = {
    output: 'standalone',
    outputFileTracingExcludes: {
        '/*': ['./blog/**/*'],
    },
};

module.exports = nextConfig;
