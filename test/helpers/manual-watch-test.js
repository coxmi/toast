
const webpack = require('webpack')
const path = require('path')
const Plugin = require('./../../dist/index.js').default

const fixture = (...paths) => path.resolve(__dirname, './../fixtures/', ...paths)

function watch({ name, config }) {
    const outputDir = fixture('dist', name)
    webpack({
        mode: 'development',
        devtool: 'source-map',
        watch: true,
        stats: {
            all: false,
            assets: true,
            assetsSort: '!size',
            assetsSpace: 10,
            relatedAssets: false,
            cachedAssets: false,
            errors: true
        },
        output: {
            path: outputDir,
            filename: '[name].js',
        },
        ...config
    }).watch({}, (err, stats) => {})
}

watch({
    name: 'route-jsx',
    config: {
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    loader: 'babel-loader'
                }
            ]
        },
        plugins: [
            new Plugin({ 
                pages: fixture('route-jsx/template-*.js') 
            })
        ]
    }
})