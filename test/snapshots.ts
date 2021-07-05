
import test from 'ava'
import fs from 'fs-extra'
import path from 'path'
import glob from 'fast-glob'
import { bundle } from './helpers/webpack.js'
import Plugin from './../dist/index.js'


const fixture = (...paths) => path.resolve(__dirname, './fixtures/', ...paths)


async function snapshot({ name = '', config = {} }) {
    test(name, async t => {

        if (!name) throw new Error('No name specified for snapshot')
        
        const outputDir = fixture('dist', name)

        const results = await bundle({
            output: {
                path: outputDir,
                filename: '[name].js',
            },
            ...config
        })

        const files = await glob(`${outputDir}/**/*`)

        const fileContents = await Promise.all(files.map(file => fs.readFile(file, 'utf8')))
        const fileEntries = Object.fromEntries(fileContents.map(
            (file, i) => [ 
                path.relative(outputDir, files[i]), 
                file
            ]
        ))

        t.snapshot(fileEntries)
    })   
}

snapshot({
    name: 'route-cjs',
    config: {
        plugins: [
            new Plugin({ 
                routes: fixture('route-cjs/template.js') 
            })
        ]
    }
})

snapshot({
    name: 'route-dynamic',
    config: {
        plugins: [
            new Plugin({ 
                routes: fixture('route-dynamic/template.js') 
            })
        ]
    }
})

snapshot({
    name: 'route-esm',
    config: {
        plugins: [
            new Plugin({ 
                routes: fixture('route-esm/template-*.js')
            })
        ]
    }
})

snapshot({
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
                routes: fixture('route-jsx/template-*.js') 
            })
        ]
    }
})