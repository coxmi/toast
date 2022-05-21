
const webpack = require('webpack')
const path = require('path')
const Plugin = require('./../../dist/webpack.js').WebpackToastPlugin


const fixture = (...paths) => path.resolve(__dirname, './../fixtures/', ...paths)

function watch({ name, config }) {
    
    const outputDir = fixture('dist', name)

    compiler = webpack({
        mode: 'development',
        devtool: 'source-map',
        watch: true,
        context: outputDir,
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
    })
}

watch({
    name: 'route-dynamic',
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
                templates: fixture('route-dynamic/template.js') 
            })
        ]
    }
})