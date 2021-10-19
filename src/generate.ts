
import fs from 'fs-extra'
import path from 'path'
import { applyHook } from './hooks.js'
import { createPage, staticpath } from './pages.js'
import { isFunction, isIterable, isArray, chunkArray } from './util.js'


type Map = {
    [key: string]: string
}

type AnyFunctionTemp = (...args : any[]) => any


export async function staticGen(outputDir: string, entrypoints: Map, compiledFiles: string[], routes: string[]) {

	const generator = createGenerator(outputDir)

	const processed = await Promise.all(routes.map(async route => {
		const filepath = entrypoints[route]
		if (!filepath) throw new Error(`No module found at "${filepath}"`)
		const compiled = await import(filepath)
		return await processRoute(compiled, generator)
	}))

	// delete all generated js files
	compiledFiles.map(file => fs.remove(file))

	const rendered = generator.outputEntries().map(async output => {
		const [url, source] = output
		const success = await createPage(outputDir, url, source)
		return success ? url : false
	})

	const outputs = (await Promise.all(rendered)).filter(Boolean)
	
	const reset = "\x1b[0m"
	const dim = "\x1b[2m"
	const cyan = "\x1b[36m"
	const plural = (count: number, singular: string, plural: string) => count === 1 ? singular : plural
	const displayMax = 10
	let text = `${cyan}${outputs.length} ${plural(outputs.length, 'page', 'pages')}${reset} created at ${cyan}${path.relative(process.cwd() ,outputDir)}${reset}`
	if (outputs.length <= displayMax) {
		const list = outputs.map(url => path.relative(outputDir, staticpath(url, outputDir))).join(', ')
		text += ` ${dim}(${list})${reset}`
	}
	console.log(text)
}


async function processRoute(route, generator) {

	const messages = []
	if (validateRoute(route) !== true) return false

	const hasSingleProp = route.content !== undefined
	const hasCollectionProp = route.collection !== undefined
	const hasPerPageProp = route.perPage !== undefined
	const isStringUrl = typeof route.url === 'string'
	const isFunctionUrl = isFunction(route.url)
	const isBasic = isStringUrl || (!hasSingleProp && !hasCollectionProp && isFunctionUrl)
	
	// get user-defined functions

	const fnUrl = fn(route.url)
	const fnHtml = fn(route.html)
	const perPage = route.perPage

	// retrieve user-function data and validate
	
	const [collection, content] = await Promise.all([
		fn(route.collection)() ?? null, 
		fn(route.content)() ?? null
	])

	if (hasCollectionProp && !isIterable(collection)) {
		messages.push(`value returned from 'collection' must be iterable`)
	}

	// rendering

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

	return true

	// NOTE:
	// Look into adding hooks before processing:
	// beforeSingle
	// single
	// beforeCollection
	// collection
	// urlconso
	// beforeHtml
	// html
	// e.g.
	// const doSingle = applyHook('beforeSingle', true)
	// const doCollection = applyHook('beforeCollection', true)
}


function createGenerator(outputDir = '') {

	const outputEntries = []
	const duplicateEntries = []
	const duplicateMap = {}

	const leading = (base :string, start: string) :string => {
		return base.startsWith(start) ? base : `${base}${start}`
	}

	const trailing = (base :string, end: string) :string => {
		return base.endsWith(end) ? base : `${base}${end}`
	}

	const rootFrom = url => trailing(path.relative(url, '/') || '.', '/')

	const absoluteFromOutput = url => {
		const absolute = staticpath(url, outputDir)
		const relative = path.relative(outputDir, absolute)
		return path.join('/', relative)
	}

	async function generateSingle(fnUrl : AnyFunctionTemp, fnHtml : AnyFunctionTemp, content = {}, meta = {}) {

		const url = await fnUrl(content, meta)

		// gather metadata
		const pageMeta = {
			url : url,
			output : absoluteFromOutput(url),
			outputDir : outputDir,
			relativeRoot : rootFrom(url),
			...meta,
		}

		const output = await fnHtml(content, pageMeta)
		const single = [url, output]

		if (duplicateMap[url]) duplicateEntries.push(single)
		duplicateMap[url] = true
		outputEntries.push(single)

		return single
	}

	return {
		generate : generateSingle,
		duplicateEntries : () => duplicateEntries,
		outputEntries : () => outputEntries,
	}
}


function validateRoute({ html, url, single, collection, perPage }) : true {

	const messages = []
	const throwEarly = () => messages.length && throws(messages)

	const hasCollectionProp = collection !== undefined
	const isStringUrl = typeof url === 'string'
	
	if (html === undefined) 
		messages.push(`ensure 'html' function is exported`)

	if (url === undefined) 
		messages.push(`ensure 'url' string or function is exported`)

	if (html === undefined || url === undefined) 
		throwEarly()

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

	if (messages.length) throws(messages)
	
	return true
}

function pageVars(currentIndex, perPage, totalItems) {

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

function throws(array: string[]) :void {
	const messages = array
		.map(string => `•\t${string}`)
		.join('\n')
	throw new Error(messages)
}

function fn(x) {
	return isFunction(x) ? x : () => x
} 

function is(x: any, ...types: string[]) : boolean {
	return types.includes(typeof x)
}

