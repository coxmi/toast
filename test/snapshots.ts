
import test from 'ava'
import fs from 'fs-extra'
import path from 'path'
import glob from 'fast-glob'
import { bundle } from './helpers/webpack.js'
import { WebpackToastPlugin } from './../dist/webpack.js'


const fixture = (...paths) => path.resolve(__dirname, './fixtures/', ...paths)


async function generate({ name = '', config = {} }) {

    if (!name) throw new Error('No output directory specified')

    const outputDir = fixture('dist', name)
    
    await fs.emptyDir(outputDir)

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

    return fileEntries
}


async function snapshot({ name = '', config = {} } : { name:string, config:any }) {
    // run webpack context from the fixture name
    config.context = fixture('dist/' + name)
    
    test(name, async t => {
         const fileEntries = await generate({ name, config })
        t.snapshot(fileEntries)
    })   
}


snapshot({
    name: 'route-assets',
    config: {
        module: {
            rules: [
                {
                    test: /\.(jpe?g|png|svg|gif|ico|eot|ttf|woff|woff2|mp4|pdf|webm|txt)$/,
                    type: 'asset/resource',
                    generator: {
                        filename: './static/[name].[hash][ext]'
                    }
                }
            ]
        },
        plugins: [
            new WebpackToastPlugin({ 
                templates: fixture('route-assets/*.js')
            })
        ]
    }
})

snapshot({
    name: 'route-cjs',
    config: {
        plugins: [
            new WebpackToastPlugin({ 
                templates: fixture('route-cjs/template.js') 
            })
        ]
    }
})

snapshot({
    name: 'route-context',
    config: {
        plugins: [
            new WebpackToastPlugin({ 
                templates: fixture('route-context/*.js') 
            })
        ]
    }
})

snapshot({
    name: 'route-dynamic',
    config: {
        plugins: [
            new WebpackToastPlugin({ 
                templates: fixture('route-dynamic/template.js') 
            })
        ]
    }
})

snapshot({
    name: 'route-esm',
    config: {
        plugins: [
            new WebpackToastPlugin({ 
                templates: fixture('route-esm/template-*.js')
            })
        ]
    }
})

snapshot({
    name: 'route-external',
    config: {
        plugins: [
            new WebpackToastPlugin({ 
                templates: fixture('route-external/*.js')
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
            new WebpackToastPlugin({ 
                templates: fixture('route-jsx/*-*.js') 
            })
        ]
    }
})

snapshot({
    name: 'route-paged',
    config: {
        plugins: [
            new WebpackToastPlugin({ 
                templates: fixture('route-paged/*.js') 
            })
        ]
    }
})