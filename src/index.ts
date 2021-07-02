
import path from 'path'
import glob from 'fast-glob'
import { Compiler } from 'webpack'
import EntryPlugin from 'webpack/lib/EntryPlugin.js'


const PLUGIN_NAME = "StaticSitePlugin"


function webpackEditConfiguration(compiler: Compiler) {
	// change output to module format because 
	// we need to import the compiled files later
	compiler.options.output.library = { 
		...compiler.options.output.library,
		type: 'module' 
	}
	compiler.options.experiments = {
		...compiler.options.experiments,
		outputModule : true
	}
	compiler.options.output.globalObject = 'global'
	compiler.options.output.publicPath = ''
	compiler.options.optimization = {
		...compiler.options.optimization,
		mangleExports: false
	}
}

async function webpackInfoAfterEmit(compiler: Compiler): Promise<Record<string,any>> {
	return await new Promise((resolve, reject) => {
		compiler.hooks.afterEmit.tap(PLUGIN_NAME, compilation => {
			resolve({
				entrypoints : [...compilation.entrypoints.values()].map(entrypoint => {
					const chunk = entrypoint.getEntrypointChunk()
					return {
						chunk,
						files : [...chunk.files, ...chunk.auxiliaryFiles],
						origin : entrypoint?.origins[0]?.request,
					}
				}),
				modules : compilation.modules,
				outputPath : compilation.outputOptions.path,
			})
		})
	})
}

async function webpackCompiledRoutes(entrypoints, outputPath: string, absoluteRoutePaths: string[]) {
	return Object.fromEntries(await Promise.all(
		entrypoints
			.filter(entry => absoluteRoutePaths.includes(entry.origin))
			.map(async entry => {
				const file = entry.files.find(name => /\.js$/.test(name))
				const filepath = path.resolve(outputPath, file)
				if (!filepath) throw new Error(`Path to "${outputPath}" could not be resolved`)
				entry.compiled = await import(filepath)
				return [entry.chunk.id, entry]
			})
	))
}


export default class StaticSitePlugin {

	private absoluteRoutePaths: string[]

	constructor(options: { routes: string }) {
		this.absoluteRoutePaths = options.routes ? glob.sync(options.routes) : []
	}

	async apply(compiler: Compiler) {

		webpackEditConfiguration(compiler)

		// add template routes as new entry points
		this.absoluteRoutePaths.map(file => {
			new EntryPlugin(compiler.context, file, path.parse(file).name).apply(compiler)
		})

		const { entrypoints, outputPath } = await webpackInfoAfterEmit(compiler)
		const compiledRoutes = await webpackCompiledRoutes(entrypoints, outputPath, this.absoluteRoutePaths)

		// TODO: render compiled routes
	}
}