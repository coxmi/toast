
import path from 'path'
import glob from 'fast-glob'
import fs from 'fs-extra'
import { Compiler } from 'webpack'
import EntryPlugin from 'webpack/lib/EntryPlugin'

const PLUGIN_NAME = "StaticSitePlugin"


const entryName = file => path.basename(file, path.extname(file))


function webpackEditConfiguration(compiler: Compiler) {
	// change output to module format because 
	// we need to import the compiled files later
	// compiler.options.output.library = { 
	// 	...compiler.options.output.library,
	// 	type: 'module' 
	// }
	// compiler.options.experiments = {
	// 	...compiler.options.experiments,
	// 	outputModule : true
	// }
	compiler.options.output.globalObject = 'global'
	compiler.options.output.publicPath = ''
	// compiler.options.optimization = {
	// 	...compiler.options.optimization,
	// 	mangleExports: false
	// }
}

async function webpackCompiledRoutes(entrypoints, outputPath: string, absoluteRoutePaths: string[]) {
	return Object.fromEntries(await Promise.all(
		entrypoints
			.filter(entry => absoluteRoutePaths.includes(entry.origin))
			.map(async entry => {
				const file = entry.files.find(name => /\.js$/.test(name))
				const filepath = path.resolve(outputPath, file)
				if (!filepath) throw new Error(`No module found at "${filepath}"`)
				// compile and remove from outputDir
				// entry.compiled = await import(filepath)
				// await fs.remove(filepath)
				// await fs.remove(`${filepath}.map`)
				return [entry.chunk.id, entry]
			})
	))
}


interface PluginOptions {
	routes: string|string[]
}


export default class StaticSitePlugin {

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
		compiler.hooks.afterEmit.tapPromise(PLUGIN_NAME, async (compilation) => {
			const stats = compilation.getStats().toJson()
			const entrypoints = [...compilation.entrypoints.values()].map(entrypoint => {
				const chunk = entrypoint.getEntrypointChunk()
				return {
					chunk,
					files : [...chunk.files, ...chunk.auxiliaryFiles],
					origin : entrypoint?.origins[0]?.request,
				}
			})
			const modules = compilation.modules
			const outputPath = compilation.outputOptions.path
			const compiledRoutes = await webpackCompiledRoutes(entrypoints, outputPath, routes)

			console.log(compiledRoutes)
		})
	}
}