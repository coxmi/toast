import 'source-map-support/register'
import path from 'path'
import fs from 'fs-extra'
import clearModule from 'clear-module'
import { getErrorSource } from 'source-map-support'
import { getRequestContext, updateRequestContext, cleanContext } from 'async-hooks-context'
import { createFile, canWrite } from './files.js'
import { createCache, CacheType } from './cache.js'
import { filehash, filehashSync, fileExists, sha1, regexes, isFunction, isIterable, isArray, chunkArray, trailing } from './util.js'


const CACHE_KEY = 'toast'


type EntryMap = StringMap | string[]

type CacheMap = {
	[key: string]: true|undefined
}

type DependencyMap = {
	[key: string]: string[]
}

type ToCompile = {
	toCompilePaths : string[], 
	cached : EntryMap,
	cachedDependencies : DependencyMap
}

type Template = {
	origin : string,
	importPath : string,
	dependencies : string[],
	dependenciesHashed : StringMap,
	compiled? : any,
	valid? : boolean,
	userData? : any
}

type RenderFunction = (content: {}, meta : {}) => string | Promise<string>

type Index = {
	add: (key: string, value?: any) => void,
	all: () => { [key: string]: string },
	entries : () => Array<[string, string]>,
	duplicates: () => string[],
}

type ErrorLog = {
	log: (error: Error) => void,
	check: () => void
}


export function context() {
	return global.__toast__context()
}


export async function toast(outputDir: string, entries: EntryMap, dependencies?: DependencyMap) {

	// TODO – hooks:
	// beforeSingle
	// single
	// beforeCollection
	// collection
	// url
	// beforeHtml
	// html
	// e.g.
	// const doSingle = applyHook('beforeSingle', true)
	// const doCollection = applyHook('beforeCollection', true)

	global.__toast__context = () => getRequestContext()

	const isEntryMap = !Array.isArray(entries)
	const entrypoints: string[] = isEntryMap ? Object.keys(entries) : [...entries]
	
	const templates: Template[] = entrypoints.map(entrypoint => ({
		origin : entrypoint,
		importPath: isEntryMap ? entries[entrypoint] : entrypoint,
		dependencies: dependencies[entrypoint] || [],
		dependenciesHashed : undefined,
		compiled : undefined,
		valid : undefined,
		userData : undefined
	}))

	const cache: CacheType = createCache(CACHE_KEY)
	const pageIndex: Index = createIndex()
	const errorLog: ErrorLog = createErrorLog()
	const parallel = createParallel(errorLog, templates)
	
	// main process:
	// hashDependencies
	// importTemplate
	// gatherUserTemplateData
	// generatePages
	// checkForDuplicates
	// outputDryRun
	// outputFiles

	// TODO:
	// cacheOutputFileLocations

	await parallel(template => hashDependencies(template))
	await parallel(template => importTemplate(template))
	await parallel(template => gatherUserTemplateData(template))
	await parallel(template => generatePages(template, outputDir, pageIndex))

	try {
		await checkForDuplicates(pageIndex)
		await outputDryRun(pageIndex, outputDir)
		const rendered: string[] = await outputFiles(pageIndex, outputDir)
		consoleRendered(rendered, outputDir)

	} catch(error) {
		errorLog.log(error)
		errorLog.check()
		return false
	}

	await parallel(template => cacheDependencyHashes(template, cache))
	return true
}


export function toCompile(entrypoints: string[], forceAll: boolean = false) : ToCompile {

	const toCompilePaths: string[] = []
	const cached: EntryMap = {}
	const cachedDependencies: DependencyMap = {}
	
	entrypoints.forEach(origin => {

		if (forceAll) return toCompilePaths.push(origin)

		const cache = getCache(origin)
		if (!cache) return toCompilePaths.push(origin)

		const deps = cache?.dependenciesHashed
		const importPath = cache?.importPath
		
		if (!deps || !Object.keys(deps).length)	return toCompilePaths.push(origin)

		const matches = Object.keys(deps).map(path => (filehashSync(path) === deps[path]))
		const changed = (matches.filter(Boolean).length !== matches.length)
		const exists = fileExists(importPath)

		if (changed || !exists) return toCompilePaths.push(origin)

		cached[origin] = importPath
		cachedDependencies[origin] = deps && Object.keys(deps) || []
	})

	return { 
		toCompilePaths, 
		cached,
		cachedDependencies
	}
}


function createParallel(errorLog: ErrorLog, array: any[]) {
	let state = array

	return async function (fn): Promise<any[]> {
		const processor = withErrorHandling(fn)
		state = await Promise.all(state.map(processor))
		errorLog.check()
		return state
	}

	function withErrorHandling(fn) {
		return async (...args) => {
			try {
				return await fn(...args)
			} catch (error) {
				errorLog.log(error)
			}
		}
	}
}


function createErrorLog(): ErrorLog {

	let duplicateErrors: CacheMap = {}
	let errors: Error[] = []

	function log(error: Error): void {
		const id = sha1(error.message)
		if (!duplicateErrors.hasOwnProperty(id)) {
			duplicateErrors[id] = true
			errors.push(error)
		}
	}

	function outputError(error: Error): void {
		const source = getErrorSource(error)
		if (source) {
			console.error()
			console.error(source)
		}
		console.error(error.stack)
	}

	function check(): void {
		// outputt multiple error messages before
		// throwing blank error to halt parent processes
		const error = new Error()
		error.stack = ''

		if (errors.length === 1) {
			outputError(errors[0])
			throw error
		}
		if (errors.length) {
			errors.map(error => outputError)
			throw error
		}
	}

	return { log, check }
}


function createIndex(): Index {

    const index: StringMap = {}
    const duplicates: string[] = []
    const duplicateMap: CacheMap = {}

    const add = (key: string, value: string): void => {
    	if (duplicateMap[key]) duplicates.push(key)
    	duplicateMap[key] = true
    	index[key] = value
    }

    return {
    	add : add,
    	all : () => index,
    	entries : () => Object.entries(index),
        duplicates : () => duplicates,
    }
}


async function hashDependencies(template: Template): Promise<Template> {	
	const promises = template.dependencies.map(async path => {
	    const hash: string|null = await filehash(path)
	    return [path, hash]
	})
	const entries = (await Promise.all(promises)).filter(([_, hash]) => !!hash)
	const hashes = Object.fromEntries(entries)
	template.dependenciesHashed = hashes
	return template
}


async function cacheDependencyHashes(template: Template, cache: CacheType) : Promise<Template> {
	await cache.set(template.origin, {
		origin : template.origin,
		importPath : template.importPath,
		dependenciesHashed : template.dependenciesHashed
	})
	return template
}


function getCache(origin: string) {
	const cache: CacheType = createCache(CACHE_KEY)
	const object = cache.getSync(origin)
	return object
}

function clearCache() {
	const cache: CacheType = createCache(CACHE_KEY)
	cache.clear()
}


async function importTemplate(template: Template): Promise<Template> {
	const exists = await fs.pathExists(template.importPath)
	if (!exists) throw new Error(`No module found at "${template.importPath}"`)

	clearModule(template.importPath)
	const compiled = await import(template.importPath)
	const invalidations = invalidateTemplate(compiled)

	template.compiled = compiled
	template.valid = !invalidations.length
	if (!template.valid)
		throw new Error(`${template.origin}: ${invalidations.join(', ')}`)

	return template
}


function invalidateTemplate(compiled: any): string[] {

	const { html, url, single, collection, perPage } = compiled
	
	const messages = []

	const hasCollectionProp = collection !== undefined
	const isStringUrl = typeof url === 'string'

	if (html === undefined) 
		messages.push(`ensure 'html' function is exported`)

	if (url === undefined) 
		messages.push(`ensure 'url' string or function is exported`)

	if ((html === undefined || url === undefined) && messages.length) 
		return messages

	if (!isFunction(html)) 
		messages.push(`export 'html' must be of type function`)

	if (!(isFunction(url) || typeof url === 'string'))
		messages.push(`export 'url' must be of type function or string`)

	if (hasCollectionProp && isStringUrl)
		messages.push(`export 'url' must be a function when using a collection`)

	if (perPage !== undefined && typeof perPage !== 'number')
		messages.push(`export 'perPage' must be a positive number`)

	if (typeof perPage === 'number' && perPage <= 0)
		messages.push(`export 'perPage' must be positive`)

	return messages
}


async function gatherUserTemplateData(template: Template): Promise<Template> {

	const compiled: { collection: any, content: any} = template.compiled
	const hasCollectionProp = compiled.hasOwnProperty('collection')
		
	const [collection, content] = await Promise.all([
		fn(compiled.collection)() ?? undefined, 
		fn(compiled.content)() ?? undefined
	])

	if (hasCollectionProp && !isIterable(collection))
		throw new Error(`${template.origin}: value returned from 'collection' must be iterable`)

	template.userData = { collection, content }
	return template
}


async function generatePages(template: Template, outputDir: string, pageIndex: Index) {
		
	const { compiled, userData } = template
	const { collection, content } = template.userData

	const hasSingleProp = compiled?.hasOwnProperty('content')
	const hasCollectionProp = compiled?.hasOwnProperty('collection')
	const hasPerPageProp = compiled?.hasOwnProperty('perPage')
	const isStringUrl = typeof compiled.url === 'string'
	const isFunctionUrl = isFunction(compiled.url)
	const isBasic = isStringUrl || (!hasSingleProp && !hasCollectionProp && isFunctionUrl)
	
	const fnUrl = fn(compiled.url)
	const fnHtml = fn(compiled.html)
	const perPage = compiled.perPage

	if (isBasic || hasSingleProp) {
		const [url, page] = await generatePage(outputDir, fnUrl, fnHtml, content, {
			index : null,
			items : null,
			total : null,
			...pageVars()
		})
		pageIndex.add(url, page)
	}

	if (isIterable(collection) && !hasPerPageProp) {
		await Promise.all([...collection].map(async (item, index, collection) => {
			const [url, page] = await generatePage(outputDir, fnUrl, fnHtml, item, {
				index : index,
				items : collection,
				total : collection.length,
				...pageVars()
			})
			pageIndex.add(url, page)
		}))
	}

	if (isIterable(collection) && hasPerPageProp) {
		const chunk = chunkArray(collection, perPage)
		await Promise.all(chunk.map(async (chunk, chunkIndex) => {
			const [url, page] = await generatePage(outputDir, fnUrl, fnHtml, chunk, {
				index : null,
				items : collection,
				total : collection.length,
				...pageVars(chunkIndex, perPage, collection.length)
			})
			pageIndex.add(url, page)
		}))
	}

	return template
}


async function generatePage(outputDir: string, fnUrl: RenderFunction, fnHtml: RenderFunction, content = {}, meta = {}) : Promise<[string, string]> {

    const urlMeta = Object.freeze({
        url : undefined,
        output : undefined,
        outputDir : outputDir, 
        root : undefined,
        relative : undefined,
        ...meta,
    })

    const urlContext = Object.freeze({ 
        content, 
        meta : urlMeta 
    })

    updateRequestContext(urlContext)
    const url = await fnUrl(content, urlMeta)

    if (typeof url !== 'string') 
        throw new Error('url must return a string or Promise<string>, found: ' + url)

    if (!validateUrl(url))
        throw new Error(`invalid permalink "${url}" must start with a "/" and be a valid path (no special characters)`)

    const outputAbsolute = staticpath(url, outputDir)
    const outputFromRoot = outputAbsolute.replace(outputDir, '')
    const toRoot = trailing(
        path.relative(path.dirname(outputAbsolute), outputDir) || '.', 
        '/'
    )

    const pageMeta = Object.freeze({
        ...urlMeta,
        url : url,
        output : outputFromRoot,
        outputDir : outputDir,
        root : toRoot,
        relative : (from: string): string => path.join(toRoot, from)
    })

    const pageContext = Object.freeze({ 
        content, 
        meta : pageMeta 
    })

    updateRequestContext(pageContext)
    const page = await fnHtml(content, pageMeta)
    cleanContext()

    return [url, page]
}


function checkForDuplicates(pageIndex: Index): false {
	const duplicates = pageIndex.duplicates()
	if (duplicates.length > 0) {
		const page = (duplicates.length === 1) ? 'Page' : 'Pages'
		throw new Error(`${page} generated with overlapping permalinks:\n ${duplicates.join('\n')}`)
	}
	return false
}


async function outputDryRun(pageIndex: Index, outputDir: string) : Promise<true> {

	const files: Array<[string, string]> = pageIndex.entries()

	const output = await Promise.all(files.map(async ([ permalink, source ]) => {
		const file = staticpath(permalink, outputDir)
		const write = await canWrite(file)
		return { file, permalink, write }
	}))

	const failed = output.filter(file => !file.write).map(file => file.permalink)

	if (failed.length) 
		throw new Error(`Failed to write files: \n${failed.join('\n')}`)

	return true
}


async function outputFiles(pageIndex: Index, outputDir: string) : Promise<string[]> {
	
	const files: Array<[string, string]> = pageIndex.entries()

	const output = await Promise.all(files.map(async ([ permalink, source ]) => {
		const file = staticpath(permalink, outputDir)
		const rendered = await createFile(outputDir, file, source)
		return { file, permalink, rendered, source }
	}))

	const rendered = output.filter(file => file.rendered).map(file => file.permalink)
	return rendered
}


function consoleRendered(outputs: string[], outputDir: string): void {

	const reset = "\x1b[0m"
	const dim = "\x1b[2m"
	const cyan = "\x1b[36m"
	const plural = (count: number, singular: string, plural: string) => count === 1 ? singular : plural
	
	const displayMax = 12
	let text = `${cyan}${outputs.length || 'No'} ${plural(outputs.length, 'page', 'pages')}${reset} created at ${cyan}${path.relative(process.cwd() ,outputDir)}${reset}`
	
	if (outputs.length <= displayMax) {
		const list = outputs.map(
			url => path.relative(outputDir, staticpath(url, outputDir))
		).join(', ')

		text += ` ${dim}(${list})${reset}`
	}
	
	console.log(text)
}


function pageVars(currentIndex?: number, perPage?: number, totalItems?: number) {

    const orNull = num => (typeof num === 'number' && !Number.isNaN(num)) ? num : null
    const currentPage = orNull(currentIndex + 1)
    const firstPage = orNull(currentPage > 0 ? 1 : null)
    const lastPage = orNull(Math.ceil(totalItems / perPage))
    const previousPage = orNull((currentPage > firstPage) ? currentPage - 1 : null)
    const nextPage = orNull((currentPage < lastPage) ? currentPage + 1 : null)
    const firstIndexOnPage = orNull((currentPage * perPage) - perPage)
    const lastIndexOnPage = orNull(Math.min(totalItems - 1, firstIndexOnPage + perPage - 1))
    const firstItemOnPage = typeof firstIndexOnPage === 'number' ? firstIndexOnPage + 1 : null
    const lastItemOnPage = typeof lastIndexOnPage === 'number' ? lastIndexOnPage + 1 : null

    return {
        currentPage, firstPage, lastPage, previousPage, nextPage, 
        firstIndexOnPage, lastIndexOnPage, firstItemOnPage, lastItemOnPage, 
    }
}


function staticpath(permalink: string, outputDir: string): string {

	const trailingSlash = permalink.endsWith('/')

	// remove / from start of permalink, and make relative
	if (permalink.startsWith('/')) permalink = permalink.replace(/^\//, './')

    const normalizedPath = path.resolve(outputDir, permalink) + (trailingSlash ? '/index.html' : '')
    const relativePath = path.relative(outputDir, normalizedPath)
    const isOutsideOfOutput = relativePath.startsWith('../')

    // don't overwrite anything outside of the project
    if (isOutsideOfOutput)
    	throw new Error(`File path is outside of the output directory:\n${permalink} \n${normalizedPath}`)

    return normalizedPath
}


function validateUrl(permalink: string): boolean {

    const permalinkPattern:RegExp = regexes(
        [
            // just a root path: "/",
            /^\/$|/,
            // or:
                // negative lookahead across pattern
                // to catch likely mistakes
                `^(?!`,
                    // disallow more than double dots everywhere
                    /.*\.{3,}.*|/,
                    // disallow double dots at start of files
                    /.*\.{2,}(?!\/|$)/,
                `)`,
                // start with slash
                /\//,
                // path segment, 1 or more
                `(?:`,
                    // standard limited characters
                    /[a-z0-9-_.]+/,
                    // optional trailing slash
                    /\/?/,
                `)+`,
            // end (discounts ?query, #hash, etc.)
            /$/
        ],
        'i'
    )

    return permalinkPattern.test(permalink)   
}


function fn(x) {
	return isFunction(x) ? x : () => x
}


