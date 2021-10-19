
import fs from 'fs-extra'
import path from 'path'
import { regexes } from './util.js'

type RenderFunction = () => string

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


export function staticpath(permalink: string, outputDir: string): string {

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


export async function createPage(outputDir: string, url: string, source: string) {
    
    if (!validateUrl(url))
        throw new Error(`invalid permalink "${url}" must start with a "/" and be a valid path (no special characters)`)

    const filePath = staticpath(url, outputDir)
    const pageDir = path.dirname(filePath)
    const hasSource = source !== undefined && source !== '';

    if (!hasSource) 
        throw new Error(`No source sent for file ${path.relative(outputDir, filePath)}`)

    await fs.ensureDir(pageDir).catch(err => {
        if (err.code === 'EEXIST') {
            throw new Error(`Can't create folder "${path.relative(outputDir, pageDir)}" for file "${path.relative(outputDir, filePath)}" because a file with the same name already exists in its path — ensure your permalinks do not cause conflicts, or clear the output directory to remove conflicting files`)
        }
    })

    if (await isDir(filePath)) 
        throw new Error(`Attempted to overwrite directory "${path.relative(outputDir, filePath)}" with an output file — add an extension to your permalink, or clear the output directory to remove conflicting files`)

    try {
        await fs.outputFile(filePath, source)
        return true
    } catch(e) {
        return false
    }
}


async function isDir(file : string) : Promise<boolean> {
    let isDirectory = false
    try { isDirectory = (await fs.stat(file)).isDirectory() } 
    catch { isDirectory = false }
    return isDirectory
}