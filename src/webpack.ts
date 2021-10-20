
import { staticGen } from './generate.js'
import path from 'path'
import glob from 'fast-glob'
import fs from 'fs-extra'
import { Compiler } from 'webpack'
import EntryPlugin from 'webpack/lib/EntryPlugin'


interface PluginOptions {
	routes: string|string[]
}

const PLUGIN_NAME = "ToastPlugin"

export default class ToastPlugin {

	private globs: string[]

	constructor({ routes = [] }: PluginOptions) {
		this.globs = [routes].flat()
	}

	absoluteRoutePaths(globs, relativeTo) {
		const results = globs.map(globPath => {
			const isRelative = !globPath.startsWith('/')
			const absoluteGlobPath = isRelative ? path.resolve(relativeTo, globPath) : globPath
			return glob.sync(absoluteGlobPath)
		})
		return results.flat()
	}

	apply(compiler: Compiler) {

		webpackEditConfiguration(compiler)

		// remove main entry if it's empty from config
		for (var name in compiler.options.entry) {
			const entry = compiler.options.entry[name]
			if (!Object.keys(entry).length) 
				delete compiler.options.entry[name]
		}

		// add template routes as new entry points
		const routes = this.absoluteRoutePaths(this.globs, compiler.context)
		routes.map(file => {
			new EntryPlugin(compiler.context, file, path.parse(file).name).apply(compiler)
		})

		// after emit, get entrypoint info and compile routes
		compiler.hooks.afterEmit.tapPromise(PLUGIN_NAME, async compilation => {
			
			const outputPath = compilation.outputOptions.path
			
			const allFiles = [ ...compilation.chunks ]
				.map(chunk => [ ...chunk.files, ...chunk.auxiliaryFiles ])
				.flat()
				.map(file => path.resolve(outputPath, file))

			const compiledFiles = allFiles.filter(name => /\.js(\.map)?$/.test(name))
			
			const entrypoints = Object.fromEntries(await Promise.all([...compilation.entrypoints.values()].map(async entry => {
				const chunk = entry.getEntrypointChunk()
				const origin = entry?.origins[0]?.request
				const files = [...chunk.files, ...chunk.auxiliaryFiles]
				const file = files.find(name => /\.js$/.test(name))
				const filepath = path.resolve(outputPath, file)
				return [origin, filepath]
			})))

			await staticGen(outputPath, entrypoints, compiledFiles, routes)
		})
	}
}

function webpackEditConfiguration(compiler: Compiler) {

	// use node target, or dynamic imports are included with script loader
	compiler.options.target = 'node'

	// change output to cjs-module format
	compiler.options.output.library = { 
		...compiler.options.output.library,
		type: 'commonjs-module',
	}

	compiler.options.output.globalObject = 'global'
	compiler.options.output.publicPath = ''
	compiler.options.optimization = {
		...compiler.options.optimization,
		mangleExports: false
	}
}
