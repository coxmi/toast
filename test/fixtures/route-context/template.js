import { context } from './../../../dist/index.js'

const timeout = s => new Promise(resolve => setTimeout(resolve, s))

export const collection = async () => {
	await timeout(200)
	return [
		// uses overlapping wait / length times — a crossover shouldn't cause errors in global context
		{ slug : '/', wait : 0, length : 500 },
		{ slug : '/level-1/', wait : 100, length : 400 },
		{ slug : '/level-1/page.html', wait : 200, length : 300 },
		{ slug : '/level-1/level-2/', wait : 250, length : 450 },
		{ slug : '/level-1/level-2/page.html', wait : 100, length : 250 }
	]
}

export const url = async content => {
	await timeout(100)
	return content.slug
}

export const html = async (content, meta) => {
	await timeout(content.wait)
	await timeout(content.length)
	return `<!DOCTYPE html>
	<html>
		<body>
			<h1>${content.slug}</h1>
			${ await AsyncComponent() }
		</body>
	</html>`
}

const AsyncComponent = async () => {
	await timeout(5)
	const { content, meta } = context()
	return `
		<h2>async context variables:</h2>
		<h2>variables</h2>
		<pre>content.slug: ${ content.slug }</pre>
		<pre>meta.output: ${ meta.output }</pre>
		<pre>meta.root: ${ meta.root }</pre>
	`
}