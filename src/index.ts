import 'source-map-support/register'
import path from 'path'
import fs from 'fs-extra'
import clearModule from 'clear-module'
import { getRequestContext, updateRequestContext, cleanContext } from 'async-hooks-context'
import { createFile } from './files.js'
import { filehashes, sha1, regexes, isFunction, isIterable, isArray, chunkArray, trailing } from './util.js'


type EntryMap = StringMap | string[]

type DependencyMap = {
	[key: string]: string[]
}

type Template = {
	origin : string,
	importPath : string,
	dependencies : string[],
	hashedDependencies : StringMap,
	compiled? : any,
	valid? : boolean,
	userData? : any
}

type RenderFunction = (content: {}, meta : {}) => string

type PageIndex = {
	add: (key: string, value?: any) => void,
	all: () => { [key: string]: string },
	duplicates: () => string[],
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
	
	global.context = () => getRequestContext()

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
	const pageIndex: PageIndex = createIndex()
	const duplicateErrors: CacheMap = {}	

	try {

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
		await parallel(template => generatePages(template, outputDir, pageIndex))
	
	} catch(error) {
		// avoid duplicate error messages from a shared 
		// dependency used by multiple pages 
		if (!errorIsDuplicated(error, duplicateErrors)) console.log(error)
	}

	// deal with duplicates
	const duplicates = pageIndex.duplicates()
	if (duplicates.length > 0) {

	}

	// output files
	const files: Array<[string, string]> = Object.entries(pageIndex.all())
	const rendered = files.map(async ([ url, source ]) => {
		const outputPath = staticpath(url, outputDir)
		const success = await createFile(outputDir, outputPath, source)
		return success ? url : ""
	})

	// console message
	const outputs: string[] = (await Promise.all(rendered)).filter(Boolean)
	if (!outputs.length) return

	const reset = "\x1b[0m"
	const dim = "\x1b[2m"
	const cyan = "\x1b[36m"

	const plural = (count: number, singular: string, plural: string) => count === 1 ? singular : plural
	
	const displayMax = 10
	let text = `${cyan}${outputs.length || 'No'} ${plural(outputs.length, 'page', 'pages')}${reset} created at ${cyan}${path.relative(process.cwd() ,outputDir)}${reset}`
	
	if (outputs.length <= displayMax) {
		const list = outputs.map(
			url => path.relative(outputDir, staticpath(url, outputDir))
		).join(', ')

		text += ` ${dim}(${list})${reset}`
	}
	
	console.log(text)	
}


function createParallel(array: Array<any>) {
    return async fn => await Promise.all(array.map(fn))
}


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

function createIndex() {

    const index = {}
    const duplicates = []
    const duplicateMap: CacheMap = {}

    const add = (key, value) => {
    	if (duplicateMap[key]) duplicates.push(key)
    	duplicateMap[key] = true
    	index[key] = value
    }

    return {
    	add : add,
    	all : () => index,
        duplicates : () => duplicates,
    }
}


async function generatePages (template: Template, outputDir: string, pageIndex: PageIndex) {
		
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
    cleanContext()

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


function errorIsDuplicated(error: Error, duplicateErrors: CacheMap): boolean {
	const id = sha1(error.message.split('\n').slice(0, 3).join('\n'))
	const exists = duplicateErrors.hasOwnProperty(id)
	duplicateErrors[id] = true
	return exists
}