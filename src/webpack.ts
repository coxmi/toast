
import { toast, toCompile } from './toast.js'
import path from 'path'
import glob from 'fast-glob'
import fs from 'fs-extra'
import { Compiler, Compilation } from 'webpack'
import EntryPlugin from 'webpack/lib/EntryPlugin'


const PLUGIN_NAME = 'WebpackToastPlugin'


interface PluginOptions {
	templates: string|string[],
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


function moduleDependencyIndex(compilation: Compilation) {
	
	const modules = compilation.getStats().toJson().modules
	const modulesById = {}
	const modulesByFullPath = {}
	const moduleDependencies = {}
	
	modules.filter(module => 
			module.id 
			&& module.nameForCondition
			&& module.name.substr(0, 1) === '.'
		)
		.map(module => {
			modulesById[module.id] = module
			modulesByFullPath[module.nameForCondition] = module
			module.reasons.map(reason => {
				if (!reason.moduleId) return
				if (!moduleDependencies[reason.moduleId]) moduleDependencies[reason.moduleId] = {}
				moduleDependencies[reason.moduleId][module.id] = true
			})
		})

	const traverse = (id, processed = {}) => {
		if (!id || processed[id]) return {}
		processed[id] = true
		const ids = Object.keys(moduleDependencies[id] || {})
		ids.map(id => {
			processed = { ...processed, ...traverse(id, processed) }
		})
		return processed
	}

	const list = path => {
		const id = modulesByFullPath[path]?.id
		return Object.keys(traverse(id)).map(id => modulesById[id].nameForCondition)
	}

	return { list }
}


export class WebpackToastPlugin {

	private globs: string[]
	private cache: boolean

	constructor({ templates = [], cache = true }: PluginOptions) {
		this.globs = [templates].flat()
		this.cache = Boolean(cache)
	}

	apply(compiler: Compiler) {

		webpackEditConfiguration(compiler)
		
		const templates = absolutePaths(this.globs, compiler.context)
		if (!templates.length) 
			throw new Error(`No templates found using: ${this.globs.join(', ')}`)
		
		// only send uncached routes off to webpack, unless we're in watch mode
		const watching = compiler.options.watch || compiler.watchMode || false
		const { toCompilePaths, cached, cachedDependencies } = toCompile(templates, watching || !this.cache)
		webpackAddEntrypoints(toCompilePaths, compiler)
		
		compiler.hooks.afterEmit.tapPromise(PLUGIN_NAME, async compilation => {
			const outputDir = compilation.outputOptions.path
			const entrypoints = [...compilation.entrypoints.values()]
			const dependencyIndex = moduleDependencyIndex(compilation)
			
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
				const deps = dependencyIndex.list(origin)
				return [origin, deps]
			}))

			const entries = { ...cached, ...compiled }
			const deps = { ...cachedDependencies, ...dependencies }
			await toast(outputDir, entries, deps)
		})
	}
}
