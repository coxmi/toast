
import { toast, toCompile } from './index.js'
import path from 'path'
import glob from 'fast-glob'
import fs from 'fs-extra'
import { Compiler } from 'webpack'
import EntryPlugin from 'webpack/lib/EntryPlugin'


const PLUGIN_NAME = 'WebpackToastPlugin'


interface PluginOptions {
	pages: string|string[],
	cache?: boolean
}


function webpackEditConfiguration(compiler: Compiler): void {

	// remove main entry if it's empty from config
	for (const name in compiler.options.entry) {
		const entry = compiler.options.entry[name]
		if (!Object.keys(entry).length) 
			delete compiler.options.entry[name]
	}

	// put all js output in a cache directory
	const filename = compiler.options.output.filename || '[name].js'
	const pathToContext = (path.relative(compiler.options.output.path, compiler.context) || '.')
	compiler.options.output.filename = `${pathToContext}/.cache/${filename}`

	// fix sourcemaps
	compiler.options.output.devtoolModuleFilenameTemplate = '[absolute-resource-path]'

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
		mangleExports: false,
		minimize: false,
	}
}


function webpackAddEntrypoints(entrypoints: string[], compiler: Compiler): void {
	entrypoints.map(file => {
		new EntryPlugin(compiler.context, file, path.parse(file).name).apply(compiler)
	})
}


function absolutePaths(globs: string[], relativeTo: string): string[] {
	const results = globs.map(globPath => {
		const isRelative = !globPath.startsWith('/')
		const absoluteGlobPath = isRelative ? path.resolve(relativeTo, globPath) : globPath
		return glob.sync(absoluteGlobPath)
	})
	return results.flat()
}


export class WebpackToastPlugin {

	private globs: string[]
	private cache: boolean

	constructor({ pages = [], cache = true }: PluginOptions) {
		this.globs = [pages].flat()
		this.cache = Boolean(cache)
	}

	apply(compiler: Compiler) {

		webpackEditConfiguration(compiler)
		
		const pages = absolutePaths(this.globs, compiler.context)
		if (!pages.length) 
			throw new Error(`No templates found using: ${this.globs.join(', ')}`)
		
		// only send uncached routes off to webpack, unless we're in watch mode
		const watching = compiler.options.watch || compiler.watchMode || false
		const { toCompilePaths, cached, cachedDependencies } = toCompile(pages, watching || !this.cache)
		webpackAddEntrypoints(toCompilePaths, compiler)
		
		compiler.hooks.afterEmit.tapPromise(PLUGIN_NAME, async compilation => {

			const outputDir = compilation.outputOptions.path
			const entrypoints = [...compilation.entrypoints.values()]
			
			const compiled = Object.fromEntries(entrypoints.map(entry => {
				const chunk = entry.getEntrypointChunk()
				const origin = entry?.origins[0]?.request
				const files = [...chunk.files, ...chunk.auxiliaryFiles]
				const file = files.find(name => /\.js$/.test(name))
				const compiledPath = path.resolve(outputDir, file)
				return [origin, compiledPath]
			}))

			const dependencies = Object.fromEntries(entrypoints.map(entry => {
				const chunk = entry.getEntrypointChunk()
				const origin = entry?.origins[0]?.request
				const modules = compilation.chunkGraph.getChunkModules(chunk)
				const deps = modules
					// @ts-ignore (userRequest not in webpack Module type)
					.map(module => module.userRequest)
					.filter(moduleId => fs.pathExistsSync(moduleId))

				return [origin, deps]
			}))

			const entries = { ...cached, ...compiled }
			const deps = { ...cachedDependencies, ...dependencies }
			await toast(outputDir, entries, deps)
		})
	}
}
