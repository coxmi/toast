import 'source-map-support/register'
import path from 'path'
import fs from 'fs-extra'
import { getRequestContext, updateRequestContext, cleanContext } from 'async-hooks-context'
import clearModule from 'clear-module'
import { applyHook } from './hooks.js'
import { createPage, staticpath } from './pages.js'
import { isFunction, isIterable, isArray, chunkArray } from './util.js'
import crypto from 'crypto'


// types

type StringMap = {
    [key: string]: string
}

type EntryMap = StringMap | string[]

type DependencyMap = {
	[key: string]: string[]
}

type CacheMap = {
	[key: string]: true|undefined
}

type Template = {
	origin : string,
	importPath : string,
	dependencies : string[],
	compiled? : any
}

type RenderFunction = (content: {}, meta : {}) => string


// helpers

function sha1(string: string): string {
	return crypto.createHash('sha1').update(string).digest("hex")
}

async function filehash(path: string): Promise<string> {
	try {
		const contents = await fs.readFile(path, 'utf8')
		return sha1(contents)
	} catch(error) {
		return ""
	}
}

async function filehashes(paths: string[]) : Promise<StringMap> {
	const promises = paths.map(async path => {
		const hash = await filehash(path)
		return [path, hash]
	})
	const entries = await Promise.all(promises)
	return Object.fromEntries(entries)
}

function createParallel(array: Array<any>) {
	return async fn => await Promise.all(array.map(fn))
}

function leading(base: string, start: string): string {
	return base.startsWith(start) ? base : `${base}${start}`
}

function trailing(base: string, end: string): string {
	return base.endsWith(end) ? base : `${base}${end}`
}


// process template

async function importModule(filepath: string): Promise<any> {
	const exists = await fs.pathExists(filepath)
	if (!exists) throw new Error(`No module found at "${filepath}"`)
	clearModule(filepath)
	return await import(filepath)
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

async function userTemplateData(compiled: any): Promise<{ collection: any, content: any}> {

	const hasCollectionProp = compiled.hasOwnProperty('collection')
		
	const [collection, content] = await Promise.all([
		fn(compiled.collection)() ?? undefined, 
		fn(compiled.content)() ?? undefined
	])

	if (hasCollectionProp && !isIterable(collection))
		throw new Error(`value returned from 'collection' must be iterable`)

	return {
		collection, content
	}
}

export async function toast(outputDir: string, entries: EntryMap, dependencies?: DependencyMap) {

	// todo:
		// error logger
		// duplicateErrors: CacheMap = {}

	// intended process:
		// hashPreviousDependencies
		// importTemplate
		// validateTemplate
		// gatherUserData
		// permalinks
		// generatePages
		// checkGenerationErrors
		// checkForDuplicates
		// checkOutputPermissions
		// outputFilesDryRun
		// outputFiles

	// possible hooks:
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
	
	const isEntryMap = !Array.isArray(entries)
	const entrypoints: string[] = isEntryMap ? Object.keys(entries) : [...entries]
	
	const templates: Template[] = entrypoints.map(entrypoint => ({
		origin : entrypoint,
		importPath: isEntryMap ? entries[entrypoint] : entrypoint,
		dependencies: dependencies[entrypoint] || [],
		compiled : undefined,
		hashedDependencies : undefined,
		valid : undefined,
		userData : undefined,
	}))

	const parallel = createParallel(templates)

	// hash dependencies
	await parallel(async template => {
		template.hashedDependencies = await filehashes(template.dependencies)
	})

	// import and validate
	await parallel(async template => {
		const compiled = await importModule(template.importPath)		
		const invalidations = invalidateTemplate(compiled)

		template.compiled = compiled
		template.valid = !invalidations.length
		if (!template.valid)
			throw new Error(`${template.origin}: ${invalidations.join(', ')}`)
	})

	// gather user data
	await parallel(async template => {
		template.userData = await userTemplateData(template.compiled)
	})

	// generate pages
	const generator = createGenerator(outputDir)
	await parallel(async template => {
		
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
			await generator.generate(fnUrl, fnHtml, content, {
				index : null,
				items : null,
				total : null,
				...pageVars()
			})
		}

		if (isIterable(collection) && !hasPerPageProp) {
			await Promise.all([...collection].map(async (item, index, collection) => {
				const pageInfo = pageVars()
				const out = await generator.generate(fnUrl, fnHtml, item, {
					index : index,
					items : collection,
					total : collection.length,
					...pageVars()
				})
			}))
		}

		if (isIterable(collection) && hasPerPageProp) {
			const pages = chunkArray(collection, perPage)
			await Promise.all(pages.map(async (page, pageIndex, allPages) => {
				const pageInfo = pageVars(pageIndex, perPage, collection.length)
				const out = await generator.generate(fnUrl, fnHtml, page, {
					index : null,
					items : collection,
					total : collection.length,
					...pageInfo
				})
			}))
		}
	})

	// output pages
	const rendered = generator.outputEntries().map(async output => {
		const [url, source] = output
		const success = await createPage(outputDir, url, source)
		return success ? url : false
	})

	const outputs = (await Promise.all(rendered)).filter(Boolean)
	if (!outputs.length) return

	const reset = "\x1b[0m"
	const dim = "\x1b[2m"
	const cyan = "\x1b[36m"
	const plural = (count: number, singular: string, plural: string) => count === 1 ? singular : plural
	const displayMax = 10
	let text = `${cyan}${outputs.length || 'No'} ${plural(outputs.length, 'page', 'pages')}${reset} created at ${cyan}${path.relative(process.cwd() ,outputDir)}${reset}`
	if (outputs.length <= displayMax) {
		const list = outputs.map(url => path.relative(outputDir, staticpath(url, outputDir))).join(', ')
		text += ` ${dim}(${list})${reset}`
	}
	console.log(text)	
}


function createGenerator(outputDir: string = '') {

	const outputEntries = []
	const duplicateEntries = []
	const duplicateMap = {}

	global.context = () => getRequestContext()

	async function generateSingle(fnUrl : RenderFunction, fnHtml : RenderFunction, content = {}, meta = {}) {

		const urlMeta = Object.freeze({
			url : undefined,
			output : undefined,
			outputDir : outputDir, 
			root : undefined,
			relative : undefined,
			...meta,
		})

		const urlContext = Object.freeze({ content, meta : urlMeta })
		
		updateRequestContext(urlContext)
		const url = await fnUrl(content, urlMeta)
		cleanContext()

		if (typeof url !== 'string') 
			throw new Error('url must return a string or Promise<string>, found: ' + url)

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

		const pageContext = Object.freeze({ content, meta : pageMeta })

		updateRequestContext(pageContext)

		const page = await fnHtml(content, pageMeta)
		cleanContext()

		const entry = [url, page]
		if (duplicateMap[url]) duplicateEntries.push(entry)
		duplicateMap[url] = true
		outputEntries.push(entry)
		return entry
	}

	return {
		generate : generateSingle,
		duplicateEntries : () => duplicateEntries,
		outputEntries : () => outputEntries,
	}
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

function fn(x) {
	return isFunction(x) ? x : () => x
} 

function errorDedupe(error: Error, duplicateErrors: CacheMap): void {
	// avoid duplicate error messages from a shared 
	// dependency used by multiple pages 
	const id = sha1(error.message.split('\n').slice(0, 3).join('\n'))
	const exists = duplicateErrors[id]
	if (!exists) console.log(error)
	duplicateErrors[id] = true
}