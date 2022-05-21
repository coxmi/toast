
const path = require('path')
const Plugin = require('./../../dist/webpack.js').WebpackToastPlugin
const fixture = (...paths) => path.resolve(__dirname, './../fixtures/', ...paths)

const name = 'route-dynamic'
const outputDir = fixture('dist', name)

module.exports = {
    mode: 'development',
    devtool: 'source-map',
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
            pages: fixture('route-dynamic/template.js') 
        })
    ]
}