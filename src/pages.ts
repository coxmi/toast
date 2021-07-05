
import path from 'path'
import fs from 'fs-extra'
import { regexes } from './util.js'


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


function validateUrl(permalink: string): boolean {
    return permalinkPattern.test(permalink)   
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


type RenderFunction = () => string

export async function createPage(outputDir: string, id: string, url: string, output: string|RenderFunction) {
    
    if (!validateUrl(url))
        throw new Error(`invalid permalink "${url}" must start with a "/" and be a valid path (no special characters)`)

    const rendered = (typeof output === 'function') ? output() : output
    const outputPath = staticpath(url, outputDir)

    console.log(outputPath, rendered)
}


export async function outputPage(content: string, staticPath:string) {

}