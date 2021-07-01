
import test from 'ava'
import webpack from 'webpack'
import glob from 'fast-glob'
import fs from 'fs-extra'
import path from 'path'
import Plugin from './../lib/index.js'


const dir = path.dirname(import.meta.url.replace(/^file:\/\//, ''))
const fixture = input => path.resolve(dir, './fixtures', input)


const config = {
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
	}
}


export function bundle(entryPath = '', outputDir = '', pluginOptions = {}) {

	const compiler = webpack({
		...config,
		entry: entryPath,
	  	output: {
			path: outputDir,
			filename: '[name].js',
	  	},
		plugins : [new Plugin(pluginOptions)]
	})

	return new Promise((resolve, reject) => {
		compiler.run((err, stats) => {
			if (err) return reject(err)
			if (stats.compilation.errors.length) return reject(stats.compilation.errors)
			resolve(stats.compilation.chunks)
		})
	})	
}


const snapshot = async (name = '', input = './index.js', pluginOptions) => {

	if (!name) return false
	const inputPath = fixture(`${name}/${input}`)
    const outputDir = fixture(`dist/${name}`)

    await bundle(inputPath, outputDir, pluginOptions)
    const files = await glob(`${outputDir}/**/*`)
    const fileContents = await Promise.all(files.map(file => fs.readFile(file, 'utf8')))

    return Object.fromEntries(fileContents.map(
        (file, i) => [ 
            path.relative(outputDir, files[i]), 
            file 
        ]
    ))
}

const snapshots = (configs = []) => {
    for (const config of configs) {
        if (!config.name) throw new Error('No "name" provided for snapshot')
        if (!config.input) throw new Error('No "input" provided for snapshot')
        if (!config.pluginOptions) throw new Error('No "pluginOptions" provided for snapshot')
       
        test(config.name, async t => {
            const files = await snapshot(
                config.name, 
                config.input, 
                config.pluginOptions
            )
            t.snapshot(files)
        })
    }
}


snapshots([
    {
        name : 'esmodules',
        input : 'index.js',
        pluginOptions : {}
    }
])