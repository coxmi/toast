
const timeout = s => new Promise(resolve => setTimeout(resolve, s))

export const collection = async () => {
	await timeout(200)
	return [
		{ slug : '/' },
		{ slug : '/level-1/' },
		{ slug : '/level-1/page.html' },
		{ slug : '/level-1/level-2/' },
		{ slug : '/level-1/level-2/page.html' }
	]
}

export const url = async content => {
	await timeout(200)
	return content.slug
}

export const html = async (content, meta) => {
	await timeout(200)
	return `<!DOCTYPE html>
	<html>
		<body>
			<h1>${content.slug}</h1>
			${ await AsyncComponent() }
		</body>
	</html>`
}

const AsyncComponent = async () => {
	await timeout(200)
	const { content, meta } = context()
	return `
		<h2>async context variables:</h2>
		<h2>variables</h2>
		<pre>content.slug: ${ content.slug }</pre>
		<pre>meta.output: ${ meta.output }</pre>
		<pre>meta.root: ${ meta.root }</pre>
	`
}