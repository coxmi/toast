
import webpack from 'webpack'

export async function bundle(config = {}) {

    const compiler = webpack({
        mode: 'development',
        devtool: 'source-map',
        stats: {
            all: false,
            assets: true,
            assetsSort: '!size',
            assetsSpace: 10,
            relatedAssets: false,
            cachedAssets: false,
            errors: true
        },
        ...config
    })

    return await new Promise((resolve, reject) => {
        compiler.run((err, stats) => {
            if (err) return reject(err)
            if (stats.compilation.errors.length) return reject(stats.compilation.errors[0].message)
            resolve(stats.compilation.chunks)
        })
    })
}

